"""
Model: Xe buýt (Bus)

Lưu thông tin xe buýt: biển số, loại xe, số ghế, trạng thái hoạt động.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class BusType(str, enum.Enum):
    STANDARD = "standard"    # Xe ghế thường
    SLEEPER = "sleeper"      # Xe giường nằm
    LIMOUSINE = "limousine"  # Xe limousine


class Bus(Base):
    """Xe buýt / Xe khách"""
    __tablename__ = "buses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    license_plate = Column(String(20), unique=True, nullable=False, index=True,
                           comment="Biển số xe")
    bus_type = Column(Enum(BusType), nullable=False, default=BusType.STANDARD,
                      comment="Loại xe")
    total_seats = Column(Integer, nullable=False, comment="Tổng số ghế")
    manufacturer = Column(String(100), nullable=True, comment="Hãng sản xuất")
    model = Column(String(100), nullable=True, comment="Model xe")
    year = Column(Integer, nullable=True, comment="Năm sản xuất")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    trips = relationship("Trip", back_populates="bus")
    seats = relationship("Seat", back_populates="bus", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Bus id={self.id} plate={self.license_plate}>"
