import { Injectable } from '@nestjs/common'

@Injectable()
export class M2DerivedProductStockService {
  async getStock(baseProductId: number, _sizeId: number, fallbackStock = 0): Promise<number> {
    void baseProductId
    return Number.isFinite(fallbackStock) ? Number(fallbackStock) : 0
  }
}
