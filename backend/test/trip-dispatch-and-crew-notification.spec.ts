import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TripsService } from '../src/modules/trips/trips.service.js';
import { TripsController } from '../src/modules/trips/trips.controller.js';
import { TripStatus, VehicleStatus, UserStatus, TicketStatus } from '../src/common/constants/status.constant.js';
import { Role } from '../src/common/constants/roles.constant.js';

describe('Trips Dispatch & Crew Notification (Tác vụ hoàn thiện điều phối)', () => {
  let tripsService: TripsService;
  let tripsController: TripsController;

  let mockTripRepo: any;
  let mockRouteRepo: any;
  let mockVehicleRepo: any;
  let mockSeatRepo: any;
  let mockTicketRepo: any;
  let mockUserRepo: any;
  let mockNotificationCenterService: any;
  let mockFcmService: any;

  const sampleTripId = 'trip-1111-2222-3333';
  const sampleVehicleId = 'veh-1111-2222-3333';
  const sampleDriverId = 'drv-1111-2222-3333';
  const sampleConductorId = 'cnd-1111-2222-3333';

  beforeEach(() => {
    mockTripRepo = {
      findOne: vi.fn(),
      save: vi.fn((entity) => Promise.resolve({ ...entity, id: entity.id || sampleTripId })),
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
        getCount: vi.fn().mockResolvedValue(5),
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

    tripsController = new TripsController(tripsService);
  });

  describe('Tác vụ 1 & 4: Điều kiện phân công xe trong dispatch()', () => {
    it('Chặn phân công xe bảo dưỡng (maintenance) -> 400 Bad Request', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
      });

      mockVehicleRepo.findOne.mockResolvedValue({
        id: sampleVehicleId,
        licensePlate: '20B-123.45',
        status: VehicleStatus.MAINTENANCE,
        seatCapacity: 29,
      });

      await expect(
        tripsService.dispatch({ tripId: sampleTripId, vehicleId: sampleVehicleId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Chặn phân công xe ngừng hoạt động (retired) -> 400 Bad Request', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
      });

      mockVehicleRepo.findOne.mockResolvedValue({
        id: sampleVehicleId,
        licensePlate: '20B-999.99',
        status: VehicleStatus.RETIRED,
        seatCapacity: 29,
      });

      await expect(
        tripsService.dispatch({ tripId: sampleTripId, vehicleId: sampleVehicleId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Chặn phân công xe thiếu chỗ so với lượng vé đã đặt (seatCapacity < bookedCount) -> 400 Bad Request', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
      });

      mockVehicleRepo.findOne.mockResolvedValue({
        id: sampleVehicleId,
        licensePlate: '20B-123.45',
        status: VehicleStatus.ACTIVE,
        seatCapacity: 4, // bookedCount = 5
      });

      await expect(
        tripsService.dispatch({ tripId: sampleTripId, vehicleId: sampleVehicleId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Chặn tài xế bị khóa (status !== ACTIVE) -> 400 Bad Request', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
      });

      mockUserRepo.findOne.mockResolvedValue({
        id: sampleDriverId,
        fullName: 'Nguyễn Văn Khóa',
        status: UserStatus.LOCKED,
        role: { name: Role.DRIVER },
        faculty: 'Hạng D',
      });

      await expect(
        tripsService.dispatch({ tripId: sampleTripId, driverId: sampleDriverId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Chặn tài xế không đủ điều kiện giấy phép lái xe Hạng D/E -> 400 Bad Request', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
      });

      mockUserRepo.findOne.mockResolvedValue({
        id: sampleDriverId,
        fullName: 'Lê Văn Non',
        status: UserStatus.ACTIVE,
        role: { name: Role.DRIVER },
        faculty: 'Bằng Hạng B2 (Xe con)',
      });

      await expect(
        tripsService.dispatch({ tripId: sampleTripId, driverId: sampleDriverId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Chặn phụ xe bị khóa hoặc không active -> 400 Bad Request', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
      });

      mockUserRepo.findOne.mockResolvedValue({
        id: sampleConductorId,
        fullName: 'Phạm Phụ Xe Khóa',
        status: UserStatus.LOCKED,
      });

      await expect(
        tripsService.dispatch({ tripId: sampleTripId, conductorId: sampleConductorId }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Tác vụ 2: Dispatch hợp lệ & Gửi thông báo tự động (In-App + FCM)', () => {
    it('Phân công hợp lệ: lưu vào CSDL và tự động gửi thông báo TRIP_ASSIGNED cho tài xế & phụ xe', async () => {
      const tripMock = {
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
        route: { routeCode: ' tuyến 01', name: 'Đại Học CNTT - Bến Xe Thái Nguyên' },
        vehicle: { licensePlate: '20B-123.45', seatCapacity: 29 },
      };

      mockTripRepo.findOne.mockResolvedValue(tripMock);

      mockVehicleRepo.findOne.mockResolvedValue({
        id: sampleVehicleId,
        licensePlate: '20B-123.45',
        status: VehicleStatus.ACTIVE,
        seatCapacity: 29,
      });

      mockUserRepo.findOne
        .mockResolvedValueOnce({
          id: sampleDriverId,
          fullName: 'Trần Văn Nam',
          status: UserStatus.ACTIVE,
          role: { name: Role.DRIVER },
          faculty: 'Hạng D (Xe 29 chỗ)',
        })
        .mockResolvedValueOnce({
          id: sampleConductorId,
          fullName: 'Nguyễn Phụ Xe',
          status: UserStatus.ACTIVE,
          role: { name: Role.DRIVER },
        });

      // No conflicts
      mockTripRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      });

      const res = await tripsService.dispatch({
        tripId: sampleTripId,
        vehicleId: sampleVehicleId,
        driverId: sampleDriverId,
        conductorId: sampleConductorId,
      });

      expect(res).toBeDefined();
      expect(mockNotificationCenterService.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleDriverId,
          type: 'TRIP_ASSIGNED',
        }),
      );
      expect(mockNotificationCenterService.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleConductorId,
          type: 'TRIP_ASSIGNED',
        }),
      );
      expect(mockFcmService.sendPushToUser).toHaveBeenCalledWith(
        sampleDriverId,
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('Cơ chế điều chuyển: Gửi TRIP_UNASSIGNED cho tài xế cũ khi đổi sang tài xế mới', async () => {
      const oldDriverId = 'old-driver-999';
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        status: TripStatus.SCHEDULED,
        driverId: oldDriverId,
        route: { routeCode: ' tuyến 01', name: 'Đại Học CNTT - Bến Xe Thái Nguyên' },
        vehicle: { licensePlate: '20B-123.45' },
      });

      mockUserRepo.findOne.mockResolvedValue({
        id: sampleDriverId,
        fullName: 'Trần Văn Nam',
        status: UserStatus.ACTIVE,
        role: { name: Role.DRIVER },
        faculty: 'Hạng D',
      });

      mockTripRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      });

      await tripsService.dispatch({
        tripId: sampleTripId,
        driverId: sampleDriverId,
      });

      // Kiểm tra có thông báo TRIP_UNASSIGNED gửi cho tài xế cũ
      expect(mockNotificationCenterService.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: oldDriverId,
          type: 'TRIP_UNASSIGNED',
        }),
      );
    });
  });

  describe('Tác vụ 3: POST /trips/:id/notify-crew (API chủ động gửi lại thông báo lịch trình)', () => {
    it('Ném 400 BadRequest nếu chuyến chưa gán tài xế hoặc phụ xe', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        driverId: null,
        conductorId: null,
      });

      await expect(tripsService.notifyCrew(sampleTripId)).rejects.toThrow(BadRequestException);
    });

    it('Gửi thành công thông báo tóm tắt lịch trình chi tiết và trả về cấu trúc chuẩn', async () => {
      mockTripRepo.findOne.mockResolvedValue({
        id: sampleTripId,
        driverId: sampleDriverId,
        conductorId: sampleConductorId,
        departureTime: new Date('2026-10-10T08:00:00Z'),
        arrivalTime: new Date('2026-10-10T09:00:00Z'),
        route: { routeCode: ' tuyến 01', name: 'Tuyến số 01 ICTU' },
        vehicle: { licensePlate: '20B-123.45', seatCapacity: 29 },
      });

      const result = await tripsController.notifyCrew(sampleTripId);

      expect(result).toEqual({
        success: true,
        message: 'Đã gửi thông báo lịch trình làm việc đến tổ xe thành công',
        data: {
          tripId: sampleTripId,
          notifiedDriverId: sampleDriverId,
          notifiedConductorId: sampleConductorId,
        },
      });

      expect(mockNotificationCenterService.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleDriverId,
          type: 'TRIP_ASSIGNED',
        }),
      );
      expect(mockNotificationCenterService.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleConductorId,
          type: 'TRIP_ASSIGNED',
        }),
      );
    });
  });
});
