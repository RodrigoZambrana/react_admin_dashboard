import ApiService from './ApiService'

export type CmsPageStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type CmsPageScope = 'GENERAL_SITE' | 'STOREFRONT'
export type CmsPageSectionType =
  | 'SITE_HEADER'
  | 'HERO'
  | 'FEATURE_GRID'
  | 'MEDIA_GRID'
  | 'MEDIA_CAROUSEL'
  | 'CONTENT_SPLIT'
  | 'FAQ'
  | 'RICH_TEXT'
  | 'CTA_BANNER'
  | 'BUDGET_CALCULATOR'
  | 'SITE_FOOTER'
export type CmsPageBlockType =
  | 'TEXT'
  | 'IMAGE'
  | 'BUTTON'
  | 'LIST_ITEM'
  | 'RICH_TEXT'
  | 'FAQ_ITEM'
  | 'CARD'
export type CmsMediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'EMBED' | 'AUDIO'

export type CmsPageMedia = {
  id: number
  url: string
  type: CmsMediaType
  alt?: string | null
  title?: string | null
  mimeType?: string | null
  fileName?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  source?: string | null
  metadata?: Record<string, unknown> | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export type CmsPageBlock = {
  id?: number
  type: CmsPageBlockType
  key?: string | null
  name?: string | null
  sortOrder: number
  visible: boolean
  content?: Record<string, unknown> | null
  mediaId?: number | null
  media?: CmsPageMedia | null
}

export type CmsPageSection = {
  id?: number
  type: CmsPageSectionType
  key?: string | null
  name?: string | null
  sortOrder: number
  visible: boolean
  settings?: Record<string, unknown> | null
  blocks: CmsPageBlock[]
}

export type CmsPage = {
  id?: number
  path: string
  aliases?: string[]
  title: string
  summary?: string | null
  scope: CmsPageScope
  locale: string
  status: CmsPageStatus
  visible: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  seoImageUrl?: string | null
  layoutKey?: string | null
  legacySource?: string | null
  sections: CmsPageSection[]
}

export type CmsPageListItem = {
  id: number
  path: string
  title: string
  summary?: string | null
  scope: CmsPageScope
  locale: string
  status: CmsPageStatus
  visible: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  seoImageUrl?: string | null
  layoutKey?: string | null
  legacySource?: string | null
  updatedAt?: string
  _count?: {
    sections: number
  }
}

const CmsPagesService = {
  async listPages(params?: Record<string, unknown>) {
    return ApiService.fetchData<CmsPageListItem[]>({
      url: '/cms/pages',
      method: 'get',
      params,
    })
  },

  async getPage(id: number) {
    return ApiService.fetchData<CmsPage>({
      url: `/cms/pages/${id}`,
      method: 'get',
    })
  },

  async createPage(payload: CmsPage) {
    return ApiService.fetchData<CmsPage>({
      url: '/cms/pages',
      method: 'post',
      data: payload,
    })
  },

  async updatePage(id: number, payload: CmsPage) {
    return ApiService.fetchData<CmsPage>({
      url: `/cms/pages/${id}`,
      method: 'put',
      data: payload,
    })
  },

  async deletePage(id: number) {
    return ApiService.fetchData<{ ok: boolean }>({
      url: `/cms/pages/${id}`,
      method: 'delete',
    })
  },

  async listMedia(params?: Record<string, unknown>) {
    return ApiService.fetchData<CmsPageMedia[]>({
      url: '/cms/media',
      method: 'get',
      params,
    })
  },

  async createMedia(payload: Partial<CmsPageMedia>) {
    return ApiService.fetchData<CmsPageMedia>({
      url: '/cms/media',
      method: 'post',
      data: payload,
    })
  },

  async updateMedia(id: number, payload: Partial<CmsPageMedia>) {
    return ApiService.fetchData<CmsPageMedia>({
      url: `/cms/media/${id}`,
      method: 'put',
      data: payload,
    })
  },

  async deleteMedia(id: number) {
    return ApiService.fetchData<{ ok: boolean }>({
      url: `/cms/media/${id}`,
      method: 'delete',
    })
  },

  async uploadMedia(formData: FormData) {
    return ApiService.fetchData<CmsPageMedia, FormData>({
      url: '/cms/media/upload',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

export default CmsPagesService
