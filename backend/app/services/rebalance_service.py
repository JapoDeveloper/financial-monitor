import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from app.schemas.stocks import RebalanceRecommendation, AlphaAttribution

class RebalanceService:
    def __init__(self):
        pass

    def detect_macro_regime(self, rf_series: pd.Series, spy_series: pd.Series) -> str:
        """
        Detects the macroeconomic regime based on the 10Y Treasury Yield (^TNX) and SPY.
        Returns a string describing the regime.
        """
        if rf_series.empty or spy_series.empty or len(rf_series) < 60:
            return "Neutral (Datos Insuficientes)"
            
        # Compare current vs 3 months ago (approx 60 trading days)
        rf_current = rf_series.iloc[-1]
        rf_past = rf_series.iloc[-60]
        
        spy_current = spy_series.iloc[-1]
        spy_past = spy_series.iloc[-60]
        
        yield_change = rf_current - rf_past
        spy_return = (spy_current - spy_past) / spy_past
        
        if yield_change > 0.5 and spy_return > 0:
            return "Crecimiento Caliente (Tasas al Alza, Equity Fuerte)"
        elif yield_change > 0.5 and spy_return <= 0:
            return "Estanflación / Contracción de Múltiplos (Tasas al Alza, Equity Débil)"
        elif yield_change < -0.5 and spy_return <= 0:
            return "Recesión / Vuelo a la Calidad (Tasas a la Baja, Equity Débil)"
        elif yield_change < -0.5 and spy_return > 0:
            return "Ricitos de Oro / Relajación (Tasas a la Baja, Equity Fuerte)"
        else:
            return "Régimen Estable / Neutral"

    def generate_macro_views(self, regime: str, asset_metrics: List[Dict[str, Any]]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Generates P (Pick matrix), Q (View values matrix), and Omega (Confidence) for Black-Litterman
        based on the detected macro regime.
        """
        n_assets = len(asset_metrics)
        P = []
        Q = []
        
        # We form absolute views based on the regime, tilting by asset Beta.
        # In a real institutional context, we map sectors. Here we use Beta as a proxy for risk/growth correlation.
        
        for i, m in enumerate(asset_metrics):
            beta = m.get('beta', 1.0)
            view_vector = np.zeros(n_assets)
            view_vector[i] = 1.0
            
            # Base expectation
            view_return = 0.0
            add_view = False
            
            # Map beta to absolute views so that ANY change in regime shifts the equilibrium
            if "Tasas al Alza" in regime and "Equity Fuerte" in regime:
                view_return = 0.04 * beta
                add_view = True
            elif "Tasas al Alza" in regime and "Equity Débil" in regime:
                # Penalty for high beta, reward for low beta (defensive)
                view_return = -0.05 * beta + 0.02 * (1.0 / max(beta, 0.5))
                add_view = True
            elif "Tasas a la Baja" in regime and "Equity Débil" in regime:
                # Recession: strong penalty for high beta, strong reward for safe havens
                view_return = -0.08 * beta + 0.05 * (1.0 / max(beta, 0.5))
                add_view = True
            elif "Tasas a la Baja" in regime and "Equity Fuerte" in regime or "Relajación" in regime:
                # Goldilocks/Easing: huge reward for high beta
                view_return = 0.06 * beta
                add_view = True
            elif "Estable" in regime or "Neutral" in regime:
                # No views, defer to CAPM
                add_view = False
            elif "Maximizar Alpha" in regime:
                # Custom User Contribution Scenario: Alpha + Momentum
                alpha_val = m.get('alpha', 0.0)
                ytd_val = m.get('ytd_return', 0.0)
                # Composite Score: Quality (Alpha) heavily weighted, Momentum (YTD) as a 20% modifier
                view_return = alpha_val + (ytd_val * 0.2)
                add_view = True
            else:
                # Fallback if manual text doesn't exactly match
                add_view = False
            
            # Just an example of adding a view
            if add_view:
                P.append(view_vector)
                Q.append(view_return)
                
        if not P:
            # If no specific views, return empty matrices
            return np.array([]), np.array([]), np.array([])
            
        P = np.array(P)
        Q = np.array(Q).reshape(-1, 1)
        # Omega is diagonal matrix of confidence (variance of views). Smaller = higher confidence.
        # Proportional to P * Sigma * P.T usually, but we simplify.
        tau = 0.05
        Omega = np.eye(len(Q)) * 0.02 
        
        return P, Q, Omega

    def _black_litterman_optimization(
        self, 
        asset_metrics: List[Dict[str, Any]], 
        cov_matrix: pd.DataFrame, 
        rf_rate: float,
        regime: str
    ) -> Dict[str, float]:
        """
        Calculates the Black-Litterman target weights. 
        """
        assets = [m['ticker'] for m in asset_metrics]
        n_assets = len(assets)
        if n_assets == 0 or cov_matrix.empty:
            return {m['ticker']: m['weight'] for m in asset_metrics}
            
        # Align covariance matrix
        try:
            Sigma = cov_matrix.loc[assets, assets].values * 252 # Annualized
        except KeyError:
            # Fail gracefully fallback to current weights
            return {m['ticker']: m['weight'] for m in asset_metrics}

        delta_risk_aversion = 2.5
        
        # 1. True Black-Litterman Prior: Reverse Optimization of Current Weights
        # This asserts that the "Market" equilibrium is the user's current portfolio (or Benchmark).
        # This prevents the model from dropping assets to 0% just because their historical Beta is low.
        W_eq = np.array([max(m.get('weight', 0.0), 0.0001) for m in asset_metrics])
        
        # Normalize sum
        if np.sum(W_eq) > 0:
            W_eq = W_eq / np.sum(W_eq)
            
        Pi = delta_risk_aversion * (Sigma @ W_eq)
        Pi = Pi.reshape(-1, 1)
        
        # Note: We add rf_rate later when deriving excess returns, or we just operate in excess return space.
        # Pi calculated here is Excess Return (E[R] - Rf).
            
        # 2. Get Views based on Macro Regime (Now interpreted as Shifts from Pi)
        P, Q_shifts, Omega = self.generate_macro_views(regime, asset_metrics)
        
        tau = 0.05 # Scaling factor for uncertainty of the prior
        
        if len(P) > 0:
            P = np.array(P)
            Q_shifts = np.array(Q_shifts).reshape(-1, 1)
            
            # CONVERSION TO RELATIVE VIEWS: 
            # We treat the Q_shifts array from generate_macro_views as Deltas over the Equilibrium Return (Pi)
            # This prevents aggressive purging to 0% by centering the model on Pi
            Q_absolute = (P @ Pi) + Q_shifts
            
            # Omega is already a diagonal matrix from generate_macro_views, no need for np.diag(Omega)
            # Scale of uncertainty
            tau = 0.05
            
            # Information matrix
            M_inverse = np.linalg.inv(tau * Sigma)
            
            # Black-Litterman posterior returns
            posterior_returns = np.linalg.inv(M_inverse + P.T @ np.linalg.inv(Omega) @ P) @ (M_inverse @ Pi + P.T @ np.linalg.inv(Omega) @ Q_absolute)
        else:
            posterior_returns = Pi
            
        # 3. Derive implied target weights from posterior returns
        # W_opt = (delta * Sigma)^-1 * (posterior_returns - rf_rate)
        # delta = risk aversion parameter ~ 2.5
        delta_risk_aversion = 2.5
        
        try:
            Sigma_inv = np.linalg.inv(Sigma)
            # W_opt = (delta * Sigma)^-1 * posterior_returns 
            # (since posterior returns are already in excess return space)
            W_opt_unscaled = Sigma_inv @ posterior_returns / delta_risk_aversion
        except np.linalg.LinAlgError:
            return {m['ticker']: m['weight'] for m in asset_metrics}

        # Set a rigid floor to prevent Mean-Variance from purging out perfectly safe assets to 0.0
        # A structural minimum of 1.5% preserves basic diversification.
        W_opt = np.maximum(W_opt_unscaled, 0.015).flatten()
        
        # Normalize weights so they sum to 1
        if np.sum(W_opt) > 0:
            W_opt = W_opt / np.sum(W_opt)
        else:
            # Fallback to equal weight if math breaks down completely
            W_opt = np.ones(n_assets) / n_assets
            
        # 5. Respect max capping to avoid concentration risk (FEA requirement)
        MAX_WEIGHT = 0.35
        while np.any(W_opt > MAX_WEIGHT):
            # Cap at 35% and redistribute
            excess = np.sum(W_opt[W_opt > MAX_WEIGHT] - MAX_WEIGHT)
            W_opt[W_opt > MAX_WEIGHT] = MAX_WEIGHT
            mask_under = W_opt < MAX_WEIGHT
            if np.any(mask_under):
                sum_under = np.sum(W_opt[mask_under])
                if sum_under > 0:
                    W_opt[mask_under] += excess * (W_opt[mask_under] / sum_under)
                else:
                    W_opt[mask_under] += excess / np.sum(mask_under)
            else:
                break
                
        return {assets[i]: W_opt[i] for i in range(n_assets)}

    def calculate_recommendations(
        self, 
        asset_metrics: List[Dict[str, Any]], 
        total_value: float,
        price_history: pd.DataFrame,
        rf_rate: float,
        benchmark_ticker: str = 'SPY',
        macro_regime_override: str = None
    ) -> tuple[List[RebalanceRecommendation], float, float, float, str]:
        """
        Generates tactical rebalancing recommendations using Black-Litterman 
        dynamically adjusted by the Macro Regime.
        """
        recommendations = []
        if not asset_metrics or total_value <= 0 or price_history.empty:
            return [], 0.0, 0.0, 0.0, "Desconocido"

        # 1. Identify Macro Regime
        rf_series = price_history.get('^TNX', pd.Series())
        spy_series = price_history.get(benchmark_ticker, pd.Series())
        regime = macro_regime_override if macro_regime_override else self.detect_macro_regime(rf_series, spy_series)
        
        # Calculate daily returns for Covariance
        returns_df = price_history.pct_change().dropna()
        cov_matrix = returns_df.cov()

        # 2. Optimize Weights via Black-Litterman
        target_weights = self._black_litterman_optimization(asset_metrics, cov_matrix, rf_rate, regime)

        # 3. Create Recommendations mapping
        for asset in asset_metrics:
            ticker = asset['ticker']
            curr_w = asset['weight']
            
            target_w = target_weights.get(ticker, curr_w)
            
            # Apply Tethering Bounds: Don't allow a single rebalance to swing more than 10%
            max_swing = 0.10
            if target_w - curr_w > max_swing:
                target_w = curr_w + max_swing
            elif curr_w - target_w > max_swing:
                target_w = curr_w - max_swing
                
            # Ignore micro-adjustments (< 1%)
            if abs(target_w - curr_w) < 0.01:
                target_w = curr_w
                
            actual_delta = target_w - curr_w
            
            if actual_delta > 0.01:
                action = "BUY"
                rationale = f"Incrementar peso (Alpha táctico o Régimen Macro: {regime}). Modelo Black-Litterman sugiere {target_w:.1%}."
            elif actual_delta < -0.01:
                action = "SELL"
                rationale = f"Reducir peso (Riesgo marginal alto o Régimen Macro desfavorable). Modelo Black-Litterman sugiere {target_w:.1%}."
            else:
                action = "HOLD"
                rationale = f"Mantener posición. Peso óptimo ({target_w:.1%}) en línea con nivel actual de riesgo y entorno macro."

            recommendations.append(RebalanceRecommendation(
                ticker=ticker,
                current_weight=round(curr_w, 4),
                target_weight=round(target_w, 4),
                delta_weight=round(actual_delta, 4),
                action=action,
                estimated_trade_value=round(actual_delta * total_value, 2),
                rationale=rationale
            ))
            
        recommendations.sort(key=lambda x: abs(x.delta_weight), reverse=True)
        
        # Backward compatibility for Tactical widgets -> these values are arbitrary now
        mean_score = 1.0 
        buy_threshold = 1.1
        sell_threshold = 0.9
        
        return recommendations, float(mean_score), float(buy_threshold), float(sell_threshold), regime

    def calculate_alpha_attribution(
        self, 
        asset_metrics: List[Dict[str, Any]]
    ) -> List[AlphaAttribution]:
        """
        Maintains Alpha Attribution metric logic.
        """
        attribution = []
        for m in asset_metrics:
            ticker = m['ticker']
            weight = m['weight']
            alpha_contrib = m.get('alpha', 0.0) * weight
            
            verdict = "Neutral"
            if alpha_contrib > 0.001: verdict = "GENERADOR"
            elif alpha_contrib < -0.001: verdict = "DETRACTOR"
            
            attribution.append(AlphaAttribution(
                ticker=ticker,
                alpha_contribution=round(alpha_contrib, 4),
                return_contribution=round(m['ytd_return'] * weight, 4),
                risk_contribution=round(weight, 4), # Simplified
                verdict=verdict
            ))
            
        attribution.sort(key=lambda x: x.alpha_contribution, reverse=True)
        return attribution
