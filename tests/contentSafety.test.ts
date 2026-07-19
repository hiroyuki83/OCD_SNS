import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePostSafety, validatePublicPostContent } from '../src/lib/contentSafety';

test('ordinary posts have no safety flag', () => {
    assert.deepEqual(evaluatePostSafety('今日は少し散歩できた'), { level: 'none' });
});

test('distress language shows a notice without creating an urgent flag', () => {
    assert.deepEqual(evaluatePostSafety('もう無理かもしれない。話を聞いてほしい'), { level: 'notice' });
});

test('explicit imminent intent is marked urgent', () => {
    assert.deepEqual(evaluatePostSafety('今から自殺するつもりです'), { level: 'urgent' });
});

test('public post validation limits links and repeated characters', () => {
    assert.equal(validatePublicPostContent('https://a.example https://b.example https://c.example'), 'URLは1投稿につき2件までにしてください。');
    assert.equal(validatePublicPostContent('あ'.repeat(25)), '同じ文字の連続が多すぎます。内容を短く整えてください。');
});
