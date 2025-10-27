import type { CustomerProfile } from "@/types/storefront";

type Address = CustomerProfile["addresses"][number];

export default Address;
