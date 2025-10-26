declare class CustomerStatusPayloadDto {
    id?: number;
    name?: string;
    color?: string;
}
declare class CustomerAddressDto {
    street?: string;
    number?: string;
    corner?: string;
    apartment?: string;
    city?: string;
    country?: string;
    comments?: string;
    isPrimary?: boolean;
}
declare class CustomerPersonalInfoDto {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    img?: string;
    location?: string;
    title?: string;
    facebook?: string;
    twitter?: string;
    pinterest?: string;
    linkedIn?: string;
    phoneNumber?: string;
    phoneNumbers?: string[];
    birthday?: string;
}
export declare class UpdateCustomerDto {
    id?: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string | null;
    img?: string;
    location?: string;
    title?: string;
    facebook?: string;
    twitter?: string;
    pinterest?: string;
    linkedIn?: string;
    phoneNumber?: string;
    phoneNumbers?: string[];
    personalInfo?: CustomerPersonalInfoDto;
    status?: CustomerStatusPayloadDto;
    address?: CustomerAddressDto;
    statusId?: number | null;
    statusName?: string;
    birthday?: string;
}
export {};
