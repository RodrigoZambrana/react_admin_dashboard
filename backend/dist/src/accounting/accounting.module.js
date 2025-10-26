"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingModule = void 0;
const common_1 = require("@nestjs/common");
const accounting_controller_1 = require("./accounting.controller");
const payments_controller_1 = require("./payments.controller");
const payments_service_1 = require("./payments.service");
const orders_module_1 = require("../orders/orders.module");
let AccountingModule = class AccountingModule {
};
exports.AccountingModule = AccountingModule;
exports.AccountingModule = AccountingModule = __decorate([
    (0, common_1.Module)({
        imports: [orders_module_1.OrdersModule],
        controllers: [accounting_controller_1.AccountingController, payments_controller_1.PaymentsController],
        providers: [payments_service_1.PaymentsService],
    })
], AccountingModule);
//# sourceMappingURL=accounting.module.js.map