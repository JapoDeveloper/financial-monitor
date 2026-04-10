import pytest
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.currency_service import CurrencyService

@pytest.fixture
def mock_repo():
    return MagicMock()

@pytest.fixture
def service(mock_repo):
    return CurrencyService(mock_repo)

def test_parse_spanish_date_valid(service):
    date_str = "jueves, 22 de enero de 2026 10:30 a"
    parsed = service._parse_spanish_date(date_str)
    assert parsed == datetime(2026, 1, 22, 10, 30)

def test_parse_spanish_date_pm(service):
    date_str = "viernes, 23 de enero de 2026 02:45 p"
    parsed = service._parse_spanish_date(date_str)
    assert parsed == datetime(2026, 1, 23, 14, 45)

def test_parse_spanish_date_invalid(service):
    date_str = "invalid date"
    parsed = service._parse_spanish_date(date_str)
    # Should return current time, let's just check it's a datetime
    assert isinstance(parsed, datetime)

@pytest.mark.asyncio
async def test_get_rates_from_db(service, mock_repo):
    mock_repo.get_all_exchange_rates = AsyncMock(return_value=[
        {
            "moneda_origen": "USD",
            "moneda_destino": "DOP",
            "valor": 60.5,
            "fecha_actualizacion": datetime(2026, 1, 22, 10, 30)
        }
    ])
    
    rates = await service.get_rates_from_db()
    assert len(rates) == 1
    assert rates[0].moneda_origen == "USD"
    assert rates[0].valor == 60.5

@pytest.mark.asyncio
async def test_update_rates_from_web_success(service, mock_repo):
    # Mock HTML response
    html_content = """
    <table>
        <tr>
            <td>Promedio InfoDolar</td>
            <td>60.10</td>
            <td>61.20</td>
            <td><abbr title="jueves, 22 de enero de 2026 10:30 a">10:30 AM</abbr></td>
        </tr>
    </table>
    """
    
    mock_repo.update_exchange_rate = AsyncMock()
    mock_repo.get_all_exchange_rates = AsyncMock(return_value=[])

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, text=html_content)
        
        await service.update_rates_from_web()
        
        # Verify repo calls
        assert mock_repo.update_exchange_rate.call_count == 2
        # Verify commit
        assert mock_repo.db.commit.called
        # USD -> DOP
        mock_repo.update_exchange_rate.assert_any_call("USD", "DOP", 60.1, datetime(2026, 1, 22, 10, 30))
        # DOP -> USD
        mock_repo.update_exchange_rate.assert_any_call("DOP", "USD", 1.0/60.1, datetime(2026, 1, 22, 10, 30))
