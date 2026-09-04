const PUBLIC_PAGE_ROOTS = ['/login', '/reset-password', '/showcase', '/demo'] as const;

export function isPublicPagePath(pathname: string): boolean {
  return PUBLIC_PAGE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
