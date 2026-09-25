"""
Model: Ghế xe (Seat)

Lưu danh sách ghế của từng xe, gồm mã ghế, loại ghế (thường/VIP/giường).
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class SeatType(str, enum.Enum):
    STANDARD = "standard"    # Ghế thường
    VIP = "vip"              # Ghế VIP
    SLEEPER = "sleeper"      # Giường nằm


class Seat(Base):
    """Ghế xe"""
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    bus_id = Column(Integer, ForeignKey("buses.id", ondelete="CASCADE"), nullable=False)
    seat_number = Column(String(10), nullable=False, comment="Mã ghế, vd: A1, B2, 01")
    seat_type = Column(Enum(SeatType), nullable=False, default=SeatType.STANDARD)
    floor = Column(Integer, default=1, comment="Tầng (1 hoặc 2 cho xe 2 tầng)")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    bus = relationship("Bus", back_populates="seats")

    def __repr__(self):
        return f"<Seat bus={self.bus_id} number={self.seat_number}>"
