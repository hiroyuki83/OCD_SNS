import { test, expect } from '@playwright/test';
import {
  enrollStaffMfa,
  login,
  loginStaffWithRecoveryCode,
  PREVIEW_PASSWORD,
  reportVisiblePost,
  USERS,
} from './helpers.mjs';

test('report → moderation warning → appeal → admin overturn', async ({ browser }) => {
  const token = Date.now().toString(36);
  const authorContext = await browser.newContext();
  const reporterContext = await browser.newContext();
  const moderatorContext = await browser.newContext();
  const adminContext = await browser.newContext();

  const author = await authorContext.newPage();
  const reporter = await reporterContext.newPage();
  const moderator = await moderatorContext.newPage();
  const admin = await adminContext.newPage();

  const content = `E2E moderation flow ${token} #moderation-e2e`;
  const warningReason = `E2E警告理由です ${token}`;
  const appealMessage = `この警告は文脈上適切ではないため再確認をお願いします。 ${token}`;
  const reviewNote = `E2E審査で警告取消を確認しました ${token}`;

  await login(author, USERS.public1);
  await author.goto('/?compose=1');
  await author.getByLabel('投稿本文').fill(content);
  await author.getByRole('button', { name: '投稿', exact: true }).click();
  await expect(author.getByText('投稿しました。')).toBeVisible();

  await login(reporter, USERS.public2);
  await reportVisiblePost(reporter, content, {
    reasonNumber: '1',
    detail: `E2E moderation report ${token}`,
  });

  const moderatorMfa = await enrollStaffMfa(
    moderator,
    USERS.moderator2,
    PREVIEW_PASSWORD,
  );
  const moderatorRecoveryCode = moderatorMfa.recoveryCodes[0] ?? '';
  expect(moderatorRecoveryCode.length).toBeGreaterThan(10);
  await loginStaffWithRecoveryCode(
    moderator,
    USERS.moderator2,
    moderatorRecoveryCode,
    PREVIEW_PASSWORD,
  );

  await moderator.goto('/moderation');
  let reportCard = moderator.locator('[data-report-card]').filter({ hasText: content });
  await expect(reportCard).toBeVisible();

  await reportCard.getByRole('button', { name: '対応中', exact: true }).click();
  await moderator.goto('/moderation?status=REVIEWING');
  reportCard = moderator.locator('[data-report-card]').filter({ hasText: content });
  await expect(reportCard).toBeVisible();

  const warningForm = reportCard
    .getByRole('button', { name: '警告して解決' })
    .locator('xpath=ancestor::form');
  await warningForm.getByPlaceholder('警告理由（5文字以上）').fill(warningReason);
  await warningForm.getByRole('button', { name: '警告して解決' }).click();

  await author.goto('/notifications?filter=warnings');
  const warningCard = author.locator('[data-warning-card]').filter({ hasText: warningReason });
  await expect(warningCard).toBeVisible();
  await warningCard.getByLabel('この警告に異議申立てをする').fill(appealMessage);
  await warningCard.getByRole('button', { name: '異議申立てを送信' }).click();
  await expect(warningCard.getByRole('status')).toContainText('異議申立て');

  const adminMfa = await enrollStaffMfa(admin, USERS.admin2, PREVIEW_PASSWORD);
  const adminRecoveryCode = adminMfa.recoveryCodes[0] ?? '';
  expect(adminRecoveryCode.length).toBeGreaterThan(10);
  await loginStaffWithRecoveryCode(
    admin,
    USERS.admin2,
    adminRecoveryCode,
    PREVIEW_PASSWORD,
  );

  await admin.goto('/moderation/appeals');
  const appealCard = admin.locator('[data-appeal-card]').filter({ hasText: appealMessage });
  await expect(appealCard).toBeVisible();
  await appealCard.getByLabel('審査理由').fill(reviewNote);
  await appealCard.getByRole('button', { name: '警告を取り消す' }).click();

  await author.goto('/notifications?filter=warnings');
  const resolvedWarning = author.locator('[data-warning-card]').filter({ hasText: warningReason });
  await expect(resolvedWarning.getByText('運営からの警告（取消済み）')).toBeVisible();
  await expect(resolvedWarning.getByText('異議申立て結果：警告を取り消しました')).toBeVisible();
  await expect(resolvedWarning.getByText(reviewNote)).toBeVisible();

  await Promise.all([
    authorContext.close(),
    reporterContext.close(),
    moderatorContext.close(),
    adminContext.close(),
  ]);
});
