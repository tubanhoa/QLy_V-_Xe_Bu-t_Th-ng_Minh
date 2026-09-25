"""
Models: Tuyến xe (Route) và Điểm dừng (Stop)

Bảng routes: Lưu thông tin tuyến xe (số hiệu tuyến, tên, điểm đầu/cuối)
Bảng stops: Lưu các điểm dừng/trạm trên hệ thống
Bảng route_stops: Quan hệ nhiều-nhiều, điểm dừng nào thuộc tuyến nào + thứ tự
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    Float, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Stop(Base):
    """Điểm dừng / Trạm xe buýt"""
    __tablename__ = "stops"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="Tên điểm dừng")
    address = Column(String(500), nullable=True, comment="Địa chỉ đầy đủ")
    province = Column(String(100), nullable=False, comment="Tỉnh/Thành phố")
    latitude = Column(Float, nullable=True, comment="Vĩ độ GPS")
    longitude = Column(Float, nullable=True, comment="Kinh độ GPS")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    route_stops = relationship("RouteStop", back_populates="stop")

    def __repr__(self):
        return f"<Stop id={self.id} name={self.name}>"


class Route(Base):
    """Tuyến xe buýt"""
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    route_code = Column(String(20), unique=True, nullable=False, index=True,
                        comment="Mã tuyến, ví dụ: HN-HP-01")
    name = Column(String(300), nullable=False, comment="Tên đầy đủ tuyến xe")
    origin_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False,
                            comment="Điểm xuất phát")
    destination_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False,
                                  comment="Điểm kết thúc")
    distance_km = Column(Float, nullable=True, comment="Khoảng cách (km)")
    duration_minutes = Column(Integer, nullable=True, comment="Thời gian di chuyển (phút)")
    base_price = Column(Float, nullable=False, default=0, comment="Giá vé cơ bản (VND)")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    origin_stop = relationship("Stop", foreign_keys=[origin_stop_id])
    destination_stop = relationship("Stop", foreign_keys=[destination_stop_id])
    route_stops = relationship("RouteStop", back_populates="route",
                               order_by="RouteStop.stop_order")
    trips = relationship("Trip", back_populates="route")

    def __repr__(self):
        return f"<Route id={self.id} code={self.route_code}>"


class RouteStop(Base):
    """Quan hệ nhiều-nhiều: tuyến xe - điểm dừng (với thứ tự và thời gian dừng)"""
    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    route_id = Column(Integer, ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    stop_id = Column(Integer, ForeignKey("stops.id", ondelete="CASCADE"), nullable=False)
    stop_order = Column(Integer, nullable=False, comment="Thứ tự điểm dừng trong tuyến (0-based)")
    arrival_offset_minutes = Column(Integer, default=0, nullable=False,
                                     comment="Phút tính từ giờ khởi hành đến điểm dừng này")
    is_pickup = Column(Boolean, default=True, comment="Điểm đón khách")
    is_dropoff = Column(Boolean, default=True, comment="Điểm trả khách")

    # Relationships
    route = relationship("Route", back_populates="route_stops")
    stop = relationship("Stop", back_populates="route_stops")

    __table_args__ = (
        UniqueConstraint("route_id", "stop_id", name="uq_route_stop"),
        UniqueConstraint("route_id", "stop_order", name="uq_route_stop_order"),
    )

    def __repr__(self):
        return f"<RouteStop route={self.route_id} stop={self.stop_id} order={self.stop_order}>"
