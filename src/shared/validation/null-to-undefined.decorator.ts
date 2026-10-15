import { Transform } from 'class-transformer';

export const NullToUndefined = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (value === null ? undefined : value));
