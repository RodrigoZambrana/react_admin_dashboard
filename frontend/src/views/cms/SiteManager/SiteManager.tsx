/* eslint-disable jsx-a11y/label-has-associated-control */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    DragDropContext,
    Draggable,
    type DropResult,
} from '@hello-pangea/dnd'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Loading from '@/components/shared/Loading'
import StrictModeDroppable from '@/components/shared/StrictModeDroppable'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Notification from '@/components/ui/Notification'
import Switcher from '@/components/ui/Switcher'
import Textarea from '@/components/ui/Textarea'
import Upload from '@/components/ui/Upload'
import { useLocation } from 'react-router-dom'
import { toast } from '@/components/ui/toast'
import CmsPagesService, {
    type CmsPage,
    type CmsPageBlock,
    type CmsPageBlockType,
    type CmsPageListItem,
    type CmsPageMedia,
    type CmsPageSection,
    type CmsPageSectionType,
    type CmsPageScope,
    type CmsPageStatus,
} from '@/services/CmsPagesService'

type SiteManagerProps = {
    initialTab?: 'pages' | 'media'
}

type EditorBlock = CmsPageBlock & { clientId: string }
type EditorSection = Omit<CmsPageSection, 'blocks'> & {
    clientId: string
    blocks: EditorBlock[]
}
type EditorPage = Omit<CmsPage, 'sections'> & {
    sections: EditorSection[]
}

const sectionTypeOptions: CmsPageSectionType[] = [
    'SITE_HEADER',
    'HERO',
    'FEATURE_GRID',
    'MEDIA_GRID',
    'MEDIA_CAROUSEL',
    'CONTENT_SPLIT',
    'FAQ',
    'RICH_TEXT',
    'CTA_BANNER',
    'SITE_FOOTER',
]

const blockTypeOptions: CmsPageBlockType[] = [
    'TEXT',
    'RICH_TEXT',
    'IMAGE',
    'BUTTON',
    'LIST_ITEM',
    'FAQ_ITEM',
    'CARD',
]

const pageStatusOptions: CmsPageStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const pageScopeOptions: CmsPageScope[] = ['GENERAL_SITE', 'STOREFRONT']

const nextClientId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)

const createDefaultBlockContent = (
    type: CmsPageBlockType,
): Record<string, unknown> => {
    switch (type) {
        case 'RICH_TEXT':
            return { html: '' }
        case 'IMAGE':
            return { title: '', description: '', href: '', linkLabel: '' }
        case 'BUTTON':
            return { label: '', href: '' }
        case 'LIST_ITEM':
            return { title: '', body: '', href: '' }
        case 'FAQ_ITEM':
            return { question: '', answer: '' }
        case 'CARD':
            return { title: '', body: '', href: '', linkLabel: '' }
        case 'TEXT':
        default:
            return { title: '', body: '' }
    }
}

const createDefaultSectionSettings = (
    type: CmsPageSectionType,
): Record<string, unknown> => {
    switch (type) {
        case 'SITE_HEADER':
            return {
                brandLabel: '',
                brandHref: '/',
                navigationMode: 'grouped',
                navigationGroupLabel: 'Información',
                topbarContacts: [],
                items: [],
                floatingContact: null,
            }
        case 'HERO':
            return {
                eyebrow: '',
                title: '',
                description: '',
                primaryCtaLabel: '',
                primaryCtaHref: '',
                secondaryCtaLabel: '',
                secondaryCtaHref: '',
                backgroundImageUrl: '',
            }
        case 'MEDIA_CAROUSEL':
            return {
                title: '',
                description: '',
                variant: 'cards',
            }
        case 'CONTENT_SPLIT':
            return {
                title: '',
                description: '',
                variant: 'image-content',
                mediaPosition: 'start',
                imageUrl: '',
                imageAlt: '',
                gallery: [],
            }
        case 'CTA_BANNER':
            return {
                title: '',
                description: '',
                label: '',
                href: '',
            }
        case 'SITE_FOOTER':
            return {
                title: '',
                contacts: [],
                socials: [],
                linkGroups: [],
            }
        case 'FEATURE_GRID':
        case 'MEDIA_GRID':
        case 'FAQ':
        case 'RICH_TEXT':
        default:
            return {
                title: '',
                description: '',
            }
    }
}

const createBlock = (type: CmsPageBlockType, index = 0): EditorBlock => ({
    clientId: nextClientId(),
    type,
    key: '',
    name: '',
    sortOrder: index,
    visible: true,
    mediaId: null,
    content: createDefaultBlockContent(type),
})

const createSection = (type: CmsPageSectionType, index = 0): EditorSection => ({
    clientId: nextClientId(),
    type,
    key: '',
    name: '',
    sortOrder: index,
    visible: true,
    settings: createDefaultSectionSettings(type),
    blocks:
        type === 'FAQ'
            ? [createBlock('FAQ_ITEM')]
            : type === 'FEATURE_GRID' || type === 'MEDIA_GRID' || type === 'MEDIA_CAROUSEL'
              ? [createBlock('CARD')]
              : type === 'CONTENT_SPLIT'
                ? [createBlock('RICH_TEXT')]
              : type === 'CTA_BANNER' || type === 'SITE_HEADER' || type === 'SITE_FOOTER'
                ? []
                : [createBlock(type === 'RICH_TEXT' ? 'RICH_TEXT' : 'TEXT')],
})

const createBlankPage = (): EditorPage => ({
    path: '',
    aliases: [],
    title: '',
    summary: '',
    scope: 'GENERAL_SITE',
    locale: 'es',
    status: 'DRAFT',
    visible: true,
    seoTitle: '',
    seoDescription: '',
    layoutKey: '',
    legacySource: '',
    sections: [],
})

const attachClientIds = (page: CmsPage): EditorPage => ({
    ...page,
    sections: page.sections.map((section, sectionIndex) => ({
        ...section,
        clientId: nextClientId(),
        sortOrder: section.sortOrder ?? sectionIndex,
        blocks: section.blocks.map((block, blockIndex) => ({
            ...block,
            clientId: nextClientId(),
            sortOrder: block.sortOrder ?? blockIndex,
        })),
    })),
})

const stripClientIds = (page: EditorPage): CmsPage => ({
    path: page.path,
    aliases: page.aliases ?? [],
    title: page.title,
    summary: page.summary,
    scope: page.scope,
    locale: page.locale,
    status: page.status,
    visible: page.visible,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    layoutKey: page.layoutKey,
    legacySource: page.legacySource,
    sections: page.sections.map((section, sectionIndex) => ({
        type: section.type,
        key: section.key,
        name: section.name,
        sortOrder: sectionIndex,
        visible: section.visible,
        settings: section.settings ?? null,
        blocks: section.blocks.map((block, blockIndex) => ({
            type: block.type,
            key: block.key,
            name: block.name,
            sortOrder: blockIndex,
            visible: block.visible,
            mediaId: block.mediaId ?? null,
            content: block.content ?? null,
        })),
    })),
})

const reorder = <T,>(items: T[], startIndex: number, endIndex: number) => {
    const next = [...items]
    const [removed] = next.splice(startIndex, 1)
    next.splice(endIndex, 0, removed)
    return next
}

const getSectionBlockFields = (type: CmsPageBlockType) => {
    switch (type) {
        case 'BUTTON':
            return ['label', 'href']
        case 'FAQ_ITEM':
            return ['question', 'answer']
        case 'IMAGE':
            return ['title', 'description', 'href', 'linkLabel']
        case 'RICH_TEXT':
            return ['html']
        case 'TEXT':
            return ['title', 'body']
        case 'LIST_ITEM':
        case 'CARD':
        default:
            return ['title', 'body', 'href', 'linkLabel']
    }
}

const fieldLabelMap: Record<string, string> = {
    eyebrow: 'Eyebrow',
    title: 'Título',
    description: 'Descripción',
    variant: 'Variante',
    mediaPosition: 'Posición de media',
    imageUrl: 'URL de imagen',
    imageAlt: 'Alt de imagen',
    primaryCtaLabel: 'CTA principal',
    primaryCtaHref: 'URL CTA principal',
    secondaryCtaLabel: 'CTA secundaria',
    secondaryCtaHref: 'URL CTA secundaria',
    backgroundImageUrl: 'Imagen de fondo',
    body: 'Cuerpo',
    html: 'HTML',
    href: 'URL',
    label: 'Etiqueta',
    linkLabel: 'Texto del enlace',
    question: 'Pregunta',
    answer: 'Respuesta',
    brandLabel: 'Marca',
    brandHref: 'URL de marca',
    navigationMode: 'Presentación de navegación',
    navigationGroupLabel: 'Etiqueta del grupo de navegación',
}

const toPrettyJson = (value: Record<string, unknown> | null | undefined) =>
    JSON.stringify(value ?? {}, null, 2)

const routeScopeMap: Record<'general' | 'store', CmsPageScope> = {
    general: 'GENERAL_SITE',
    store: 'STOREFRONT',
}

const SiteManager = ({ initialTab = 'pages' }: SiteManagerProps) => {
    const location = useLocation()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [mediaUploading, setMediaUploading] = useState(false)
    const [activeTab, setActiveTab] = useState<'pages' | 'media'>(initialTab)
    const [pages, setPages] = useState<CmsPageListItem[]>([])
    const [selectedPageId, setSelectedPageId] = useState<number | null>(null)
    const [pageEditor, setPageEditor] = useState<EditorPage>(createBlankPage())
    const [mediaItems, setMediaItems] = useState<CmsPageMedia[]>([])
    const [mediaForm, setMediaForm] = useState({
        title: '',
        alt: '',
        source: '',
        externalUrl: '',
    })

    const mediaOptions = useMemo(
        () =>
            mediaItems.map((item) => ({
                value: item.id,
                label: `${item.title || item.fileName || item.url} · ${item.type}`,
            })),
        [mediaItems],
    )

    const pageScope = useMemo<'general' | 'store'>(() => {
        const params = new URLSearchParams(location.search)
        return params.get('scope')?.trim().toLowerCase() === 'store'
            ? 'store'
            : 'general'
    }, [location.search])
    const persistedScope = routeScopeMap[pageScope]

    const loadPages = useCallback(async () => {
        const response = await CmsPagesService.listPages({ scope: persistedScope })
        const nextPages = Array.isArray(response.data) ? response.data : []
        setPages(nextPages)
        setSelectedPageId((current) => {
            if (current && nextPages.some((page) => page.id === current)) {
                return current
            }
            return nextPages[0]?.id ?? null
        })
    }, [persistedScope])

    const loadMedia = useCallback(async () => {
        const response = await CmsPagesService.listMedia()
        setMediaItems(Array.isArray(response.data) ? response.data : [])
    }, [])

    const loadPage = useCallback(async (id: number) => {
        const response = await CmsPagesService.getPage(id)
        setPageEditor(attachClientIds(response.data))
    }, [])

    useEffect(() => {
        setLoading(true)
        Promise.all([loadPages(), loadMedia()])
            .catch((error) => {
                console.error(error)
                toast.push(
                    <Notification title="CMS" type="danger">
                        No fue posible cargar el CMS de páginas.
                    </Notification>,
                )
            })
            .finally(() => setLoading(false))
    }, [loadMedia, loadPages])

    useEffect(() => {
        if (!selectedPageId) {
            setPageEditor({
                ...createBlankPage(),
                scope: persistedScope,
            })
            return
        }
        loadPage(selectedPageId).catch((error) => {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible cargar la página seleccionada.
                </Notification>,
            )
        })
    }, [loadPage, persistedScope, selectedPageId])

    useEffect(() => {
        setSelectedPageId((current) => {
            if (current && pages.some((page) => page.id === current)) {
                return current
            }
            return pages[0]?.id ?? null
        })
    }, [pages])

    const setPageField = <K extends keyof EditorPage>(field: K, value: EditorPage[K]) => {
        setPageEditor((current) => ({
            ...current,
            [field]: value,
        }))
    }

    const setSectionField = (sectionClientId: string, key: keyof EditorSection, value: unknown) => {
        setPageEditor((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.clientId === sectionClientId
                    ? {
                          ...section,
                          [key]: value,
                      }
                    : section,
            ),
        }))
    }

    const setSectionSettingField = (sectionClientId: string, key: string, value: unknown) => {
        setPageEditor((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.clientId === sectionClientId
                    ? {
                          ...section,
                          settings: {
                              ...(section.settings ?? {}),
                              [key]: value,
                          },
                      }
                    : section,
            ),
        }))
    }

    const setSectionSettingsJson = (sectionClientId: string, raw: string) => {
        try {
            const parsed = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {}
            setPageEditor((current) => ({
                ...current,
                sections: current.sections.map((section) =>
                    section.clientId === sectionClientId
                        ? {
                              ...section,
                              settings: parsed,
                          }
                        : section,
                ),
            }))
        } catch {
            // keep textarea free-form until save
        }
    }

    const setBlockField = (
        sectionClientId: string,
        blockClientId: string,
        key: keyof EditorBlock,
        value: unknown,
    ) => {
        setPageEditor((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.clientId === sectionClientId
                    ? {
                          ...section,
                          blocks: section.blocks.map((block) =>
                              block.clientId === blockClientId
                                  ? {
                                        ...block,
                                        [key]: value,
                                    }
                                  : block,
                          ),
                      }
                    : section,
            ),
        }))
    }

    const setBlockContentField = (
        sectionClientId: string,
        blockClientId: string,
        key: string,
        value: unknown,
    ) => {
        setPageEditor((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.clientId === sectionClientId
                    ? {
                          ...section,
                          blocks: section.blocks.map((block) =>
                              block.clientId === blockClientId
                                  ? {
                                        ...block,
                                        content: {
                                            ...(block.content ?? {}),
                                            [key]: value,
                                        },
                                    }
                                  : block,
                          ),
                      }
                    : section,
            ),
        }))
    }

    const setBlockContentJson = (sectionClientId: string, blockClientId: string, raw: string) => {
        try {
            const parsed = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {}
            setPageEditor((current) => ({
                ...current,
                sections: current.sections.map((section) =>
                    section.clientId === sectionClientId
                        ? {
                              ...section,
                              blocks: section.blocks.map((block) =>
                                  block.clientId === blockClientId
                                      ? {
                                            ...block,
                                            content: parsed,
                                        }
                                      : block,
                              ),
                          }
                        : section,
                ),
            }))
        } catch {
            // keep textarea free-form until save
        }
    }

    const handleNewPage = () => {
        setSelectedPageId(null)
        setPageEditor({
            ...createBlankPage(),
            scope: persistedScope,
        })
        setActiveTab('pages')
    }

    const handleAddSection = (type: CmsPageSectionType) => {
        setPageEditor((current) => ({
            ...current,
            sections: [...current.sections, createSection(type, current.sections.length)],
        }))
    }

    const handleDeleteSection = (sectionClientId: string) => {
        setPageEditor((current) => ({
            ...current,
            sections: current.sections.filter((section) => section.clientId !== sectionClientId),
        }))
    }

    const handleAddBlock = (sectionClientId: string, type: CmsPageBlockType) => {
        setPageEditor((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.clientId === sectionClientId
                    ? {
                          ...section,
                          blocks: [...section.blocks, createBlock(type, section.blocks.length)],
                      }
                    : section,
            ),
        }))
    }

    const handleDeleteBlock = (sectionClientId: string, blockClientId: string) => {
        setPageEditor((current) => ({
            ...current,
            sections: current.sections.map((section) =>
                section.clientId === sectionClientId
                    ? {
                          ...section,
                          blocks: section.blocks.filter((block) => block.clientId !== blockClientId),
                      }
                    : section,
            ),
        }))
    }

    const handleSavePage = async () => {
        setSaving(true)
        try {
            const payload = stripClientIds(pageEditor)
            const response = selectedPageId
                ? await CmsPagesService.updatePage(selectedPageId, payload)
                : await CmsPagesService.createPage(payload)
            await loadPages()
            setSelectedPageId(response.data.id ?? null)
            setPageEditor(attachClientIds(response.data))
            toast.push(
                <Notification title="CMS" type="success">
                    Página guardada correctamente.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible guardar la página.
                </Notification>,
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDeletePage = async () => {
        if (!selectedPageId) return
        try {
            await CmsPagesService.deletePage(selectedPageId)
            await loadPages()
            setSelectedPageId(null)
            setPageEditor({
                ...createBlankPage(),
                scope: persistedScope,
            })
            toast.push(
                <Notification title="CMS" type="success">
                    Página eliminada.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible eliminar la página.
                </Notification>,
            )
        }
    }

    const handleCreateExternalMedia = async () => {
        if (!mediaForm.externalUrl.trim()) return
        try {
            await CmsPagesService.createMedia({
                url: mediaForm.externalUrl.trim(),
                title: mediaForm.title.trim() || undefined,
                alt: mediaForm.alt.trim() || undefined,
                source: mediaForm.source.trim() || undefined,
            })
            setMediaForm({ title: '', alt: '', source: '', externalUrl: '' })
            await loadMedia()
            toast.push(
                <Notification title="CMS" type="success">
                    Recurso registrado en la biblioteca.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible registrar el recurso externo.
                </Notification>,
            )
        }
    }

    const handleUploadMedia = async (files: File[]) => {
        if (!files.length) return
        setMediaUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', files[0], files[0].name)
            if (mediaForm.title.trim()) formData.append('title', mediaForm.title.trim())
            if (mediaForm.alt.trim()) formData.append('alt', mediaForm.alt.trim())
            if (mediaForm.source.trim()) formData.append('source', mediaForm.source.trim())
            await CmsPagesService.uploadMedia(formData)
            setMediaForm({ title: '', alt: '', source: '', externalUrl: '' })
            await loadMedia()
            toast.push(
                <Notification title="CMS" type="success">
                    Archivo cargado correctamente.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible subir el archivo.
                </Notification>,
            )
        } finally {
            setMediaUploading(false)
        }
    }

    const handleDeleteMedia = async (mediaId: number) => {
        try {
            await CmsPagesService.deleteMedia(mediaId)
            await loadMedia()
            toast.push(
                <Notification title="CMS" type="success">
                    Recurso eliminado.
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="CMS" type="danger">
                    No fue posible eliminar el recurso.
                </Notification>,
            )
        }
    }

    const onDragEnd = (result: DropResult) => {
        const { source, destination, type } = result
        if (!destination) return

        if (type === 'SECTION') {
            setPageEditor((current) => ({
                ...current,
                sections: reorder(current.sections, source.index, destination.index),
            }))
            return
        }

        const fromSectionId = source.droppableId.replace('blocks-', '')
        const toSectionId = destination.droppableId.replace('blocks-', '')

        setPageEditor((current) => {
            const nextSections = current.sections.map((section) => ({
                ...section,
                blocks: [...section.blocks],
            }))
            const fromSection = nextSections.find((section) => section.clientId === fromSectionId)
            const toSection = nextSections.find((section) => section.clientId === toSectionId)
            if (!fromSection || !toSection) {
                return current
            }
            const [movedBlock] = fromSection.blocks.splice(source.index, 1)
            if (!movedBlock) {
                return current
            }
            toSection.blocks.splice(destination.index, 0, movedBlock)
            return {
                ...current,
                sections: nextSections,
            }
        })
    }

    const renderSectionSettings = (section: EditorSection) => {
        const settings = section.settings ?? {}
        const commonFields =
            section.type === 'SITE_HEADER'
                ? [
                      'brandLabel',
                      'brandHref',
                      'navigationMode',
                      'navigationGroupLabel',
                  ]
                : section.type === 'HERO'
                ? [
                      'eyebrow',
                      'title',
                      'description',
                      'primaryCtaLabel',
                      'primaryCtaHref',
                      'secondaryCtaLabel',
                      'secondaryCtaHref',
                      'backgroundImageUrl',
                  ]
                : section.type === 'MEDIA_CAROUSEL'
                  ? ['title', 'description', 'variant']
                : section.type === 'CONTENT_SPLIT'
                  ? [
                        'title',
                        'description',
                        'variant',
                        'mediaPosition',
                        'imageUrl',
                        'imageAlt',
                    ]
                : section.type === 'CTA_BANNER'
                  ? ['title', 'description', 'label', 'href']
                  : section.type === 'SITE_FOOTER'
                    ? ['title']
                  : ['title', 'description']

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {commonFields.map((field) =>
                    field === 'navigationMode' ? (
                        <div key={field}>
                            <label className="text-xs font-semibold text-gray-500 uppercase">
                                {fieldLabelMap[field] ?? field}
                            </label>
                            <select
                                className="input"
                                value={String(settings[field] ?? 'grouped')}
                                onChange={(event) =>
                                    setSectionSettingField(
                                        section.clientId,
                                        field,
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="grouped">
                                    Grupo descriptivo
                                </option>
                                <option value="flat">Ítems planos</option>
                            </select>
                        </div>
                    ) : field === 'description' || field === 'body' ? (
                        <div className="lg:col-span-2" key={field}>
                            <label className="text-xs font-semibold text-gray-500 uppercase">
                                {fieldLabelMap[field] ?? field}
                            </label>
                            <Textarea
                                rows={3}
                                value={String(settings[field] ?? '')}
                                onChange={(event) =>
                                    setSectionSettingField(
                                        section.clientId,
                                        field,
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                    ) : (
                        <div key={field}>
                            <label className="text-xs font-semibold text-gray-500 uppercase">
                                {fieldLabelMap[field] ?? field}
                            </label>
                            <Input
                                value={String(settings[field] ?? '')}
                                onChange={(event) =>
                                    setSectionSettingField(
                                        section.clientId,
                                        field,
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                    ),
                )}
                <div className="lg:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase">
                        JSON avanzado
                    </label>
                    <Textarea
                        rows={6}
                        value={toPrettyJson(settings)}
                        onChange={(event) =>
                            setSectionSettingsJson(section.clientId, event.target.value)
                        }
                    />
                </div>
            </div>
        )
    }

    const renderBlockEditor = (section: EditorSection, block: EditorBlock) => {
        const content = block.content ?? {}
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">
                        Tipo de bloque
                    </label>
                    <select
                        className="input"
                        value={block.type}
                        onChange={(event) =>
                            setBlockField(
                                section.clientId,
                                block.clientId,
                                'type',
                                event.target.value as CmsPageBlockType,
                            )
                        }
                    >
                        {blockTypeOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Media</label>
                    <select
                        className="input"
                        value={block.mediaId ?? ''}
                        onChange={(event) =>
                            setBlockField(
                                section.clientId,
                                block.clientId,
                                'mediaId',
                                event.target.value ? Number(event.target.value) : null,
                            )
                        }
                    >
                        <option value="">Sin media vinculada</option>
                        {mediaOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                {getSectionBlockFields(block.type).map((field) =>
                    field === 'body' || field === 'html' || field === 'answer' ? (
                        <div className="lg:col-span-2" key={field}>
                            <label className="text-xs font-semibold text-gray-500 uppercase">
                                {fieldLabelMap[field] ?? field}
                            </label>
                            <Textarea
                                rows={field === 'html' || field === 'answer' ? 6 : 4}
                                value={String(content[field] ?? '')}
                                onChange={(event) =>
                                    setBlockContentField(
                                        section.clientId,
                                        block.clientId,
                                        field,
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                    ) : (
                        <div key={field}>
                            <label className="text-xs font-semibold text-gray-500 uppercase">
                                {fieldLabelMap[field] ?? field}
                            </label>
                            <Input
                                value={String(content[field] ?? '')}
                                onChange={(event) =>
                                    setBlockContentField(
                                        section.clientId,
                                        block.clientId,
                                        field,
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                    ),
                )}
                <div className="lg:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase">
                        JSON avanzado
                    </label>
                    <Textarea
                        rows={6}
                        value={toPrettyJson(content)}
                        onChange={(event) =>
                            setBlockContentJson(section.clientId, block.clientId, event.target.value)
                        }
                    />
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-[320px] flex items-center justify-center">
                <Loading loading />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <AdaptableCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-xl font-semibold">CMS Headless</h3>
                        <p className="text-sm text-gray-500">
                            Gestiona páginas, secciones, bloques y media sin tocar código.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={activeTab === 'pages' ? 'solid' : 'plain'}
                            onClick={() => setActiveTab('pages')}
                        >
                            Páginas
                        </Button>
                        <Button
                            variant={activeTab === 'media' ? 'solid' : 'plain'}
                            onClick={() => setActiveTab('media')}
                        >
                            Media
                        </Button>
                    </div>
                </div>
            </AdaptableCard>

            {activeTab === 'pages' ? (
                <div className="grid grid-cols-1 xl:grid-cols-[320px,minmax(0,1fr)] gap-4">
                    <AdaptableCard divider>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h4 className="font-semibold">Páginas</h4>
                                <p className="text-sm text-gray-500">
                                    {pageScope === 'store'
                                        ? 'Componentes y páginas de la experiencia comercial.'
                                        : 'Rutas informacionales persistidas en BD y publicadas en storefront.'}
                                </p>
                            </div>
                            <Button size="sm" variant="solid" onClick={handleNewPage}>
                                Nueva
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {pages.map((page) => (
                                <button
                                    key={page.id}
                                    type="button"
                                    className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                                        selectedPageId === page.id
                                            ? 'border-emerald-400 bg-emerald-50'
                                            : 'border-gray-200 hover:border-emerald-200'
                                    }`}
                                    onClick={() => setSelectedPageId(page.id)}
                                >
                                    <div className="font-semibold">{page.title}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        /{page.path || ''}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {page.status} · {page.locale} · {page.scope} · {page._count?.sections ?? 0} secciones
                                    </div>
                                </button>
                            ))}
                            {!pages.length ? (
                                <div className="text-sm text-gray-500">
                                    {pageScope === 'store'
                                        ? 'Todavía no hay páginas CMS asociadas a tienda.'
                                        : 'Todavía no hay páginas CMS cargadas.'}
                                </div>
                            ) : null}
                        </div>
                    </AdaptableCard>

                    <div className="space-y-4">
                        <AdaptableCard divider>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div>
                                    <h4 className="font-semibold">Metadatos de página</h4>
                                    <p className="text-sm text-gray-500">
                                        La raíz pública del sitio migrado usa estas rutas.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedPageId ? (
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            className="text-red-600"
                                            onClick={handleDeletePage}
                                        >
                                            Eliminar
                                        </Button>
                                    ) : null}
                                    <Button size="sm" variant="solid" loading={saving} onClick={handleSavePage}>
                                        Guardar página
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Ruta pública
                                    </label>
                                    <Input
                                        value={pageEditor.path}
                                        onChange={(event) => setPageField('path', event.target.value)}
                                        placeholder="contacto.html o productos/cortinas-roller.html"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Usa vacío para la raíz principal del sitio migrado.
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Título
                                    </label>
                                    <Input
                                        value={pageEditor.title}
                                        onChange={(event) => setPageField('title', event.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Aliases
                                    </label>
                                    <Textarea
                                        rows={3}
                                        value={(pageEditor.aliases ?? []).join('\n')}
                                        onChange={(event) =>
                                            setPageField(
                                                'aliases',
                                                event.target.value
                                                    .split('\n')
                                                    .map((value) => value.trim())
                                                    .filter(Boolean),
                                            )
                                        }
                                        placeholder={'cortinas-roller.html\nproductos/roller.html'}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Una ruta por línea. Permite mantener URLs anteriores sin agregar lógica especial al storefront.
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        SEO title
                                    </label>
                                    <Input
                                        value={pageEditor.seoTitle ?? ''}
                                        onChange={(event) => setPageField('seoTitle', event.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Layout key
                                    </label>
                                    <Input
                                        value={pageEditor.layoutKey ?? ''}
                                        onChange={(event) => setPageField('layoutKey', event.target.value)}
                                        placeholder="landing-default"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Locale
                                    </label>
                                    <Input
                                        value={pageEditor.locale}
                                        onChange={(event) => setPageField('locale', event.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Scope
                                    </label>
                                    <select
                                        className="input"
                                        value={pageEditor.scope}
                                        onChange={(event) =>
                                            setPageField('scope', event.target.value as CmsPageScope)
                                        }
                                    >
                                        {pageScopeOptions.map((scope) => (
                                            <option key={scope} value={scope}>
                                                {scope}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Estado
                                    </label>
                                    <select
                                        className="input"
                                        value={pageEditor.status}
                                        onChange={(event) =>
                                            setPageField('status', event.target.value as CmsPageStatus)
                                        }
                                    >
                                        {pageStatusOptions.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Resumen
                                    </label>
                                    <Textarea
                                        rows={3}
                                        value={pageEditor.summary ?? ''}
                                        onChange={(event) => setPageField('summary', event.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        SEO description
                                    </label>
                                    <Textarea
                                        rows={3}
                                        value={pageEditor.seoDescription ?? ''}
                                        onChange={(event) =>
                                            setPageField('seoDescription', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                        Legacy source
                                    </label>
                                    <Input
                                        value={pageEditor.legacySource ?? ''}
                                        onChange={(event) =>
                                            setPageField('legacySource', event.target.value)
                                        }
                                        placeholder="/Users/.../urucortinas_html_version/contacto.html"
                                    />
                                </div>
                                <div className="lg:col-span-2 flex items-center gap-3">
                                    <Switcher
                                        checked={pageEditor.visible}
                                        onChange={(value) => setPageField('visible', Boolean(value))}
                                    />
                                    <span className="text-sm text-gray-600">
                                        Visible públicamente
                                    </span>
                                </div>
                            </div>
                        </AdaptableCard>

                        <AdaptableCard divider>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div>
                                    <h4 className="font-semibold">Secciones</h4>
                                    <p className="text-sm text-gray-500">
                                        Ordena y edita la composición visual de la página.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {sectionTypeOptions.map((type) => (
                                        <Button
                                            key={type}
                                            size="xs"
                                            variant="plain"
                                            onClick={() => handleAddSection(type)}
                                        >
                                            + {type}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <DragDropContext onDragEnd={onDragEnd}>
                                <StrictModeDroppable droppableId="cms-sections" type="SECTION">
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="space-y-4"
                                        >
                                            {pageEditor.sections.map((section, sectionIndex) => (
                                                <Draggable
                                                    key={section.clientId}
                                                    draggableId={section.clientId}
                                                    index={sectionIndex}
                                                >
                                                    {(sectionProvided) => (
                                                        <div
                                                            ref={sectionProvided.innerRef}
                                                            {...sectionProvided.draggableProps}
                                                            className="border border-gray-200 rounded-2xl p-4 bg-gray-50"
                                                        >
                                                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                                <div
                                                                    className="flex items-center gap-2 cursor-grab"
                                                                    {...sectionProvided.dragHandleProps}
                                                                >
                                                                    <span className="text-xs uppercase text-gray-500">
                                                                        Sección {sectionIndex + 1}
                                                                    </span>
                                                                    <span className="font-semibold">
                                                                        {section.type}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Switcher
                                                                        checked={section.visible}
                                                                        onChange={(value) =>
                                                                            setSectionField(
                                                                                section.clientId,
                                                                                'visible',
                                                                                Boolean(value),
                                                                            )
                                                                        }
                                                                    />
                                                                    <Button
                                                                        size="xs"
                                                                        variant="plain"
                                                                        className="text-red-600"
                                                                        onClick={() =>
                                                                            handleDeleteSection(section.clientId)
                                                                        }
                                                                    >
                                                                        Eliminar
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                                                                <div>
                                                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                                                        Tipo
                                                                    </label>
                                                                    <select
                                                                        className="input"
                                                                        value={section.type}
                                                                        onChange={(event) =>
                                                                            setSectionField(
                                                                                section.clientId,
                                                                                'type',
                                                                                event.target.value as CmsPageSectionType,
                                                                            )
                                                                        }
                                                                    >
                                                                        {sectionTypeOptions.map((option) => (
                                                                            <option key={option} value={option}>
                                                                                {option}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                                                        Key interno
                                                                    </label>
                                                                    <Input
                                                                        value={section.key ?? ''}
                                                                        onChange={(event) =>
                                                                            setSectionField(
                                                                                section.clientId,
                                                                                'key',
                                                                                event.target.value,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                                                        Nombre visible
                                                                    </label>
                                                                    <Input
                                                                        value={section.name ?? ''}
                                                                        onChange={(event) =>
                                                                            setSectionField(
                                                                                section.clientId,
                                                                                'name',
                                                                                event.target.value,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>

                                                            {renderSectionSettings(section)}

                                                            <div className="mt-5">
                                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                                    <div className="font-semibold">Bloques</div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {blockTypeOptions.map((type) => (
                                                                            <Button
                                                                                key={type}
                                                                                size="xs"
                                                                                variant="plain"
                                                                                onClick={() =>
                                                                                    handleAddBlock(
                                                                                        section.clientId,
                                                                                        type,
                                                                                    )
                                                                                }
                                                                            >
                                                                                + {type}
                                                                            </Button>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                <StrictModeDroppable
                                                                    droppableId={`blocks-${section.clientId}`}
                                                                    type="BLOCK"
                                                                >
                                                                    {(blockDropProvided) => (
                                                                        <div
                                                                            ref={blockDropProvided.innerRef}
                                                                            {...blockDropProvided.droppableProps}
                                                                            className="space-y-3"
                                                                        >
                                                                            {section.blocks.map((block, blockIndex) => (
                                                                                <Draggable
                                                                                    key={block.clientId}
                                                                                    draggableId={block.clientId}
                                                                                    index={blockIndex}
                                                                                >
                                                                                    {(blockProvided) => (
                                                                                        <div
                                                                                            ref={blockProvided.innerRef}
                                                                                            {...blockProvided.draggableProps}
                                                                                            className="rounded-2xl border border-gray-200 bg-white p-4"
                                                                                        >
                                                                                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                                                                <div
                                                                                                    className="cursor-grab font-medium"
                                                                                                    {...blockProvided.dragHandleProps}
                                                                                                >
                                                                                                    Bloque {blockIndex + 1}
                                                                                                </div>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <Switcher
                                                                                                        checked={block.visible}
                                                                                                        onChange={(value) =>
                                                                                                            setBlockField(
                                                                                                                section.clientId,
                                                                                                                block.clientId,
                                                                                                                'visible',
                                                                                                                Boolean(
                                                                                                                    value,
                                                                                                                ),
                                                                                                            )
                                                                                                        }
                                                                                                    />
                                                                                                    <Button
                                                                                                        size="xs"
                                                                                                        variant="plain"
                                                                                                        className="text-red-600"
                                                                                                        onClick={() =>
                                                                                                            handleDeleteBlock(
                                                                                                                section.clientId,
                                                                                                                block.clientId,
                                                                                                            )
                                                                                                        }
                                                                                                    >
                                                                                                        Eliminar
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                                                                                                <div>
                                                                                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                                                                                        Key
                                                                                                    </label>
                                                                                                    <Input
                                                                                                        value={block.key ?? ''}
                                                                                                        onChange={(event) =>
                                                                                                            setBlockField(
                                                                                                                section.clientId,
                                                                                                                block.clientId,
                                                                                                                'key',
                                                                                                                event.target.value,
                                                                                                            )
                                                                                                        }
                                                                                                    />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="text-xs font-semibold text-gray-500 uppercase">
                                                                                                        Nombre
                                                                                                    </label>
                                                                                                    <Input
                                                                                                        value={block.name ?? ''}
                                                                                                        onChange={(event) =>
                                                                                                            setBlockField(
                                                                                                                section.clientId,
                                                                                                                block.clientId,
                                                                                                                'name',
                                                                                                                event.target.value,
                                                                                                            )
                                                                                                        }
                                                                                                    />
                                                                                                </div>
                                                                                            </div>

                                                                                            {renderBlockEditor(section, block)}
                                                                                        </div>
                                                                                    )}
                                                                                </Draggable>
                                                                            ))}
                                                                            {blockDropProvided.placeholder}
                                                                        </div>
                                                                    )}
                                                                </StrictModeDroppable>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </StrictModeDroppable>
                            </DragDropContext>
                        </AdaptableCard>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[360px,minmax(0,1fr)] gap-4">
                    <AdaptableCard divider>
                        <div className="space-y-3">
                            <div>
                                <h4 className="font-semibold">Alta de media</h4>
                                <p className="text-sm text-gray-500">
                                    Sube archivos o registra URLs externas reutilizables.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">
                                    Título
                                </label>
                                <Input
                                    value={mediaForm.title}
                                    onChange={(event) =>
                                        setMediaForm((current) => ({
                                            ...current,
                                            title: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">
                                    Alt
                                </label>
                                <Input
                                    value={mediaForm.alt}
                                    onChange={(event) =>
                                        setMediaForm((current) => ({
                                            ...current,
                                            alt: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">
                                    Source
                                </label>
                                <Input
                                    value={mediaForm.source}
                                    onChange={(event) =>
                                        setMediaForm((current) => ({
                                            ...current,
                                            source: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <Upload
                                uploadLimit={1}
                                onChange={(files) => handleUploadMedia(files as File[])}
                                onFileRemove={() => undefined}
                            >
                                <div className="py-8 text-center">
                                    {mediaUploading ? 'Subiendo...' : 'Subir archivo a la biblioteca'}
                                </div>
                            </Upload>
                            <div className="pt-2 border-t border-gray-200">
                                <label className="text-xs font-semibold text-gray-500 uppercase">
                                    URL externa
                                </label>
                                <Input
                                    value={mediaForm.externalUrl}
                                    onChange={(event) =>
                                        setMediaForm((current) => ({
                                            ...current,
                                            externalUrl: event.target.value,
                                        }))
                                    }
                                    placeholder="https://..."
                                />
                                <Button
                                    className="mt-3"
                                    variant="solid"
                                    size="sm"
                                    onClick={handleCreateExternalMedia}
                                >
                                    Registrar URL
                                </Button>
                            </div>
                        </div>
                    </AdaptableCard>

                    <AdaptableCard divider>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="font-semibold">Biblioteca de media</h4>
                                <p className="text-sm text-gray-500">
                                    Recursos disponibles para bloques y secciones.
                                </p>
                            </div>
                            <div className="text-sm text-gray-500">{mediaItems.length} recursos</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                            {mediaItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-2xl border border-gray-200 overflow-hidden bg-white"
                                >
                                    <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
                                        {item.type === 'IMAGE' ? (
                                            <img
                                                src={item.url}
                                                alt={item.alt ?? item.title ?? 'CMS media'}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-sm text-gray-500 px-4 text-center">
                                                {item.type}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 space-y-2">
                                        <div className="font-semibold text-sm">
                                            {item.title || item.fileName || item.url}
                                        </div>
                                        <div className="text-xs text-gray-500 break-all">{item.url}</div>
                                        <div className="text-xs text-gray-500">
                                            {item.type}
                                            {item.sizeBytes ? ` · ${(item.sizeBytes / 1024).toFixed(1)} KB` : ''}
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-2">
                                            <Button
                                                size="xs"
                                                variant="plain"
                                                onClick={() => navigator.clipboard.writeText(item.url)}
                                            >
                                                Copiar URL
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="plain"
                                                className="text-red-600"
                                                onClick={() => handleDeleteMedia(item.id)}
                                            >
                                                Eliminar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AdaptableCard>
                </div>
            )}
        </div>
    )
}

export default SiteManager
