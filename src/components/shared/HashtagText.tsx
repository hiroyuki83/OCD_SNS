import Link from 'next/link';
import { cn } from '@/lib/utils';

const HASHTAG_REGEX = /#([\p{L}\p{N}_]+)/gu;

type HashtagTextProps = {
    text: string;
    className?: string;
};

export default function HashtagText({ text, className }: HashtagTextProps) {
    const parts = [] as Array<
        | { type: 'text'; value: string; key: string }
        | { type: 'tag'; value: string; key: string }
    >;

    let lastIndex = 0;
    let index = 0;
    for (const match of text.matchAll(HASHTAG_REGEX)) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;
        if (start > lastIndex) {
            parts.push({ type: 'text', value: text.slice(lastIndex, start), key: `t-${index}` });
            index += 1;
        }
        parts.push({ type: 'tag', value: match[0], key: `h-${index}` });
        index += 1;
        lastIndex = end;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex), key: `t-${index}` });
    }

    return (
        <p className={cn('whitespace-pre-wrap break-all', className)}>
            {parts.length === 0
                ? text
                : parts.map((part) =>
                      part.type === 'text' ? (
                          <span key={part.key}>{part.value}</span>
                      ) : (
                          <Link
                              key={part.key}
                              href={`/explore?q=${encodeURIComponent(part.value)}`}
                              className="text-[#1d9bf0] underline"
                          >
                              {part.value}
                          </Link>
                      ),
                  )}
        </p>
    );
}
