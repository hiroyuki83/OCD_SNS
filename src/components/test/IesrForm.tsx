'use client';

import { useActionState } from 'react';
import { submitIesr, type IesrState } from '@/app/lib/actions';
import { useFormStatus } from 'react-dom';

const options = [
    { value: 0, label: '0. 全くなし' },
    { value: 1, label: '1. 少し' },
    { value: 2, label: '2. 中くらい' },
    { value: 3, label: '3. かなり' },
    { value: 4, label: '4. 非常に' },
];

const questions = [
    'どんなきっかけでも，そのことを思い出すと，そのときの気もちがぶりかえしてくる。',
    '睡眠の途中で目がさめてしまう。',
    '別のことをしていても，そのことが頭から離れない。',
    'イライラして，怒りっぽくなっている。',
    'そのことについて考えたり思い出すときは，なんとか気を落ちつかせるようにしている。',
    '考えるつもりはないのに，そのことを考えてしまうことがある。',
    'そのことは，実際には起きなかったとか，現実のことではなかったような気がする。',
    'そのことを思い出させるものには近よらない。',
    'そのときの場面が，いきなり頭にうかんでくる。',
    '神経が敏感になっていて，ちょっとしたことでどきっとしてしまう。',
    'そのことは考えないようにしている。',
    'そのことについては，まだいろいろな気もちがあるが，それには触れないようにしている。',
    'そのことについての感情は，マヒしたようである。',
    '気がつくと，まるでそのときにもどってしまったかのように，ふるまったり感じたりすることがある。',
    '寝つきが悪い。',
    'そのことについて，感情が強くこみあげてくることがある。',
    'そのことを何とか忘れようとしている。',
    'ものごとに集中できない。',
    'そのことを思い出すと，身体が反応して，汗ばんだり，息苦しくなったり，むかむかしたり，どきどきすることがある。',
    'そのことについての夢を見る。',
    '警戒して用心深くなっている気がする。',
    'そのことについては話さないようにしている。',
];

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            className="bg-[#1d9bf0] text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-[#1a8cd8] disabled:opacity-50"
            disabled={pending}
        >
            {pending ? '保存中...' : '結果を保存'}
        </button>
    );
}

export default function IesrForm() {
    const [state, formAction] = useActionState<IesrState, FormData>(submitIesr, undefined);

    return (
        <form action={formAction} className="space-y-6">
            <section className="border border-border rounded-2xl p-4 space-y-4">
                <h2 className="text-sm font-bold">IES-R 改訂出来事インパクト尺度</h2>
                <div className="text-xs text-zinc-500">
                    各項目について、最近1週間のあなたの状態に最も近いものを選んでください。
                </div>
                <div className="grid gap-4">
                    {questions.map((question, index) => (
                        <div key={`q-${index + 1}`} className="border border-border rounded-xl p-3 space-y-2">
                            <div className="text-sm font-bold">
                                {index + 1}. {question}
                            </div>
                            <div className="grid gap-2 text-xs text-zinc-400">
                                {options.map((option) => (
                                    <label key={`${index + 1}-${option.value}`} className="flex items-start gap-2">
                                        <input
                                            type="radio"
                                            name={`q${index + 1}`}
                                            value={option.value}
                                            required={option.value === 0}
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {state?.message && <div className="text-sm text-zinc-400">{state.message}</div>}
            <SubmitButton />
        </form>
    );
}
