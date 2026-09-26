-- =======================================================
-- SMART BUS TICKETING SYSTEM - ICTU
-- PostgreSQL 16 + PostGIS Complete Database Schema
-- =======================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone_number VARCHAR(15),
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    avatar_url VARCHAR(500),
    student_id VARCHAR(50),
    faculty VARCHAR(100),
    id_card_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    refresh_token_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 3. Routes
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    origin VARCHAR(200) NOT NULL,
    destination VARCHAR(200) NOT NULL,
    distance_km DECIMAL(10,2),
    base_price DECIMAL(12,0) NOT NULL,
    student_price DECIMAL(12,0),
    operating_start TIME,
    operating_end TIME,
    frequency_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Stations
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    address VARCHAR(300),
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    location GEOGRAPHY(Point, 4326),
    is_hub BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Route Stations
CREATE TABLE IF NOT EXISTS route_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id),
    stop_order INTEGER NOT NULL,
    distance_from_origin_km DECIMAL(10,2),
    estimated_minutes INTEGER,
    UNIQUE(route_id, station_id),
    UNIQUE(route_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_route_stations_route ON route_stations(route_id);

-- 6. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_plate VARCHAR(15) UNIQUE NOT NULL,
    model VARCHAR(100),
    vehicle_type VARCHAR(20) DEFAULT 'electric',
    seat_capacity INTEGER NOT NULL DEFAULT 28,
    manufacture_year INTEGER,
    battery_capacity_kwh DECIMAL(5,1),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Seats
CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    seat_number VARCHAR(5) NOT NULL,
    row_number INTEGER NOT NULL,
    column_label VARCHAR(1) NOT NULL,
    seat_type VARCHAR(20) DEFAULT 'standard',
    floor_number INTEGER DEFAULT 1,
    UNIQUE(vehicle_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_seats_vehicle ON seats(vehicle_id);

-- 8. Trips
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES users(id),
    conductor_id UUID REFERENCES users(id),
    departure_time TIMESTAMPTZ NOT NULL,
    arrival_time TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_departure ON trips(departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- 9. Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(12,2) NOT NULL,
    min_order_value DECIMAL(12,0) DEFAULT 0,
    max_discount_amount DECIMAL(12,0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    usage_limit INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code VARCHAR(30) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    trip_id UUID NOT NULL REFERENCES trips(id),
    voucher_id UUID REFERENCES vouchers(id),
    total_amount DECIMAL(12,0) NOT NULL,
    discount_amount DECIMAL(12,0) DEFAULT 0,
    final_amount DECIMAL(12,0) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    booking_time TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 11. Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id),
    ticket_code VARCHAR(30) UNIQUE NOT NULL,
    qr_data TEXT,
    qr_signature_hash VARCHAR(128),
    passenger_name VARCHAR(100) NOT NULL,
    passenger_phone VARCHAR(15),
    original_price DECIMAL(12,0) NOT NULL,
    discount_price DECIMAL(12,0),
    status VARCHAR(20) DEFAULT 'reserved',
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_booking ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- 12. Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    payment_method VARCHAR(20) NOT NULL,
    transaction_id VARCHAR(100) UNIQUE,
    amount DECIMAL(12,0) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    payment_time TIMESTAMPTZ,
    refund_time TIMESTAMPTZ,
    refund_amount DECIMAL(12,0),
    refund_reason VARCHAR(300),
    payment_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 13. Monthly Passes
CREATE TABLE IF NOT EXISTS monthly_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    route_id UUID NOT NULL REFERENCES routes(id),
    pass_code VARCHAR(30) UNIQUE NOT NULL,
    category VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    proof_image_url VARCHAR(500),
    approval_status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    rejection_reason VARCHAR(300),
    price DECIMAL(12,0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_passes_user ON monthly_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_passes_status ON monthly_passes(approval_status);

-- 14. Vehicle Tracking
CREATE TABLE IF NOT EXISTS vehicle_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    speed_kmh DECIMAL(5,1),
    heading_degrees DECIMAL(5,1),
    battery_percent DECIMAL(4,1),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_trip ON vehicle_tracking(trip_id);
CREATE INDEX IF NOT EXISTS idx_tracking_time ON vehicle_tracking(last_updated DESC);

-- 15. Trip Incidents
CREATE TABLE IF NOT EXISTS trip_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    reported_by UUID NOT NULL REFERENCES users(id),
    incident_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    description TEXT,
    delay_minutes_estimate INTEGER,
    resolution_status VARCHAR(20) DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    reported_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    trip_id UUID REFERENCES trips(id),
    rating_score INTEGER CHECK (rating_score BETWEEN 1 AND 5),
    content TEXT,
    category VARCHAR(30),
    status VARCHAR(20) DEFAULT 'new',
    admin_response TEXT,
    responded_by UUID REFERENCES users(id),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_name VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp DESC);
