import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient

type StorefrontStockLineItem = {
  quantity: number
  product: {
    id: number
    stock: number | null
    permanentStock: boolean | null
    name?: string | null
  }
  variant?: {
    id: number
    stock: number | null
    permanentStock: boolean | null
    productId: number
  } | null
}

type ReservationTarget =
  | { type: 'product'; id: number; quantity: number; name?: string | null }
  | { type: 'variant'; id: number; quantity: number; name?: string | null }

@Injectable()
export class OrderStockIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  private buildReservationTargets(items: StorefrontStockLineItem[]): ReservationTarget[] {
    const grouped = new Map<string, ReservationTarget>()

    for (const item of items) {
      const quantity = Math.max(1, Math.round(Number(item.quantity ?? 1)))
      const variant = item.variant ?? null

      if (variant && variant.stock !== null && variant.stock !== undefined) {
        const isPermanent = Boolean(variant.permanentStock ?? false)
        if (isPermanent) {
          continue
        }
        const key = `variant:${variant.id}`
        const existing = grouped.get(key)
        if (existing) {
          existing.quantity += quantity
        } else {
          grouped.set(key, {
            type: 'variant',
            id: variant.id,
            quantity,
            name: item.product.name ?? null,
          })
        }
        continue
      }

      const isPermanent = Boolean(item.product.permanentStock ?? false)
      if (isPermanent) {
        continue
      }
      const key = `product:${item.product.id}`
      const existing = grouped.get(key)
      if (existing) {
        existing.quantity += quantity
      } else {
        grouped.set(key, {
          type: 'product',
          id: item.product.id,
          quantity,
          name: item.product.name ?? null,
        })
      }
    }

    return Array.from(grouped.values())
  }

  async commitStorefrontItems(items: StorefrontStockLineItem[], tx?: Prisma.TransactionClient) {
    const client = (tx ?? this.prisma) as PrismaClientOrTx
    const targets = this.buildReservationTargets(items)

    for (const target of targets) {
      if (target.type === 'variant') {
        const result = await client.productVariant.updateMany({
          where: {
            id: target.id,
            stock: {
              gte: target.quantity,
            },
          },
          data: {
            stock: {
              decrement: target.quantity,
            },
          },
        })

        if (result.count === 0) {
          throw new BadRequestException(
            `No hay stock suficiente para completar el pedido${target.name ? ` de "${target.name}"` : ''}.`,
          )
        }
        continue
      }

      const result = await client.product.updateMany({
        where: {
          id: target.id,
          stock: {
            gte: target.quantity,
          },
        },
        data: {
          stock: {
            decrement: target.quantity,
          },
        },
      })

      if (result.count === 0) {
        throw new BadRequestException(
          `No hay stock suficiente para completar el pedido${target.name ? ` de "${target.name}"` : ''}.`,
        )
      }
    }
  }

  async releaseOrderStock(orderId: number, tx?: Prisma.TransactionClient) {
    const client = (tx ?? this.prisma) as PrismaClientOrTx
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                stock: true,
                permanentStock: true,
                name: true,
              },
            },
            variant: {
              select: {
                id: true,
                stock: true,
                permanentStock: true,
                productId: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }

    const targets = this.buildReservationTargets(
      order.items.map((item) => ({
        quantity: item.qty,
        product: {
          id: item.product?.id ?? item.productId ?? 0,
          stock: item.product?.stock ?? null,
          permanentStock: item.product?.permanentStock ?? null,
          name: item.product?.name ?? item.nameSnapshot ?? item.name ?? null,
        },
        variant: item.variant,
      })),
    )

    for (const target of targets) {
      if (target.type === 'variant') {
        await client.productVariant.update({
          where: { id: target.id },
          data: {
            stock: {
              increment: target.quantity,
            },
          },
        })
        continue
      }

      await client.product.update({
        where: { id: target.id },
        data: {
          stock: {
            increment: target.quantity,
          },
        },
      })
    }
  }
}
