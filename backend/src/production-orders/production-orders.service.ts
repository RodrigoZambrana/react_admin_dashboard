import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, WorkOrderStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import {
  CreateProductionOrderDto,
  ProductionOrderListQueryDto,
  UpdateProductionOrderDto,
} from './dto/production-order.dto'

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient

@Injectable()
export class ProductionOrdersService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private async ensureAssigneeExists(client: PrismaClientOrTx, userId: number) {
    const user = await client.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new BadRequestException('production.orders.validation.assigneeNotFound')
    }
  }

  private ensureFeature() {
    const slug = (this.config.get<string>('CLIENT_SLUG') || this.config.get<string>('CLIENT') || '').toLowerCase()
    if (slug !== 'urucortinas') {
      throw new NotFoundException('production.orders.disabled')
    }
  }

  async list(query: ProductionOrderListQueryDto) {
    this.ensureFeature()
    const pageIndex = query.pageIndex && query.pageIndex > 0 ? query.pageIndex : 1
    const pageSize = query.pageSize && query.pageSize > 0 && query.pageSize <= 200 ? query.pageSize : 25

    const where: Prisma.ProductionOrderWhereInput = {}
    if (query.status) {
      where.status = query.status
    }
    if (query.orderId) {
      where.orderId = query.orderId
    }
    if (query.assignedToId) {
      where.assignedToId = query.assignedToId
    }
    if (query.priority) {
      where.priority = query.priority
    }
    if (query.search) {
      const term = query.search.trim()
      if (term) {
        const numericId = Number(term)
        const byId = Number.isFinite(numericId)
        where.OR = [
          { order: { customer: { name: { contains: term, mode: 'insensitive' } } } },
          { workOrder: { code: { contains: term, mode: 'insensitive' } } },
          ...(byId ? [{ id: numericId }] : []),
        ]
      }
    }

    const orderBy: Prisma.ProductionOrderOrderByWithRelationInput[] = (() => {
      const key = query.sortKey
      const order = query.sortOrder === 'desc' ? 'desc' : 'asc'
      if (key === 'scheduledAt') {
        return [{ scheduledAt: order }]
      }
      return [{ createdAt: order }]
    })()

    const [items, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        orderBy,
        skip: (pageIndex - 1) * pageSize,
        take: pageSize,
        include: {
          workOrder: true,
          order: {
            include: {
              customer: true,
            },
          },
          assignedTo: true,
        },
      }),
      this.prisma.productionOrder.count({ where }),
    ])

    return {
      data: items.map((item) => this.serialize(item)),
      total,
      pageIndex,
      pageSize,
    }
  }

  async summary() {
    this.ensureFeature()
    const grouped = await this.prisma.productionOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    })
    const total = grouped.reduce((acc, item) => acc + item._count._all, 0)
    const byStatus = Object.values(WorkOrderStatus).reduce<Record<string, number>>((acc, status) => {
      acc[status] = grouped.find((g) => g.status === status)?._count._all ?? 0
      return acc
    }, {})

    const overdue = await this.prisma.productionOrder.count({
      where: {
        status: { in: [WorkOrderStatus.PENDING, WorkOrderStatus.IN_PROGRESS] },
        scheduledAt: { lt: new Date() },
      },
    })

    return {
      total,
      byStatus,
      overdue,
    }
  }

  async stats() {
    this.ensureFeature()
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - 5)
    start.setDate(1)

    const raw = await this.prisma.productionOrder.findMany({
      where: { createdAt: { gte: start } },
      select: {
        createdAt: true,
        status: true,
      },
    })

    const buckets = new Map<string, { created: number; completed: number }>()
    const cursor = new Date(start)
    while (cursor <= now) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`
      buckets.set(key, { created: 0, completed: 0 })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    for (const item of raw) {
      const key = `${item.createdAt.getFullYear()}-${item.createdAt.getMonth() + 1}`
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.created += 1
        if (
          item.status === WorkOrderStatus.READY ||
          item.status === WorkOrderStatus.DELIVERED ||
          item.status === WorkOrderStatus.CLOSED
        ) {
          bucket.completed += 1
        }
      }
    }

    const labels: string[] = []
    const createdSeries: number[] = []
    const completedSeries: number[] = []
    buckets.forEach((value, key) => {
      const [year, month] = key.split('-').map((v) => Number(v))
      labels.push(`${String(month).padStart(2, '0')}/${String(year).slice(-2)}`)
      createdSeries.push(value.created)
      completedSeries.push(value.completed)
    })

    return {
      labels,
      created: createdSeries,
      completed: completedSeries,
    }
  }

  async findOne(id: number) {
    this.ensureFeature()
    const record = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        workOrder: true,
        order: {
          include: {
            customer: true,
          },
        },
        assignedTo: true,
      },
    })
    if (!record) {
      throw new NotFoundException('production.orders.notFound')
    }
    return this.serialize(record)
  }

  async create(dto: CreateProductionOrderDto) {
    this.ensureFeature()
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: { workOrders: { orderBy: { createdAt: 'desc' } } },
      })
      if (!order) {
        throw new BadRequestException('production.orders.validation.orderNotFound')
      }

      let workOrderId = dto.workOrderId ?? order.workOrders[0]?.id ?? null
      if (workOrderId && !order.workOrders.some((w) => w.id === workOrderId)) {
        throw new BadRequestException('production.orders.validation.workOrderMismatch')
      }
      if (!workOrderId) {
        const workOrder = await tx.workOrder.create({
          data: {
            orderId: order.id,
            status: dto.status ?? WorkOrderStatus.PENDING,
            code: this.generateWorkOrderCode(order.id),
          },
        })
        workOrderId = workOrder.id
      }

      const assignedToId =
        dto.assignedToId !== undefined && dto.assignedToId !== null ? dto.assignedToId : null
      if (assignedToId !== null) {
        await this.ensureAssigneeExists(tx, assignedToId)
      }

      const production = await tx.productionOrder.create({
        data: {
          orderId: order.id,
          workOrderId,
          status: dto.status ?? WorkOrderStatus.PENDING,
          priority: dto.priority ?? 1,
          assignedToId,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
          deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : null,
          notes: dto.notes?.trim() || null,
          metadata: dto.metadata ? this.safeJsonParse(dto.metadata) : null,
        },
        include: {
          workOrder: true,
          order: { include: { customer: true } },
          assignedTo: true,
        },
      })

      return this.serialize(production)
    })
  }

  async update(id: number, dto: UpdateProductionOrderDto) {
    this.ensureFeature()
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productionOrder.findUnique({ where: { id } })
      if (!existing) {
        throw new NotFoundException('production.orders.notFound')
      }
      const data: Prisma.ProductionOrderUpdateInput = {}
      if (dto.status) {
        data.status = dto.status
      }
      if (dto.priority !== undefined) {
        data.priority = dto.priority
      }
      if (dto.assignedToId !== undefined) {
        if (dto.assignedToId === null) {
          data.assignedTo = { disconnect: true }
        } else {
          await this.ensureAssigneeExists(tx, dto.assignedToId)
          data.assignedTo = { connect: { id: dto.assignedToId } }
        }
      }
      if (dto.scheduledAt !== undefined) {
        data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null
      }
      if (dto.startedAt !== undefined) {
        data.startedAt = dto.startedAt ? new Date(dto.startedAt) : null
      }
      if (dto.completedAt !== undefined) {
        data.completedAt = dto.completedAt ? new Date(dto.completedAt) : null
      }
      if (dto.deliveredAt !== undefined) {
        data.deliveredAt = dto.deliveredAt ? new Date(dto.deliveredAt) : null
      }
      if (dto.notes !== undefined) {
        const trimmed = dto.notes?.trim()
        data.notes = trimmed?.length ? trimmed : null
      }
      if (dto.metadata !== undefined) {
        data.metadata = dto.metadata ? this.safeJsonParse(dto.metadata) : null
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data,
        include: {
          workOrder: true,
          order: { include: { customer: true } },
          assignedTo: true,
        },
      })

      if (dto.status) {
        await tx.workOrder.update({
          where: { id: updated.workOrderId },
          data: { status: dto.status },
        })
      }

      return this.serialize(updated)
    })
  }

  async remove(id: number) {
    this.ensureFeature()
    await this.prisma.productionOrder.delete({ where: { id } })
    return true
  }

  private safeJsonParse(value?: string | null) {
    if (!value) {
      return null
    }
    try {
      return JSON.parse(value)
    } catch (error) {
      throw new BadRequestException('production.orders.validation.metadataJson')
    }
  }

  private generateWorkOrderCode(orderId: number) {
    const stamp = Date.now().toString(36).toUpperCase()
    return `WO-${orderId}-${stamp}`
  }

  private serialize(
    record: Prisma.ProductionOrderGetPayload<{
      include: {
        workOrder: true
        order: { include: { customer: true } }
        assignedTo: true
      }
    }>,
  ) {
    return {
      id: record.id,
      orderId: record.orderId,
      workOrderId: record.workOrderId,
      status: record.status,
      priority: record.priority,
      assignedToId: record.assignedToId,
      scheduledAt: record.scheduledAt?.toISOString() ?? null,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      deliveredAt: record.deliveredAt?.toISOString() ?? null,
      notes: record.notes ?? null,
      metadata: record.metadata ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      workOrder: record.workOrder,
      order: {
        id: record.order.id,
        code: record.workOrder.code,
        customer: record.order.customer
          ? {
              id: record.order.customer.id,
              name: record.order.customer.name,
            }
          : null,
      },
      assignedTo: record.assignedTo
        ? {
            id: record.assignedTo.id,
            name: record.assignedTo.name,
            lastName: record.assignedTo.lastName,
          }
        : null,
    }
  }
}
