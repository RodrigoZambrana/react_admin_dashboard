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
exports.BudgetsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const sales_documents_service_1 = require("./sales-documents.service");
const order_dto_1 = require("../sales/dto/order.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const budgets_feature_guard_1 = require("./guards/budgets-feature.guard");
const multipart_1 = require("../common/uploads/multipart");
let BudgetsController = class BudgetsController {
    documents;
    constructor(documents) {
        this.documents = documents;
    }
    listBudgets(q) {
        return this.documents.listDocuments(client_1.DocumentType.BUDGET, q);
    }
    exportBudgets(q) {
        return this.documents.exportDocuments(client_1.DocumentType.BUDGET, q);
    }
    importBudgets(req) {
        return this.documents.importDocuments(client_1.DocumentType.BUDGET, req);
    }
    deleteBudgets(body) {
        return this.documents.deleteDocuments(client_1.DocumentType.BUDGET, body);
    }
    getBudgetDetails(id) {
        return this.documents.getDocumentDetails(client_1.DocumentType.BUDGET, id);
    }
    getBudgetPdf(id) {
        return this.documents.getDocumentPdf(client_1.DocumentType.BUDGET, id);
    }
    createBudget(dto) {
        return this.documents.createDocument(client_1.DocumentType.BUDGET, dto);
    }
    replaceBudget(id, dto) {
        return this.documents.replaceDocument(client_1.DocumentType.BUDGET, id, dto);
    }
    updateBudgetComment(id, body) {
        return this.documents.updateDocumentComment(client_1.DocumentType.BUDGET, id, body);
    }
    updateBudgetStatus(id, body) {
        return this.documents.updateDocumentStatus(client_1.DocumentType.BUDGET, id, body);
    }
    updateBudgetPaymentMethod(id, body) {
        return this.documents.updateDocumentPaymentMethod(client_1.DocumentType.BUDGET, id, body);
    }
    async uploadBudgetDocument(id, req) {
        const { file } = await (0, multipart_1.parseSingleFileMultipart)(req);
        return this.documents.persistDocumentFile(client_1.DocumentType.BUDGET, id, file);
    }
    sendBudget(id, req) {
        const userId = req.user?.id ?? null;
        return this.documents.sendBudget(id, userId);
    }
    confirmBudget(id, req) {
        const userId = req.user?.id ?? null;
        return this.documents.confirmBudget(id, userId);
    }
};
exports.BudgetsController = BudgetsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "listBudgets", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "exportBudgets", null);
__decorate([
    (0, common_1.Post)('import'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "importBudgets", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "deleteBudgets", null);
__decorate([
    (0, common_1.Get)(':id/details'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "getBudgetDetails", null);
__decorate([
    (0, common_1.Get)(':id/pdf'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "getBudgetPdf", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "createBudget", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "replaceBudget", null);
__decorate([
    (0, common_1.Patch)(':id/comment'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "updateBudgetComment", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "updateBudgetStatus", null);
__decorate([
    (0, common_1.Put)(':id/payment-method'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "updateBudgetPaymentMethod", null);
__decorate([
    (0, common_1.Post)(':id/document'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "uploadBudgetDocument", null);
__decorate([
    (0, common_1.Post)(':id/send'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "sendBudget", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], BudgetsController.prototype, "confirmBudget", null);
exports.BudgetsController = BudgetsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, budgets_feature_guard_1.BudgetsFeatureGuard),
    (0, common_1.Controller)('budgets'),
    __metadata("design:paramtypes", [sales_documents_service_1.SalesDocumentsService])
], BudgetsController);
//# sourceMappingURL=budgets.controller.js.map