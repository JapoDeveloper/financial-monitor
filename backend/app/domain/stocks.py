import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Tuple

def calculate_stock_metrics(
    rets_series: pd.Series, 
    market_rets_series: pd.Series, 
    risk_free_rate: float,
    min_days_annualize: int = 120
) -> Dict[str, float]:
    """
    Calculates key risk/return metrics: YTD, Volatility, Sharpe, Beta, Jensen's Alpha.
    """
    if rets_series.empty:
        return {"ytd": 0.0, "vol": 0.0, "sharpe": 0.0, "beta": 0.0, "alpha": 0.0, "n_days": 0}

    n_days = len(rets_series)
    total_ret = (1 + rets_series).prod() - 1
    vol = float(rets_series.std() * np.sqrt(252))
    ann_ret = (1 + total_ret)**(252/n_days) - 1
    sharpe = (ann_ret - risk_free_rate) / vol if vol > 0 else 0
    beta, jensen_alpha = 0.0, 0.0
    r_squared, tracking_error, rel_vol = 0.0, 0.0, 1.0
    
    if not market_rets_series.empty:
        common_idx = market_rets_series.index.intersection(rets_series.index)
        if len(common_idx) > 20:
            r_b, m_b = rets_series.loc[common_idx], market_rets_series.loc[common_idx]
            
            # Beta calculation
            cov_matrix = np.cov(r_b, m_b)
            beta = cov_matrix[0, 1] / cov_matrix[1, 1] if cov_matrix[1, 1] > 0 else 1.0
            
            # R-Squared
            corr = np.corrcoef(r_b, m_b)[0, 1]
            r_squared = corr**2 if np.isfinite(corr) else 0.0
            
            # Tracking Error (Annualized)
            active_ret = r_b - m_b
            tracking_error = active_ret.std() * np.sqrt(252)
            
            # Relative Volatility
            m_vol = m_b.std() * np.sqrt(252)
            rel_vol = vol / m_vol if m_vol > 0 else 1.0
            
            # Alpha calculation
            m_alpha_window = market_rets_series.loc[rets_series.index]
            if n_days >= min_days_annualize:
                ann_market_ret = (1 + (1 + m_alpha_window).prod() - 1)**(252/n_days) - 1
                jensen_alpha = (ann_ret - risk_free_rate) - beta * (ann_market_ret - risk_free_rate)
            else:
                mkt_cum = (1 + m_alpha_window).prod() - 1
                rf_period = risk_free_rate * (n_days / 252)
                jensen_alpha = (total_ret - rf_period) - beta * (mkt_cum - rf_period)
            
    return {
        "ytd": float(total_ret) if np.isfinite(total_ret) else 0.0,
        "vol": float(vol) if np.isfinite(vol) else 0.0,
        "sharpe": float(sharpe) if np.isfinite(sharpe) else 0.0,
        "beta": float(beta) if np.isfinite(beta) else 0.0,
        "alpha": float(jensen_alpha) if np.isfinite(jensen_alpha) else 0.0,
        "r_squared": float(r_squared) if np.isfinite(r_squared) else 0.0,
        "tracking_error": float(tracking_error) if np.isfinite(tracking_error) else 0.0,
        "rel_vol": float(rel_vol) if np.isfinite(rel_vol) else 1.0,
        "n_days": int(n_days)
    }

def calculate_weighted_average_price(df_ops: pd.DataFrame) -> float:
    """
    Calculates the weighted average purchase price for an asset.
    """
    compras = df_ops[df_ops['aporte'] > 0]
    if not compras.empty:
        return compras['aporte'].sum() / (compras['aporte'] / compras['precio_compra']).sum()
    return 0.0
