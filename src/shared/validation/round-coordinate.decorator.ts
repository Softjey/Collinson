import { Transform } from 'class-transformer';
import { roundCoordinate } from '../coordinates.js';

export const RoundCoordinate = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'number' ? roundCoordinate(value) : value));
