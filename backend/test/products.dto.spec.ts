import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProductDto } from '../src/products/products.controller';

describe('UpdateProductDto validation', () => {
  it('preserves false when isActive is sent as the string "false"', async () => {
    const dto = plainToInstance(UpdateProductDto, { isActive: 'false' });
    expect(dto.isActive).toBe(false);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('converts the string "true" to boolean true', async () => {
    const dto = plainToInstance(UpdateProductDto, { isActive: 'true' });
    expect(dto.isActive).toBe(true);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid boolean strings', async () => {
    const dto = plainToInstance(UpdateProductDto, { isActive: 'not-a-boolean' });
    expect(dto.isActive).toBe('not-a-boolean');
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'isActive')).toBe(true);
  });
});
