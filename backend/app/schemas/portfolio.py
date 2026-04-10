from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class PerformancePeriod(BaseModel):
    """Represents a single month's performance data."""
    period: date
    v_inicial: float
    flujo_neto: float
    ganancia_mercado: float
    valor_cartera: float
    retorno_mensual: float
    retorno_acc: float

class PortfolioSummary(BaseModel):
    """Summary metrics for a given year."""
    total_gain: float
    annual_return: float
    current_value: float

class YearlyPerformanceData(BaseModel):
    """Summary and breakdown for a specific currency."""
    summary: PortfolioSummary
    monthly_breakdown: list[PerformancePeriod]

class YearlyPerformance(BaseModel):
    """Full performance report for a year, grouped by currency."""
    year: int
    data_by_currency: dict[str, YearlyPerformanceData]

class HistoricalReturn(BaseModel):
    """Annual return for a specific year, containing returns for all currencies."""
    year: int
    returns_by_currency: dict[str, float]
