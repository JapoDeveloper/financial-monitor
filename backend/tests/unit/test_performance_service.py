import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.performance_service import PerformanceService
from app.schemas.performance import InstrumentInfo

@pytest.fixture
def mock_db():
    return AsyncMock()

@pytest.fixture
def performance_service(mock_db):
    return PerformanceService(mock_db)

@pytest.mark.asyncio
async def test_get_active_instruments(performance_service, mock_db):
    # Mock database response
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [
        MagicMock(id=1, nombre="Test Inst", alias="TEST", meses_dividendo=3, institucion="Bank A", cuotas_participacion=10.0, sub_clase="Sub A"),
        MagicMock(id=2, nombre="Stock B", alias="STKB", meses_dividendo=0, institucion="Broker B", cuotas_participacion=5.0, sub_clase="Activos / Acciones")
    ]
    mock_db.execute.return_value = mock_result

    instruments = await performance_service.get_active_instruments(user_id=1)
    
    assert len(instruments) == 2
    assert instruments[0].nombre == "Test Inst"
    assert instruments[1].sub_clase == "Activos / Acciones"
    assert instruments[1].meses_dividendo == 0 # Based on CASE logic in service

@pytest.mark.asyncio
async def test_calculate_performance_manual(performance_service, mock_db):
    # Mock instruments list
    performance_service.get_active_instruments = AsyncMock(return_value=[
        InstrumentInfo(id=20, nombre="Inst 20", meses_dividendo=12, institucion="Bank X", cuotas_participacion=1.0, sub_clase="Other")
    ])
    
    # Mock transaction data query
    mock_result = MagicMock()
    mock_result.fetchone.return_value = MagicMock(Vi=100000.0, F_Neto=5000.0, F_Pond=2500.0, Div_Monto=1000.0)
    mock_db.execute.return_value = mock_result
    
    response = await performance_service.calculate_performance(
        user_id=1, instrument_id=20, year=2024, month=1, div_period=12, manual_price=110000.0
    )
    
    assert response.results.capital_inicial == 100000.0
    assert response.results.capital_final == 110000.0
    assert response.results.flujos_netos == 5000.0
    # Gain Total = 110000 - 100000 - 5000 = 5000
    assert response.results.ganancia_total == 5000.0
    # Denominator = 100000 + 2500 = 102500
    # ROI = 5000 / 102500 * 100 = 4.878
    assert abs(response.results.roi_mensual - 4.878) < 0.01

@patch("app.services.performance_service.get_assets_last_price_for_period")
@pytest.mark.asyncio
async def test_calculate_performance_stock_auto(mock_get_price, performance_service, mock_db):
    # Mock instruments list
    performance_service.get_active_instruments = AsyncMock(return_value=[
        InstrumentInfo(id=30, nombre="Apple", alias="AAPL", meses_dividendo=3, institucion="Broker", cuotas_participacion=10.0, sub_clase="Activos / Acciones")
    ])
    
    # Mock Yahoo Finance price
    mock_get_price.return_value = {"AAPL": {"price": 200.0, "date": "2024-02-29"}}
    
    # Mock transaction data query
    mock_result = MagicMock()
    mock_result.fetchone.return_value = MagicMock(Vi=1800.0, F_Neto=0.0, F_Pond=0.0, Div_Monto=20.0)
    mock_db.execute.return_value = mock_result
    
    response = await performance_service.calculate_performance(
        user_id=1, instrument_id=30, year=2024, month=2, div_period=3
    )
    
    # Final Value = 200.0 * 10.0 = 2000.0
    assert response.results.capital_final == 2000.0
    assert response.results.ganancia_total == 200.0 # 2000 - 1800 - 0
    assert response.results.roi_mensual == pytest.approx((200 / 1800) * 100, abs=1e-4)
