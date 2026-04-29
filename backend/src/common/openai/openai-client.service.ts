import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SecureConfigService } from '../security/secure-config.service'

export type OpenAiRuntimeConfig = {
  enabled?: boolean
  provider?: 'mock' | 'openai' | 'ollama' | null
  model?: string | null
  openAiApiKey?: string | null
}

export type OpenAiRequestOptions = {
  apiKey?: string | null
  headers?: Record<string, string>
  timeoutMs?: number
}

@Injectable()
export class OpenAiClientService {
  static readonly AI_RUNTIME_CONFIG_KEY = 'AI_RUNTIME_CONFIG'
  static readonly OPENAI_BASE_URL = 'https://api.openai.com/v1'
  static readonly DEFAULT_TIMEOUT_MS = 12_000

  constructor(
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
  ) {}

  async resolveRuntimeConfig(
    configKey: string = OpenAiClientService.AI_RUNTIME_CONFIG_KEY,
  ): Promise<OpenAiRuntimeConfig> {
    let stored: { value: OpenAiRuntimeConfig; updatedAt: Date } | null = null
    try {
      stored = await this.secureConfig.getJson<OpenAiRuntimeConfig>(configKey)
    } catch {
      stored = null
    }
    const envApiKey =
      this.config.get<string>('API_KEY_OPEN_IA')?.trim() ||
      this.config.get<string>('API_KEY_OPEN_IA_NEW')?.trim() ||
      this.config.get<string>('OPENAI_API_KEY')?.trim() ||
      this.config.get<string>('API_KEY_OPEM_IA')?.trim() ||
      ''
    const storedApiKey = stored?.value?.openAiApiKey?.trim() ?? ''
    return {
      enabled:
        stored?.value?.enabled ??
        ((this.config.get<string>('AI_ENABLED') ?? 'true') === 'true'),
      provider:
        stored?.value?.provider ??
        ((this.config.get<string>('AI_MODEL_PROVIDER') as OpenAiRuntimeConfig['provider']) ??
          'openai'),
      model:
        stored?.value?.model ??
        this.config.get<string>('AI_MODEL_NAME') ??
        'gpt-4o-mini',
      openAiApiKey: storedApiKey.length ? storedApiKey : envApiKey,
    }
  }

  async resolveOpenAiApiKey(
    configKey: string = OpenAiClientService.AI_RUNTIME_CONFIG_KEY,
  ): Promise<string | null> {
    const runtime = await this.resolveRuntimeConfig(configKey)
    return runtime.provider === 'openai' && runtime.openAiApiKey?.trim()
      ? runtime.openAiApiKey.trim()
      : this.config.get<string>('OPENAI_API_KEY')?.trim() || null
  }

  buildHeaders(
    apiKey: string,
    extraHeaders: Record<string, string> = {},
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    }

    const organization = this.config.get<string>('OPENAI_ORGANIZATION_ID')?.trim()
    const project = this.config.get<string>('OPENAI_PROJECT_ID')?.trim()
    if (organization) {
      headers['OpenAI-Organization'] = organization
    }
    if (project) {
      headers['OpenAI-Project'] = project
    }

    return headers
  }

  async requestJson<T>(
    path: string,
    input: {
      body?: BodyInit | Record<string, unknown> | null
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      apiKey?: string | null
      headers?: Record<string, string>
      timeoutMs?: number
      query?: Record<string, string | number | boolean | Array<string | number | boolean> | null | undefined>
    } = {},
  ): Promise<T> {
    const response = await this.request(path, input)
    const text = await response.text()
    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new Error(
        `openai_response_parse_error_${response.status}: ${text || (error instanceof Error ? error.message : 'invalid_json')}`,
      )
    }
  }

  async requestText(
    path: string,
    input: {
      body?: BodyInit | Record<string, unknown> | null
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      apiKey?: string | null
      headers?: Record<string, string>
      timeoutMs?: number
      query?: Record<string, string | number | boolean | Array<string | number | boolean> | null | undefined>
    } = {},
  ): Promise<string> {
    const response = await this.request(path, input)
    return await response.text()
  }

  async request(
    path: string,
    input: {
      body?: BodyInit | Record<string, unknown> | null
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      apiKey?: string | null
      headers?: Record<string, string>
      timeoutMs?: number
      query?: Record<string, string | number | boolean | Array<string | number | boolean> | null | undefined>
    } = {},
  ): Promise<Response> {
    const apiKey = (input.apiKey ?? (await this.resolveOpenAiApiKey()))?.trim?.() ?? null

    if (!apiKey) {
      throw new Error('openai_api_key_missing')
    }

    const url = new URL(
      path.startsWith('http') ? path : `${OpenAiClientService.OPENAI_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
    )
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        if (value === null || value === undefined) {
          continue
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            url.searchParams.append(key, String(item))
          }
          continue
        }
        url.searchParams.set(key, String(value))
      }
    }

    const timeoutMs = input.timeoutMs ?? OpenAiClientService.DEFAULT_TIMEOUT_MS
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const body = this.normalizeBody(input.body)

      const headers = this.buildHeaders(apiKey, input.headers ?? {})
      if (
        body &&
        typeof body === 'string' &&
        !headers['content-type'] &&
        !headers['Content-Type']
      ) {
        headers['content-type'] = 'application/json'
      }

      const response = await fetch(url.toString(), {
        method: input.method ?? 'POST',
        headers,
        body,
        signal: controller.signal,
      })

      if (!response.ok) {
        const responseBody = await response.text()
        throw new Error(`openai_http_${response.status}:${responseBody}`)
      }

      return response
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`openai_timeout_${timeoutMs}`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private normalizeBody(
    body?: BodyInit | Record<string, unknown> | null,
  ): BodyInit | undefined {
    if (body == null) {
      return undefined
    }

    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return body
    }

    if (
      typeof body === 'string' ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body) ||
      body instanceof URLSearchParams
    ) {
      return body
    }

    if (typeof body === 'object') {
      return JSON.stringify(body)
    }

    return undefined
  }
}
