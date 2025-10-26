export declare const ROLES: {
    readonly SUPERADMIN: "SUPERADMIN";
    readonly ADMIN: "ADMIN";
    readonly USER: "USER";
};
export type Role = (typeof ROLES)[keyof typeof ROLES];
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: Role[]) => import("@nestjs/common").CustomDecorator<string>;
