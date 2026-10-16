import { Transform } from 'class-transformer';

export const Deduplicate = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (Array.isArray(value) ? [...new Set<unknown>(value)] : value));
