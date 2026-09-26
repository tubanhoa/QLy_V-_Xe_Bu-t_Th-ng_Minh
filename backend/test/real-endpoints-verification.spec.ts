import { describe, it, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../src/database/entities/index.js';
import { RouteEntity } from '../src/database/entities/route.entity.js';
import { StationEntity } from '../src/database/entities/station.entity.js';
import { RouteStationEntity } from '../src/database/entities/route-station.entity.js';
import { RoleEntity } from '../src/database/entities/role.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { VehicleEntity } from '../src/database/entities/vehicle.entity.js';
import { SeatEntity } from '../src/database/entities/seat.entity.js';
import { TripEntity } from '../src/database/entities/trip.entity.js';
import { TicketEntity } from '../src/database/entities/ticket.entity.js';
import { VoucherEntity } from '../src/database/entities/voucher.entity.js';
import { BookingEntity } from '../src/database/entities/booking.entity.js';
import { SeedService } from '../src/database/seeds/seed.service.js';
import { RoutesService } from '../src/modules/transit/routes.service.js';
import { RoutesController } from '../src/modules/transit/routes.controller.js';
import { BookingService } from '../src/modules/booking/booking.service.js';
import { BookingController } from '../src/modules/booking/booking.controller.js';
import { SeatLockService } from '../src/modules/booking/seat-lock.service.js';

describe('Real Dev Environment Verification (Postgres & Redis, No Mock)', () => {
  let dataSource: DataSource;
  let routesController: RoutesController;
  let bookingController: BookingController;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'smart_bus_db',
      entities: ALL_ENTITIES,
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
    console.log('Postgres connection established successfully!');

    // Run real seed data
    const seedService = new SeedService(
      dataSource.getRepository(RoleEntity),
      dataSource.getRepository(UserEntity),
      dataSource.getRepository(RouteEntity),
      dataSource.getRepository(StationEntity),
      dataSource.getRepository(RouteStationEntity),
      dataSource.getRepository(VehicleEntity),
      dataSource.getRepository(SeatEntity),
      dataSource.getRepository(TripEntity),
      dataSource.getRepository(VoucherEntity),
    );
    await seedService.runSeed();

    // Initialize Services and Controllers
    const routeRepo = dataSource.getRepository(RouteEntity);
    const routeStationRepo = dataSource.getRepository(RouteStationEntity);
    const routesService = new RoutesService(routeRepo, routeStationRepo);
    routesController = new RoutesController(routesService);

    const bookingRepo = dataSource.getRepository(BookingEntity);
    const ticketRepo = dataSource.getRepository(TicketEntity);
    const tripRepo = dataSource.getRepository(TripEntity);
    const seatRepo = dataSource.getRepository(SeatEntity);
    const voucherRepo = dataSource.getRepository(VoucherEntity);
    const userRepo = dataSource.getRepository(UserEntity);
    const seatLockService = new SeatLockService();

    const bookingService = new BookingService(
      bookingRepo,
      ticketRepo,
      tripRepo,
      seatRepo,
      voucherRepo,
      userRepo,
      seatLockService,
    );
    bookingController = new BookingController(bookingService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('Scenario a: GET /api/routes without query parameters', async () => {
    const response = await routesController.findAll({});
    console.log('=== SCENARIO A RAW JSON ===');
    console.log(JSON.stringify(response, null, 2));
  });

  it('Scenario b1: GET /api/routes with origin as intermediate station (Cổng KTX)', async () => {
    const response = await routesController.findAll({
      origin: 'Cổng KTX',
    });
    console.log('=== SCENARIO B1 (ORIGIN INTERMEDIATE) RAW JSON ===');
    console.log(JSON.stringify(response, null, 2));
  });

  it('Scenario b2: GET /api/routes with destination as intermediate station (Bệnh Viện)', async () => {
    const response = await routesController.findAll({
      destination: 'Bệnh Viện',
    });
    console.log('=== SCENARIO B2 (DESTINATION INTERMEDIATE) RAW JSON ===');
    console.log(JSON.stringify(response, null, 2));
  });

  it('Scenario c: GET /api/v1/booking/search without date parameter', async () => {
    const response = await bookingController.searchTrips({
      origin: 'ĐH CNTT & TT',
      destination: 'Bến xe',
    });
    console.log('=== SCENARIO C RAW JSON ===');
    console.log(JSON.stringify(response, null, 2));
  });
});
