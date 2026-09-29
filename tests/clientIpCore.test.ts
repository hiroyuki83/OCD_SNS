import assert from 'node:assert/strict';
import test from 'node:test';

import { clientIpFromHeaders } from '../src/lib/clientIpCore';

test('extracts the first Vercel x-forwarded-for value', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.10, 10.0.0.1',
  });

  assert.equal(clientIpFromHeaders(headers), '203.0.113.10');
});

test('normalizes surrounding whitespace and IPv6 case', () => {
  const headers = new Headers({
    'x-forwarded-for': ' 2001:DB8::1 ',
  });

  assert.equal(clientIpFromHeaders(headers), '2001:db8::1');
});

test('returns null when the forwarded IP header is absent or unusable', () => {
  assert.equal(clientIpFromHeaders(new Headers()), null);
  assert.equal(
    clientIpFromHeaders(new Headers({ 'x-forwarded-for': '   ' })),
    null,
  );
  assert.equal(
    clientIpFromHeaders(
      new Headers({ 'x-forwarded-for': 'x'.repeat(129) }),
    ),
    null,
  );
});

test('rejects control characters if a non-standard Headers implementation supplies them', () => {
  const headers = {
    get(name: string) {
      return name.toLowerCase() === 'x-forwarded-for'
        ? '203.0.113.10\u0000suffix'
        : null;
    },
  } as Headers;

  assert.equal(clientIpFromHeaders(headers), null);
});
