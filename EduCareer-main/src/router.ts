import type { TabId } from './types';

const routeByTab: Record<TabId, string> = {
  home: '/',
  about: '/about',
  programs: '/programs',
  opportunities: '/opportunities',
  register: '/register',
  partners: '/partners',
  contact: '/contact',
  portal: '/portal',
  dashboard: '/admin'
};

const tabByRoute = new Map<string, TabId>(
  Object.entries(routeByTab).map(([tab, route]) => [route, tab as TabId])
);

export function routeForTab(tab: TabId): string {
  return routeByTab[tab];
}

export function tabFromPath(pathname: string): TabId {
  return tabByRoute.get(normalizePath(pathname)) ?? 'home';
}

export function isKnownRoute(pathname: string): boolean {
  return tabByRoute.has(normalizePath(pathname));
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.replace(/\/+$/, '') || '/';
}
