from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date, datetime
 
class RebalanceRecommendation(BaseModel):
    ticker: str
    current_weight: float
    target_weight: float
    delta_weight: float
    action: str  # 'BUY', 'SELL', 'HOLD'
    estimated_trade_value: float
    rationale: str

class AlphaAttribution(BaseModel):
    ticker: str
    alpha_contribution: float
    return_contribution: float
    risk_contribution: float
    verdict: str

class AssetThematicData(BaseModel):
    focus: str
    niche: str
    region: str

class StockAssetDetail(BaseModel):
    ticker: str
    name: str
    weight: float
    ytd_return: float       # Market YTD: pure price return (no flow distortion)
    ytd_twr: float = 0.0   # TWR YTD: Modified Dietz adjusted for cash flows
    current_value: float
    current_price: float = 0.0
    average_buy_price: float = 0.0
    thematic: AssetThematicData
    classification: str     # 'Core' or 'Satellite'
    r_squared: float = 0.0
    tracking_error_ann: float = 0.0
    relative_volatility: float = 0.0

class BenchmarkComparison(BaseModel):
    strategy: str
    ytd: float                        # Market YTD: pure price return (no flow distortion)
    ytd_twr: Optional[float] = None   # TWR YTD: Modified Dietz adjusted for cash flows
    market_ytd: Optional[float] = None   # [DEPRECATED] use ytd for market-puro
    volatility: float
    sharpe: float
    beta: float
    vs_spy: float
    vs_vt: float

class ManagementDiagnostic(BaseModel):
    verdict: str
    alpha_jensen: float       # TWR-based Jensen Alpha (investor experience)
    alpha_market: float       # Market-weighted Alpha (asset quality, pure market)
    alpha_label: str
    alpha_market_label: str
    total_invested: float = 0.0
    current_value: float = 0.0
    note: str

class StocksDashboardResponse(BaseModel):
    scorecard: List[BenchmarkComparison]
    diagnostic: ManagementDiagnostic
    assets: List[StockAssetDetail]
    risk_free_rate: float
    last_updated: datetime
    portfolio_history: List[Dict[str, Any]] = Field(default_factory=list)
    rebalancing_recommendations: List[RebalanceRecommendation] = Field(default_factory=list)
    alpha_attribution: List[AlphaAttribution] = Field(default_factory=list)
    tactical_mean_score: float = 0.0
    tactical_buy_threshold: float = 0.0
    tactical_sell_threshold: float = 0.0
    macro_regime: str = "Desconocido"
    core_satellite_distribution: Dict[str, float] = Field(default_factory=dict)

class TransactionMarker(BaseModel):
    date: date
    price: float
    type: str  # 'buy' or 'sell'
    monto: float

class PricePoint(BaseModel):
    date: date
    price: float

class AssetHistoryResponse(BaseModel):
    ticker: str
    history: List[PricePoint]
    transactions: List[TransactionMarker]
    average_buy_price: float
    current_price: float
    price_diff_perc: float
    support: Optional[float] = None
    resistance: Optional[float] = None
    dist_to_support: Optional[float] = None
    dist_to_resistance: Optional[float] = None
