from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class InstrumentInfo(BaseModel):
    id: int
    nombre: str
    alias: Optional[str] = None
    meses_dividendo: int
    institucion: str
    cuotas_participacion: float
    sub_clase: str
    moneda: str

class PerformanceRequest(BaseModel):
    year: int
    month: int
    instrument_id: int
    dividend_period_months: int
    manual_price: Optional[float] = None  # User inputs the single unit price (cuota)

class PerformanceResults(BaseModel):
    capital_inicial: float
    flujos_netos: float
    dividendos_recibidos: float
    capital_final: float
    ganancia_capital: float
    ganancia_total: float
    roi_mensual: float
    tea: float
    div_yield_ann: float

class DividendEvent(BaseModel):
    date: str
    amount: float

class DividendComparison(BaseModel):
    has_dividend: bool
    events: List[DividendEvent]
    is_registered: bool

class PerformanceResponse(BaseModel):
    instrument: InstrumentInfo
    year: int
    month: int
    calculated_price: float # The unit price used (either manual or fetched)
    price_date: Optional[str] = None # The date of the price used
    dividend_info: Optional[DividendComparison] = None # Info about dividends found in Yahoo Finance vs results
    results: PerformanceResults
