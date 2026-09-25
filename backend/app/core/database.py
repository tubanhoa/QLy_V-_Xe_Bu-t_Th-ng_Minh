from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings


# Tạo engine kết nối MySQL
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # Kiểm tra kết nối trước mỗi request
    pool_recycle=3600,        # Tái sử dụng kết nối sau 1 giờ
    pool_size=10,             # Số kết nối tối đa trong pool
    max_overflow=20,          # Số kết nối mở rộng thêm khi pool đầy
    echo=settings.APP_DEBUG,  # Log SQL queries khi debug
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Base class cho tất cả ORM models
class Base(DeclarativeBase):
    pass


def get_db():
    """
    Dependency injection: trả về DB session cho mỗi request.
    Tự động đóng session sau khi request hoàn thành.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
