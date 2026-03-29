import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CmsEntryStatus, CmsPageSectionType } from '@prisma/client'
import { NotFoundException } from '@nestjs/common'
import { CmsPagesService } from '../cms-pages.service'

const createPage = (path: string) => ({
  id: 1,
  path,
  title: `Page ${path || 'root'}`,
  summary: null,
  locale: 'es',
  status: CmsEntryStatus.PUBLISHED,
  visible: true,
  seoTitle: null,
  seoDescription: null,
  layoutKey: 'landing-default',
  legacySource: null,
  aliases: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  sections: [
    {
      id: 1,
      pageId: 1,
      type: CmsPageSectionType.SITE_HEADER,
      key: 'header',
      name: 'Header',
      sortOrder: 0,
      visible: true,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      blocks: [],
    },
  ],
})

describe('CmsPagesService.getPublicPageByPath', () => {
  let prisma: {
    cmsPage: {
      findMany: ReturnType<typeof vi.fn>
    }
  }
  let service: CmsPagesService

  beforeEach(() => {
    prisma = {
      cmsPage: {
        findMany: vi.fn(),
      },
    }

    service = new CmsPagesService(prisma as any)
  })

  it('returns the exact published page when the path exists', async () => {
    prisma.cmsPage.findMany.mockResolvedValueOnce([createPage('contacto.html')])

    const page = await service.getPublicPageByPath('contacto.html')

    expect(page.path).toBe('contacto.html')
    expect(prisma.cmsPage.findMany).toHaveBeenCalledTimes(1)
  })

  it('resolves a short legacy html path to the canonical imported product path', async () => {
    prisma.cmsPage.findMany
      .mockResolvedValueOnce([
        {
          ...createPage('productos/cortinas-roller.html'),
          aliases: [{ path: 'cortinas-roller.html' }],
        },
      ])

    const page = await service.getPublicPageByPath('cortinas-roller.html')

    expect(page.path).toBe('productos/cortinas-roller.html')
    expect(prisma.cmsPage.findMany).toHaveBeenCalledTimes(1)
  })

  it('falls back to basename matches ordered by legacy section preference', async () => {
    prisma.cmsPage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createPage('articulos/dvh.html'),
        createPage('productos/dvh.html'),
      ])

    const page = await service.getPublicPageByPath('dvh.html')

    expect(page.path).toBe('productos/dvh.html')
    expect(prisma.cmsPage.findMany).toHaveBeenCalledTimes(2)
  })

  it('throws when no visible published page matches the requested path', async () => {
    prisma.cmsPage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(service.getPublicPageByPath('inexistente.html')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
