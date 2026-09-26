import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutesService } from '../../src/modules/transit/routes.service.js';
import { Repository } from 'typeorm';
import { RouteEntity } from '../../src/database/entities/route.entity.js';
import { RouteStationEntity } from '../../src/database/entities/route-station.entity.js';

describe('RoutesService - Keyword Search (STT 1)', () => {
  let routesService: RoutesService;
  let mockRouteRepo: any;
  let mockRouteStationRepo: any;
  let mockQueryBuilder: any;

  const sampleRoutes = [
    {
      id: 'route-uuid-1',
      routeCode: 'CT-01',
      name: 'ĐH CNTT & TT (ICTU) ↔ Bến Xe Trung Tâm Thái Nguyên',
      origin: 'ĐH CNTT & TT Thái Nguyên',
      destination: 'Bến Xe Trung Tâm Thái Nguyên',
      status: 'active',
      routeStations: [],
    },
    {
      id: 'route-uuid-2',
      routeCode: 'CT-02',
      name: 'Bến Xe Nam Thái Nguyên ↔ Gang Thép',
      origin: 'Bến Xe Nam',
      destination: 'Gang Thép',
      status: 'active',
      routeStations: [],
    },
  ];

  beforeEach(() => {
    mockQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(sampleRoutes),
    };

    mockRouteRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    mockRouteStationRepo = {
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    routesService = new RoutesService(
      mockRouteRepo as unknown as Repository<RouteEntity>,
      mockRouteStationRepo as unknown as Repository<RouteStationEntity>,
    );
  });

  it('should search routes by keyword using SQL parameter binding on routeCode and name', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([sampleRoutes[0]]);

    const result = await routesService.findAll({ keyword: 'CT-01' });

    expect(mockRouteRepo.createQueryBuilder).toHaveBeenCalledWith('route');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('route.status = :status', { status: 'active' });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      '(LOWER(route.routeCode) LIKE :keyword OR LOWER(route.name) LIKE :keyword)',
      { keyword: '%ct-01%' },
    );
    expect(result).toHaveLength(1);
    expect(result[0].routeCode).toBe('CT-01');
  });

  it('should trim whitespace and convert keyword to lowercase for case-insensitive search', async () => {
    await routesService.findAll({ keyword: '   Thái Nguyên   ' });

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      '(LOWER(route.routeCode) LIKE :keyword OR LOWER(route.name) LIKE :keyword)',
      { keyword: '%thái nguyên%' },
    );
  });

  it('should not add keyword where clause if keyword is empty or whitespace only', async () => {
    await routesService.findAll({ keyword: '    ' });

    // andWhere should NOT be called with keyword condition
    const calls = mockQueryBuilder.andWhere.mock.calls;
    const hasKeywordCall = calls.some((c: any[]) => c[0].includes('route.routeCode'));
    expect(hasKeywordCall).toBe(false);
  });
});
