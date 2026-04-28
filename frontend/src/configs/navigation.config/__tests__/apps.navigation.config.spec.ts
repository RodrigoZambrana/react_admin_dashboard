import { describe, expect, it } from 'vitest'

import appsNavigationConfig from '../apps.navigation.config'

const findNode = (nodes: any[], predicate: (node: any) => boolean): any | undefined => {
  for (const node of nodes) {
    if (predicate(node)) return node
    const child = node?.subMenu ? findNode(node.subMenu, predicate) : undefined
    if (child) return child
  }
  return undefined
}

describe('apps navigation config', () => {
  it('renders CMS and Channels with structural icons and translation keys', () => {
    const root = appsNavigationConfig[0]
    expect(root?.subMenu?.length).toBeGreaterThan(0)

    const channels = findNode(root.subMenu as any[], (node) => node.key === 'apps.channels')
    const cms = findNode(root.subMenu as any[], (node) => node.key === 'apps.cms')

    expect(channels).toMatchObject({
      title: 'Channels',
      translateKey: 'nav.appsSettings.channels',
      icon: 'message',
    })
    expect(cms).toMatchObject({
      title: 'CMS',
      translateKey: 'nav.appsCms.root',
      icon: 'layout',
    })

    expect(channels.subMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Email',
          translateKey: 'nav.appsSettings.email',
          icon: 'emailChannel',
        }),
        expect.objectContaining({
          title: 'WhatsApp QR',
          translateKey: 'nav.appsSettings.whatsappQr',
          icon: 'whatsapp',
        }),
        expect.objectContaining({
          title: 'Meta Channels',
          translateKey: 'nav.appsSettings.metaChannels',
          icon: 'meta',
        }),
      ]),
    )

    expect(cms.subMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'General Site Pages',
          translateKey: 'nav.appsCms.generalPages',
          icon: 'pages',
        }),
        expect.objectContaining({
          title: 'Legacy Content',
          translateKey: 'nav.appsCms.content',
          icon: 'documentation',
        }),
        expect.objectContaining({
          title: 'Storefront Pages',
          translateKey: 'nav.appsCms.storePages',
          icon: 'products',
        }),
      ]),
    )
  })
})
