export type LabRouteMap = {
  dashboard: string;
  roadmap: string;
  focus: string;
  log: string;
  projects: string;
  progress: string;
};

export const OWNER_ROUTES: LabRouteMap = {
  dashboard: '/',
  roadmap: '/roadmap',
  focus: '/focus',
  log: '/log',
  projects: '/projects',
  progress: '/progress',
};

export const DEMO_ROUTES: LabRouteMap = {
  dashboard: '/demo',
  roadmap: '/demo/roadmap',
  focus: '/demo/focus',
  log: '/demo/log',
  projects: '/demo/projects',
  progress: '/demo/progress',
};

export function isLabRouteActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/' && href !== '/demo' && pathname.startsWith(`${href}/`));
}
