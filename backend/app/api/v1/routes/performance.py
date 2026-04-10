from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.performance_service import PerformanceService
from app.schemas.performance import InstrumentInfo, PerformanceRequest, PerformanceResponse
from app.core.logging import logger

router = APIRouter()

@router.get("/instruments", response_model=List[InstrumentInfo])
async def get_active_instruments(db: AsyncSession = Depends(get_db)):
    """
    Returns a list of active investment instruments for the current user.
    """
    user_id = 1  # Default user_id as per project pattern
    service = PerformanceService(db)
    return await service.get_active_instruments(user_id=user_id)

@router.post("/calculate", response_model=PerformanceResponse)
async def calculate_performance(
    request: PerformanceRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculates performance metrics for a specific instrument and period.
    """
    user_id = 1  # Default user_id as per project pattern
    service = PerformanceService(db)
    try:
        return await service.calculate_performance(
            user_id=user_id,
            instrument_id=request.instrument_id,
            year=request.year,
            month=request.month,
            div_period=request.dividend_period_months,
            manual_price=request.manual_price
        )
    except ValueError as e:
        logger.error(f"Validation Error in calculate_performance: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected Error in calculate_performance: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
