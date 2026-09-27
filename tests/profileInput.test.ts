import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAutoHashtag,
  normalizeProfileBio,
  normalizeProfileName,
} from '../src/lib/profileInput';

test('normalizes profile name whitespace and strips unsafe controls', () => {
  assert.equal(normalizeProfileName('  Alice\u0000\n   Bob  '), 'Alice Bob');
  assert.equal(normalizeProfileName('   '), null);
});

test('normalizes profile bio line endings and allows clearing it', () => {
  assert.equal(
    normalizeProfileBio(' first  \r\nsecond\u0007\rthird\t  '),
    'first\nsecond\nthird',
  );
  assert.equal(normalizeProfileBio('\r\n  '), null);
});

test('normalizes valid automatic hashtags', () => {
  assert.deepEqual(normalizeAutoHashtag('  #OCD\n#ERP   #回復  '), {
    ok: true,
    value: '#OCD #ERP #回復',
  });
  assert.deepEqual(normalizeAutoHashtag('   '), { ok: true, value: null });
});

test('rejects malformed automatic hashtags', () => {
  for (const value of ['OCD', '#', '#one#two']) {
    assert.equal(normalizeAutoHashtag(value).ok, false);
  }
});

test('limits automatic hashtag count and individual length', () => {
  assert.equal(normalizeAutoHashtag('#1 #2 #3 #4 #5 #6').ok, false);
  assert.equal(normalizeAutoHashtag('#' + 'a'.repeat(32)).ok, false);
});
