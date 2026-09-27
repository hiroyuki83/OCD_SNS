import Link from 'next/link';

export default function PaginationLinks({
  page,
  totalPages,
  previousHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  previousHref: string | null;
  nextHref: string | null;
}) {
  return (
    <nav
      aria-label="ページ移動"
      className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm"
    >
      {previousHref ? (
        <Link
          href={previousHref}
          rel="prev"
          className="rounded-full border border-border px-4 py-2 text-zinc-700"
        >
          前へ
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-full border border-border px-4 py-2 text-zinc-400"
        >
          前へ
        </span>
      )}
      <span aria-current="page" className="text-xs text-zinc-500">
        {page} / {totalPages}
      </span>
      {nextHref ? (
        <Link
          href={nextHref}
          rel="next"
          className="rounded-full border border-border px-4 py-2 text-zinc-700"
        >
          次へ
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-full border border-border px-4 py-2 text-zinc-400"
        >
          次へ
        </span>
      )}
    </nav>
  );
}
