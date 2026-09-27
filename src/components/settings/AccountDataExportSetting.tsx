export default function AccountDataExportSetting() {
  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <h2 className="font-semibold">データのエクスポート</h2>
      <p className="mt-1 text-sm text-zinc-500">
        自分のプロフィール、投稿、リアクション、フォロー関係、心理セルフチェック履歴などをJSON形式で保存できます。
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        パスワード、2段階認証の秘密情報、管理者メモなどの内部情報は含まれません。
      </p>
      <a
        href="/api/account/export"
        className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
      >
        自分のデータをダウンロード
      </a>
    </section>
  );
}
