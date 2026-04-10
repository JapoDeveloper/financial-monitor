from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.portfolio_holdings_service import PortfolioHoldingsService
from app.schemas.holdings import HoldingsReport, ProfitabilityEvolutionReport, CagrPerformanceItem
from typing import List

router = APIRouter()

@router.get("/holdings", response_model=HoldingsReport)
async def get_holdings(db: AsyncSession = Depends(get_db)):
    # Mocking user_id = 1 as per notebook pattern
    user_id = 1
    service = PortfolioHoldingsService(db)
    return await service.get_holdings(user_id=user_id)

@router.get("/profitability-evolution", response_model=ProfitabilityEvolutionReport)
async def get_profitability_evolution(
    year: int = Query(..., description="The year to analysis"),
    currency: str = Query(..., description="Currency code (e.g. DOP, USD)"),
    db: AsyncSession = Depends(get_db)
):
    user_id = 1
    service = PortfolioHoldingsService(db)
    return await service.get_profitability_evolution(user_id=user_id, year=year, currency=currency)

@router.get("/cagr-performance", response_model=List[CagrPerformanceItem])
async def get_cagr_performance(db: AsyncSession = Depends(get_db)):
    user_id = 1
    service = PortfolioHoldingsService(db)
    return await service.get_cagr_performance(user_id=user_id)
