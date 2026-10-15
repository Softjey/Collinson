import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { checkConnection } from '../generated/prisma/sql.js';
import { PrismaService } from '../shared/database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.prismaService.$queryRawTyped(checkConnection());
    } catch {
      throw new ServiceUnavailableException({ status: 'error' });
    }
    return { status: 'ok' };
  }
}
