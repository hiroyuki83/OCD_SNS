'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitItq, type ItqState } from '@/app/lib/actions';

const scaleOptions = [
    { value: 0, label: 'まったくない' },
    { value: 1, label: '少しだけある' },
    { value: 2, label: 'まぁある' },
    { value: 3, label: 'かなりある' },
    { value: 4, label: 'きわめてある' },
];

const timingOptions = [
    { value: 'a', label: '6ヶ月未満' },
    { value: 'b', label: '6ヶ月から12ヶ月' },
    { value: 'c', label: '1年以上5年未満' },
    { value: 'd', label: '5年以上10年未満' },
    { value: 'e', label: '10年以上20年未満' },
    { value: 'f', label: '20年以上前' },
];

const ptsdQuestions = [
    { id: 'p1', text: 'その経験の一部を再生するような、あるいはその経験に明らかに関連があるために、自分の心が動揺するような夢をみますか。' },
    { id: 'p2', text: 'その経験が今ここで再び生じているように感じる強力なイメージや記憶が時々思い出されますか。' },
    { id: 'p3', text: 'その経験について思い出すきっかけになる内的なこと（例えば、考え、感情、身体的な感覚）を避けていますか。' },
    { id: 'p4', text: 'その経験について思い出すきっかけとなる外的なこと（例えば、人、場所、会話、物体、活動、状況）を避けていますか。' },
    { id: 'p5', text: '厳重に警戒したり、注意深かったり、あるいは用心したりすることがありますか。' },
    { id: 'p6', text: '神経過敏であったり、容易にびっくりしたりすることがありますか。' },
];

const ptsdFunctional = [
    { id: 'p7', text: 'あなたの人間関係や社会生活に影響しましたか。' },
    { id: 'p8', text: 'あなたの仕事や仕事をする能力に影響しましたか。' },
    { id: 'p9', text: '育児、学校、大学やその他の重要な活動など、人生の重要な部分に影響しましたか。' },
];

const dsoQuestions = [
    { id: 'c1', text: '動揺すると落ち着くのに時間がかかる。' },
    { id: 'c2', text: '心が麻痺したように感じたり、感情停止したように感じたりする。' },
    { id: 'c3', text: '自分は出来損ないだと感じる。' },
    { id: 'c4', text: '自分には価値がないと感じる。' },
    { id: 'c5', text: '人と距離があるように感じたり、仲間はずれにされているように感じたりする。' },
    { id: 'c6', text: '人と感情的に近い距離を保つのが難しいと感じる。' },
];

const dsoFunctional = [
    { id: 'c7', text: 'あなたの人間関係や社会生活に影響しましたか。' },
    { id: 'c8', text: 'あなたの仕事や仕事をする能力に影響しましたか。' },
    { id: 'c9', text: '育児、学校、大学やその他の重要な活動など、人生の重要な部分に影響しましたか。' },
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

function QuestionBlock({
    title,
    description,
    items,
}: {
    title: string;
    description: string;
    items: { id: string; text: string }[];
}) {
    return (
        <section className="border border-border rounded-2xl p-4 space-y-4">
            <div className="space-y-1">
                <h2 className="text-sm font-bold">{title}</h2>
                <p className="text-xs text-zinc-500">{description}</p>
            </div>
            <div className="grid gap-4">
                {items.map((item) => (
                    <div key={item.id} className="border border-border rounded-xl p-3 space-y-2">
                        <div className="text-sm font-bold">{item.text}</div>
                        <div className="grid gap-2 text-xs text-zinc-400">
                            {scaleOptions.map((option) => (
                                <label key={`${item.id}-${option.value}`} className="flex items-start gap-2">
                                    <input type="radio" name={item.id} value={option.value} required={option.value === 0} />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function ItqForm() {
    const [state, formAction] = useActionState<ItqState, FormData>(submitItq, undefined);

    return (
        <form action={formAction} className="space-y-6">
            <section className="border border-border rounded-2xl p-4 space-y-4">
                <h2 className="text-sm font-bold">導入</h2>
                <p className="text-xs text-zinc-500">
                    あなたの人生で、今もあなたを困らせるもっともストレスフルな経験をイメージしてください。
                    その経験について、以下の質問に回答してください。
                </p>
                <label className="block text-xs text-zinc-500">
                    簡単にその経験について説明してください。（任意）
                    <textarea
                        name="eventDescription"
                        rows={3}
                        className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-300 p-2 text-sm resize-none"
                    />
                </label>
                <div className="space-y-2">
                    <div className="text-xs text-zinc-500">それはいつ頃経験したことですか。（ひとつを選んでください）</div>
                    <div className="grid gap-2 text-xs text-zinc-400">
                        {timingOptions.map((option) => (
                            <label key={option.value} className="flex items-start gap-2">
                                <input type="radio" name="eventTiming" value={option.value} required />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </section>

            <QuestionBlock
                title="PTSD症状評価（Pセクション）"
                description="過去一ヶ月のうちにその問題によってどれほど支障があったのか、回答してください。"
                items={ptsdQuestions}
            />
            <QuestionBlock
                title="PTSD機能障害"
                description="過去一ヶ月間の影響について回答してください。"
                items={ptsdFunctional}
            />

            <QuestionBlock
                title="DSO評価（Cセクション）"
                description="あなたの典型的な感じ方、考え方、他者に対する関わり方について回答してください。"
                items={dsoQuestions}
            />
            <QuestionBlock
                title="DSO機能障害"
                description="過去一ヶ月間の影響について回答してください。"
                items={dsoFunctional}
            />

            {state?.message && <div className="text-sm text-zinc-400">{state.message}</div>}
            <SubmitButton />
            <div className="text-xs text-zinc-500 border border-border rounded-2xl p-4">
                この結果は医学的な診断ではありません。正確な診断や治療については、専門の医療機関にご相談ください。
                また、この測定用具はパブリックドメインであり、臨床的有用性を最大化するために開発されました。
            </div>
        </form>
    );
}
