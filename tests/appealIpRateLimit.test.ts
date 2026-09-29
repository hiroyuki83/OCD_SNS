import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appealSource = readFileSync('src/app/appeal/actions.ts', 'utf8');
const requestIpSource = readFileSync('src/lib/requestClientIp.ts', 'utf8');

test('sanction appeal authentication is rate limited by both client IP and email', () => {
  assert.match(appealSource, /currentRequestClientIp\(\)/);
  assert.match(
    appealSource,
    /rateLimit\(\`sanction-appeal-ip:\$\{clientIp\}\`, 50, 15 \* 60 \* 1000\)/,
  );
  assert.match(
    appealSource,
    /rateLimit\(\`sanction-appeal-auth:\$\{email\}\`, 10, 15 \* 60 \* 1000\)/,
  );
});

test('appeal IP limiting remains conditional when the trusted proxy IP is absent', () => {
  assert.match(
    appealSource,
    /clientIp\s*&&[\s\S]*sanction-appeal-ip:/,
  );
});

test('server actions resolve client IP through the shared trusted request helper', () => {
  assert.match(requestIpSource, /headers\(\)/);
  assert.match(requestIpSource, /clientIpFromHeaders/);
});
