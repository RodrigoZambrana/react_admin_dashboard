import { useEffect, useRef } from 'react'
import appConfig from '@/configs/app.config'
import { useAppDispatch, useAppSelector, ingestInboxEvent } from '../store'
import type { InboxMessageSummaryDto } from '@/services/InboxService'

type Options = {
    accountId?: string
    queueSlug?: string | null
}

type ParsedSseEvent = {
    event?: string
    data?: string
}

const parseEventBlock = (block: string): ParsedSseEvent | null => {
    if (!block) {
        return null
    }
    const lines = block.split('\n')
    const event: ParsedSseEvent = {}
    const dataLines: string[] = []
    lines.forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed) {
            return
        }
        if (trimmed.startsWith('event:')) {
            event.event = trimmed.slice(6).trim()
            return
        }
        if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice(5).trim())
        }
    })
    if (dataLines.length > 0) {
        event.data = dataLines.join('\n')
    }
    return event
}

export const useInboxEventStream = ({ accountId, queueSlug }: Options) => {
    const dispatch = useAppDispatch()
    const token = useAppSelector((state) => state.auth.session.token)
    const retryRef = useRef<number>()

    useEffect(() => {
        if (!accountId || !token) {
            return
        }
        let closed = false
        let controller: AbortController | null = null

        const connect = async () => {
            controller = new AbortController()
            const apiPrefix = appConfig.apiPrefix || ''
            const base = apiPrefix.startsWith('http')
                ? apiPrefix
                : `${window.location.origin}${apiPrefix.startsWith('/') ? apiPrefix : `/${apiPrefix}`}`
            const endpoint = base.endsWith('/')
                ? `${base}inbox/events/messages`
                : `${base}/inbox/events/messages`
            const url = new URL(endpoint)
            url.searchParams.set('accountId', accountId)
            if (queueSlug) {
                url.searchParams.set('queueSlug', queueSlug)
            }

            try {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'text/event-stream',
                    },
                    credentials: 'include',
                    signal: controller.signal,
                })

                if (!response.ok || !response.body) {
                    throw new Error(`SSE failed with status ${response.status}`)
                }

                const reader = response.body.getReader()
                const decoder = new TextDecoder('utf-8')
                let buffer = ''

                while (!closed) {
                    const { done, value } = await reader.read()
                    if (done) {
                        break
                    }
                    buffer += decoder.decode(value, { stream: true })
                    let separatorIndex = buffer.indexOf('\n\n')
                    while (separatorIndex !== -1) {
                        const rawEvent = buffer.slice(0, separatorIndex)
                        buffer = buffer.slice(separatorIndex + 2)
                        const parsed = parseEventBlock(rawEvent)
                        if (parsed?.data) {
                            try {
                                const payload = JSON.parse(parsed.data) as InboxMessageSummaryDto
                                dispatch(
                                    ingestInboxEvent({
                                        message: payload,
                                        eventType: parsed.event,
                                    }),
                                )
                            } catch (error) {
                                console.warn('[Mail] Unable to parse inbox SSE payload', error)
                            }
                        }
                        separatorIndex = buffer.indexOf('\n\n')
                    }
                }
            } catch (error) {
                if (!closed) {
                    console.warn('[Mail] SSE connection error', error)
                    retryRef.current = window.setTimeout(() => {
                        connect().catch((err) => {
                            console.warn('[Mail] SSE reconnect failed', err)
                        })
                    }, 5000)
                }
            }
        }

        connect().catch((error) => {
            console.warn('[Mail] SSE initial connection failed', error)
        })

        return () => {
            closed = true
            if (controller) {
                controller.abort()
            }
            if (retryRef.current) {
                window.clearTimeout(retryRef.current)
            }
        }
    }, [accountId, queueSlug, token, dispatch])
}
