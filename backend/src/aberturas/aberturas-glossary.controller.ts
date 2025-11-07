import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AberturasGlossaryService } from './aberturas-glossary.service'

@Controller('aberturas/glossary')
@UseGuards(JwtAuthGuard)
export class AberturasGlossaryController {
  constructor(private readonly service: AberturasGlossaryService) {}

  @Get()
  getAll() {
    return this.service.listGrouped()
  }

  @Get(':category')
  getByCategory(@Param('category') category: string) {
    return this.service.listByCategory(category)
  }

  @Post(':category')
  create(@Param('category') category: string, @Body() body: Record<string, unknown>) {
    return this.service.create(category, {
      category,
      label: String(body?.label ?? ''),
      value: body?.value ? String(body.value) : undefined,
      adjustPct: typeof body?.adjustPct === 'number' ? (body.adjustPct as number) : undefined,
    })
  }

  @Put('items/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.service.update(id, {
      category: String(body?.category ?? ''),
      label: String(body?.label ?? ''),
      value: body?.value ? String(body.value) : undefined,
      adjustPct: typeof body?.adjustPct === 'number' ? (body.adjustPct as number) : undefined,
    })
  }

  @Delete('items/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }
}
