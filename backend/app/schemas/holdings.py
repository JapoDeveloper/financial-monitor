from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

class AssetHolding(BaseModel):
    """Represents a single asset holding."""
    instrumento: str
    clase: str
    sub_tipo: str
    moneda: str
    valor_ajustado: float
    peso_meta: float
    
class InvestmentDistribution(BaseModel):
    """Aggregate distribution data."""
    criterio: str
    nombre: str
    total_valor: float
    total_valor_nominal: Optional[float] = None

class VariableIncomeData(BaseModel):
    """Data for variable income comparison."""
    instrumento: str
    valor_actual: float
    meta_objetivo: float

class HoldingsReport(BaseModel):
    """Full holdings report."""
    distribucion_moneda: List[InvestmentDistribution]
    distribucion_institucion: List[InvestmentDistribution]
    distribucion_plazo: List[InvestmentDistribution]
    distribucion_clase: List[InvestmentDistribution]
    renta_variable: List[VariableIncomeData]
    # Treemap data could be complex, keeping it flexible as a list of dicts
    treemap_data: List[dict]

class ProfitabilityTrendPoint(BaseModel):
    """A single data point in a profitability trend."""
    model_config = ConfigDict(populate_by_name=True)

    month: str
    yield_value: float = Field(..., alias="yield")

class ProfitabilityInstrumentSerie(BaseModel):
    """A series of profitability data points for an instrument."""
    instrument: str
    type_instrument: str
    asset_class: str
    data: List[ProfitabilityTrendPoint]

class ProfitabilityEvolutionReport(BaseModel):
    """Full report for profitability evolution over a year."""
    year: int
    currency: str
    series: List[ProfitabilityInstrumentSerie]
    weighted_average: List[ProfitabilityTrendPoint]

class CagrPerformanceItem(BaseModel):
    """A single item in the CAGR performance table."""
    instrument: str
    currency: str
    weight: float
    cagr_30d: Optional[float] = None
    cagr_90d: Optional[float] = None
    cagr_180d: Optional[float] = None
    cagr_1y: Optional[float] = None
    cagr_3y: Optional[float] = None
    cagr_5y: Optional[float] = None
