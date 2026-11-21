import { useCallback, useEffect, useState } from 'react';
import { sharedAudioController } from './audioPlayer.ts';

export type AppRoute =
  | { page: 'setup' }
  | { page: 'quiz' }
  | { page: 'summary'; sessionId?: string }
  | { page: 'catalog'; focusId?: string };

export function parseHashRoute(rawHash: string): AppRoute {
  const cleaned = rawHash.replace(/^#/, '') || '/';
  const [pathname, queryString] = cleaned.split('?');
  const params = new URLSearchParams(queryString || '');
  const segments = pathname.split('/').filter(Boolean);

  const first = segments[0] ?? '';

  switch (first) {
    case 'catalog':
    case 'study':
      return { page: 'catalog', focusId: params.get('id') || undefined };
    case 'quiz':
      return { page: 'quiz' };
    case 'summary':
      return { page: 'summary', sessionId: segments[1] || params.get('id') || undefined };
    case 'setup':
    case 'training':
    case '':
    default:
      return { page: 'setup' };
  }
}

export function buildHashUrl(route: AppRoute): string {
  switch (route.page) {
    case 'setup':
      return '#/training';
    case 'quiz':
      return '#/quiz';
    case 'summary':
      return route.sessionId
        ? `#/summary/${encodeURIComponent(route.sessionId)}`
        : '#/summary';
    case 'catalog':
      return route.focusId
        ? `#/study?id=${encodeURIComponent(route.focusId)}`
        : '#/study';
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined' ? parseHashRoute(window.location.hash) : { page: 'setup' }
  );

  useEffect(() => {
    const onHashChange = () => {
      sharedAudioController.stop();
      setRoute(parseHashRoute(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    const targetHash = buildHashUrl(next);
    sharedAudioController.stop();
    if (window.location.hash === targetHash) {
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    window.location.hash = targetHash;
  }, []);

  return { route, navigate };
}
