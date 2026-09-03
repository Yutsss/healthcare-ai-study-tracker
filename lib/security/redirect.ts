/**
 * Returns a safe SAME-SITE path for post-auth redirects, or '/' when the input
 * is missing, absolute, protocol-relative (//host), backslash-tricked, or otherwise unsafe.
 * Prevents open-redirect (CWE-601) via the ?next= parameter.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  let value = String(next).trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return '/';
  }
  // Must be a root-relative path...
  if (!value.startsWith('/')) return '/';
  // ...but not protocol-relative (//evil.com) or backslash-tricked (/\evil.com).
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  // No control chars, no backslashes, no embedded scheme (CR/LF/scheme injection).
  if (/[\x00-\x1f]/.test(value) || value.includes('\\')) return '/';
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return '/';
  return value;
}
