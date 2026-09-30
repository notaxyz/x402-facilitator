import { describe, expect, it } from 'vitest';
import { screenResourceUrl } from '../src/resourceUrl.js';

/** Every catalogued URL is one an agent may call unattended, so these are the SSRF rules. */
describe('screenResourceUrl', () => {
  it('accepts an ordinary public https resource', () => {
    expect(screenResourceUrl('https://api.example.com/analyze', false)).toEqual({
      ok: true,
      url: 'https://api.example.com/analyze',
    });
  });

  it.each([
    ['not a url', 'analyze'],
    ['a relative path', '/analyze'],
    ['a non-http scheme', 'file:///etc/passwd'],
    ['a gopher scheme', 'gopher://example.com/'],
    ['embedded credentials', 'https://user:pass@example.com/x'],
    ['a loopback name', 'http://localhost:3100/analyze'],
    ['an ip6-localhost name', 'http://ip6-localhost/x'],
    ['a loopback literal', 'http://127.0.0.1:3100/analyze'],
    ['link-local metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['a private range literal', 'http://10.0.0.5/internal'],
    ['another private range', 'http://192.168.1.1/admin'],
    ['a decimal-encoded ip', 'http://2130706433/'],
    ['a hex-encoded ip', 'http://0x7f000001/'],
    ['an ipv6 literal', 'http://[::1]/x'],
    ['an internal suffix', 'http://billing.internal/x'],
    ['an mdns suffix', 'http://printer.local/x'],
    ['a bare hostname', 'http://intranet/x'],
  ])('rejects %s', (_label, url) => {
    const verdict = screenResourceUrl(url, false);
    expect(verdict.ok).toBe(false);
  });

  it('rejects a url past the length cap', () => {
    const long = `https://example.com/${'a'.repeat(4000)}`;
    expect(screenResourceUrl(long, false)).toMatchObject({ ok: false });
  });

  it('allows loopback when private resource urls are explicitly enabled', () => {
    expect(screenResourceUrl('http://localhost:3100/analyze', true)).toMatchObject({ ok: true });
  });

  it('still refuses a non-http scheme even when private urls are enabled', () => {
    expect(screenResourceUrl('file:///etc/passwd', true)).toMatchObject({ ok: false });
  });
});
