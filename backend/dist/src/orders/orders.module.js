"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const orders_controller_1 = require("./orders.controller");
const budgets_controller_1 = require("./budgets.controller");
const sales_documents_service_1 = require("./sales-documents.service");
const budgets_feature_guard_1 = require("./guards/budgets-feature.guard");
const order_finance_service_1 = require("./order-finance.service");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        controllers: [orders_controller_1.OrdersController, budgets_controller_1.BudgetsController],
        providers: [sales_documents_service_1.SalesDocumentsService, budgets_feature_guard_1.BudgetsFeatureGuard, order_finance_service_1.OrderFinanceService],
        exports: [sales_documents_service_1.SalesDocumentsService, order_finance_service_1.OrderFinanceService],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map