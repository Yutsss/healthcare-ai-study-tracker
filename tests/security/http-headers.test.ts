import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.js';

describe('production security headers', () => {
  it('prevents cross-site framing without advertising wildcard CORS', async () => {
    const entries = await nextConfig.headers?.();
    const global = entries?.find((entry) => entry.source === '/(.*)');
    const headers = new Map(global?.headers.map(({ key, value }) => [key.toLowerCase(), value]));

    expect(headers.get('content-security-policy')).toBe("frame-ancestors 'self';");
    expect(headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(headers.has('access-control-allow-origin')).toBe(false);
    expect(headers.has('access-control-allow-methods')).toBe(false);
    expect(headers.has('access-control-allow-headers')).toBe(false);
  });

  it('does not advertise the framework in the powered-by header', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
