import { test, expect } from '@playwright/test';
import { login, USERS } from './helpers.mjs';

test.describe.serial('core social flows', () => {
  test('searches users by @handle', async ({ page }) => {
    await login(page, USERS.public1);
    await page.goto('/explore?q=%40preview-private');
    await expect(page.getByRole('link', { name: /@preview-private/ })).toBeVisible();
  });

  test('keeps private posts hidden until follow approval', async ({ browser }) => {
    const requester = await browser.newContext();
    const owner = await browser.newContext();
    const anonymous = await browser.newContext();
    const requesterPage = await requester.newPage();
    const ownerPage = await owner.newPage();
    const anonymousPage = await anonymous.newPage();
    const privateContent = 'E2E 非公開投稿 #private-e2e';

    await login(ownerPage, USERS.private);
    await ownerPage.goto('/?compose=1');
    await ownerPage.getByLabel('投稿本文').fill(privateContent);
    await ownerPage.getByRole('button', { name: '投稿', exact: true }).click();
    await expect(ownerPage.getByText('投稿しました。')).toBeVisible();

    await anonymousPage.goto('/explore?q=%23private-e2e');
    await expect(anonymousPage.getByText(privateContent, { exact: true })).toHaveCount(0);

    await login(requesterPage, USERS.public1);
    await requesterPage.goto('/user/preview-private');
    await expect(requesterPage.getByText(privateContent, { exact: true })).toHaveCount(0);
    await expect(requesterPage.getByText('このアカウントは非公開です')).toBeVisible();

    await requesterPage.getByRole('button', { name: 'フォローする' }).click();
    await expect(requesterPage.getByRole('status')).toContainText('フォロー申請を送信しました');
    await expect(requesterPage.getByText('フォロー申請を送信済みです')).toBeVisible();

    await ownerPage.goto('/profile/followers');
    const userLink = ownerPage.getByRole('link', { name: 'Preview 公開ユーザー1' });
    const row = userLink.locator('..').locator('..');
    await row.getByRole('button', { name: '承認' }).click();
    await expect(row.getByRole('button', { name: 'フォロワーから削除' })).toBeVisible();

    await requesterPage.reload();
    await expect(requesterPage.getByRole('button', { name: 'フォロー中' })).toBeVisible();
    await expect(requesterPage.getByText(privateContent, { exact: true })).toBeVisible();

    await requesterPage.goto('/?tab=following');
    await expect(requesterPage.getByText(privateContent, { exact: true })).toBeVisible();

    await requester.close();
    await owner.close();
    await anonymous.close();
  });

  test('mutes, unmutes, blocks, and unblocks another user', async ({ page }) => {
    await login(page, USERS.public1);
    await page.goto('/user/preview-public-2');

    await page.getByRole('button', { name: 'ミュート', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('ミュートしました');
    await expect(page.getByText('ミュート中のため投稿は表示されません')).toBeVisible();

    await page.getByRole('button', { name: 'ミュート解除' }).click();
    await expect(page.getByRole('status')).toContainText('ミュートを解除しました');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'ブロック', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('ブロックしました');
    await expect(page.getByText('ブロック中のため投稿は表示されません')).toBeVisible();

    await page.getByRole('button', { name: 'ブロック解除' }).click();
    await expect(page.getByRole('status')).toContainText('ブロックを解除しました');
  });

  test('creates a post, interacts with it, bookmarks it, and deletes it', async ({ browser }) => {
    const author = await browser.newContext();
    const viewer = await browser.newContext();
    const authorPage = await author.newPage();
    const viewerPage = await viewer.newPage();
    const content = 'E2E 投稿フロー #coco-e2e';

    await login(authorPage, USERS.public1);
    await authorPage.goto('/?compose=1');
    await authorPage.getByLabel('投稿本文').fill(content);
    await authorPage.getByRole('button', { name: '投稿', exact: true }).click();
    await expect(authorPage.getByText('投稿しました。')).toBeVisible();

    await login(viewerPage, USERS.public2);
    await viewerPage.goto('/user/preview-public-1');
    const contentNode = viewerPage.getByText(content, { exact: true });
    await expect(contentNode).toBeVisible();
    const card = contentNode.locator('..');

    for (const name of ['いいね', 'わかる', '頑張った', 'ブックマーク']) {
      const button = card.getByRole('button', { name: new RegExp(`^${name}`) });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }

    await viewerPage.goto('/bookmarks');
    await expect(viewerPage.getByText(content, { exact: true })).toBeVisible();

    await authorPage.goto('/profile');
    const authorContent = authorPage.getByText(content, { exact: true });
    const authorCard = authorContent.locator('..');
    authorPage.once('dialog', (dialog) => dialog.accept());
    await authorCard.getByRole('button', { name: '削除' }).click();
    await expect(authorPage.getByText(content, { exact: true })).toHaveCount(0);

    await viewerPage.goto('/bookmarks');
    await expect(viewerPage.getByText(content, { exact: true })).toHaveCount(0);

    await author.close();
    await viewer.close();
  });
});
