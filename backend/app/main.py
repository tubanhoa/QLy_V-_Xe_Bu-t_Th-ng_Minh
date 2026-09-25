"""
FastAPI Application Entry Point — Smart Bus Ticketing System

Cấu hình:
  - CORS: Cho phép tất cả origins trong môi trường dev
  - Exception handlers: Bắt ValidationError và trả JSON chuẩn
  - Routers: Đăng ký tất cả API routers
  - Startup: Tạo bảng DB nếu chưa có
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.database import engine
from app.api.v1 import api_router

# Import models để SQLAlchemy biết cần tạo bảng nào
import app.models  # noqa: F401


# ──────────────────────────────────────────────
# Lifespan: khởi tạo DB khi app start
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Tạo các bảng DB khi ứng dụng khởi động (nếu chưa tồn tại)"""
    from app.models import Base
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready.")
    yield
    print("👋 Shutting down...")


# ──────────────────────────────────────────────
# App instance
# ──────────────────────────────────────────────

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="""
## 🚌 Smart Bus Ticketing System — API

### Tính năng Sprint 1:
- **Tìm kiếm chuyến xe**: Tìm theo điểm đi, điểm đến, ngày, số hành khách
- **Danh sách điểm dừng**: Cung cấp dữ liệu cho dropdown Frontend

### Cách dùng:
1. Xem docs tại `/docs` (Swagger UI) hoặc `/redoc`
2. Test endpoint `POST /api/v1/search/trips` với body JSON
3. Hoặc dùng `GET /api/v1/search/trips?origin=Hà Nội&destination=Hải Phòng&departure_date=2026-09-26`
""",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ──────────────────────────────────────────────
# CORS Middleware
# ──────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Dev: cho phép tất cả origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Exception Handlers — trả JSON nhất quán
# ──────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Bắt lỗi validation Pydantic, trả JSON thân thiện"""
    errors = []
    for error in exc.errors():
        field = " → ".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({
            "field": field or "unknown",
            "message": error["msg"],
            "input": error.get("input"),
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Dữ liệu đầu vào không hợp lệ. Vui lòng kiểm tra lại.",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Bắt tất cả lỗi không mong đợi"""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "Lỗi hệ thống nội bộ. Vui lòng thử lại sau.",
            "detail": str(exc) if settings.APP_DEBUG else None,
        },
    )


# ──────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# ──────────────────────────────────────────────
# Root endpoint
# ──────────────────────────────────────────────

@app.get("/", include_in_schema=False)
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "docs": "/docs",
        "redoc": "/redoc",
        "api_prefix": settings.API_V1_PREFIX,
    }
