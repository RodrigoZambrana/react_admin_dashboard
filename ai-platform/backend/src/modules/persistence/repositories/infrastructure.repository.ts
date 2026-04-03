import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InfrastructureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async pingDatabase() {
    const result = await this.prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    return result[0]?.ok === 1;
  }

  async listPublicTables() {
    const tables = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name ASC
    `;

    return tables.map((table) => table.table_name);
  }
}
