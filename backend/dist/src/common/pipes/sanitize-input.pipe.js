"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizeInputPipe = void 0;
const common_1 = require("@nestjs/common");
const sanitize_1 = require("../utils/sanitize");
let SanitizeInputPipe = class SanitizeInputPipe {
    transform(value, metadata) {
        if (value === null || value === undefined) {
            return value;
        }
        if (metadata.type === 'body' || metadata.type === 'query' || metadata.type === 'param') {
            return (0, sanitize_1.sanitizeInput)(value);
        }
        return value;
    }
};
exports.SanitizeInputPipe = SanitizeInputPipe;
exports.SanitizeInputPipe = SanitizeInputPipe = __decorate([
    (0, common_1.Injectable)()
], SanitizeInputPipe);
//# sourceMappingURL=sanitize-input.pipe.js.map