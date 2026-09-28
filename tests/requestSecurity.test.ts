import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseJsonMutationRequest,
  validateJsonMutationRequest,
} from '../src/lib/requestSecurityCore';

function jsonRequest(
  body = '{}',
  headers: Record<string, string> = {},
  url = 'https://coco.example/api/test',
) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://coco.example',
      ...headers,
    },
    body,
  });
}

test('same-origin JSON mutation is accepted', () => {
  const result = validateJsonMutationRequest(jsonRequest());
  assert.deepEqual(result, { ok: true });
});

test('cross-site fetch metadata is rejected even when Origin otherwise matches', () => {
  const result = validateJsonMutationRequest(
    jsonRequest('{}', { 'sec-fetch-site': 'cross-site' }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.equal(result.error, 'Cross-site request blocked.');
  }
});

test('mismatched Origin is rejected', () => {
  const result = validateJsonMutationRequest(
    jsonRequest('{}', { origin: 'https://attacker.example' }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.equal(result.error, 'Origin is not allowed.');
  }
});

test('invalid Origin is rejected as malformed input', () => {
  const result = validateJsonMutationRequest(
    jsonRequest('{}', { origin: 'not a url' }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.error, 'Invalid Origin header.');
  }
});

test('missing Origin is accepted only with same-origin or none fetch metadata', () => {
  for (const site of ['same-origin', 'none']) {
    const request = new Request('https://coco.example/api/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': site,
      },
      body: '{}',
    });
    assert.deepEqual(validateJsonMutationRequest(request), { ok: true });
  }

  const missingMetadata = new Request('https://coco.example/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const rejected = validateJsonMutationRequest(missingMetadata);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.status, 403);
    assert.equal(rejected.error, 'Origin verification required.');
  }
});

test('non-JSON mutation content type is rejected', () => {
  const result = validateJsonMutationRequest(
    jsonRequest('{}', { 'content-type': 'text/plain' }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 415);
    assert.equal(result.error, 'Content-Type must be application/json.');
  }
});

test('oversized declared content length is rejected before parsing', () => {
  const result = validateJsonMutationRequest(
    jsonRequest('{}', { 'content-length': String(16 * 1024 + 1) }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 413);
    assert.equal(result.error, 'Request body is too large.');
  }
});

test('invalid content length is rejected', () => {
  const result = validateJsonMutationRequest(
    jsonRequest('{}', { 'content-length': 'invalid' }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.error, 'Invalid Content-Length header.');
  }
});

test('JSON parser rejects malformed and empty bodies', async () => {
  const malformed = await parseJsonMutationRequest(
    jsonRequest('{not-json'),
  );
  assert.equal(malformed.ok, false);
  if (!malformed.ok) {
    assert.equal(malformed.status, 400);
    assert.equal(malformed.error, 'Invalid JSON body.');
  }

  const empty = await parseJsonMutationRequest(
    jsonRequest('   '),
  );
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.equal(empty.status, 400);
    assert.equal(empty.error, 'JSON body is required.');
  }
});

test('JSON parser enforces actual UTF-8 body size even without Content-Length', async () => {
  const oversizedBody = JSON.stringify({ text: 'あ'.repeat(6000) });
  const request = new Request('https://coco.example/api/test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://coco.example',
    },
    body: oversizedBody,
  });

  // Remove the automatically generated Content-Length semantics from the
  // security assertion: parseJsonMutationRequest must independently check bytes.
  const result = await parseJsonMutationRequest(request);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 413);
    assert.equal(result.error, 'Request body is too large.');
  }
});

test('valid JSON is returned after request security checks pass', async () => {
  const result = await parseJsonMutationRequest<{ value: number }>(
    jsonRequest('{"value":42}'),
  );

  assert.deepEqual(result, {
    ok: true,
    data: { value: 42 },
  });
});
