import pytest
import pandas as pd
from datetime import date

from app.domain.portfolio import calculate_modified_dietz

@pytest.fixture
def sample_portfolio_data():
    """Sample data for testing portfolio calculations."""
    return pd.DataFrame([
        { "periodo": date(2023, 1, 31), "moneda": "USD", "valor_cartera": 10000, "aportes": 0, "retiros": 0, "dividendos": 0, "flujo_ponderado": 0 },
        { "periodo": date(2023, 2, 28), "moneda": "USD", "valor_cartera": 10500, "aportes": 100, "retiros": 0, "dividendos": 50, "flujo_ponderado": 100 * 0.9677 }, # Approx Feb weighted flow
        { "periodo": date(2023, 3, 31), "moneda": "USD", "valor_cartera": 11000, "aportes": 0, "retiros": 200, "dividendos": 0, "flujo_ponderado": -200 * 0.9355 } # Approx Mar weighted flow
    ])

def test_calculate_modified_dietz_empty():
    """Test with an empty DataFrame."""
    df = pd.DataFrame()
    result = calculate_modified_dietz(df)
    assert result.empty

def test_calculate_modified_dietz_basic(sample_portfolio_data):
    """Test basic Modified Dietz calculation."""
    df = sample_portfolio_data
    result = calculate_modified_dietz(df)

    # Expected values (approximate, based on sample data logic)
    # Month 1 (Jan)
    assert result.iloc[0]['v_inicial'] == 0
    assert result.iloc[0]['flujo_neto'] == 0
    assert result.iloc[0]['ganancia_mercado'] == 10000 # Final - Initial - NetFlow = 10000 - 0 - 0
    assert result.iloc[0]['capital_promedio'] == 0
    assert result.iloc[0]['retorno_mensual'] == 0
    assert result.iloc[0]['retorno_acc'] == 0

    # Month 2 (Feb)
    assert abs(result.iloc[1]['v_inicial'] - 10000) < 0.01
    assert result.iloc[1]['flujo_neto'] == 100
    assert abs(result.iloc[1]['ganancia_mercado'] - (10500 - 100 - 10000)) < 0.01
    assert abs(result.iloc[1]['capital_promedio'] - (10000 + 96.77)) < 0.01
    assert abs(result.iloc[1]['retorno_mensual'] - (result.iloc[1]['ganancia_mercado'] / result.iloc[1]['capital_promedio'])) < 0.01
    assert abs(result.iloc[1]['retorno_acc'] - result.iloc[1]['retorno_mensual']) < 0.01

    # Month 3 (Mar)
    assert abs(result.iloc[2]['v_inicial'] - 10500) < 0.01
    assert result.iloc[2]['flujo_neto'] == -200
    assert abs(result.iloc[2]['ganancia_mercado'] - (11000 - (-200) - 10500)) < 0.01
    assert abs(result.iloc[2]['capital_promedio'] - (10500 - 193.55)) < 0.01
    assert abs(result.iloc[2]['retorno_mensual'] - (result.iloc[2]['ganancia_mercado'] / result.iloc[2]['capital_promedio'])) < 0.01
    assert abs(result.iloc[2]['retorno_acc'] - ((1 + result.iloc[1]['retorno_mensual']) * (1 + result.iloc[2]['retorno_mensual']) - 1)) < 0.01

