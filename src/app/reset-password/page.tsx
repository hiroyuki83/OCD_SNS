import Link from 'next/link';
import ResetPasswordForm from './ResetPasswordForm';

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token?.trim() ?? '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-black">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="w-full max-w-sm p-8 text-center">
          <h1 className="text-2xl font-bold">リンクが無効です</h1>
          <p className="mt-2 text-sm text-zinc-500">
            再設定メールのリンクを開き直すか、もう一度再設定を申請してください。
          </p>
          <Link href="/forgot-password" className="mt-4 inline-block text-sm text-[#1d9bf0] hover:underline">
            再設定を申請する
          </Link>
        </div>
      )}
    </div>
  );
}
