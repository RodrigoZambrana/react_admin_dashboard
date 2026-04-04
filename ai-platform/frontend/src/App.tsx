import { useEffect, useState } from 'react';

import { AdminApp } from './AdminApp';
import { PublicChatPage } from './pages/PublicChatPage';

type ShellMode = 'admin' | 'public-chat';

function resolveShellMode(pathname: string): ShellMode {
  if (pathname.startsWith('/chat') || pathname.startsWith('/webchat')) {
    return 'public-chat';
  }

  return 'admin';
}

export function App() {
  const [shellMode, setShellMode] = useState<ShellMode>(() =>
    resolveShellMode(window.location.pathname),
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setShellMode(resolveShellMode(window.location.pathname));
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  if (shellMode === 'public-chat') {
    return <PublicChatPage />;
  }

  return <AdminApp />;
}
