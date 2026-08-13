import pandas as pd
import numpy as np
from datetime import date
from typing import Dict

def calculate_modified_dietz(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates portfolio performance using the Modified Dietz method.
    
    Expected columns in df:
    - periodo: date
    - valor_cartera: float (End of period value)
    - aportes: float
    - retiros: float
    - dividendos: float
    - flujo_ponderado: float (Time-weighted cash flows)
    """
    if df.empty:
        return df

    g = df.copy().sort_values('periodo')
    
    # Financial Logic
    g['v_inicial'] = g['valor_cartera'].shift(1).fillna(0)
    g['flujo_neto'] = g['aportes'] - g['retiros']
    
    # Gain = End Value - (Initial Value + Net Cash Flow)
    g['ganancia_mercado'] = np.where(
    g['valor_cartera'] != g['v_inicial'],
    g['valor_cartera'] - g['flujo_neto'] - g['v_inicial'],
    0
)
    
    # Capital Promedio = Initial Value + Weighted Cash Flows
    g['capital_promedio'] = g['v_inicial'] + g['flujo_ponderado']
    
    # Monthly Return
    g['retorno_mensual'] = np.where(
        g['capital_promedio'] > 0, 
        (g['ganancia_mercado'] / g['capital_promedio']) * 100, 
        0.0
    )
    
    # Accumulated Return: (1 + r1)*(1 + r2)... - 1
    # Note: Using decimal for calculation then converting to percentage
    g['retorno_acc'] = (((1 + (g['retorno_mensual'] / 100)).cumprod()) - 1) * 100
    
    return g
