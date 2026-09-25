-- ============================================================
-- Smart Bus Ticketing System — Database Schema (MySQL)
-- Sprint 1: Tìm kiếm tuyến/chuyến xe
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_bus_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smart_bus_db;

-- ────────────────────────────────────────
-- Bảng: stops (Điểm dừng / Trạm xe buýt)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stops (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(200) NOT NULL COMMENT 'Tên điểm dừng',
    address     VARCHAR(500) NULL COMMENT 'Địa chỉ đầy đủ',
    province    VARCHAR(100) NOT NULL COMMENT 'Tỉnh/Thành phố',
    latitude    FLOAT NULL COMMENT 'Vĩ độ GPS',
    longitude   FLOAT NULL COMMENT 'Kinh độ GPS',
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_stops_province (province),
    INDEX idx_stops_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Điểm dừng / Trạm xe buýt';

-- ────────────────────────────────────────
-- Bảng: buses (Xe buýt)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buses (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    license_plate   VARCHAR(20) NOT NULL UNIQUE COMMENT 'Biển số xe',
    bus_type        ENUM('standard','sleeper','limousine') NOT NULL DEFAULT 'standard',
    total_seats     INT NOT NULL COMMENT 'Tổng số ghế',
    manufacturer    VARCHAR(100) NULL COMMENT 'Hãng sản xuất',
    model           VARCHAR(100) NULL COMMENT 'Model xe',
    year            INT NULL COMMENT 'Năm sản xuất',
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_buses_license (license_plate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Xe buýt / Xe khách';

-- ────────────────────────────────────────
-- Bảng: seats (Ghế xe)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seats (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    bus_id      INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL COMMENT 'Mã ghế: A1, B2...',
    seat_type   ENUM('standard','vip','sleeper') NOT NULL DEFAULT 'standard',
    floor       INT NOT NULL DEFAULT 1 COMMENT 'Tầng 1 hoặc 2',
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
    UNIQUE KEY uq_bus_seat (bus_id, seat_number),
    INDEX idx_seats_bus (bus_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ghế xe';

-- ────────────────────────────────────────
-- Bảng: routes (Tuyến xe)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    route_code              VARCHAR(20) NOT NULL UNIQUE COMMENT 'Mã tuyến: HN-HP-01',
    name                    VARCHAR(300) NOT NULL COMMENT 'Tên đầy đủ tuyến',
    origin_stop_id          INT NOT NULL COMMENT 'Điểm xuất phát',
    destination_stop_id     INT NOT NULL COMMENT 'Điểm kết thúc',
    distance_km             FLOAT NULL COMMENT 'Khoảng cách (km)',
    duration_minutes        INT NULL COMMENT 'Thời gian di chuyển (phút)',
    base_price              FLOAT NOT NULL DEFAULT 0 COMMENT 'Giá vé cơ bản (VND)',
    description             TEXT NULL,
    is_active               TINYINT(1) NOT NULL DEFAULT 1,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (origin_stop_id) REFERENCES stops(id),
    FOREIGN KEY (destination_stop_id) REFERENCES stops(id),
    INDEX idx_routes_code (route_code),
    INDEX idx_routes_origin (origin_stop_id),
    INDEX idx_routes_dest (destination_stop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tuyến xe buýt';

-- ────────────────────────────────────────
-- Bảng: route_stops (Điểm dừng trên tuyến)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_stops (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    route_id                INT NOT NULL,
    stop_id                 INT NOT NULL,
    stop_order              INT NOT NULL COMMENT 'Thứ tự điểm dừng (0-based)',
    arrival_offset_minutes  INT NOT NULL DEFAULT 0 COMMENT 'Số phút từ giờ khởi hành',
    is_pickup               TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Điểm đón',
    is_dropoff              TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Điểm trả',
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE,
    UNIQUE KEY uq_route_stop (route_id, stop_id),
    UNIQUE KEY uq_route_stop_order (route_id, stop_order),
    INDEX idx_rs_route (route_id),
    INDEX idx_rs_stop (stop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Điểm dừng theo tuyến';

-- ────────────────────────────────────────
-- Bảng: trips (Chuyến xe)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    route_id        INT NOT NULL,
    bus_id          INT NOT NULL,
    departure_time  DATETIME NOT NULL COMMENT 'Giờ khởi hành',
    arrival_time    DATETIME NOT NULL COMMENT 'Giờ dự kiến đến nơi',
    total_seats     INT NOT NULL COMMENT 'Tổng ghế chuyến',
    available_seats INT NOT NULL COMMENT 'Ghế còn trống',
    price           FLOAT NOT NULL COMMENT 'Giá vé (VND)',
    status          ENUM('scheduled','boarding','in_transit','completed','cancelled')
                    NOT NULL DEFAULT 'scheduled' COMMENT 'Trạng thái chuyến',
    driver_name     VARCHAR(200) NULL COMMENT 'Tên tài xế',
    notes           TEXT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id),
    FOREIGN KEY (bus_id) REFERENCES buses(id),
    INDEX idx_trips_route (route_id),
    INDEX idx_trips_departure (departure_time),
    INDEX idx_trips_status (status),
    -- Index tổng hợp cho query tìm kiếm chuyến xe (route + ngày)
    INDEX idx_trips_search (route_id, departure_time, status, available_seats)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Chuyến xe cụ thể';
