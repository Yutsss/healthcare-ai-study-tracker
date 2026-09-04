import { describe, expect, it } from 'vitest';
import { isPublicPagePath } from './public-paths';

describe('isPublicPagePath', () => {
  it.each(['/login', '/reset-password', '/showcase', '/showcase/project', '/demo', '/demo/roadmap'])(
    'allows %s', (path) => expect(isPublicPagePath(path)).toBe(true),
  );

  it.each(['/', '/projects', '/settings', '/showcase-private', '/demolition'])(
    'keeps %s private', (path) => expect(isPublicPagePath(path)).toBe(false),
  );
});
