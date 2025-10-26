import type {
  AuthSession,
  CategorySummary,
  CreateOrderPayload,
  HomeLayoutDefinition,
  OrderSummary,
  PaginatedResponse,
  ProductDetail,
  ProductListQuery,
  ProductSummary,
  StorefrontConfig,
} from "@/types/storefront"
import { apiFetch, ApiError } from "@/lib/http"

export const StorefrontApi = {
  async getConfig(): Promise<StorefrontConfig> {
    return apiFetch<StorefrontConfig>("config", {
      cache: "no-store",
    })
  },

  async getHomeLayout(layoutKey: string): Promise<HomeLayoutDefinition> {
    return apiFetch<HomeLayoutDefinition>(`home-layouts/${encodeURIComponent(layoutKey)}`, {
      cache: "no-store",
    })
  },

  async listProducts(query: ProductListQuery = {}): Promise<PaginatedResponse<ProductSummary>> {
    return apiFetch<PaginatedResponse<ProductSummary>>("products", {
      params: {
        page: query.page,
        pageSize: query.pageSize,
        category: query.categorySlug,
        search: query.search,
        sort: query.sort,
        tag: query.tag,
      },
      cache: "no-store",
    })
  },

  async getProduct(slugOrId: string): Promise<ProductDetail> {
    return apiFetch<ProductDetail>(`products/${encodeURIComponent(slugOrId)}`, {
      cache: "no-store",
    })
  },

  async listCategories(): Promise<CategorySummary[]> {
    return apiFetch<CategorySummary[]>("categories", {
      cache: "no-store",
    })
  },

  async getRecommendations(productId: number, limit = 8): Promise<ProductSummary[]> {
    return apiFetch<ProductSummary[]>(`products/${productId}/recommendations`, {
      params: { limit },
      cache: "no-store",
    })
  },

  async login(email: string, password: string): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    })
  },

  async register(payload: {
    email: string
    password: string
    firstName: string
    lastName: string
  }): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    })
  },

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    })
  },

  async createOrder(payload: CreateOrderPayload): Promise<OrderSummary> {
    return apiFetch<OrderSummary>("orders", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    })
  },
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError
