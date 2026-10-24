# Smart Bus Ticketing System (SBTS) - ICTU
## Enterprise Intelligent Transit & Automated Ticketing Platform
**Thai Nguyen University of Information and Communication Technology (ICTU)**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-20232A?style=flat-square&logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11.0.0-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20Supabase-336791?style=flat-square&logo=postgresql)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Upstash%20Distributed-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/Vitest-36%20Suites%20Passed%20(322%2F322)-729B1B?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Architecture](https://img.shields.io/badge/Architecture-Clean%20Feature--Driven%20Monorepo-005A36?style=flat-square)](https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh)
[![Compliance](https://img.shields.io/badge/Security-HMAC--SHA256%20%7C%20RBAC%20Tier--4-blue?style=flat-square)](https://github.com/tubanhoa/QLy_V-_Xe_Bu-t_Th-ng_Minh)

---

## Table of Contents
1. [Executive Summary & Core Objectives](#1-executive-summary--core-objectives)
2. [Algorithmic & Mathematical Specifications](#2-algorithmic--mathematical-specifications)
3. [System Architecture (C4 Component Model)](#3-system-architecture-c4-component-model)
4. [Relational Database Schema & Entity Relationships (ERD)](#4-relational-database-schema--entity-relationships-erd)
5. [Distributed Seat Reservation & Concurrency Control Flow](#5-distributed-seat-reservation--concurrency-control-flow)
6. [Real-time Telemetry & Geofencing Event Engine](#6-real-time-telemetry--geofencing-event-engine)
7. [Cryptographic QR Verification & State Machine](#7-cryptographic-qr-verification--state-machine)
8. [Clean Monorepo & Modular Codebase Structure](#8-clean-monorepo--modular-codebase-structure)
9. [Role-Based Access Control (RBAC) Specification](#9-role-based-access-control-rbac-specification)
10. [Automated Cancellation & Flexible Refund Policy](#10-automated-cancellation--flexible-refund-policy)
11. [Installation, Environment & Deployment Runbook](#11-installation-environment--deployment-runbook)
12. [Automated Test Suite Execution & Quality Metrics](#12-automated-test-suite-execution--quality-metrics)
13. [Institutional Governance & Licensing](#13-institutional-governance--licensing)

---

## 1. Executive Summary & Core Objectives

The **Smart Bus Ticketing System (SBTS)** is an enterprise-grade commuter transit management and digital ticketing solution designed and engineered for the **Thai Nguyen University of Information and Communication Technology (ICTU)** ecosystem.

The system addresses the operational friction, concurrency bottlenecks, and physical queue overhead associated with traditional suburban university shuttle lines. By integrating modern distributed systems patterns, SBTS guarantees sub-second seat reservation, multi-tenant role isolation, cryptographic fare verification, and continuous real-time fleet positioning.

### Core Engineering Tenets
* **Strict Concurrency Safety**: Guaranteed mutual exclusion on individual seat allocations during flash-booking periods via atomic distributed lock primitives.
* **Cryptographic Tamper-Resistance**: Zero-trust ticket emission backed by HMAC-SHA256 signatures, ensuring offline and online verification fidelity.
* **High Availability & Fault Isolation**: Monorepo decoupling separating edge presentation logic (Next.js 16) from business-critical transactional pipelines (NestJS 11).
* **Deterministic Financial Settlements**: Dual-layer reconciliation integrating national banking gateway webhooks (VNPay Sandbox) with automatic fallback reversal.

---

## 2. Algorithmic & Mathematical Specifications

### 2.1. Distributed Mutual Exclusion (Seat Allocation Concurrency)
To eliminate race conditions when multiple concurrent threads target seat allocation $S_k$ on trip $T_i$, SBTS enforces a Distributed Lock backed by Redis atomic commands:

$$\text{LockKey} = \text{format}(\text{"seat\_lock:trip:}\%s\text{:seat:}\%s\text{", } T_i, S_k)$$

The lock acquisition executes as an atomic single-roundtrip operation:
```
SET seat_lock:{tripId}:{seatNumber} {userId} NX PX 600000
```
Where:
* `NX`: Sets the key if and only if it does not already exist.
* `PX 600000`: Sets a deterministic Time-To-Live (TTL) of 600,000 milliseconds (10 minutes).
* **Formal Safety Guarantee**: Let $C_1, C_2$ be two concurrent client processes attempting to acquire the lock at time $t$. Because Redis single-threaded execution guarantees linear serializability of incoming commands, exactly one command evaluates to `OK`, while the subsequent command evaluates to `nil`, triggering an immediate HTTP 409 Conflict rejection.

### 2.2. Great-Circle Geodesic Distance (Haversine Formulation)
Station-to-station distances and dynamic fares are computed using the Haversine metric over the WGS 84 ellipsoidal mean radius $R = 6,371.0088\text{ km}$:

$$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$

$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)$$

$$c = 2 \cdot \arctan2\left(\sqrt{a}, \sqrt{1 - a}\right)$$

$$d = R \cdot c$$

Where $\phi_1, \phi_2$ are station latitudes and $\lambda_1, \lambda_2$ are station longitudes in radians. The calculated distance $d$ is subsequently fed into the fare resolution matrix:

$$\text{Fare}(d) = \max\left(\text{BasePrice}, \text{BasePrice} + \lfloor d - d_{\text{base}} \rfloor \times \text{RatePerKm}\right)$$

### 2.3. Cryptographic Ticket Signature Formulation
Tickets emitted by the settlement pipeline contain a cryptographically verifiable payload $P$:

$$P = \text{ticketCode} \parallel \text{tripId} \parallel \text{seatNumber} \parallel \text{passengerId} \parallel \text{issuedTimestamp}$$

$$\text{Signature} = \text{HMAC-SHA256}(K_{\text{private}}, P)$$

When a mobile scanner reads the QR payload, it recalculates the message digest using the local or server-held secret key $K_{\text{private}}$. If $\text{HMAC}_{\text{computed}} \neq \text{Signature}_{\text{provided}}$, verification is aborted prior to any database read, eliminating database resource exhaustion attacks.

### 2.4. Telemetry Anomaly Filtering & Kinematic Thresholds
To eliminate erratic GPS drift in urban canyons, raw telemetry packets $(p_t, t)$ are validated against kinematic constraints:

$$v_{\text{calculated}} = \frac{\text{Distance}(p_t, p_{t-1})}{\Delta t}$$

$$\text{Status} = \begin{cases} 
\text{ACCEPTED}, & \text{if } v_{\text{calculated}} \le 150\text{ km/h} \text{ and } \Delta t \ge 1\text{ s} \\
\text{REJECTED\_OUTLIER}, & \text{if } v_{\text{calculated}} > 150\text{ km/h} \\
\text{SIGNAL\_LOST}, & \text{if } \Delta t > 60\text{ s}
\end{cases}$$

---

## 3. System Architecture (C4 Component Model)

The following diagram illustrates the component architecture across the client, gateway, application core, persistence layer, and external partners:

```mermaid
graph TB
    subgraph Client_Layer ["Client & Edge Presentation Layer"]
        WebPassenger["Passenger Web Portal<br/>Next.js 16 App Router / React 19"]
        MobileDriver["Driver Mobile Scanner<br/>PWA Camera Stream / Offline Storage"]
        AdminConsole["Operations & Admin Dashboard<br/>Recharts / Leaflet Map / A4 Print"]
    end

    subgraph Edge_Gateway ["API Gateway, Edge & Security Layer"]
        NginxProxy["Reverse Proxy & SSL Termination"]
        ThrottlerGuard["Rate Limiter & Anti-Spam Guard"]
        JWTAuthenticator["JWT Auth Guard & Token Rotation"]
        RBACInterceptor["Role-Based Access Guard"]
    end

    subgraph Service_Core ["NestJS Application Micro-Monolith"]
        TransitSvc["Transit & Network Engine<br/>Route Stations, Geo Distance"]
        TripDispatchSvc["Trip Dispatch & Crew Roster<br/>4-Day Rolling Window Generator"]
        BookingLockSvc["Booking & Seat-Lock Service<br/>Atomic Distributed Lock Manager"]
        PaymentSvc["Payment & Reconciliation Engine<br/>VNPay Sandbox, HMAC Hash Validation"]
        TrackingGateway["Tracking & Telemetry Gateway<br/>WebSocket WSS, Kalman Filter, ETA Radar"]
        AuditEngine["Audit Logger & Financial Reporter<br/>Change-Set Capture, Excel, PDF"]
        NotificationHub["Notification Dispatch Hub<br/>FCM Web Push, SMTP PDF Dispatcher"]
    end

    subgraph Persistence_Cache ["Persistence & Distributed State"]
        PostgresCluster[("PostgreSQL 16 (Supabase)<br/>ACID Transactions, Foreign Keys, PostGIS")]
        RedisCluster[("Redis In-Memory Engine (Upstash)<br/>Distributed Locks, Lat/Lng Cache, Pub/Sub")]
        FileRepository[("Static File Storage<br/>Identity Proofs, Driver Licenses, Invoices")]
    end

    subgraph External_Services ["External Cloud Infrastructure"]
        VNPayGateway["VNPay National Payment Gateway"]
        FirebaseFCM["Firebase Cloud Messaging (FCM)"]
        SMTPServer["Google SMTP Relay Server"]
        OSRMEngine["OpenStreetMap / OSRM Engine"]
    end

    WebPassenger --> NginxProxy
    MobileDriver --> NginxProxy
    AdminConsole --> NginxProxy

    NginxProxy --> ThrottlerGuard --> JWTAuthenticator --> RBACInterceptor

    RBACInterceptor --> TransitSvc
    RBACInterceptor --> TripDispatchSvc
    RBACInterceptor --> BookingLockSvc
    RBACInterceptor --> PaymentSvc
    RBACInterceptor --> TrackingGateway
    RBACInterceptor --> AuditEngine
    RBACInterceptor --> NotificationHub

    BookingLockSvc -.->|Acquire / Release Lock| RedisCluster
    TrackingGateway -.->|Real-time Coordinate Stream| RedisCluster
    TransitSvc --> PostgresCluster
    TripDispatchSvc --> PostgresCluster
    BookingLockSvc --> PostgresCluster
    PaymentSvc --> PostgresCluster
    AuditEngine --> PostgresCluster

    PaymentSvc <==>|Secure Checksum Verification| VNPayGateway
    NotificationHub ==>|Web Push Protocol| FirebaseFCM
    NotificationHub ==>|MIME Multi-part Mail| SMTPServer
    TrackingGateway ==>|Map Matching / Matrix| OSRMEngine
```

---

## 4. Relational Database Schema & Entity Relationships (ERD)

The relational schema is normalized to Third Normal Form (3NF) to ensure strict transactional integrity, prevent update anomalies, and enforce relational foreign keys.

```mermaid
erDiagram
    ROLES ||--o{ USERS : "authorizes"
    USERS ||--o{ DRIVER_PROFILES : "extends"
    USERS ||--o{ BOOKINGS : "places"
    USERS ||--o{ MONTHLY_PASSES : "holds"
    USERS ||--o{ FEEDBACKS : "evaluates"
    USERS ||--o{ ACTIVITY_LOGS : "causes"

    ROUTES ||--o{ ROUTE_STATIONS : "sequences"
    STATIONS ||--o{ ROUTE_STATIONS : "anchors"
    ROUTES ||--o{ TRIPS : "serves"

    VEHICLES ||--o{ SEATS : "houses"
    VEHICLES ||--o{ TRIPS : "assigned"
    USERS ||--o{ TRIPS : "operates"

    TRIPS ||--o{ BOOKINGS : "manifests"
    TRIPS ||--o{ TRIP_INCIDENTS : "records"

    BOOKINGS ||--o{ TICKETS : "issues"
    SEATS ||--o{ TICKETS : "occupies"
    BOOKINGS ||--o{ PAYMENTS : "settles"
    VOUCHERS ||--o{ BOOKINGS : "deducts"

    ROLES {
        uuid id PK
        varchar name "ADMIN | DISPATCHER | DRIVER | PASSENGER"
        varchar description
        timestamp created_at
    }

    USERS {
        uuid id PK
        varchar email UK
        varchar phone_number
        varchar password_hash
        varchar full_name
        varchar student_id
        varchar faculty
        varchar status "active | inactive | pending_approval"
        uuid role_id FK
    }

    DRIVER_PROFILES {
        uuid id PK
        uuid user_id FK
        varchar license_number UK
        varchar license_class "D | E"
        date license_expiry
        varchar approval_status "approved | pending | rejected"
    }

    ROUTES {
        uuid id PK
        varchar route_code UK "CT-01, CT-02"
        varchar name
        varchar origin
        varchar destination
        decimal distance_km
        decimal base_price
        decimal student_price
        varchar status "active | inactive | deleted"
    }

    STATIONS {
        uuid id PK
        varchar name
        decimal latitude
        decimal longitude
        boolean is_hub
        varchar status "active | inactive"
    }

    ROUTE_STATIONS {
        uuid id PK
        uuid route_id FK
        uuid station_id FK
        int stop_order
        decimal distance_from_origin_km
        int estimated_minutes
    }

    VEHICLES {
        uuid id PK
        varchar license_plate UK
        varchar model
        varchar vehicle_type "electric | diesel"
        int seat_capacity "28"
        varchar status "active | maintenance | inactive"
    }

    SEATS {
        uuid id PK
        uuid vehicle_id FK
        varchar seat_number "01A to 07D"
        int row_number
        varchar column_label "A | B | C | D"
        varchar seat_type "standard | priority"
    }

    TRIPS {
        uuid id PK
        uuid route_id FK
        uuid vehicle_id FK
        uuid driver_id FK
        timestamp departure_time
        timestamp arrival_time
        varchar status "scheduled | boarding | in_progress | completed | cancelled"
    }

    BOOKINGS {
        uuid id PK
        varchar booking_code UK "ICTU-XXXXXX"
        uuid user_id FK
        uuid trip_id FK
        uuid voucher_id FK
        decimal original_amount
        decimal discount_amount
        decimal final_amount
        varchar status "pending | confirmed | cancelled | refunded"
    }

    TICKETS {
        uuid id PK
        uuid booking_id FK
        uuid seat_id FK
        varchar ticket_code UK
        varchar passenger_name
        varchar qr_signature "HMAC-SHA256"
        varchar status "reserved | paid | boarded | cancelled | refunded | expired"
    }

    PAYMENTS {
        uuid id PK
        uuid booking_id FK
        varchar payment_method "vnpay | student_wallet | cash"
        varchar transaction_ref UK
        decimal amount
        varchar status "pending | completed | failed | refunded"
    }

    VOUCHERS {
        uuid id PK
        varchar code UK "ICTU2026, VETHANG_50K"
        varchar discount_type "percentage | fixed_amount"
        decimal discount_value
        decimal min_order_value
        date end_date
        varchar status "active | expired"
    }
```

---

## 5. Distributed Seat Reservation & Concurrency Control Flow

The transactional booking sequence below depicts the state transitions across distributed cache, relational database, external banking gateway, and notification relay:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Passenger Client
    participant Frontend as Next.js Web App
    participant Backend as NestJS Booking Service
    participant Redis as Redis Lock Engine
    participant Postgres as PostgreSQL (Supabase)
    participant Banking as VNPay Payment Gateway
    participant Mailer as Nodemailer SMTP Relay

    Client->>Frontend: Select Route, Date, Trip and Seat (e.g. 04C)
    Frontend->>Backend: POST /api/v1/booking/hold-seat { tripId, seatNumber: "04C" }

    rect rgb(240, 244, 250)
        Note over Backend,Redis: Atomic Distributed Lock Verification
        Backend->>Redis: SET seat_lock:tripId:04C userId NX PX 600000
        alt Seat is currently locked by concurrent user
            Redis-->>Backend: nil
            Backend-->>Frontend: 409 Conflict ("Seat 04C is currently locked by another passenger")
            Frontend-->>Client: Render seat collision alert & refresh grid state
        else Lock successfully acquired
            Redis-->>Backend: OK
            Backend->>Postgres: INSERT INTO bookings, tickets (status = 'reserved')
            Backend-->>Frontend: 201 Created { bookingId, holdExpiresAt }
            Frontend-->>Client: Start 10-Minute Countdown Clock
        end
    end

    Client->>Frontend: Confirm Order & Select VNPay Gateway
    Frontend->>Backend: POST /api/v1/payment/create-url { bookingId }
    Backend->>Backend: Generate VNPay payment query with HMAC-SHA512 checksum
    Backend-->>Frontend: Return VNPay Redirection URL
    Frontend->>Banking: Redirect client to Secure Checkout Gateway

    Client->>Banking: Authenticate Banking Credentials & Submit OTP
    Banking->>Backend: Asynchronous Webhook IPN Callback (GET /api/v1/payment/vnpay-ipn)

    rect rgb(240, 250, 240)
        Note over Backend,Postgres: Settlement & Cryptographic Ticket Activation
        Backend->>Backend: Verify cryptographic hash (vnp_SecureHash)
        Backend->>Postgres: UPDATE payments SET status = 'completed'
        Backend->>Postgres: UPDATE bookings SET status = 'confirmed'
        Backend->>Postgres: UPDATE tickets SET status = 'paid', qr_signature = HMAC(payload)
        Backend->>Redis: DEL seat_lock:tripId:04C (Release distributed reservation lock)
        Backend-->>Banking: HTTP 200 OK { RspCode: "00", Message: "Confirm Success" }
    end

    Backend->>Mailer: Queue asynchronous dispatch of PDF Ticket & inline QR
    Mailer-->>Client: Deliver Email Confirmation to Passenger Inbox
    Banking-->>Frontend: Browser redirect to /payment/result?bookingCode=...
    Frontend-->>Client: Display Order Confirmation & Encrypted Boarding Pass
```

---

## 6. Real-time Telemetry & Geofencing Event Engine

The telematics subsystem processes high-frequency spatial streams from vehicle onboard units and evaluates boundary proximity against fixed station anchors:

```mermaid
flowchart TD
    OBU["On-Board Vehicle Unit / Driver Mobile<br/>Emits GPS Stream: lat, lon, speed, heading"]
    WSS["WebSocket Telemetry Gateway<br/>/tracking/gps-stream"]
    KinematicFilter["Kinematic Anomaly & Outlier Filter<br/>Rejects speeds > 150 km/h or time delta < 1s"]
    RedisSpatial["Redis Geospatial Index<br/>GEOADD bus_positions lon lat tripId"]
    
    GeoEval{"Haversine Proximity Check<br/>Distance to Next Station &le; 500m?"}
    ETAPredictor["ETA Prediction Engine<br/>Distance / Speed + Incident Delay Factor"]
    PushTrigger["Notification Dispatch Service<br/>Firebase Cloud Messaging (FCM)"]
    WebClient["Real-time Leaflet Map UI<br/>Passenger & Dispatcher Visualizer"]
    PassengerAlert["Push Notification Delivered:<br/>'Bus is arriving at your pickup station within 3 mins'"]

    OBU -->|WSS Stream every 5s| WSS
    WSS --> KinematicFilter
    KinematicFilter --> RedisSpatial
    RedisSpatial --> WebClient
    
    KinematicFilter --> ETAPredictor
    ETAPredictor --> GeoEval
    GeoEval -- "TRUE (Inside Geofence)" --> PushTrigger
    GeoEval -- "FALSE (En Route)" --> WebClient
    PushTrigger --> PassengerAlert
```

---

## 7. Cryptographic QR Verification & State Machine

The state diagram below illustrates the multi-tier deterministic validation pipeline executed by the driver inspection terminal during boarding:

```mermaid
stateDiagram-v2
    [*] --> ReadScan: Scanner captures QR string
    
    ReadScan --> VerifyHMAC: Parse payload & compute HMAC-SHA256 signature
    VerifyHMAC --> TamperedError: Digest mismatch or forged payload
    TamperedError --> [*]: Rejection 400 ("Cryptographic signature invalid")

    VerifyHMAC --> ValidateTripMatch: Compare Ticket Trip ID with Bus Current Trip ID
    ValidateTripMatch --> WrongTripError: Ticket belongs to a different schedule
    WrongTripError --> [*]: Rejection 400 ("Wrong vehicle trip allocation")

    ValidateTripMatch --> QueryState: Inspect database record state
    QueryState --> DuplicateError: Current status == 'boarded'
    DuplicateError --> [*]: Rejection 400 ("Ticket already checked in")

    QueryState --> InactiveError: Status in ('cancelled', 'expired', 'refunded')
    InactiveError --> [*]: Rejection 400 ("Ticket revoked or expired")

    QueryState --> GrantBoarding: Current status == 'paid'
    GrantBoarding --> PersistState: Write status = 'boarded', checkedInAt = NOW()
    PersistState --> AudioHapticFeedback: Trigger success tone and haptic confirmation
    AudioHapticFeedback --> [*]: Passenger Boarding Confirmed
```

---

## 8. Clean Monorepo & Modular Codebase Structure

The repository is organized under a strict **Clean Separation Monorepo Architecture**, separating the presentation tier from the backend micro-monolith:

```mermaid
graph LR
    MonorepoRoot["smart-bus-ticketing-system"]
    
    subgraph Frontend_App ["frontend/ (Next.js 16 + React 19)"]
        FE_App["app/ (Route Handlers, Layouts, Dynamic Slugs)"]
        FE_Features["features/ (Domain-Specific Business Logic)"]
        FE_Components["components/ (Shared Reusable UI Components)"]
        FE_Lib["lib/ (API Services, Context, Utility Functions)"]
        FE_Hooks["hooks/ (Custom Hooks: useSeatLock, useTracking)"]
    end

    subgraph Backend_App ["backend/ (NestJS 11 + TypeORM)"]
        BE_Modules["src/modules/ (16 Isolated Domain Modules)"]
        BE_Database["src/database/ (Entities, Schema, Rolling Seed)"]
        BE_Common["src/common/ (Filters, Guards, Interceptors)"]
        BE_Config["src/config/ (Database, Redis, JWT, Mailer)"]
        BE_Tests["test/ (36 Vitest Unit & Integration Suites)"]
    end

    subgraph Core_Orchestrator ["Monorepo Governance"]
        PkgJson["package.json (Unified Execution Scripts)"]
        DevScript["scripts/start-dev.mjs (Concurrent Process Manager)"]
        BatchLauncher["start-dev.bat (Windows Single-Click Bootstrapper)"]
    end

    MonorepoRoot --> Frontend_App
    MonorepoRoot --> Backend_App
    MonorepoRoot --> Core_Orchestrator
```

### Module Breakdown (Backend Core)
| Module Name | Responsibilities & Architectural Boundaries |
| :--- | :--- |
| `src/modules/auth` | JWT issuance, password hashing via Bcrypt, refresh token rotation, RBAC guards. |
| `src/modules/transit` | Master data management for routes, stations, route-stop sequencing, and Haversine fare calculation. |
| `src/modules/trips` | Trip scheduling, vehicle/driver dispatching, and 4-day rolling window database seeding. |
| `src/modules/booking` | Seat selection, Redis distributed locking, booking intent creation, and ticket lifecycle. |
| `src/modules/payment` | VNPay integration, transaction verification, secure checksum validation, and IPN handling. |
| `src/modules/tracking` | WebSocket telemetry streaming, GPS outlier filtering, station ETA, and geofence triggering. |
| `src/modules/promotion` | Student discount voucher management and monthly commuter pass registration. |
| `src/modules/feedback` | Post-trip customer ratings, service feedback, and driver conduct tracking. |
| `src/modules/audit` | Centralized system audit logging capturing mutations, IP origins, and user agent signatures. |
| `src/modules/reports` | Financial reconciliation, occupancy statistics, Excel export, and A4 print templates. |

---

## 9. Role-Based Access Control (RBAC) Specification

Access control is enforced at both the HTTP routing layer (via NestJS `RolesGuard`) and the persistence layer (via database user entity constraints):

| Functional Scope | Admin | Dispatcher | Driver / Crew | Passenger |
| :--- | :---: | :---: | :---: | :---: |
| Route, Station & Schedule Querying | Read | Read | Read | Read |
| Seat Hold & Booking Creation | Denied | Denied | Denied | Create / Read |
| Online Payment Execution | Denied | Denied | Denied | Create |
| Self-Service Ticket Cancellation & Exchange | Denied | Denied | Denied | Update |
| Mobile QR Boarding Inspection | Denied | Denied | Execute | Denied |
| Real-time Telemetry Emission (GPS Ping) | Denied | Denied | Execute | Denied |
| En-route Incident Logging | Denied | Denied | Create | Denied |
| Crew & Vehicle Dispatching | Full Access | Full Access | Denied | Denied |
| Safe Dispatch Lock Enforcement (`IN_PROGRESS`) | Enforced | Enforced | Denied | Denied |
| Student Discount & Identity Document Approval | Full Access | Full Access | Denied | Denied |
| Route Creation, Deletion & Fare Adjustment | Full Access | Denied | Denied | Denied |
| Marketing Voucher & Discount Management | Full Access | Denied | Denied | Denied |
| System Audit Logs & Forensic Change Analysis | Full Access | Denied | Denied | Denied |
| Revenue Dashboard, Excel & PDF A4 Export | Full Access | Full Access | Denied | Denied |

---

## 10. Automated Cancellation & Flexible Refund Policy

To balance passenger convenience against operator empty-seat exposure, SBTS implements an automated tier-based refund and exchange policy:

```
+---------------------------------------------------------------------------------------------------+
|                                 DEPARTURE TIMELINE FEE THRESHOLDS                                 |
+---------------------------------------------------------------------------------------------------+
|  >= 12 Hours to Departure        |  Refund: 100% of Face Value   |  Cancellation Fee: 0%          |
|                                  |  Exchange Fee: 0%             |  Status: Permitted             |
+----------------------------------+-------------------------------+--------------------------------+
|  2 Hours to 12 Hours             |  Refund: 90% of Face Value    |  Cancellation Fee: 10%         |
|                                  |  Exchange Fee: 5%             |  Status: Permitted             |
+----------------------------------+-------------------------------+--------------------------------+
|  15 Minutes to 2 Hours           |  Refund: 80% of Face Value    |  Cancellation Fee: 20%         |
|                                  |  Exchange Fee: 10%            |  Status: Permitted             |
+----------------------------------+-------------------------------+--------------------------------+
|  < 15 Minutes to Departure       |  Refund: 0% (Non-refundable)  |  Cancellation Fee: 100%        |
|                                  |  Exchange: Locked             |  Status: Rejected (HTTP 400)   |
+----------------------------------+-------------------------------+--------------------------------+
```

### Cooling-off Period Override
Regardless of the departure timeline threshold, any ticket cancelled within **30 minutes of creation** (`NOW() - createdAt <= 30 minutes`) receives an unconditional **100% refund** with 0% penalty fee.

---

## 11. Installation, Environment & Deployment Runbook

### 11.1. Prerequisites
* **Runtime Environment**: Node.js `v20.x`, `v22.x`, or `v24.x LTS`.
* **Package Manager**: `npm` (bundled with Node.js) or `pnpm`.
* **Relational Database**: PostgreSQL 16+ instance with PostGIS and UUID extension support (e.g. Supabase).
* **In-Memory Store**: Redis 6.0+ instance (e.g. Upstash Redis).

### 11.2. Dependency Installation
Execute dependency installation for both workspaces from the root directory:
```bash
npm --prefix backend install && npm --prefix frontend install
```

### 11.3. Environment Configuration
Populate `backend/.env` with production or sandbox parameters:
```ini
# Core Application Server
PORT=3001
NODE_ENV=production

# PostgreSQL Connection (Supabase Transaction Pooler)
DATABASE_URL=postgresql://postgres.xxx:xxx@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# Redis Distributed Cache & Lock Engine
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# Cryptographic Signatures & JWT
JWT_SECRET=ICTU_SMART_BUS_JWT_ENTERPRISE_SECRET_KEY_2026
JWT_EXPIRATION=7d

# VNPay Payment Gateway Sandbox Credentials
VNPAY_TMN_CODE=BDCDEH71
VNPAY_HASH_SECRET=TJAWJFAONXJGYJULKCPRUYGNVXTCHGUN
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/result

# Transactional Mail Relay (SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=smartbus.ictu@gmail.com
MAIL_PASS=xxxx-xxxx-xxxx-xxxx
MAIL_FROM="Smart Bus ICTU" <smartbus.ictu@gmail.com>
```

### 11.4. Application Startup
```bash
# Option 1: Concurrent startup via root script (Frontend: 3000, Backend: 3001)
npm run dev

# Option 2: Windows automated one-click launcher
start-dev.bat
```

### 11.5. Build Verification
Validate compilation health across both workspaces:
```bash
# Compile Backend NestJS application
npm --prefix backend run build

# Compile Frontend Next.js production bundle with Turbopack
npm --prefix frontend run build
```

---

## 12. Automated Test Suite Execution & Quality Metrics

The codebase is protected by **36 automated test suites** executed via Vitest, verifying 100% of all critical transactional contracts, security validations, and edge conditions:

```bash
# Execute full backend automated test suite
npm run test:backend
```

### Verification Execution Report
```
--------------------------------------------------------------------------------
VITEST TEST EXECUTION SUMMARY (ALL 36 FILES PASSED)
--------------------------------------------------------------------------------
 [PASS] test/search-hardening.spec.ts                            (3 tests)
 [PASS] test/real-endpoints-verification.spec.ts                 (4 tests)
 [PASS] test/tracking-realtime-and-eta.spec.ts                   (17 tests)
 [PASS] test/incident-flow-integration.spec.ts                   (7 tests)
 [PASS] test/ticket-cancel-and-exchange.spec.ts                  (10 tests)
 [PASS] test/auth-register-integration.spec.ts                   (13 tests)
 [PASS] test/transit-management-and-integrity.spec.ts            (16 tests)
 [PASS] test/trip-dispatch-and-crew-notification.spec.ts         (10 tests)
 [PASS] test/security-and-auth-hardening.spec.ts                (10 tests)
 [PASS] test/seat-hold-payment.spec.ts                           (10 tests)
 [PASS] test/qr-ticket-notification.spec.ts                     (10 tests)
 [PASS] test/qa/sprint1-core-features.spec.ts                   (32 tests)
 [PASS] test/qa/sprint2-advanced-features.spec.ts               (17 tests)
 [PASS] test/entrypoint-standardization.spec.ts                 (12 tests)
 [PASS] test/unit/conductor-creation-and-dispatch-constraints   (10 tests)
 [PASS] test/unit/auth-register.spec.ts                         (15 tests)
 [PASS] test/unit/anti-spam-and-email.spec.ts                   (4 tests)
 [PASS] test/unit/trips-vietnam-timezone.spec.ts                (3 tests)
 [PASS] test/unit/notification-controller-and-service.spec.ts   (7 tests)
 [PASS] test/qa/sprint3-geofencing-push-notification.spec.ts    (17 tests)
 [PASS] test/qa/sprint2-geofencing-notification.spec.ts         (17 tests)
 [PASS] ... 15 additional unit test suites ...

 Test Files  36 passed (36)
      Tests  322 passed (322)
   Duration  21.68s
   Exit Code 0
--------------------------------------------------------------------------------
```

---

## 13. Institutional Governance & Licensing

* **Host Institution**: Thai Nguyen University of Information and Communication Technology (ICTU) - Thai Nguyen University
* **Department**: Faculty of Information Technology & Software Engineering
* **Project Designation**: Graduate Capstone Project / Production Release Candidate `v1.0.0`
* **Intellectual Property**: © 2026 Smart Bus Ticketing System - ICTU. All rights reserved.
