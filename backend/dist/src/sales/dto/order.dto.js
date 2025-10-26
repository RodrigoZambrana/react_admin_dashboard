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
exports.CreateOrderDto = exports.ShippingDto = exports.AddressDto = exports.OrderItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const is_safe_string_decorator_1 = require("../../common/validation/is-safe-string.decorator");
const client_1 = require("@prisma/client");
class OrderItemDto {
    productId;
    name;
    price;
    qty;
    img;
    description;
    comments;
    specifications;
    currency;
    unitPrice;
    unitCurrency;
    customAttributes;
    pricingMethod;
}
exports.OrderItemDto = OrderItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OrderItemDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OrderItemDto.prototype, "qty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "img", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "comments", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "specifications", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OrderItemDto.prototype, "unitPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "unitCurrency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], OrderItemDto.prototype, "customAttributes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "pricingMethod", void 0);
class AddressDto {
    addressLine1;
    addressLine2;
    city;
    state;
    street;
    number;
    corner;
    apartment;
}
exports.AddressDto = AddressDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "addressLine1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "addressLine2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "state", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "street", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "corner", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], AddressDto.prototype, "apartment", void 0);
class ShippingDto {
    shippingVendor;
    deliveryFees;
    estimatedMin;
    estimatedMax;
}
exports.ShippingDto = ShippingDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], ShippingDto.prototype, "shippingVendor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ShippingDto.prototype, "deliveryFees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ShippingDto.prototype, "estimatedMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ShippingDto.prototype, "estimatedMax", void 0);
class CreateOrderDto {
    customerId;
    date;
    paymentMehod;
    orderCurrency;
    validUntilDate;
    validUntil;
    items;
    shippingAddress;
    billingAddress;
    billingSameAsShipping;
    shipping;
    comment;
    disclaimer;
    minimumDepositType;
    minimumDepositValue;
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "paymentMehod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "orderCurrency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "validUntilDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "validUntil", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OrderItemDto),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AddressDto),
    __metadata("design:type", AddressDto)
], CreateOrderDto.prototype, "shippingAddress", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AddressDto),
    __metadata("design:type", AddressDto)
], CreateOrderDto.prototype, "billingAddress", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateOrderDto.prototype, "billingSameAsShipping", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ShippingDto),
    __metadata("design:type", ShippingDto)
], CreateOrderDto.prototype, "shipping", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "comment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_safe_string_decorator_1.IsSafeString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "disclaimer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.DepositRequirementType),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "minimumDepositType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "minimumDepositValue", void 0);
//# sourceMappingURL=order.dto.js.map