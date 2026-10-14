import { Module } from '@nestjs/common';
import { Clock, SystemClock } from './clock.js';

@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
export class ClockModule {}
