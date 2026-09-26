import Link from 'next/link';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import { buildTotpUri, decryptTotpSecret } from '@/lib/totp';
import {
  beginStaffTotpEnrollment,
  confirmStaffTotpEnrollment,
} from './actions';

function groupSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

export default async function StaffSecuritySettingsPage() {
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      email: true,
      role: true,
      staffTotpSecretEncrypted: true,
      staffTotpEnabledAt: true,
    },
  });

  if (!user) return null;

  const enabled = Boolean(user.staffTotpEnabledAt);
  const secret =
    !enabled && user.staffTotpSecretEncrypted
      ? decryptTotpSecret(user.staffTotpSecretEncrypted)
      : null;
  const uri = secret
    ? buildTotpUri({
        secret,
        accountName: user.email,
      })
    : null;

  return (
    <div className="min-h-screen border-r border-border">
      <div className="sticky top-0 z-10 h-14 border-b border-border bg-background/80 px-4 backdrop-blur-md flex items-center">
        <h1 className="font-bold text-base">スタッフ用2要素認証</h1>
      </div>

      <div className="p-6">
        <Link href="/settings" className="text-sm text-zinc-500 hover:text-zinc-900">
          設定へ戻る
        </Link>

        <section className="mt-4 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">認証アプリ（TOTP）</h2>
              <p className="mt-1 text-sm text-zinc-500">
                対象: {user.role} / {user.email}
              </p>
            </div>
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (enabled
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800")
              }
            >
              {enabled ? "有効" : "未設定"}
            </span>
          </div>

          {enabled ? (
            <div className="mt-4 rounded-md bg-green-50 p-4 text-sm text-green-800">
              2要素認証は有効です。秘密鍵は安全のため再表示しません。
            </div>
          ) : secret && uri ? (
            <div className="mt-4">
              <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-700">
                <li>
                  Google Authenticator、Microsoft Authenticator、1Passwordなどの認証アプリで
                  新しいTOTPアカウントを追加します。
                </li>
                <li>
                  <a href={uri} className="font-semibold text-[#1d9bf0] hover:underline">
                    認証アプリで開く
                  </a>
                  <div className="mt-2 rounded-md bg-zinc-50 p-3">
                    <div className="text-xs font-semibold text-zinc-500">手動入力用秘密鍵</div>
                    <code className="mt-1 block break-all text-sm tracking-wide text-zinc-900">
                      {groupSecret(secret)}
                    </code>
                  </div>
                </li>
                <li>認証アプリに表示された6桁コードを下に入力します。</li>
              </ol>

              <form action={confirmStaffTotpEnrollment} className="mt-4 flex max-w-sm gap-2">
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  placeholder="123456"
                  className="min-w-0 flex-1 rounded-md border border-border px-3 py-2 text-sm"
                />
                <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                  有効化
                </button>
              </form>

              <form action={beginStaffTotpEnrollment} className="mt-3">
                <button className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">
                  秘密鍵を再生成
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-zinc-600">
                認証アプリ用の秘密鍵を作成します。作成後、6桁コードで確認するまでは有効になりません。
              </p>
              <form action={beginStaffTotpEnrollment} className="mt-3">
                <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                  TOTP設定を開始
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
