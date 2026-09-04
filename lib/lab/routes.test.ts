import { describe, expect, it } from 'vitest';
import { DEMO_ROUTES, OWNER_ROUTES, isLabRouteActive } from './routes';

describe('lab route maps', () => {
  it('maps the same six capabilities to owner and nested demo paths', () => {
    expect(OWNER_ROUTES).toEqual({
      dashboard: '/', roadmap: '/roadmap', focus: '/focus', log: '/log', projects: '/projects', progress: '/progress',
    });
    expect(DEMO_ROUTES).toEqual({
      dashboard: '/demo', roadmap: '/demo/roadmap', focus: '/demo/focus', log: '/demo/log', projects: '/demo/projects', progress: '/demo/progress',
    });
  });

  it('keeps dashboard exact while nested sections remain active below their root', () => {
    expect(isLabRouteActive('/demo', '/demo')).toBe(true);
    expect(isLabRouteActive('/demo/progress', '/demo')).toBe(false);
    expect(isLabRouteActive('/demo/projects/item', '/demo/projects')).toBe(true);
    expect(isLabRouteActive('/progress', '/')).toBe(false);
  });
});
