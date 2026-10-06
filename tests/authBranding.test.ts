import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('login and register use the CoCo logo instead of the legacy X mark', () => {
  for (const path of ['src/app/login/page.tsx', 'src/app/register/page.tsx']) {
    const source = readFileSync(path, 'utf8');

    assert.ok(source.includes('src="/icon/logo.png"'));
    assert.ok(source.includes('alt="CoCo"'));
    assert.ok(!source.includes('M18.244 2.25h3.308'));
  }
});

test('logged-out register buttons keep readable white text on black background', () => {
  for (const path of [
    'src/components/layout/Sidebar.tsx',
    'src/components/layout/MobileMenu.tsx',
  ]) {
    const source = readFileSync(path, 'utf8');

    assert.ok(source.includes('bg-black'));
    assert.ok(source.includes('badge-text-white'));
  }
});
