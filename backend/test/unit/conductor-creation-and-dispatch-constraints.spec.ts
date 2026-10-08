import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { UsersService } from '../../src/modules/users/users.service.js';
import { Role, ROLE_HIERARCHY } from '../../src/common/constants/roles.constant.js';
import { UserStatus, TripStatus, VehicleStatus } from '../../src/common/constants/status.constant.js';
import { TripsService } from '../../src/modules/trips/trips.service.js';

describe('Quản lý Phụ xe và Ràng buộc Phân công Điều phối (Conductor Creation & Dispatch Constraints)', () => {
  describe('1. Định nghĩa Vai trò Phụ xe (Role.CONDUCTOR & ROLE_HIERARCHY)', () => {
    it('Phải tồn tại Role.CONDUCTOR với giá trị "conductor"', () => {
      expect(Role.CONDUCTOR).toBe('conductor');
    });

    it('ROLE_HIERARCHY phải chứa Role.CONDUCTOR và quyền hạn cao hơn hành khách', () => {
      expect(ROLE_HIERARCHY[Role.CONDUCTOR]).toBeDefined();
      expect(ROLE_HIERARCHY[Role.CONDUCTOR]).toBe(2);
      expect(ROLE_HIERARCHY[Role.CONDUCTOR]).toBeGreaterThan(ROLE_HIERARCHY[Role.PASSENGER]);
    });

    it('Role.ADMIN và Role.MANAGER phải có cấp bậc cao hơn Role.CONDUCTOR', () => {
      expect(ROLE_HIERARCHY[Role.ADMIN]).toBeGreaterThan(ROLE_HIERARCHY[Role.CONDUCTOR]);
      expect(ROLE_HIERARCHY[Role.MANAGER]).toBeGreaterThan(ROLE_HIERARCHY[Role.CONDUCTOR]);
    });
  });

  describe('2. Khởi tạo & Cấp tài khoản Phụ xe trong UsersService', () => {
    let usersService: UsersService;
    let mockUserRepo: any;
    let mockRoleRepo: any;
    let mockTripRepo: any;
    let mockTicketRepo: any;

    beforeEach(() => {
      mockUserRepo = {
        findOne: vi.fn(),
        create: vi.fn((entity) => ({ ...entity, id: 'user-conductor-uuid-1' })),
        save: vi.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'user-conductor-uuid-1' })),
      };

      mockRoleRepo = {
        findOne: vi.fn(),
        create: vi.fn((entity) => ({ ...entity, id: 'role-conductor-uuid-1' })),
        save: vi.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'role-conductor-uuid-1' })),
      };

      mockTripRepo = { findOne: vi.fn() };
      mockTicketRepo = { findOne: vi.fn() };

      usersService = new UsersService(
        mockUserRepo,
        mockRoleRepo,
        mockTripRepo,
        mockTicketRepo,
      );
    });

    it('Tạo phụ xe thành công khi vai trò conductor đã có sẵn trong cơ sở dữ liệu', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockRoleRepo.findOne.mockResolvedValue({
        id: 'role-conductor-uuid',
        name: Role.CONDUCTOR,
        description: 'Phụ xe / Soát vé viên',
      });

      const result = await usersService.create({
        fullName: 'Lê Thị Mai',
        email: 'Conductor.Mai@Smartbus.Ictu.Vn',
        password: 'Password@123',
        role: Role.CONDUCTOR,
        phoneNumber: '0987654321',
        idCardNumber: '019203009999',
        faculty: 'Soát vé & Hỗ trợ hành khách (Tuyến CT-01) (Năm sinh: 1998)',
      });

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'conductor.mai@smartbus.ictu.vn' },
      });
      expect(result.email).toBe('conductor.mai@smartbus.ictu.vn');
      expect(result.role).toBe(Role.CONDUCTOR);
      expect(result.fullName).toBe('Lê Thị Mai');
      expect(result.faculty).toContain('Soát vé & Hỗ trợ hành khách');
      expect(mockRoleRepo.create).not.toHaveBeenCalled();
    });

    it('Tự động khởi tạo vai trò conductor với mô tả chuẩn tiếng Việt nếu DB chưa có', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockRoleRepo.findOne.mockResolvedValue(null);

      const result = await usersService.create({
        fullName: 'Trần Văn Nam',
        email: 'conductor.nam@smartbus.ictu.vn',
        password: 'Password@123',
        role: Role.CONDUCTOR,
      });

      expect(mockRoleRepo.create).toHaveBeenCalledWith({
        name: Role.CONDUCTOR,
        description: 'Phụ xe / Soát vé viên',
      });
      expect(mockRoleRepo.save).toHaveBeenCalled();
      expect(result.role).toBe(Role.CONDUCTOR);
    });

    it('Bảo mật: Mật khẩu của phụ xe phải được mã hóa bcrypt trước khi lưu CSDL', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockRoleRepo.findOne.mockResolvedValue({ id: 'role-1', name: Role.CONDUCTOR });

      await usersService.create({
        fullName: 'Phạm Hồng Ánh',
        email: 'conductor.anh@smartbus.ictu.vn',
        password: 'StaffSecret@123',
        role: Role.CONDUCTOR,
      });

      const savedPayload = mockUserRepo.create.mock.calls[0][0];
      expect(savedPayload.passwordHash).toBeDefined();
      expect(savedPayload.passwordHash).not.toBe('StaffSecret@123');
      const isMatch = await bcrypt.compare('StaffSecret@123', savedPayload.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('Ràng buộc: Báo lỗi ConflictException (409) khi email phụ xe đã tồn tại', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'existing-id',
        email: 'conductor.duplicate@smartbus.ictu.vn',
      });

      await expect(
        usersService.create({
          fullName: 'Người Trùng Email',
          email: 'conductor.duplicate@smartbus.ictu.vn',
          password: 'Password@123',
          role: Role.CONDUCTOR,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('Phụ xe không bắt buộc phải có GPLX Hạng D/E (khác với tài xế)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockRoleRepo.findOne.mockResolvedValue({ id: 'role-1', name: Role.CONDUCTOR });

      const result = await usersService.create({
        fullName: 'Nguyễn Văn Hòa',
        email: 'conductor.hoa@smartbus.ictu.vn',
        password: 'Staff@123',
        role: Role.CONDUCTOR,
        faculty: 'Hỗ trợ soát vé Tuyến CT-02',
      });

      expect(result).toBeDefined();
      expect(result.faculty).not.toContain('Hạng D');
      expect(result.faculty).not.toContain('Hạng E');
    });
  });

  describe('3. Ràng buộc Phân công Phụ xe trong TripsService (Trùng ca trực & Khả dụng)', () => {
    let tripsService: TripsService;
    let mockTripRepo: any;
    let mockRouteRepo: any;
    let mockVehicleRepo: any;
    let mockSeatRepo: any;
    let mockTicketRepo: any;
    let mockUserRepo: any;
    let mockNotificationCenterService: any;
    let mockFcmService: any;

    const targetTripId = 'trip-target-001';
    const conductorId = 'conductor-active-001';
    const vehicleId = 'veh-active-001';
    const driverId = 'driver-active-001';

    beforeEach(() => {
      mockTripRepo = {
        findOne: vi.fn(),
        save: vi.fn((entity) => Promise.resolve({ ...entity })),
        createQueryBuilder: vi.fn(),
      };
      mockRouteRepo = { findOne: vi.fn() };
      mockVehicleRepo = { findOne: vi.fn() };
      mockSeatRepo = { find: vi.fn() };
      mockTicketRepo = {
        createQueryBuilder: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          getCount: vi.fn().mockResolvedValue(2),
        })),
      };
      mockUserRepo = { findOne: vi.fn() };
      mockNotificationCenterService = {
        saveNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      };
      mockFcmService = {
        sendPushToUser: vi.fn().mockResolvedValue({ success: true, dispatchedCount: 1 }),
      };

      tripsService = new TripsService(
        mockTripRepo,
        mockRouteRepo,
        mockVehicleRepo,
        mockSeatRepo,
        mockTicketRepo,
        mockUserRepo,
        undefined,
        undefined,
        undefined,
        mockNotificationCenterService,
        mockFcmService,
      );
    });

    it('Chặn phân công nếu Phụ xe đã có ca trực trên chuyến khác trong cùng khung giờ (ConflictException)', async () => {
      const depTime = new Date('2026-10-09T08:00:00Z');
      const arrTime = new Date('2026-10-09T08:45:00Z');

      // Chuyến cần phân công
      mockTripRepo.findOne.mockImplementation(async (options: any) => {
        if (options?.where?.id === targetTripId) {
          return {
            id: targetTripId,
            tripCode: 'CT01-0800',
            departureTime: depTime,
            arrivalTime: arrTime,
            status: TripStatus.SCHEDULED,
            route: { id: 'route-1', name: 'Tuyến CT-01' },
          };
        }
        return null;
      });

      // Xe buýt hợp lệ
      mockVehicleRepo.findOne.mockResolvedValue({
        id: vehicleId,
        licensePlate: '20B-123.45',
        status: VehicleStatus.ACTIVE,
        seatCapacity: 29,
      });

      // Tài xế hợp lệ (Bằng Hạng D)
      mockUserRepo.findOne.mockImplementation(async (options: any) => {
        if (options?.where?.id === driverId) {
          return {
            id: driverId,
            fullName: 'Bác Tài Tuấn',
            status: UserStatus.ACTIVE,
            faculty: 'Hạng D (Xe buýt 29-45 chỗ)',
            role: { name: Role.DRIVER },
          };
        }
        if (options?.where?.id === conductorId) {
          return {
            id: conductorId,
            fullName: 'Cô Phụ Xe Mai',
            status: UserStatus.ACTIVE,
            faculty: 'Soát vé viên Tuyến CT-01',
            role: { name: Role.CONDUCTOR },
          };
        }
        return null;
      });

      // Giả lập QueryBuilder: Không trùng xe, Không trùng tài xế, nhưng TRÙNG PHỤ XE
      mockTripRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue({
          id: 'trip-conflict-999',
          tripCode: 'CT02-0815',
          departureTime: new Date('2026-10-09T08:15:00Z'),
          route: { name: 'Tuyến CT-02' },
        }),
      });

      await expect(
        tripsService.dispatch({
          tripId: targetTripId,
          vehicleId,
          driverId,
          conductorId,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('Phân công thành công khi Phụ xe sẵn sàng và gửi thông báo lịch trình đến phụ xe', async () => {
      const depTime = new Date('2026-10-09T09:00:00Z');
      const arrTime = new Date('2026-10-09T09:45:00Z');

      const tripMock = {
        id: targetTripId,
        tripCode: 'CT01-0900',
        departureTime: depTime,
        arrivalTime: arrTime,
        status: TripStatus.SCHEDULED,
        route: { id: 'route-1', name: 'Tuyến CT-01', routeCode: 'CT-01' },
        vehicle: { id: vehicleId, licensePlate: '20B-999.88', seatCapacity: 29 },
      };

      mockTripRepo.findOne.mockResolvedValue(tripMock);

      mockVehicleRepo.findOne.mockResolvedValue({
        id: vehicleId,
        licensePlate: '20B-999.88',
        status: VehicleStatus.ACTIVE,
        seatCapacity: 29,
      });

      mockUserRepo.findOne.mockImplementation(async (options: any) => {
        if (options?.where?.id === driverId) {
          return {
            id: driverId,
            fullName: 'Lái Xe Hùng',
            status: UserStatus.ACTIVE,
            faculty: 'Hạng E (Xe buýt trên 45 chỗ / nối toa)',
            role: { name: Role.DRIVER },
          };
        }
        if (options?.where?.id === conductorId) {
          return {
            id: conductorId,
            fullName: 'Phụ Xe Hương',
            status: UserStatus.ACTIVE,
            faculty: 'Hỗ trợ soát vé lưu động',
            role: { name: Role.CONDUCTOR },
          };
        }
        return null;
      });

      // Không có chuyến nào trùng lịch
      mockTripRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      });

      const res = await tripsService.dispatch({
        tripId: targetTripId,
        vehicleId,
        driverId,
        conductorId,
      });

      expect(res).toBeDefined();
      expect(mockTripRepo.save).toHaveBeenCalled();
      // Kiểm tra có gửi thông báo ca trực đến Phụ xe qua Notification Center
      expect(mockNotificationCenterService.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: conductorId,
          type: 'TRIP_ASSIGNED',
        }),
      );
    });
  });
});
