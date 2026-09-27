import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutesService } from '../../src/modules/transit/routes.service.js';
import { Repository } from 'typeorm';
import { RouteEntity } from '../../src/database/entities/route.entity.js';
import { RouteStationEntity } from '../../src/database/entities/route-station.entity.js';

describe('RoutesService - Empty Result Handling (STT 1)', () => {
  let routesService: RoutesService;
  let mockRouteRepo: any;
  let mockRouteStationRepo: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([]),
      getMany: vi.fn().mockResolvedValue([]), // Returns empty array
    };

    mockRouteRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      findOne: vi.fn(),
    };

    mockRouteStationRepo = {};

    routesService = new RoutesService(
      mockRouteRepo as unknown as Repository<RouteEntity>,
      mockRouteStationRepo as unknown as Repository<RouteStationEntity>,
    );
  });

  it('should return an empty array when no routes match the search keyword without throwing errors', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    const result = await routesService.findAll({ keyword: 'TUYEN_KHONG_TON_TAI_999' });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should return an empty array when origin and destination have no matching routes without throwing errors', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    const result = await routesService.findAll({
      origin: 'Trạm Xa Xôi Nào Đó',
      destination: 'Trạm Khác Không Tồn Tại',
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});
