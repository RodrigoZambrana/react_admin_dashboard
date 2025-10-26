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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableQueryDto = exports.UpdateProductDto = exports.UpsertProductDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const is_safe_string_decorator_1 = require("../../common/validation/is-safe-string.decorator");
const client_1 = require("@prisma/client");
class ProductImagePayload {
    id;
    name;
    img;
}
__decorate([
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], ProductImagePayload.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], ProductImagePayload.prototype, "name", void 0);
__decorate([
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], ProductImagePayload.prototype, "img", void 0);
class ProductSortDto {
    key;
    order;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], ProductSortDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['asc', 'desc', '']),
    __metadata("design:type", String)
], ProductSortDto.prototype, "order", void 0);
class UpsertProductDto {
    id;
    name;
    productCode;
    img;
    description;
    specifications;
    categoryId;
    costPrice;
    salePrice;
    currency;
    unitOfMeasure;
    stock;
    permanentStock;
    costPerItem;
    bulkDiscountPrice;
    tags;
    brand;
    vendor;
    published;
    imgList;
}
exports.UpsertProductDto = UpsertProductDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpsertProductDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "productCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "img", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "specifications", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpsertProductDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpsertProductDto.prototype, "costPrice", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpsertProductDto.prototype, "salePrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SalesUnit),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "unitOfMeasure", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpsertProductDto.prototype, "stock", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductDto.prototype, "permanentStock", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpsertProductDto.prototype, "costPerItem", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpsertProductDto.prototype, "bulkDiscountPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertProductDto.prototype, "tags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "brand", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpsertProductDto.prototype, "vendor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductDto.prototype, "published", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ProductImagePayload),
    __metadata("design:type", Array)
], UpsertProductDto.prototype, "imgList", void 0);
class UpdateProductDto {
    id;
    name;
    productCode;
    img;
    description;
    specifications;
    categoryId;
    costPrice;
    salePrice;
    currency;
    unitOfMeasure;
    stock;
    permanentStock;
    costPerItem;
    bulkDiscountPrice;
    tags;
    brand;
    vendor;
    published;
    imgList;
}
exports.UpdateProductDto = UpdateProductDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "productCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "img", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "specifications", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "costPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "salePrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SalesUnit),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "unitOfMeasure", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "stock", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductDto.prototype, "permanentStock", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "costPerItem", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "bulkDiscountPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateProductDto.prototype, "tags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "brand", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "vendor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductDto.prototype, "published", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ProductImagePayload),
    __metadata("design:type", Array)
], UpdateProductDto.prototype, "imgList", void 0);
class TableQueryDto {
    pageIndex;
    pageSize;
    query;
    sort;
    filterData;
}
exports.TableQueryDto = TableQueryDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TableQueryDto.prototype, "pageIndex", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TableQueryDto.prototype, "pageSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], TableQueryDto.prototype, "query", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ProductSortDto),
    __metadata("design:type", ProductSortDto)
], TableQueryDto.prototype, "sort", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], TableQueryDto.prototype, "filterData", void 0);
//# sourceMappingURL=product.dto.js.map