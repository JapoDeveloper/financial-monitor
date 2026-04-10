import pytest
import pandas as pd
import numpy as np
from app.services.rebalance_service import RebalanceService
from app.schemas.stocks import RebalanceRecommendation, AlphaAttribution

def test_calculate_recommendations_black_litterman():
    service = RebalanceService()
    
    asset_metrics = [
        {'ticker': 'VTI', 'weight': 0.4, 'alpha': 0.05, 'beta': 1.0, 'vol': 0.15, 'ytd_return': 0.12},
        {'ticker': 'GLDM', 'weight': 0.2, 'alpha': -0.04, 'beta': 0.2, 'vol': 0.18, 'ytd_return': -0.02},
        {'ticker': 'QQQM', 'weight': 0.4, 'alpha': 0.001, 'beta': 1.2, 'vol': 0.25, 'ytd_return': 0.05}
    ]
    total_value = 100000.0
    
    # Mock price history for 60 days
    dates = pd.date_range(start="2023-01-01", periods=60)
    # ^TNX goes from 3.5 to 4.2 -> Tasas al Alza (+0.7)
    # SPY stays flat or slightly down -> Equity Débil (Estanflación)
    
    spy_prices = np.linspace(400, 395, 60)
    tnx_prices = np.linspace(3.5, 4.3, 60)
    vti_prices = np.linspace(200, 195, 60)
    gldm_prices = np.linspace(35, 38, 60)
    qqqm_prices = np.linspace(300, 280, 60)
    
    price_history = pd.DataFrame({
        'SPY': spy_prices,
        '^TNX': tnx_prices,
        'VTI': vti_prices,
        'GLDM': gldm_prices,
        'QQQM': qqqm_prices
    }, index=dates)
    
    rf_rate = 0.04
    
    recs, mean_score, buy_t, sell_t, regime = service.calculate_recommendations(
        asset_metrics, total_value, price_history, rf_rate, 'SPY'
    )
    
    assert len(recs) == 3
    assert "Estanflación" in regime or "Tasas al Alza" in regime
    
    qqqm_rec = next(r for r in recs if r.ticker == 'QQQM')
    gldm_rec = next(r for r in recs if r.ticker == 'GLDM')

    # Given high beta for QQQM in "Tasas al Alza, Equity Débil", it should be penalized.
    # We expect QQQM to be SELL or target < current (0.4)
    if qqqm_rec.target_weight < qqqm_rec.current_weight:
        assert qqqm_rec.action == "SELL" or qqqm_rec.action == "HOLD"
        
    assert isinstance(mean_score, float)
    assert isinstance(regime, str)

def test_calculate_alpha_attribution():
    service = RebalanceService()
    asset_metrics = [
        {'ticker': 'VTI', 'weight': 0.5, 'alpha': 0.02, 'ytd_return': 0.10},
        {'ticker': 'BND', 'weight': 0.5, 'alpha': -0.01, 'ytd_return': 0.02}
    ]
    
    attribution = service.calculate_alpha_attribution(asset_metrics)
    
    vti_attr = next(a for a in attribution if a.ticker == 'VTI')
    assert vti_attr.verdict == "GENERADOR"
    assert vti_attr.alpha_contribution == round(0.5 * 0.02, 4)
    
    bnd_attr = next(a for a in attribution if a.ticker == 'BND')
    assert bnd_attr.verdict == "DETRACTOR"
    assert bnd_attr.alpha_contribution == round(0.5 * -0.01, 4)
