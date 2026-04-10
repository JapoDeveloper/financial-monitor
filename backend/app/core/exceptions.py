from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse


class FinancialPlatformError(Exception):
    """Base exception for all domain errors."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class TickerNotFoundError(FinancialPlatformError):
    """Raised when a ticker symbol is not found on Yahoo Finance."""

    def __init__(self, ticker: str) -> None:
        super().__init__(
            message=f"Ticker '{ticker}' not found or has no data available.",
            code="TICKER_NOT_FOUND",
        )


class PortfolioNotFoundError(FinancialPlatformError):
    """Raised when a portfolio record does not exist in the database."""

    def __init__(self, portfolio_id: int) -> None:
        super().__init__(
            message=f"Portfolio with id={portfolio_id} not found.",
            code="PORTFOLIO_NOT_FOUND",
        )


class InsufficientDataError(FinancialPlatformError):
    """Raised when there is not enough historical data to compute a metric."""

    def __init__(self, metric: str, required_points: int) -> None:
        super().__init__(
            message=f"Insufficient data to compute '{metric}'. Requires at least {required_points} data points.",
            code="INSUFFICIENT_DATA",
        )


# --------------------------------------------------------------------------- #
# FastAPI Exception Handlers
# --------------------------------------------------------------------------- #


async def financial_platform_exception_handler(
    request: Request, exc: FinancialPlatformError
) -> JSONResponse:
    status_code = status.HTTP_404_NOT_FOUND if "NOT_FOUND" in exc.code else status.HTTP_400_BAD_REQUEST
    return JSONResponse(
        status_code=status_code,
        content={"error": exc.code, "message": exc.message},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
    )
