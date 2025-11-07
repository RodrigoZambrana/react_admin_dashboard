import { Module } from '@nestjs/common'
import { AberturasGlossaryService } from './aberturas-glossary.service'
import { AberturasGlossaryController } from './aberturas-glossary.controller'
import { PrismaService } from '../prisma/prisma.service'

@Module({
  controllers: [AberturasGlossaryController],
  providers: [AberturasGlossaryService, PrismaService],
  exports: [AberturasGlossaryService],
})
export class AberturasGlossaryModule {}
