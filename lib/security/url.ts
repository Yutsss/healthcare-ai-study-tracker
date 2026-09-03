/**
 * Returns the URL only if it is a safe, absolute http(s) link; otherwise null.
 * Blocks javascript:, data:, vbscript:, file: and other dangerous schemes in
 * user/seed-provided links (defence in depth against stored XSS via href).
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = String(url).trim();
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    return null;
  } catch {
    return null;
  }
}
