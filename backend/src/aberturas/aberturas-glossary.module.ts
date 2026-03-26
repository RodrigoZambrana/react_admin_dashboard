import { Module } from '@nestjs/common'
import { AberturasGlossaryService } from './aberturas-glossary.service'
import { AberturasGlossaryController } from './aberturas-glossary.controller'
import { PrismaService } from '../prisma/prisma.service'
import { AberturasParserService } from './parser/aberturas-parser.service'

@Module({
  controllers: [AberturasGlossaryController],
  providers: [AberturasGlossaryService, AberturasParserService, PrismaService],
  exports: [AberturasGlossaryService, AberturasParserService],
})
export class AberturasGlossaryModule {}
