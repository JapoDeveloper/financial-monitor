import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger

from app.db.repositories.legacy_repo import LegacyWimmRepository
from app.schemas.stocks import (
    StocksDashboardResponse, BenchmarkComparison, StockAssetDetail, 
    ManagementDiagnostic, AssetThematicData, AssetHistoryResponse,
    PricePoint, TransactionMarker
)
from app.domain.stocks import calculate_stock_metrics, calculate_weighted_average_price
from app.utils.assets_info_utils import get_asset_thematic_metadata, get_asset_supports_info, get_asset_price_label
from app.services.rebalance_service import RebalanceService

class StocksService:
    def __init__(self, db: AsyncSession):
        self.repo = LegacyWimmRepository(db)
        self.rebalance_service = RebalanceService()
        self.USA_BENCHMARK = 'SPY'
        self.GLOBAL_BENCHMARK = 'VT'
        self.RISK_FREE_SYMBOL = '^TNX'

    async def get_stocks_dashboard(self, user_id: int, macro_regime_override: Optional[str] = None) -> StocksDashboardResponse:
        df_transacciones = await self.repo.get_stocks_transactions(user_id)
        if not df_transacciones.empty:
            # Ensure numeric columns are floats to avoid Decimal/float multiplication errors
            numeric_cols = ['aporte', 'retiro', 'dividendos', 'precio_compra', 'precio_venta', 'cuotas_participacion']
            for col in numeric_cols:
                if col in df_transacciones.columns:
                    df_transacciones[col] = pd.to_numeric(df_transacciones[col], errors='coerce').fillna(0).astype(float)
        
        if df_transacciones.empty:
            return StocksDashboardResponse(
                scorecard=[], diagnostic=ManagementDiagnostic(verdict="N/A", alpha_jensen=0, alpha_label="N/A", note="No data"),
                assets=[], risk_free_rate=0, last_updated=datetime.now()
            )

        my_assets_names = list(df_transacciones['nombre_corto'].unique())
        all_tickers = list(set(my_assets_names + [self.USA_BENCHMARK, self.GLOBAL_BENCHMARK, self.RISK_FREE_SYMBOL]))
        
        # Download market data (1 year)
        all_history = yf.download(all_tickers, period="1y", group_by='ticker', progress=False, auto_adjust=True)
        
        current_year = datetime.now().year
        start_date = pd.Timestamp(f"{current_year}-01-01")

        def get_px_series(ticker):
            try:
                if isinstance(all_history.columns, pd.MultiIndex):
                    return all_history[ticker]['Close']
                return all_history['Close'] if ticker in all_history.columns else pd.Series()
            except:
                return pd.Series()

        # Risk Free Rate
        rf_series = get_px_series(self.RISK_FREE_SYMBOL)
        try:
            risk_free_rate = float(rf_series[rf_series.index >= start_date].mean() / 100) if not rf_series.empty else 0.04
        except:
            risk_free_rate = 0.04
        if np.isnan(risk_free_rate): risk_free_rate = 0.04

        # Benchmarks Returns
        usa_rets = get_px_series(self.USA_BENCHMARK).pct_change(fill_method=None).fillna(0)
        global_rets = get_px_series(self.GLOBAL_BENCHMARK).pct_change(fill_method=None).fillna(0)

        # Portfolio returns calculation
        market_prices = pd.DataFrame({t: get_px_series(t) for t in my_assets_names}).ffill()
        full_idx = market_prices.index.union(df_transacciones['fecha_transaccion'].unique()).sort_values()
        
        # Modified Dietz approach
        holdings = df_transacciones.pivot_table('cuotas_participacion', 'fecha_transaccion', 'nombre_corto', aggfunc='sum').reindex(full_idx).fillna(0).cumsum().reindex(market_prices.index, method='ffill').fillna(0)
        asset_flows = df_transacciones.pivot_table(['aporte', 'retiro'], 'fecha_transaccion', 'nombre_corto', aggfunc='sum').reindex(market_prices.index).fillna(0)
        
        net_asset_inflows = asset_flows['aporte'] - asset_flows['retiro']
        equity_by_asset = holdings * market_prices
        equity = equity_by_asset.sum(axis=1)
        net_inflows = net_asset_inflows.sum(axis=1)
        
        prev_equity = equity.shift(1).fillna(equity.iloc[0] if not equity.empty else 0)
        denom = (prev_equity + 0.5 * net_inflows).replace(0, np.nan)
        port_rets = ((equity - prev_equity - net_inflows) / denom).fillna(0)
        
        # Filter for YTD
        mask_ytd = port_rets.index >= start_date
        port_ytd_s = port_rets[mask_ytd]
        usa_ytd_s = usa_rets[mask_ytd]
        global_ytd_s = global_rets[mask_ytd]

        # Individual assets YTD
        asset_rets_matrix = ((equity_by_asset - equity_by_asset.shift(1).fillna(0) - net_asset_inflows) / (equity_by_asset.shift(1) + 0.5 * net_asset_inflows).replace(0, np.nan)).fillna(0)
        asset_ytd_rets = (1 + asset_rets_matrix[mask_ytd]).prod() - 1
        # ---
        # Unified Market Portfolio YTD: weight-adjusted sum of individual market returns
        # This is the market-pure view of the portfolio (no flow distortion)
        # ---
        curr_weights = equity_by_asset.iloc[-1] / equity.iloc[-1] if equity.iloc[-1] > 0 else pd.Series(0, index=my_assets_names)

        # Construct market returns and cached YTD early (needed by scorecard)
        price_history_for_optimization = pd.DataFrame({t: get_px_series(t) for t in all_tickers}).ffill()
        market_rets = price_history_for_optimization.pct_change(fill_method=None).fillna(0)
        market_ytd_rets = (1 + market_rets[mask_ytd]).prod() - 1

        # Weight-adjusted market portfolio return series: Σ(w_i * r_i,t)
        market_port_rets_ytd = pd.Series(0.0, index=market_rets[mask_ytd].index)
        for tkr in my_assets_names:
            if tkr in market_rets.columns:
                w = float(curr_weights.get(tkr, 0.0))
                market_port_rets_ytd = market_port_rets_ytd + w * market_rets[tkr][mask_ytd]

        market_port_ytd_scalar = float((1 + market_port_rets_ytd).prod() - 1)

        # Scorecard (Benchmark is VT/Global)
        metrics_p_twr = calculate_stock_metrics(port_ytd_s,         global_ytd_s,   risk_free_rate)
        metrics_p_mkt = calculate_stock_metrics(market_port_rets_ytd, global_ytd_s, risk_free_rate)
        metrics_spy   = calculate_stock_metrics(usa_ytd_s,          global_ytd_s,   risk_free_rate)
        metrics_vt    = calculate_stock_metrics(global_ytd_s,       pd.Series(),    risk_free_rate)

        scorecard = [
            BenchmarkComparison(
                strategy="Mi Portafolio", 
                ytd=market_port_ytd_scalar,           # Standardized: ytd = market performance
                ytd_twr=metrics_p_twr['ytd'],         # TWR: investor experience
                volatility=metrics_p_mkt['vol'], 
                sharpe=metrics_p_mkt['sharpe'], 
                beta=metrics_p_mkt['beta'],
                # Comparisons are always market vs market
                vs_spy=market_port_ytd_scalar - metrics_spy['ytd'],
                vs_vt=market_port_ytd_scalar - metrics_vt['ytd']
            ),
            BenchmarkComparison(
                strategy="SPY (USA)", 
                ytd=metrics_spy['ytd'], 
                ytd_twr=None,
                volatility=metrics_spy['vol'], 
                sharpe=metrics_spy['sharpe'], 
                beta=metrics_spy['beta'],
                vs_spy=0,
                vs_vt=metrics_spy['ytd'] - metrics_vt['ytd']
            ),
            BenchmarkComparison(
                strategy="VT (Global)", 
                ytd=metrics_vt['ytd'], 
                ytd_twr=None,
                volatility=metrics_vt['vol'], 
                sharpe=metrics_vt['sharpe'], 
                beta=1.0, 
                vs_spy=metrics_vt['ytd'] - metrics_spy['ytd'], 
                vs_vt=0
            )
        ]

        # Diagnostic — dual alpha
        n_days_p = metrics_p_twr['n_days']
        alpha_label       = 'Ann' if n_days_p >= 120 else f'Acum {n_days_p}d'
        alpha_market_label = 'Ann' if metrics_p_mkt['n_days'] >= 120 else f'Acum {metrics_p_mkt["n_days"]}d'

        total_val_current = float(equity.iloc[-1]) if not equity.empty else 0.0
        total_invested_portfolio = 0.0
        for ticker in my_assets_names:
            asset_ops = df_transacciones[df_transacciones['nombre_corto'] == ticker]
            avg_buy_p = calculate_weighted_average_price(asset_ops)
            q = float(holdings[ticker].iloc[-1])
            total_invested_portfolio += avg_buy_p * q

        if metrics_p_twr['alpha'] > 0.02: verdict = "EXCELENTE (Generando Alpha)"
        elif metrics_p_twr['alpha'] > 0: verdict = "BUENA (Alpha Positivo)"
        elif metrics_p_twr['alpha'] > -0.02: verdict = "MEJORABLE (Neutral/Casi Neutral)"
        else: verdict = "CRÍTICA (Underperform vs Beta)"
        
        diagnostic = ManagementDiagnostic(
            verdict=verdict,
            alpha_jensen=metrics_p_twr['alpha'],
            alpha_market=metrics_p_mkt['alpha'],
            alpha_label=alpha_label,
            alpha_market_label=alpha_market_label,
            total_invested=total_invested_portfolio,
            current_value=total_val_current,
            note="Jensen Alpha: exceso de retorno ajustado por Beta vs VT. TWR Modified Dietz (w=0.5). Mercado: portafolio market-puro ponderado."
        )

        # Assets list & Individual Alpha Calculation
        assets_list = []
        asset_metrics_for_attribution = []

        # Current weights for rebalancing later
        curr_weights_map = curr_weights.to_dict()

        for ticker in my_assets_names:
            try:
                tk_info = yf.Ticker(ticker).info
                thematic = get_asset_thematic_metadata(tk_info)
            except:
                thematic = {'focus': 'N/A', 'niche': 'N/A', 'region_spec': 'N/A'}
            
            # Individual Asset Alpha metrics
            a_rets = market_rets[ticker][mask_ytd] if ticker in market_rets.columns else pd.Series()
            a_metrics = calculate_stock_metrics(a_rets, global_ytd_s, risk_free_rate)
            
            # Per-asset TWR YTD (Modified Dietz, accounts for cash flows — investor experience)
            a_ytd_twr = float(asset_ytd_rets[ticker]) if ticker in asset_ytd_rets.index and np.isfinite(asset_ytd_rets[ticker]) else 0.0

            # Classification Logic: Industry Standard Institutional Thresholds
            r2 = a_metrics.get('r_squared', 0.0)
            te = a_metrics.get('tracking_error', 0.0)
            rv = a_metrics.get('rel_vol', 1.0)
            
            is_core_equity = (0.75 <= rv <= 1.15) and (r2 >= 0.55)
            is_core_fixed_income = (te < 0.9) and (r2 >= 0.80)
            is_satellite = (rv >= 1.05) and (te >= 0.03 or r2 < 0.75)
            is_diversifier = (r2 < 0.55) and (rv < 1.05)

            classification = "N/D"
            if is_core_equity or is_core_fixed_income:
                classification = "Core"
            elif is_satellite: 
                classification = "Satellite"
            elif is_diversifier:
                classification = "Diversifier"

            logger.info(f"{ticker} ({classification}): R-Squared={r2}, TrackingError={te}, RelativeVolatility={rv}")

            # Current weight
            w = float(curr_weights.get(ticker, 0.0))

            # Prices for the dashboard list
            asset_ops = df_transacciones[df_transacciones['nombre_corto'] == ticker]
            avg_buy_p = calculate_weighted_average_price(asset_ops)
            curr_p = float(market_prices[ticker].iloc[-1]) if ticker in market_prices.columns and not market_prices[ticker].empty else 0.0

            assets_list.append(StockAssetDetail(
                ticker=ticker,
                name=ticker, 
                weight=w,
                ytd_return=float(market_ytd_rets[ticker]) if ticker in market_ytd_rets and np.isfinite(market_ytd_rets[ticker]) else 0.0,
                ytd_twr=a_ytd_twr,
                current_value=float(equity_by_asset[ticker].iloc[-1]) if np.isfinite(equity_by_asset[ticker].iloc[-1]) else 0.0,
                current_price=curr_p,
                average_buy_price=float(avg_buy_p),
                thematic=AssetThematicData(
                    focus=thematic['focus'], niche=thematic['niche'], region=thematic['region_spec']
                ),
                classification=classification,
                r_squared=r2,
                tracking_error_ann=te,
                relative_volatility=rv
            ))
            
            asset_metrics_for_attribution.append({
                'ticker': ticker,
                'weight': w,
                'ytd_return': float(market_ytd_rets[ticker]) if ticker in market_ytd_rets and np.isfinite(market_ytd_rets[ticker]) else 0.0,
                'alpha': a_metrics['alpha'],
                'beta': a_metrics['beta'],
                'vol': a_metrics['vol']
            })
        
        assets_list.sort(key=lambda x: x.weight, reverse=True)

        # Rebalancing & Attribution
        def sanitize_float(v):
            if np.isnan(v) or np.isinf(v): return 0.0
            return float(v)

        current_holdings_vals = {t: sanitize_float(equity_by_asset[t].iloc[-1]) for t in my_assets_names if t in equity_by_asset.columns}
        total_p_val = sanitize_float(equity.iloc[-1]) if not equity.empty else 0.0
        
        # Call rebalancing with enriched metrics and historical prices for Black-Litterman
        rebalancing_recommendations, tactical_mean_score, buy_threshold, sell_threshold, macro_regime = self.rebalance_service.calculate_recommendations(
            asset_metrics_for_attribution, 
            total_p_val, 
            price_history_for_optimization, 
            risk_free_rate, 
            benchmark_ticker=self.USA_BENCHMARK,
            macro_regime_override=macro_regime_override
        )
        alpha_attribution = self.rebalance_service.calculate_alpha_attribution(asset_metrics_for_attribution)

        # ── 5.5 Distribution Core vs Satellite ──────────────────
        core_sat_dist = {}
        for a in assets_list:
            if a.classification in core_sat_dist:
                core_sat_dist[a.classification] += a.weight
            else:
                core_sat_dist[a.classification] = 0.0

        # Normalize to 100% just in case of rounding
        total_w = sum(core_sat_dist.values())
        if total_w > 0:
            core_sat_dist = {k: sanitize_float(v / total_w) for k, v in core_sat_dist.items()}

        # ── 6. Historial Normalizado (Base 100) ──────────────────
        portfolio_history_data = []
        if not all_history.empty and my_assets_names:
            price_df = pd.DataFrame()
            for ticker in my_assets_names:
                series = get_px_series(ticker)
                if not series.empty:
                    price_df[ticker] = series
            
            if not price_df.empty:
                # Forward fill to handle gaps, then drop rows where any asset hasn't started yet
                price_df = price_df.ffill().dropna()
                if not price_df.empty:
                    # First row is the base (100)
                    first_prices = price_df.iloc[0].replace(0, np.nan)
                    normalized = (price_df / first_prices) * 100
                    normalized = normalized.ffill().fillna(100.0)
                    
                    for d, row in normalized.iterrows():
                        point = {"date": d.strftime("%Y-%m-%d")}
                        for ticker, val in row.items():
                            point[ticker] = sanitize_float(val)
                        portfolio_history_data.append(point)
                    
        # Final Response Sanitization
        scorecard_sanitized = [
            BenchmarkComparison(
                strategy=s.strategy, 
                ytd=sanitize_float(s.ytd),
                ytd_twr=sanitize_float(s.ytd_twr) if s.ytd_twr is not None else None,
                volatility=sanitize_float(s.volatility),
                sharpe=sanitize_float(s.sharpe), 
                beta=sanitize_float(s.beta),
                vs_spy=sanitize_float(s.vs_spy), 
                vs_vt=sanitize_float(s.vs_vt)
            ) for s in scorecard
        ]

        return StocksDashboardResponse(
            scorecard=scorecard_sanitized, 
            diagnostic=ManagementDiagnostic(
                verdict=diagnostic.verdict, 
                alpha_jensen=sanitize_float(diagnostic.alpha_jensen),
                alpha_market=sanitize_float(diagnostic.alpha_market),
                alpha_label=diagnostic.alpha_label,
                alpha_market_label=diagnostic.alpha_market_label,
                total_invested=sanitize_float(diagnostic.total_invested),
                current_value=sanitize_float(diagnostic.current_value),
                note=diagnostic.note
            ), 
            assets=[
                StockAssetDetail(
                    ticker=a.ticker, name=a.name, weight=sanitize_float(a.weight),
                    ytd_return=sanitize_float(a.ytd_return),
                    ytd_twr=sanitize_float(a.ytd_twr),
                    current_value=sanitize_float(a.current_value),
                    current_price=sanitize_float(a.current_price),
                    average_buy_price=sanitize_float(a.average_buy_price),
                    thematic=a.thematic,
                    classification=a.classification,
                    r_squared=sanitize_float(a.r_squared),
                    tracking_error_ann=sanitize_float(a.tracking_error_ann),
                    relative_volatility=sanitize_float(a.relative_volatility)
                ) for a in assets_list
            ],
            risk_free_rate=sanitize_float(risk_free_rate), last_updated=datetime.now(),
            portfolio_history=portfolio_history_data,
            rebalancing_recommendations=rebalancing_recommendations,
            alpha_attribution=alpha_attribution,
            tactical_mean_score=sanitize_float(tactical_mean_score),
            tactical_buy_threshold=sanitize_float(buy_threshold),
            tactical_sell_threshold=sanitize_float(sell_threshold),
            macro_regime=macro_regime,
            core_satellite_distribution=core_sat_dist
        )

    async def get_asset_history(self, user_id: int, ticker: str, period: Optional[str] = None) -> AssetHistoryResponse:
        df_transacciones = await self.repo.get_stocks_transactions(user_id)
        if not df_transacciones.empty:
            # Ensure numeric columns are floats to avoid Decimal/float multiplication errors
            numeric_cols = ['aporte', 'retiro', 'dividendos', 'precio_compra', 'precio_venta', 'cuotas_participacion']
            for col in numeric_cols:
                if col in df_transacciones.columns:
                    df_transacciones[col] = pd.to_numeric(df_transacciones[col], errors='coerce').fillna(0).astype(float)
        
        asset_ops = df_transacciones[df_transacciones['nombre_corto'] == ticker]
        
        if asset_ops.empty:
            raise ValueError(f"No transactions found for asset {ticker}")

        tk = yf.Ticker(ticker)
        
        # Decide which history to fetch
        if period and period != "since_entry":
            # Map standard frontend names to yfinance if needed
            yf_period = period 
            hist = tk.history(period=yf_period, auto_adjust=True)
        else:
            # Original logic: Since first transaction - 30 days
            start_date = asset_ops['fecha_transaccion'].min() - pd.Timedelta(days=30)
            hist = tk.history(start=start_date, auto_adjust=True)
        
        if hist.empty:
            raise ValueError(f"No market data found for ticker {ticker}")

        price_col = get_asset_price_label(hist)
        
        # Prepare history points
        history_points = [
            PricePoint(date=d.to_pydatetime().date(), price=float(p))
            for d, p in zip(hist.index, hist[price_col])
        ]

        # Prepare transactions
        transactions = []
        for _, row in asset_ops.iterrows():
            t_type = 'buy' if row.aporte > 0 else 'sell'
            monto = row.aporte if row.aporte > 0 else row.retiro
            transactions.append(TransactionMarker(
                date=row.fecha_transaccion.date(),
                price=float(row.precio_compra if t_type == 'buy' else row.precio_venta),
                type=t_type,
                monto=float(monto)
            ))

        avg_buy_price = calculate_weighted_average_price(asset_ops)
        curr_price = float(hist[price_col].iloc[-1])
        price_diff_perc = ((curr_price - avg_buy_price) / avg_buy_price) if avg_buy_price > 0 else 0

        # Technical info (rolling history for supports)
        # We need a bit more history for supports
        full_hist_for_sup = tk.history(period="1y", auto_adjust=True)
        # Mocking all_history_data format for the helper
        mock_hist = pd.concat({ticker: full_hist_for_sup}, axis=1)
        supports = get_asset_supports_info(ticker, mock_hist)

        return AssetHistoryResponse(
            ticker=ticker,
            history=history_points,
            transactions=transactions,
            average_buy_price=float(avg_buy_price),
            current_price=curr_price,
            price_diff_perc=float(price_diff_perc),
            **supports
        )
