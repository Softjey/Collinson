import { Module } from '@nestjs/common';
import { DateTimeScalar } from './date-time.scalar.js';
import { DateScalar } from './date.scalar.js';

@Module({
  providers: [DateScalar, DateTimeScalar],
})
export class ScalarsModule {}
