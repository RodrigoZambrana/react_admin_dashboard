import type { Role } from '../../auth/roles.decorator';
type RoleInput = Role | Lowercase<Role>;
export declare class CreateUserDto {
    name: string;
    lastName?: string;
    email: string;
    img?: string;
    role?: RoleInput;
    country?: string;
    countryCode?: string;
    city?: string;
}
export {};
