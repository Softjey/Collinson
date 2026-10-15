import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

export const IsCountryCode = (): PropertyDecorator =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toUpperCase() : value)),
    Matches(/^[A-Z]{2}$/),
  );
