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
exports.BudgetsFeatureGuard = void 0;
const common_1 = require("@nestjs/common");
const client_config_constants_1 = require("../../config/client-config.constants");
let BudgetsFeatureGuard = class BudgetsFeatureGuard {
    clientConfig;
    constructor(clientConfig) {
        this.clientConfig = clientConfig;
    }
    canActivate(_context) {
        const enabled = Boolean(this.clientConfig?.featureFlags?.BUDGETS);
        if (!enabled) {
            throw new common_1.NotFoundException();
        }
        return true;
    }
};
exports.BudgetsFeatureGuard = BudgetsFeatureGuard;
exports.BudgetsFeatureGuard = BudgetsFeatureGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(client_config_constants_1.CLIENT_CONFIG_TOKEN)),
    __metadata("design:paramtypes", [Object])
], BudgetsFeatureGuard);
//# sourceMappingURL=budgets-feature.guard.js.map