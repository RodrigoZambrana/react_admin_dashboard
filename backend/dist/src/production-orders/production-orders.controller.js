"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionOrdersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const production_orders_service_1 = require("./production-orders.service");
const production_order_dto_1 = require("./dto/production-order.dto");
let ProductionOrdersController = class ProductionOrdersController {
    productionOrders;
    constructor(productionOrders) {
        this.productionOrders = productionOrders;
    }
    list(query) {
        return this.productionOrders.list(query);
    }
    summary() {
        return this.productionOrders.summary();
    }
    stats() {
        return this.productionOrders.stats();
    }
    findOne(id) {
        return this.productionOrders.findOne(id);
    }
    create(dto) {
        return this.productionOrders.create(dto);
    }
    update(id, dto) {
        return this.productionOrders.update(id, dto);
    }
    remove(id) {
        return this.productionOrders.remove(id);
    }
};
exports.ProductionOrdersController = ProductionOrdersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_order_dto_1.ProductionOrderListQueryDto]),
    __metadata("design:returntype", void 0)
], ProductionOrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionOrdersController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionOrdersController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProductionOrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_order_dto_1.CreateProductionOrderDto]),
    __metadata("design:returntype", void 0)
], ProductionOrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, production_order_dto_1.UpdateProductionOrderDto]),
    __metadata("design:returntype", void 0)
], ProductionOrdersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProductionOrdersController.prototype, "remove", null);
exports.ProductionOrdersController = ProductionOrdersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('production-orders'),
    __metadata("design:paramtypes", [production_orders_service_1.ProductionOrdersService])
], ProductionOrdersController);
//# sourceMappingURL=production-orders.controller.js.map