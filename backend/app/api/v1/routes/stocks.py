from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.services.stocks_service import StocksService
from app.schemas.stocks import StocksDashboardResponse, AssetHistoryResponse

router = APIRouter()

@router.get("/dashboard", response_model=StocksDashboardResponse)
async def get_stocks_dashboard(macro_regime_override: str = None, db: AsyncSession = Depends(get_db)):
    """
    Returns the full dashboard data for stock investments.
    """
    user_id = 1  # Default user_id as per project pattern
    service = StocksService(db)
    try:
        return await service.get_stocks_dashboard(user_id, macro_regime_override)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating stocks dashboard: {str(e)}")

@router.get("/asset/{ticker}/history", response_model=AssetHistoryResponse)
async def get_asset_history(ticker: str, period: str = None, db: AsyncSession = Depends(get_db)):
    """
    Returns historical price data and transaction markers for a specific asset.
    """
    user_id = 1  # Default user_id as per project pattern
    service = StocksService(db)
    try:
        return await service.get_asset_history(user_id, ticker, period)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching asset history: {str(e)}")
