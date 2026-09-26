import { describe, it, expect } from 'vitest';

describe('Intermediate Stations Matching Logic', () => {
  const mockRouteStations = [
    { stopOrder: 1, stationName: 'Trạm ĐH CNTT & TT Thái Nguyên (ICTU)' },
    { stopOrder: 2, stationName: 'Trạm Cổng KTX ĐH Thái Nguyên' },
    { stopOrder: 3, stationName: 'Trạm Ngã 3 Mỏ Chè' },
    { stopOrder: 4, stationName: 'Trạm Bệnh Viện Đa Khoa Trung Ương' },
    { stopOrder: 5, stationName: 'Trạm Bến Xe Trung Tâm Thái Nguyên' },
  ];

  it('should match intermediate station correctly by partial keyword', () => {
    const searchOrigin = 'cổng ktx';
    const searchDest = 'bệnh viện';

    const originStop = mockRouteStations.find((s) =>
      s.stationName.toLowerCase().includes(searchOrigin.toLowerCase()),
    );
    const destStop = mockRouteStations.find((s) =>
      s.stationName.toLowerCase().includes(searchDest.toLowerCase()),
    );

    expect(originStop).toBeDefined();
    expect(destStop).toBeDefined();
    expect(originStop!.stopOrder).toBe(2);
    expect(destStop!.stopOrder).toBe(4);
    expect(originStop!.stopOrder < destStop!.stopOrder).toBe(true);
  });

  it('should reject when destination stop appears before origin stop in route order', () => {
    const searchOrigin = 'Bến Xe';
    const searchDest = 'KTX';

    const originStop = mockRouteStations.find((s) =>
      s.stationName.toLowerCase().includes(searchOrigin.toLowerCase()),
    );
    const destStop = mockRouteStations.find((s) =>
      s.stationName.toLowerCase().includes(searchDest.toLowerCase()),
    );

    expect(originStop!.stopOrder).toBe(5);
    expect(destStop!.stopOrder).toBe(2);
    const isValidDirection = originStop!.stopOrder < destStop!.stopOrder;
    expect(isValidDirection).toBe(false);
  });
});
