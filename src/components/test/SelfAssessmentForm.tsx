'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitSelfAssessment } from '@/app/test/actions';
import type { SelfAssessmentDefinition } from '@/lib/selfAssessmentTypes';

const FUNCTION_ITEMS = [
    '症状のために、仕事や学習にどのくらい支障がありましたか。',
    '症状のために、家事や日常生活にどのくらい支障がありましたか。',
    '症状のために、人付き合いや家族関係にどのくらい支障がありましたか。',
    '症状のために、外出、趣味、社会参加などがどのくらい制限されましたか。',
    '症状に対処するために、一日の中でどのくらいの時間やエネルギーを使いましたか。',
];

const FUNCTION_OPTIONS = [
    { value: 0, label: 'なし' },
    { value: 1, label: '少し' },
    { value: 2, label: 'ある程度' },
    { value: 3, label: 'かなり' },
    { value: 4, label: '非常に大きい' },
];

function AnswerRow({
    name,
    text,
    options,
}: {
    name: string;
    text: string;
    options: Array<{ value: number; label: string }>;
}) {
    return (
        <fieldset className="space-y-3 border-b border-zinc-100 py-4 last:border-b-0">
            <legend className="text-sm leading-6 text-zinc-800">{text}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="cursor-pointer rounded-xl border border-zinc-200 px-3 py-2.5 text-xs text-zinc-700 transition hover:border-sky-300 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50 has-[:checked]:text-sky-800"
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            required
                            className="mr-2 accent-sky-500"
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export default function SelfAssessmentForm({
    definition,
    canSave,
}: {
    definition: SelfAssessmentDefinition;
    canSave: boolean;
}) {
    const router = useRouter();
    const boundAction = submitSelfAssessment.bind(null, definition.key);
    const [state, formAction, pending] = useActionState(boundAction, undefined);

    useEffect(() => {
        if (state?.success) router.refresh();
    }, [router, state?.success]);

    return (
        <form action={formAction} className="space-y-5">
            <div className="rounded-2xl border border-border bg-white p-4 text-sm text-zinc-600">
                <div className="font-bold text-zinc-900">{definition.title}</div>
                <div className="mt-1 text-xs leading-relaxed">{definition.subtitle}</div>
                <div className="mt-3 text-xs">
                    <span className="font-bold text-zinc-700">回答期間：</span>
                    {definition.period}
                </div>
                {definition.instruction && (
                    <div className="mt-2 text-xs leading-relaxed text-zinc-500">{definition.instruction}</div>
                )}
            </div>

            {definition.sections.map((section) => (
                <section key={section.id} className="rounded-2xl border border-border bg-white p-4 md:p-5">
                    <div className="mb-1 text-sm font-bold text-zinc-900">{section.title}</div>
                    {section.note && <div className="mb-2 text-xs text-zinc-500">{section.note}</div>}
                    <div>
                        {section.items.map((item) => (
                            <AnswerRow
                                key={item.id}
                                name={'answer_' + item.id}
                                text={item.text}
                                options={item.options ?? definition.defaultOptions}
                            />
                        ))}
                    </div>
                </section>
            ))}

            <section className="rounded-2xl border border-border bg-white p-4 md:p-5">
                <div className="text-sm font-bold text-zinc-900">生活への影響</div>
                <div className="mt-1 text-xs text-zinc-500">
                    症状そのものとは別に、現在の生活への影響を共通項目で確認します。
                </div>
                <div className="mt-2">
                    {FUNCTION_ITEMS.map((item, index) => (
                        <AnswerRow
                            key={item}
                            name={'function_' + (index + 1)}
                            text={item}
                            options={FUNCTION_OPTIONS}
                        />
                    ))}
                </div>
            </section>

            {!canSave && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
                    回答はできますが、結果を保存するにはログインが必要です。
                </div>
            )}

            {state?.message && (
                <div
                    className={
                        'rounded-2xl border p-4 text-sm ' +
                        (state.success
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-700')
                    }
                >
                    {state.message}
                </div>
            )}

            {state?.safetyTriggered && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
                    安全や身体状態について、追加で確認した方がよい回答が含まれていました。必要に応じて医療機関などで相談してください。
                </div>
            )}

            <button
                type="submit"
                disabled={pending || !canSave}
                className="w-full rounded-full bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
                {pending ? '保存中...' : canSave ? '結果を保存する' : 'ログインすると保存できます'}
            </button>
        </form>
    );
}
