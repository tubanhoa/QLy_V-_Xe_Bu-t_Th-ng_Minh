import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchRouteDto } from '../../src/modules/transit/dto/transit.dto.js';

describe('SearchRouteDto Validation & Parameter Binding', () => {
  it('should accept valid search query with origin and destination', async () => {
    const rawData = {
      origin: 'ĐH CNTT & TT Thái Nguyên',
      destination: 'Bến xe Trung tâm Thái Nguyên',
      keyword: 'CT-01',
    };
    const dto = plainToInstance(SearchRouteDto, rawData);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.origin).toBe('ĐH CNTT & TT Thái Nguyên');
    expect(dto.destination).toBe('Bến xe Trung tâm Thái Nguyên');
    expect(dto.keyword).toBe('CT-01');
  });

  it('should accept empty query parameters without errors', async () => {
    const dto = plainToInstance(SearchRouteDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.origin).toBeUndefined();
  });
});
