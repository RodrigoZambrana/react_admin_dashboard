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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const sales_documents_service_1 = require("./sales-documents.service");
const order_dto_1 = require("../sales/dto/order.dto");
const multipart_1 = require("../common/uploads/multipart");
let OrdersController = class OrdersController {
    documents;
    constructor(documents) {
        this.documents = documents;
    }
    listOrders(q) {
        return this.documents.listDocuments(client_1.DocumentType.ORDER, q);
    }
    exportOrders(q) {
        return this.documents.exportDocuments(client_1.DocumentType.ORDER, q);
    }
    importOrders(req) {
        return this.documents.importDocuments(client_1.DocumentType.ORDER, req);
    }
    deleteOrders(body) {
        return this.documents.deleteDocuments(client_1.DocumentType.ORDER, body);
    }
    getOrderDetails(id) {
        return this.documents.getDocumentDetails(client_1.DocumentType.ORDER, id);
    }
    getOrderPdf(id) {
        return this.documents.getDocumentPdf(client_1.DocumentType.ORDER, id);
    }
    createOrder(dto) {
        return this.documents.createDocument(client_1.DocumentType.ORDER, dto);
    }
    replaceOrder(id, dto) {
        return this.documents.replaceDocument(client_1.DocumentType.ORDER, id, dto);
    }
    updateOrderComment(id, body) {
        return this.documents.updateDocumentComment(client_1.DocumentType.ORDER, id, body);
    }
    updateOrderStatus(id, body) {
        return this.documents.updateDocumentStatus(client_1.DocumentType.ORDER, id, body);
    }
    updateOrderPaymentMethod(id, body) {
        return this.documents.updateDocumentPaymentMethod(client_1.DocumentType.ORDER, id, body);
    }
    async uploadOrderDocument(id, req) {
        const { file } = await (0, multipart_1.parseSingleFileMultipart)(req);
        return this.documents.persistDocumentFile(client_1.DocumentType.ORDER, id, file);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "listOrders", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "exportOrders", null);
__decorate([
    (0, common_1.Post)('import'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "importOrders", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "deleteOrders", null);
__decorate([
    (0, common_1.Get)(':id/details'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getOrderDetails", null);
__decorate([
    (0, common_1.Get)(':id/pdf'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getOrderPdf", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "replaceOrder", null);
__decorate([
    (0, common_1.Patch)(':id/comment'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateOrderComment", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateOrderStatus", null);
__decorate([
    (0, common_1.Put)(':id/payment-method'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateOrderPaymentMethod", null);
__decorate([
    (0, common_1.Post)(':id/document'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "uploadOrderDocument", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [sales_documents_service_1.SalesDocumentsService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map