import { useLayoutEffect } from 'react';

type TemplateBundleDefinition = {
  key: string;
  title: string;
  favicon: string;
  scripts?: string[];
  styles: string[];
};

const TEMPLATE_BUNDLES: Record<'admin' | 'chat', TemplateBundleDefinition> = {
  admin: {
    key: 'admin',
    title: 'DreamsChat AI Platform Admin',
    favicon: '/dreamschat-admin/assets/img/favicon.png',
    scripts: ['/dreamschat-admin/assets/js/theme-script.js'],
    styles: [
      '/dreamschat-admin/assets/css/bootstrap.min.css',
      '/dreamschat-admin/assets/css/feather.css',
      '/dreamschat-admin/assets/plugins/fontawesome/css/fontawesome.min.css',
      '/dreamschat-admin/assets/plugins/fontawesome/css/all.min.css',
      '/dreamschat-admin/assets/plugins/boxicons/css/boxicons.min.css',
      '/dreamschat-admin/assets/plugins/tabler-icons/tabler-icons.css',
      '/dreamschat-admin/assets/plugins/select2/css/select2.min.css',
      '/dreamschat-admin/assets/css/style.css',
    ],
  },
  chat: {
    key: 'chat',
    title: 'DreamsChat AI Platform Chat',
    favicon: '/dreamschat-chat/assets/img/favicon.png',
    scripts: ['/dreamschat-chat/assets/js/theme-script.js'],
    styles: [
      '/dreamschat-chat/assets/css/bootstrap.min.css',
      '/dreamschat-chat/assets/css/feather.css',
      '/dreamschat-chat/assets/plugins/fontawesome/css/fontawesome.min.css',
      '/dreamschat-chat/assets/plugins/fontawesome/css/all.min.css',
      '/dreamschat-chat/assets/plugins/swiper/swiper.min.css',
      '/dreamschat-chat/assets/plugins/fancybox/jquery.fancybox.min.css',
      '/dreamschat-chat/assets/plugins/tabler-icons/tabler-icons.min.css',
      '/dreamschat-chat/assets/css/bootstrap-datetimepicker.min.css',
      '/dreamschat-chat/assets/plugins/select2/css/select2.min.css',
      '/dreamschat-chat/assets/css/style.css',
    ],
  },
};

type TemplateAssetBundleProps = {
  bundle: keyof typeof TEMPLATE_BUNDLES;
};

export function TemplateAssetBundle({ bundle }: TemplateAssetBundleProps) {
  useLayoutEffect(() => {
    const definition = TEMPLATE_BUNDLES[bundle];
    const previousTitle = document.title;
    const faviconSelector = 'link[data-runtime-favicon="true"]';
    const previousManagedAssets = document.querySelectorAll(
      '[data-runtime-template-asset="true"]',
    );
    previousManagedAssets.forEach((node) => node.parentNode?.removeChild(node));

    const favicon =
      (document.querySelector(faviconSelector) as HTMLLinkElement | null) ??
      document.createElement('link');
    favicon.setAttribute('data-runtime-favicon', 'true');
    favicon.rel = 'shortcut icon';
    favicon.type = 'image/x-icon';
    favicon.href = definition.favicon;
    if (!favicon.parentNode) {
      document.head.appendChild(favicon);
    }

    const managedNodes: HTMLElement[] = [];

    for (const scriptSrc of definition.scripts ?? []) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.setAttribute('data-runtime-template-asset', 'true');
      script.async = false;
      document.head.appendChild(script);
      managedNodes.push(script);
    }

    for (const stylesheetHref of definition.styles) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = stylesheetHref;
      link.setAttribute('data-runtime-template-asset', 'true');
      document.head.appendChild(link);
      managedNodes.push(link);
    }

    document.title = definition.title;
    document.body.setAttribute('data-template-bundle', definition.key);

    return () => {
      managedNodes.forEach((node) => node.parentNode?.removeChild(node));
      document.title = previousTitle;
      if (document.body.getAttribute('data-template-bundle') === definition.key) {
        document.body.removeAttribute('data-template-bundle');
      }
    };
  }, [bundle]);

  return null;
}
