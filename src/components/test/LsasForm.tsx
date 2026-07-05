'use client';

import { useActionState, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { submitLsas, type LsasState } from '@/app/lib/actions';

const scaleFear = [
    { value: 0, label: '0 全く感じない' },
    { value: 1, label: '1 少しは感じる' },
    { value: 2, label: '2 はっきりと感じる' },
    { value: 3, label: '3 非常に強く感じる' },
];

const scaleAvoid = [
    { value: 0, label: '0 全く回避しない' },
    { value: 1, label: '1 回避する（1/3以下）' },
    { value: 2, label: '2 回避する（1/2程度）' },
    { value: 3, label: '3 回避する（2/3以上）' },
];

const questions = [
    { id: 1, text: '人前で電話をかける', type: 'P' },
    { id: 2, text: '少人数のグループ活動に参加する', type: 'P' },
    { id: 3, text: '公共の場所で食事をする', type: 'P' },
    { id: 4, text: '人と一緒に公共の場所でお酒（飲み物）を飲む', type: 'P' },
    { id: 5, text: '権威ある人と話しをする', type: 'S' },
    { id: 6, text: '観衆の前で何か行為をしたり話しをする', type: 'P' },
    { id: 7, text: 'パーティーに行く', type: 'S' },
    { id: 8, text: '人に姿を見られながら仕事（勉強）する', type: 'P' },
    { id: 9, text: '人に見られながら字を書く', type: 'P' },
    { id: 10, text: 'あまりよく知らない人に電話をする', type: 'S' },
    { id: 11, text: 'あまりよく知らない人たちと話し合う', type: 'S' },
    { id: 12, text: 'まったく初対面の人と会う', type: 'S' },
    { id: 13, text: '公衆トイレで用を足す', type: 'P' },
    { id: 14, text: '他の人達が着席して待っている部屋に入って行く', type: 'P' },
    { id: 15, text: '人々の注目を浴びる', type: 'S' },
    { id: 16, text: '会議で意見を言う', type: 'P' },
    { id: 17, text: '試験を受ける', type: 'P' },
    { id: 18, text: 'あまりよく知らない人に不賛成であると言う', type: 'S' },
    { id: 19, text: 'あまりよく知らない人と目を合わせる', type: 'S' },
    { id: 20, text: '仲間の前で報告する', type: 'P' },
    { id: 21, text: '誰かを誘おうとする', type: 'P' },
    { id: 22, text: '店に品物を返品する', type: 'S' },
    { id: 23, text: 'パーティーを主催する', type: 'S' },
    { id: 24, text: '強引なセールスマンの誘いに抵抗する', type: 'S' },
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

export default function LsasForm() {
    const [state, formAction] = useActionState<LsasState, FormData>(submitLsas, undefined);

    const legend = useMemo(
        () => (
            <div className="border border-border rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
                <div className="font-bold text-zinc-400">回答スケール</div>
                <div className="grid gap-2">
                    <div className="font-bold">恐怖感 / 不安感</div>
                    <div className="grid gap-1">
                        {scaleFear.map((item) => (
                            <div key={`fear-${item.value}`}>{item.label}</div>
                        ))}
                    </div>
                    <div className="font-bold mt-2">回避</div>
                    <div className="grid gap-1">
                        {scaleAvoid.map((item) => (
                            <div key={`avoid-${item.value}`}>{item.label}</div>
                        ))}
                    </div>
                </div>
            </div>
        ),
        [],
    );

    return (
        <form action={formAction} className="space-y-6">
            <section className="border border-border rounded-2xl p-4 space-y-2">
                <h2 className="text-sm font-bold">LSAS-J</h2>
                <p className="text-xs text-zinc-500">
                    この１週間にあなたが感じていた様子に最もよく当てはまる番号を項目ごとに1つだけ選んで記入して下さい。
                    項目をとばしたりせずに全部埋めてください。
                </p>
            </section>

            {legend}

            <section className="grid gap-4">
                {questions.map((question) => (
                    <div key={question.id} className="border border-border rounded-2xl p-4 space-y-3">
                        <div className="text-sm font-bold">
                            {question.id}. {question.text} <span className="text-xs text-zinc-400">({question.type})</span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="border border-border rounded-xl p-3 space-y-2 bg-zinc-50">
                                <div className="text-xs font-bold text-zinc-500">恐怖感 / 不安感</div>
                                <div className="grid gap-2 text-xs text-zinc-400">
                                    {scaleFear.map((option) => (
                                        <label key={`f-${question.id}-${option.value}`} className="flex items-start gap-2">
                                            <input
                                                type="radio"
                                                name={`f${question.id}`}
                                                value={option.value}
                                                required={option.value === 0}
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="border border-border rounded-xl p-3 space-y-2 bg-white">
                                <div className="text-xs font-bold text-zinc-500">回避</div>
                                <div className="grid gap-2 text-xs text-zinc-400">
                                    {scaleAvoid.map((option) => (
                                        <label key={`a-${question.id}-${option.value}`} className="flex items-start gap-2">
                                            <input
                                                type="radio"
                                                name={`a${question.id}`}
                                                value={option.value}
                                                required={option.value === 0}
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {state?.message && <div className="text-sm text-zinc-400">{state.message}</div>}
            <SubmitButton />
            <div className="text-xs text-zinc-500 border border-border rounded-2xl p-4">
                ※この診断は簡易的なものであり、医師の診断に代わるものではありません。
                気になる症状がある場合は専門機関にご相談ください。
            </div>
        </form>
    );
}
