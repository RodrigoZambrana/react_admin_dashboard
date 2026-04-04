import { useEffect, useMemo, useState } from 'react';

import { AdminShell, type AdminNavigationItem } from './components/layout/AdminShell';
import { TemplateAssetBundle } from './components/layout/TemplateAssetBundle';
import { DashboardPage } from './pages/DashboardPage';
import { ChatTestCenterPage } from './pages/ChatTestCenterPage';
import { CriticalConfigsPage } from './pages/CriticalConfigsPage';
import { DateTimeLocaleResourcesPage } from './pages/DateTimeLocaleResourcesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { KnowledgeCenterPage } from './pages/KnowledgeCenterPage';
import { KnowledgeMetadataPage } from './pages/KnowledgeMetadataPage';
import { PromptsPage } from './pages/PromptsPage';
import { ResponseFallbackCatalogsPage } from './pages/ResponseFallbackCatalogsPage';

type RouteKey =
  | 'dashboard'
  | 'chat-test-center'
  | 'knowledge-center'
  | 'documents'
  | 'prompts'
  | 'date-time-locale-resources'
  | 'critical-configs'
  | 'response-fallback-catalogs'
  | 'knowledge-metadata';

const routeLabels: Record<RouteKey, string> = {
  dashboard: 'Operations Dashboard',
  'chat-test-center': 'Chat Test Center',
  'knowledge-center': 'Knowledge Center',
  documents: 'Documents',
  prompts: 'Prompts',
  'date-time-locale-resources': 'Date-time locale resources',
  'critical-configs': 'Critical configs',
  'response-fallback-catalogs': 'Response fallback catalogs',
  'knowledge-metadata': 'Knowledge metadata',
};

const navigationItems: AdminNavigationItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'ti ti-layout-dashboard',
    href: '#dashboard',
  },
  {
    key: 'chat-test-center',
    label: 'Chat Test Center',
    icon: 'ti ti-flask-2',
    href: '#chat-test-center',
  },
  {
    key: 'knowledge-center',
    label: 'Knowledge Center',
    icon: 'ti ti-brain',
    href: '#knowledge-center',
  },
  {
    key: 'documents',
    label: 'Documents',
    icon: 'ti ti-file-search',
    href: '#documents',
  },
  {
    key: 'prompts',
    label: 'Prompts',
    icon: 'ti ti-file-text-ai',
    href: '#prompts',
  },
  {
    key: 'date-time-locale-resources',
    label: 'Date-time locale resources',
    icon: 'ti ti-calendar-time',
    href: '#date-time-locale-resources',
  },
  {
    key: 'critical-configs',
    label: 'Critical configs',
    icon: 'ti ti-adjustments-horizontal',
    href: '#critical-configs',
  },
  {
    key: 'response-fallback-catalogs',
    label: 'Response fallback catalogs',
    icon: 'ti ti-message-language',
    href: '#response-fallback-catalogs',
  },
  {
    key: 'knowledge-metadata',
    label: 'Knowledge metadata',
    icon: 'ti ti-database-star',
    href: '#knowledge-metadata',
  },
];

function parseRouteFromHash(hash: string): RouteKey {
  const normalized = hash.replace(/^#/, '') as RouteKey;

  if (normalized in routeLabels) {
    return normalized;
  }

  return 'dashboard';
}

export function AdminApp() {
  const [route, setRoute] = useState<RouteKey>(() =>
    parseRouteFromHash(window.location.hash),
  );
  const [templateReady, setTemplateReady] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseRouteFromHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const activeItem = useMemo(
    () => navigationItems.find((item) => item.key === route) ?? navigationItems[0],
    [route],
  );

  return (
    <>
      <TemplateAssetBundle bundle="admin" onReadyChange={setTemplateReady} />
      <AdminShell
        activeKey={route}
        navigationItems={navigationItems}
        currentLabel={routeLabels[route]}
        showGlobalLoader={!templateReady}
      >
        {route === 'dashboard' ? <DashboardPage /> : null}
        {route === 'chat-test-center' ? <ChatTestCenterPage /> : null}
        {route === 'knowledge-center' ? <KnowledgeCenterPage /> : null}
        {route === 'documents' ? <DocumentsPage /> : null}
        {route === 'prompts' ? <PromptsPage /> : null}
        {route === 'date-time-locale-resources' ? (
          <DateTimeLocaleResourcesPage />
        ) : null}
        {route === 'critical-configs' ? <CriticalConfigsPage /> : null}
        {route === 'response-fallback-catalogs' ? (
          <ResponseFallbackCatalogsPage />
        ) : null}
        {route === 'knowledge-metadata' ? <KnowledgeMetadataPage /> : null}
        <div className="app-route-marker d-none">{activeItem.label}</div>
      </AdminShell>
    </>
  );
}
