import numpy as np
import pandas as pd
from typing import Dict, Any

def calculate_modified_dietz_metrics(
    valor_inicial: float,
    valor_final: float,
    flujos_netos: float,
    flujos_ponderados: float,
    dividendos: float,
    factor_anualizacion: float = 12.0
) -> Dict[str, float]:
    """
    Calculates the performance metrics based on the Modified Dietz method.
    
    Args:
        valor_inicial: Initial market value (Vi).
        valor_final: Final market value (Vf).
        flujos_netos: Total net cash flows (A + R + D).
        flujos_ponderados: Time-weighted cash flows.
        dividendos: Total dividends received.
        factor_anualizacion: Periods per year (default 12 for monthly).
        
    Returns:
        Dict with metrics (ROI_Mensual, TEA, Yield_Anual, Ganancia_Capital, Ganancia_Total).
    """
    # Ganancia de Capital = Vf - Vi - (F_Neto + Div)
    ganancia_capital = valor_final - valor_inicial - (flujos_netos + dividendos)
    
    # Ganancia Total (P&L) = Vf - Vi - F_Neto
    ganancia_total = valor_final - valor_inicial - flujos_netos
    
    # Denominador Dietz = Vi + Σ(Fi * Wi)
    denominador_dietz = valor_inicial + flujos_ponderados
    
    if denominador_dietz == 0:
        return {
            "valor_inicial": valor_inicial,
            "flujos_netos": flujos_netos,
            "dividendos_recibidos": dividendos,
            "valor_final": valor_final,
            "ganancia_capital": ganancia_capital,
            "ganancia_total": ganancia_total,
            "roi_mensual": 0.0,
            "tea": 0.0,
            "div_yield_ann": 0.0
        }

    # ROI Mensual (as percentage)
    roi_mensual = (ganancia_total / denominador_dietz) * 100
    
    # TEA (Annualized return as percentage)
    tea = ((1 + (ganancia_total / denominador_dietz))**12 - 1) * 100
    
    # Div. Yield Anual (as percentage)
    yield_anual = (dividendos / denominador_dietz) * factor_anualizacion * 100
    
    return {
        "valor_inicial": valor_inicial,
        "flujos_netos": flujos_netos,
        "dividendos_recibidos": dividendos,
        "valor_final": valor_final,
        "ganancia_capital": round(ganancia_capital, 2),
        "ganancia_total": round(ganancia_total, 2),
        "roi_mensual": round(roi_mensual, 4),
        "tea": round(tea, 4),
        "div_yield_ann": round(yield_anual, 4)
    }
