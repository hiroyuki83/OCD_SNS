import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authSource = readFileSync('src/auth.ts', 'utf8');

test('credentials login is rate limited by both client IP and normalized email', () => {
  assert.match(authSource, /async authorize\(credentials, request\)/);
  assert.match(authSource, /clientIpFromHeaders\(request\.headers\)/);
  assert.match(
    authSource,
    /rateLimit\(\`login-ip:\$\{clientIp\}\`, 50, 15 \* 60 \* 1000\)/,
  );
  assert.match(
    authSource,
    /rateLimit\(\`login:\$\{email\}\`, 10, 15 \* 60 \* 1000\)/,
  );
});

test('IP rate limiting is conditional when no trusted proxy IP header is present', () => {
  assert.match(
    authSource,
    /clientIp\s*&&[\s\S]*rateLimit\(\`login-ip:\$\{clientIp\}\`/,
  );
});
