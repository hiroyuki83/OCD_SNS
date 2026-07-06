import Link from 'next/link';

const resources = [
  {
    title: '今すぐ危ない時',
    body: '自分や誰かの身に差し迫った危険がある場合は、SNSへの投稿より先に地域の緊急番号へ連絡してください。日本では119または110、米国では911が緊急通報です。',
    href: null,
  },
  {
    title: 'まもろうよ こころ',
    body: '厚生労働省の相談窓口案内です。電話相談、SNS相談、支援情報検索につながれます。',
    href: 'https://www.mhlw.go.jp/mamorouyokokoro/',
  },
  {
    title: '#いのちSOS',
    body: '日本の相談窓口です。0120-061-338。厚生労働省の案内では毎日24時間とされています。',
    href: 'https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/',
  },
  {
    title: 'よりそいホットライン',
    body: '日本の相談窓口です。0120-279-338。厚生労働省の案内では24時間対応とされています。',
    href: 'https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/',
  },
  {
    title: '988 Suicide & Crisis Lifeline',
    body: '米国では、メンタルヘルス危機や自殺に関する相談で988に電話・SMSできます。',
    href: 'https://988lifeline.org/',
  },
] as const;

export default function SafetyPage() {
  return (
    <div className="min-h-screen border-r border-border">
      <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <h1 className="text-base font-bold">安全のために</h1>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ホーム
        </Link>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">ひとりで抱えないための案内</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            CoCoは医療機関ではありません。危険が差し迫っている時、または自分を傷つけそうな時は、
            近くの人・地域の緊急窓口・専門相談につながってください。
          </p>
        </div>

        <div className="grid gap-3">
          {resources.map((resource) => (
            <div key={resource.title} className="rounded-lg border border-border p-4">
              <div className="text-base font-semibold text-zinc-900">{resource.title}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{resource.body}</p>
              {resource.href && (
                <a
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm font-semibold text-[#1d9bf0] hover:underline"
                >
                  公式ページを開く
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-border bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
          友人や家族の投稿が危険に見える場合は、通報だけで終わらせず、可能なら直接声をかけるか、
          緊急性が高い場合は地域の緊急窓口へ相談してください。
        </div>
      </div>
    </div>
  );
}

