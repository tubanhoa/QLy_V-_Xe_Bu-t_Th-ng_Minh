import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { RoleEntity } from '../entities/role.entity.js';
import { UserEntity } from '../entities/user.entity.js';
import { RouteEntity } from '../entities/route.entity.js';
import { StationEntity } from '../entities/station.entity.js';
import { RouteStationEntity } from '../entities/route-station.entity.js';
import { VehicleEntity } from '../entities/vehicle.entity.js';
import { SeatEntity } from '../entities/seat.entity.js';
import { TripEntity } from '../entities/trip.entity.js';
import { VoucherEntity } from '../entities/voucher.entity.js';
import { Role } from '../../common/constants/roles.constant.js';
import { UserStatus, VehicleStatus, TripStatus, SeatType } from '../../common/constants/status.constant.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RouteEntity)
    private readonly routeRepo: Repository<RouteEntity>,
    @InjectRepository(StationEntity)
    private readonly stationRepo: Repository<StationEntity>,
    @InjectRepository(RouteStationEntity)
    private readonly routeStationRepo: Repository<RouteStationEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
    @InjectRepository(SeatEntity)
    private readonly seatRepo: Repository<SeatEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepo: Repository<TripEntity>,
    @InjectRepository(VoucherEntity)
    private readonly voucherRepo: Repository<VoucherEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.runSeed();
      await this.ensureRollingWindowTrips();
    } catch (err: any) {
      this.logger.error(`Error during initial database seed: ${err.message}`);
    }
  }

  async runSeed() {
    // Tối ưu tốc độ khởi động: Nếu tài khoản Admin đã có trong CSDL và không có cờ FORCE_SEED thì bỏ qua
    const forceSeed = process.env.FORCE_SEED === 'true';
    if (!forceSeed) {
      const existingAdmin = await this.userRepo.findOne({
        where: { email: 'admin@smartbus.ictu.vn' },
      });
      if (existingAdmin) {
        this.logger.log('Dữ liệu CSDL đã sẵn sàng (Admin tồn tại). Bỏ qua Seed data để khởi động siêu tốc.');
        return;
      }
    }

    this.logger.log('Checking database seed data...');

    // 1. Seed Roles
    const rolesData = [
      { name: Role.ADMIN, description: 'Quản trị viên toàn hệ thống' },
      { name: Role.MANAGER, description: 'Điều hành viên / Quản lý tuyến' },
      { name: Role.DRIVER, description: 'Tài xế / Phụ xe' },
      { name: Role.PASSENGER, description: 'Hành khách / Sinh viên' },
    ];

    const roleMap = new Map<string, RoleEntity>();
    for (const r of rolesData) {
      let role = await this.roleRepo.findOne({ where: { name: r.name } });
      if (!role) {
        role = this.roleRepo.create(r);
        role = await this.roleRepo.save(role);
        this.logger.log(`Seeded role: ${r.name}`);
      }
      roleMap.set(r.name, role);
    }

    // 2. Seed Users
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const usersData = [
      {
        fullName: 'Quản Trị Viên Hệ Thống',
        email: 'admin@smartbus.ictu.vn',
        phoneNumber: '0901234567',
        passwordHash,
        roleId: roleMap.get(Role.ADMIN)!.id,
        status: UserStatus.ACTIVE,
      },
      {
        fullName: 'Nguyễn Quản Lý',
        email: 'manager@smartbus.ictu.vn',
        phoneNumber: '0902345678',
        passwordHash,
        roleId: roleMap.get(Role.MANAGER)!.id,
        status: UserStatus.ACTIVE,
      },
      {
        fullName: 'Trần Văn Nam (Tài Xế)',
        email: 'driver.nam@smartbus.ictu.vn',
        phoneNumber: '0903456789',
        passwordHash,
        roleId: roleMap.get(Role.DRIVER)!.id,
        faculty: 'Hạng D (Xe 29-45 chỗ)',
        status: UserStatus.ACTIVE,
      },
      {
        fullName: 'Nguyễn Thu An (Sinh Viên ICTU)',
        email: 'student.an@ictu.edu.vn',
        phoneNumber: '0904567890',
        passwordHash,
        roleId: roleMap.get(Role.PASSENGER)!.id,
        studentId: 'DTC215180001',
        faculty: 'Công Nghệ Thông Tin',
        status: UserStatus.ACTIVE,
      },
      {
        fullName: 'Sinh Viên Mẫu ICTU',
        email: 'sinhvien.ictu@gmail.com',
        phoneNumber: '0909999888',
        passwordHash,
        roleId: roleMap.get(Role.PASSENGER)!.id,
        studentId: 'DTC245180025',
        faculty: 'Công Nghệ Thông Tin',
        status: UserStatus.ACTIVE,
      },
    ];

    for (const u of usersData) {
      const existing = await this.userRepo.findOne({ where: { email: u.email } });
      if (!existing) {
        await this.userRepo.save(this.userRepo.create(u));
        this.logger.log(`Seeded user: ${u.email}`);
      }
    }

    // 3. Seed Stations
    const stationsData = [
      { name: 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)', address: 'Đường Z115, Quyết Thắng, TP. Thái Nguyên', latitude: 21.585284, longitude: 105.806297, isHub: true },
      { name: 'Trạm Cổng KTX ĐH Thái Nguyên (KTX ICTU)', address: 'Đường Z115, Quyết Thắng, TP. Thái Nguyên', latitude: 21.587123, longitude: 105.808234, isHub: false },
      { name: 'Trạm ĐH Sư Phạm Thái Nguyên', address: 'Số 20 Lương Ngọc Quyến, TP. Thái Nguyên', latitude: 21.591234, longitude: 105.818901, isHub: true },
      { name: 'Trạm Bến Xe Đồng Quang', address: 'Đường Quang Trung, TP. Thái Nguyên', latitude: 21.593456, longitude: 105.821234, isHub: true },
      { name: 'Trạm Ngã 3 Mỏ Chè', address: 'Đường Quang Trung, TP. Thái Nguyên', latitude: 21.595432, longitude: 105.823456, isHub: false },
      { name: 'Trạm Bệnh Viện Đa Khoa Trung Ương', address: 'Số 479 Lương Ngọc Quyến, TP. Thái Nguyên', latitude: 21.598765, longitude: 105.832109, isHub: true },
      { name: 'Trạm Bến Xe Trung Tâm Thái Nguyên', address: 'Đường Lương Ngọc Quyến, Quang Trung, TP. Thái Nguyên', latitude: 21.604321, longitude: 105.845678, isHub: true },
    ];

    const stationMap = new Map<string, StationEntity>();
    for (const s of stationsData) {
      let station = await this.stationRepo.findOne({ where: { name: s.name } });
      if (!station) {
        station = this.stationRepo.create(s);
        station = await this.stationRepo.save(station);
        this.logger.log(`Seeded station: ${s.name}`);
      }
      stationMap.set(s.name, station);
    }

    // 4. Seed Route CT-01
    let route1 = await this.routeRepo.findOne({ where: { routeCode: 'CT-01' } });
    if (!route1) {
      route1 = this.routeRepo.create({
        routeCode: 'CT-01',
        name: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
        origin: 'ĐH CNTT & TT Thái Nguyên',
        destination: 'Bến Xe Trung Tâm Thái Nguyên',
        distanceKm: 14.5,
        basePrice: 25000,
        studentPrice: 12000,
        operatingStart: '05:30:00',
        operatingEnd: '21:00:00',
        frequencyMinutes: 20,
        status: 'active',
      });
      route1 = await this.routeRepo.save(route1);

      // Add stops
      let order = 1;
      for (const s of stationsData) {
        const station = stationMap.get(s.name)!;
        await this.routeStationRepo.save(
          this.routeStationRepo.create({
            routeId: route1.id,
            stationId: station.id,
            stopOrder: order,
            distanceFromOriginKm: (order - 1) * 2.5,
            estimatedMinutes: (order - 1) * 7,
          }),
        );
        order++;
      }
      this.logger.log(`Seeded route: CT-01 with ${stationsData.length} stations`);
    }

    // 4b. Seed Route CT-02 (Tuyến độc lập: Bến Xe Nam ↔ KCN Sông Công)
    const ct02StationsData = [
      { name: 'Trạm Bến Xe Nam Thái Nguyên', address: 'Phường Tích Lương, TP. Thái Nguyên', latitude: 21.543210, longitude: 105.854321, isHub: true },
      { name: 'Trạm Ngã 4 Tích Lương', address: 'Đường 3 Tháng 2, Tích Lương, TP. Thái Nguyên', latitude: 21.532100, longitude: 105.865432, isHub: false },
      { name: 'Trạm Khu Công Nghiệp Sông Công', address: 'KCN Sông Công 1, TP. Sông Công', latitude: 21.501234, longitude: 105.887654, isHub: true },
    ];

    const ct02StationMap = new Map<string, StationEntity>();
    for (const s of ct02StationsData) {
      let station = await this.stationRepo.findOne({ where: { name: s.name } });
      if (!station) {
        station = this.stationRepo.create(s);
        station = await this.stationRepo.save(station);
        this.logger.log(`Seeded station: ${s.name}`);
      }
      ct02StationMap.set(s.name, station);
    }

    let route2 = await this.routeRepo.findOne({ where: { routeCode: 'CT-02' } });
    if (!route2) {
      route2 = this.routeRepo.create({
        routeCode: 'CT-02',
        name: 'Bến Xe Nam Thái Nguyên ↔ Khu Công Nghiệp Sông Công',
        origin: 'Bến Xe Nam Thái Nguyên',
        destination: 'Khu Công Nghiệp Sông Công',
        distanceKm: 18.0,
        basePrice: 30000,
        studentPrice: 15000,
        operatingStart: '06:00:00',
        operatingEnd: '20:30:00',
        frequencyMinutes: 30,
        status: 'active',
      });
      route2 = await this.routeRepo.save(route2);

      let order2 = 1;
      for (const s of ct02StationsData) {
        const station = ct02StationMap.get(s.name)!;
        await this.routeStationRepo.save(
          this.routeStationRepo.create({
            routeId: route2.id,
            stationId: station.id,
            stopOrder: order2,
            distanceFromOriginKm: (order2 - 1) * 9.0,
            estimatedMinutes: (order2 - 1) * 18,
          }),
        );
        order2++;
      }
      this.logger.log('Seeded route: CT-02 with 3 stations');
    }

    // 5. Seed Vehicles & Seats (Đảm bảo mỗi xe có đủ đúng 28 ghế)
    const vehiclesData = [
      { licensePlate: '20B-012.34', model: 'VinFast eBus 2024 (EV)', vehicleType: 'electric', seatCapacity: 28 },
      { licensePlate: '20B-056.78', model: 'VinFast eBus 2024 (EV)', vehicleType: 'electric', seatCapacity: 28 },
      { licensePlate: '20B-099.99', model: 'Hyundai County 2023', vehicleType: 'diesel', seatCapacity: 28 },
    ];

    const vehicles: VehicleEntity[] = [];
    for (const v of vehiclesData) {
      let vehicle = await this.vehicleRepo.findOne({ where: { licensePlate: v.licensePlate } });
      if (!vehicle) {
        vehicle = this.vehicleRepo.create({
          ...v,
          manufactureYear: 2024,
          batteryCapacityKwh: 281.9,
          status: VehicleStatus.ACTIVE,
        });
        vehicle = await this.vehicleRepo.save(vehicle);
      }

      // Đảm bảo đủ đúng 28 ghế (01A -> 07D) cho mỗi xe
      const existingSeats = await this.seatRepo.find({ where: { vehicleId: vehicle.id } });
      const existingSeatNumbers = new Set(existingSeats.map((s) => s.seatNumber));
      const missingSeats: SeatEntity[] = [];
      const cols = ['A', 'B', 'C', 'D'];
      for (let r = 1; r <= 7; r++) {
        for (const c of cols) {
          const rowStr = r < 10 ? `0${r}` : `${r}`;
          const seatNumber = `${rowStr}${c}`;
          if (!existingSeatNumbers.has(seatNumber)) {
            missingSeats.push(
              this.seatRepo.create({
                vehicleId: vehicle.id,
                seatNumber,
                rowNumber: r,
                columnLabel: c,
                seatType: r === 1 ? SeatType.PRIORITY : SeatType.STANDARD,
                floorNumber: 1,
              }),
            );
          }
        }
      }

      if (missingSeats.length > 0) {
        await this.seatRepo.save(missingSeats);
        this.logger.log(`Seeded ${missingSeats.length} missing seats for vehicle: ${v.licensePlate}`);
      }
      vehicles.push(vehicle);
    }

    // 6. Rolling Window Seed (Lăn ngày tự động): Hôm nay + 3 ngày tới
    await this.ensureRollingWindowTrips();

    // 7. Seed Vouchers (Đồng bộ đầy đủ voucher thực tế & voucher hết hạn)
    const vouchersToSeed = [
      {
        code: 'ICTU2026',
        description: 'Ưu đãi chào tân sinh viên K22 ICTU - Giảm 20% tối đa 30.000đ cho mọi chuyến buýt',
        discountType: 'percentage' as const,
        discountValue: 20,
        minOrderValue: 20000,
        maxDiscountAmount: 30000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        usageLimit: 1000,
        applicableType: 'all' as const,
        status: 'active',
      },
      {
        code: 'ICTU_BUS10K',
        description: 'Trợ giá kích cầu tuyến xe buýt Thái Nguyên - Trừ thẳng 10.000đ trực tiếp vào giá vé lượt',
        discountType: 'fixed_amount' as const,
        discountValue: 10000,
        minOrderValue: 10000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        usageLimit: 300,
        applicableType: 'single_ticket' as const,
        status: 'active',
      },
      {
        code: 'VETHANG_50K',
        description: 'Giảm 50.000đ khi đăng ký mới hoặc gia hạn vé tháng liên tuyến ĐH Thái Nguyên',
        discountType: 'fixed_amount' as const,
        discountValue: 50000,
        minOrderValue: 100000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        usageLimit: 200,
        applicableType: 'monthly_pass' as const,
        status: 'active',
      },
      {
        code: 'CUOITUAN_VUI',
        description: 'Kích cầu di chuyển cuối tuần - Giảm 15% tối đa 20.000đ cho các chuyến xe thứ 7 & chủ nhật',
        discountType: 'percentage' as const,
        discountValue: 15,
        minOrderValue: 20000,
        maxDiscountAmount: 20000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        usageLimit: 400,
        applicableType: 'single_ticket' as const,
        status: 'active',
      },
      {
        code: 'HE2025_EXP',
        description: 'Ưu đãi kích cầu mùa hè 2025 - Giảm 25.000đ cho vé tháng sinh viên (Đã kết thúc)',
        discountType: 'fixed_amount' as const,
        discountValue: 25000,
        minOrderValue: 80000,
        startDate: '2025-06-01',
        endDate: '2025-08-31',
        usageLimit: 500,
        applicableType: 'monthly_pass' as const,
        status: 'active',
      },
    ];

    for (const v of vouchersToSeed) {
      const existing = await this.voucherRepo.findOne({ where: { code: v.code } });
      if (!existing) {
        await this.voucherRepo.save(this.voucherRepo.create(v));
        this.logger.log(`Seeded voucher: ${v.code}`);
      }
    }

    this.logger.log('Database seeding check completed successfully!');
  }

  /**
   * Tự động sinh lịch trình chạy xe (Rolling window) cho các tuyến chính (CT-01, CT-02)
   * Đảm bảo hôm nay và 3 ngày tới luôn có ít nhất 10 chuyến xe SCHEDULED để sinh viên luôn tra cứu & đặt vé được
   */
  public async ensureRollingWindowTrips() {
    try {
      const driver =
        (await this.userRepo.findOne({ where: { email: 'driver.nam@smartbus.ictu.vn' } })) ||
        (await this.userRepo.findOne({
          where: { role: { name: Role.DRIVER }, status: UserStatus.ACTIVE },
          relations: { role: true },
        }));

      const routeCT01 = await this.routeRepo.findOne({ where: { routeCode: 'CT-01' } });
      const routeCT02 = await this.routeRepo.findOne({ where: { routeCode: 'CT-02' } });
      const vehicles = await this.vehicleRepo.find({
        where: { status: VehicleStatus.ACTIVE },
        order: { createdAt: 'ASC' },
      });

      if (!routeCT01 && !routeCT02) return;

      const ct01Schedule = [
        { h: 6, m: 0 }, { h: 6, m: 45 },
        { h: 7, m: 30 }, { h: 8, m: 15 },
        { h: 9, m: 0 }, { h: 9, m: 45 },
        { h: 10, m: 30 }, { h: 11, m: 15 },
        { h: 12, m: 0 }, { h: 12, m: 45 },
        { h: 13, m: 30 }, { h: 14, m: 15 },
        { h: 15, m: 0 }, { h: 15, m: 45 },
        { h: 16, m: 30 }, { h: 17, m: 15 },
        { h: 18, m: 0 }, { h: 18, m: 45 },
        { h: 19, m: 30 },
      ];

      const ct02Schedule = [
        { h: 6, m: 30 }, { h: 7, m: 15 },
        { h: 8, m: 0 }, { h: 8, m: 45 },
        { h: 9, m: 30 }, { h: 10, m: 15 },
        { h: 11, m: 0 }, { h: 11, m: 45 },
        { h: 12, m: 30 }, { h: 13, m: 15 },
        { h: 14, m: 0 }, { h: 14, m: 45 },
        { h: 15, m: 30 }, { h: 16, m: 15 },
        { h: 17, m: 0 }, { h: 17, m: 45 },
        { h: 18, m: 30 }, { h: 19, m: 15 },
      ];

      const todayDate = new Date();
      for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
        const targetDate = new Date(todayDate);
        targetDate.setDate(todayDate.getDate() + dayOffset);
        const y = targetDate.getFullYear();
        const m = targetDate.getMonth();
        const d = targetDate.getDate();

        const startOfDay = new Date(y, m, d, 0, 0, 0, 0);
        const endOfDay = new Date(y, m, d, 23, 59, 59, 999);

        const existingTripsCount = await this.tripRepo
          .createQueryBuilder('trip')
          .where('trip.departureTime BETWEEN :start AND :end', {
            start: startOfDay,
            end: endOfDay,
          })
          .andWhere('trip.status = :status', { status: TripStatus.SCHEDULED })
          .getCount();

        if (existingTripsCount < 10) {
          const tripsToCreate: TripEntity[] = [];

          // Tuyến CT-01
          if (routeCT01 && vehicles.length > 0) {
            for (let i = 0; i < ct01Schedule.length; i++) {
              const time = ct01Schedule[i];
              const dep = new Date(y, m, d, time.h, time.m, 0, 0);
              const arr = new Date(dep.getTime() + 45 * 60 * 1000);
              const vehicle = vehicles[i % Math.min(2, vehicles.length)];

              tripsToCreate.push(
                this.tripRepo.create({
                  routeId: routeCT01.id,
                  vehicleId: vehicle.id,
                  driverId: driver?.id,
                  departureTime: dep,
                  arrivalTime: arr,
                  status: TripStatus.SCHEDULED,
                  tripType: 'regular',
                }),
              );
            }
          }

          // Tuyến CT-02
          if (routeCT02 && vehicles.length > 1) {
            for (let i = 0; i < ct02Schedule.length; i++) {
              const time = ct02Schedule[i];
              const dep = new Date(y, m, d, time.h, time.m, 0, 0);
              const arr = new Date(dep.getTime() + 40 * 60 * 1000);
              const vehicle = vehicles.length >= 3 ? vehicles[1 + (i % 2)] : vehicles[1];

              tripsToCreate.push(
                this.tripRepo.create({
                  routeId: routeCT02.id,
                  vehicleId: vehicle.id,
                  driverId: driver?.id,
                  departureTime: dep,
                  arrivalTime: arr,
                  status: TripStatus.SCHEDULED,
                  tripType: 'regular',
                }),
              );
            }
          }

          if (tripsToCreate.length > 0) {
            await this.tripRepo.save(tripsToCreate);
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            this.logger.log(`[SeedService] Tự động sinh ${tripsToCreate.length} chuyến xe rolling window cho ngày ${dateStr} (CT-01 & CT-02)`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[SeedService] Không thể tự động sinh rolling trips: ${err.message}`);
    }
  }
}

