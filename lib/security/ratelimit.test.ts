import { describe, expect, it } from 'vitest';
import { isSameOrigin } from './ratelimit';

describe('isSameOrigin', () => {
  it('rejects a browser-declared cross-site request even when Origin and Referer are absent', () => {
    const request = new Request('https://app.example.com/api/seed/import', {
      method: 'POST',
      headers: {
        host: 'app.example.com',
        'sec-fetch-site': 'cross-site',
      },
    });

    expect(isSameOrigin(request)).toBe(false);
  });

  it('allows a server-to-server request without browser fetch metadata', () => {
    const request = new Request('https://app.example.com/api/seed/import', {
      method: 'POST',
      headers: { host: 'app.example.com' },
    });

    expect(isSameOrigin(request)).toBe(true);
  });
});
