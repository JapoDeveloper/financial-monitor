from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import (
    FinancialPlatformError,
    financial_platform_exception_handler,
    unhandled_exception_handler,
)
from app.core.logging import logger
from app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown hooks."""
    logger.info(
        "🚀 Starting Financial Platform API | env=%s | version=%s",
        settings.app_env,
        settings.app_version,
    )
    yield
    logger.info("👋 Financial Platform API shutting down.")

def create_application() -> FastAPI:
    """Application factory — creates and configures the FastAPI instance."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Financial dashboards API",
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Exception Handlers ---
    app.add_exception_handler(FinancialPlatformError, financial_platform_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # --- Routes ---
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/api/v1/health")
    async def health_check():
        return {"status": "ok", "message": "Financial Platform API is running."}

    return app

app = create_application()
