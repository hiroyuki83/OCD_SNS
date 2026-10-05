import type {
    AssessmentOption,
    AssessmentSection,
    SelfAssessmentDefinition,
    SelfAssessmentKey,
} from '@/lib/selfAssessmentTypes';

const SCALE_0_4: AssessmentOption[] = [
    { value: 0, label: 'まったくない' },
    { value: 1, label: '少し' },
    { value: 2, label: 'ある程度' },
    { value: 3, label: 'かなり' },
    { value: 4, label: '非常に強い' },
];

const SCALE_0_3: AssessmentOption[] = [
    { value: 0, label: 'まったくなかった' },
    { value: 1, label: '少しあった' },
    { value: 2, label: 'しばしばあった' },
    { value: 3, label: 'ほとんど毎日あった' },
];

const PERSONALITY_0_4: AssessmentOption[] = [
    { value: 0, label: '全く当てはまらない' },
    { value: 1, label: '少し当てはまる' },
    { value: 2, label: 'ある程度当てはまる' },
    { value: 3, label: 'かなり当てはまる' },
    { value: 4, label: 'とても当てはまる' },
];

const CHANGE_0_4: AssessmentOption[] = [
    { value: 0, label: '普段と変わらない' },
    { value: 1, label: '少し強かった' },
    { value: 2, label: 'はっきり強かった' },
    { value: 3, label: 'かなり強かった' },
    { value: 4, label: '非常に強かった' },
];

const PRESENCE_OPTIONS: AssessmentOption[] = [
    { value: 0, label: 'ない' },
    { value: 1, label: '過去にはあった' },
    { value: 2, label: '現在ある' },
];

function section(
    id: string,
    title: string,
    texts: string[],
    opts: Omit<AssessmentSection, 'id' | 'title' | 'items'> & {
        options?: AssessmentOption[];
        safetyItems?: number[];
    } = {},
): AssessmentSection {
    const { options, safetyItems = [], ...sectionOptions } = opts;
    return {
        id,
        title,
        items: texts.map((text, index) => ({
            id: `${id}_${index + 1}`,
            text,
            ...(options ? { options } : {}),
            ...(safetyItems.includes(index + 1) ? { safety: true } : {}),
        })),
        ...sectionOptions,
    };
}

const depression: SelfAssessmentDefinition = {
    key: 'depression',
    title: '気分・抑うつ症状',
    shortTitle: 'うつ',
    subtitle: '認知・感情症状と身体・行動症状を分けて経過を確認します。',
    period: '過去2週間',
    defaultOptions: SCALE_0_3,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('cognitive', '認知・感情症状', [
            '気分が沈んだり、気持ちが重く感じられた。',
            '普段なら楽しめることを、楽しみにくかった。',
            'これから先によいことが起こると思いにくかった。',
            '自分には価値がないように感じることがあった。',
            '実際以上に自分を責めたり、自分のせいだと考えたりした。',
            '失敗や欠点ばかりが頭に浮かんだ。',
            '考えをまとめたり、一つのことに集中したりするのが難しかった。',
            '簡単なことでも、決めるのに時間がかかった。',
        ]),
        section('somatic', '身体・行動症状', [
            '寝つき、途中で目が覚める、早く目が覚めるなど、睡眠に問題があった。',
            '普段より長く眠ったり、起きていることが難しかった。',
            '食欲が普段よりかなり減った。',
            '食欲が普段よりかなり増えた。',
            '体が重く感じたり、疲れやすかった。',
            '普段の活動を始めるのに、かなりのエネルギーが必要だった。',
            '動きや話し方が普段より遅くなった。',
            '反対に、落ち着かず動き続けたり、じっとしているのが難しいことがあった。',
        ]),
        section('safety', '安全確認', [
            '「いなくなりたい」「死んでしまいたい」という考えが浮かぶことがあった。',
            '自分を傷つけたいという気持ちが浮かぶことがあった。',
        ], { scored: false, profile: false, safetyItems: [1, 2] }),
    ],
};

const mania: SelfAssessmentDefinition = {
    key: 'mania',
    title: '躁・軽躁症状',
    shortTitle: '躁・軽躁',
    subtitle: '普段の自分からの変化として、活動性・睡眠欲求・思考速度・衝動性などを確認します。',
    period: '過去7日間',
    instruction: '「普段の自分と比べて」どの程度変化していたかを答えてください。',
    defaultOptions: CHANGE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('activation', '活動性・エネルギー', [
            '普段より活動したい気持ちが強く、次々と行動した。',
            '疲れをあまり感じず、多くのことを続けられた。',
            '一度にいくつもの予定や課題を始めた。',
            '周囲から「いつもより動きすぎている」と言われるような状態だった。',
        ]),
        section('sleepNeed', '睡眠欲求の低下', [
            '睡眠時間が短くても、十分に元気だと感じた。',
            '眠る必要そのものが普段より少なく感じられた。',
        ]),
        section('speed', '思考・会話の加速', [
            '考えが次々と浮かび、頭の中が速く動いている感じがした。',
            '一つの考えが終わる前に、別の考えへ移ることが多かった。',
            '普段よりたくさん話したり、話す速度が速くなった。',
            '人の話を待たずに話したり、会話を止めにくいことがあった。',
        ]),
        section('elevation', '気分の高揚・自信', [
            '普段より気分が高揚したり、非常に気分がよかった。',
            '自分なら何でもできそうだと感じた。',
            '普段より自分の能力や重要性を大きく感じた。',
        ]),
        section('irritability', '易刺激性・怒り', [
            '些細なことでいら立ちやすかった。',
            '人に邪魔されたり止められたりすると、強く腹が立った。',
            '気分が高揚しているというより、攻撃的・苛立った状態になることが多かった。',
        ]),
        section('impulsivity', '衝動性・リスク行動', [
            'お金、買い物、契約などで普段より大胆な判断をした。',
            '性的な行動や人間関係で普段より衝動的になった。',
            '危険があると分かっていても、勢いで行動することが増えた。',
            '後の影響を十分考えず、大きな決断をした。',
        ]),
        section('safety', '安全確認', [
            '周囲には理解されない特別な能力や使命が自分にあると強く確信した。',
            '他の人には聞こえない声や、他の人には見えないものを経験した。',
            '自分では問題ないと思っていても、周囲が生活や安全を心配するほど行動が変化した。',
        ], { scored: false, profile: false, safetyItems: [1, 2, 3] }),
    ],
};

const gad: SelfAssessmentDefinition = {
    key: 'gad',
    title: '全般性不安症状',
    shortTitle: '全般性不安',
    subtitle: '心配の広がり、止めにくさ、身体的緊張、疲労・睡眠への影響を確認します。',
    period: '過去2週間',
    defaultOptions: SCALE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('worryBreadth', '心配の広がり', [
            '一つの問題だけでなく、いろいろなことが次々と心配になった。',
            '実際にはまだ起きていない問題について長く考え続けた。',
            '小さな問題でも、重大な結果につながるように感じた。',
        ]),
        section('worryControl', '心配の制御困難', [
            '心配をやめようとしても、考え続けてしまった。',
            '別のことに集中しようとしても、心配事に注意が戻った。',
            '「考えても仕方がない」と分かっていても、心配を手放せなかった。',
        ]),
        section('tension', '緊張・身体症状', [
            '体に力が入り、肩、首、あごなどが緊張していた。',
            '落ち着かず、じっとしていることが難しかった。',
            '常に身構えているような感覚があった。',
        ]),
        section('cognitiveImpact', '認知・感情への影響', [
            '心配のために集中しにくかった。',
            '不安が続くことで、いら立ちやすくなった。',
            '心配のために物事を決めにくくなった。',
        ]),
        section('fatigueSleep', '疲労・睡眠', [
            '心配や緊張のために疲れやすかった。',
            '考え事のために寝つきにくかった。',
            '夜中や朝方に目が覚めたとき、心配が始まって眠りに戻りにくかった。',
        ]),
    ],
};

const panic: SelfAssessmentDefinition = {
    key: 'panic',
    title: 'パニック症状',
    shortTitle: 'パニック',
    subtitle: '発作、身体感覚への恐怖、予期不安、回避を分けて確認します。',
    period: '過去2週間',
    defaultOptions: SCALE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('attacks', '発作そのもの', [
            '突然、強い恐怖や強い身体的不快感が急に高まることがあった。',
            'その状態が短時間のうちに急激に強くなることがあった。',
            'はっきりした危険がない場面でも、突然その状態が起きることがあった。',
        ]),
        section('cardiorespiratory', '心肺・呼吸系の身体感覚', [
            '心臓が激しく打つ、脈が速くなる感じが強く気になった。',
            '息苦しさや、十分に息を吸えない感じが怖くなった。',
            '胸の圧迫感や痛みを、危険な徴候ではないかと感じた。',
        ]),
        section('otherBody', 'その他の身体感覚', [
            'めまい、ふらつき、倒れそうな感じが怖くなった。',
            '震え、発汗、ほてり、寒気などが急に強くなることがあった。',
            '吐き気や腹部の不快感が発作への恐怖につながった。',
        ]),
        section('catastrophicFear', '認知・解離的恐怖', [
            '発作中に、自分を制御できなくなるのではないかと怖くなった。',
            '発作中に、死ぬのではないか、重大な病気ではないかと感じた。',
            '発作中に、自分や周囲が現実ではないような感覚になることがあった。',
        ]),
        section('anticipatory', '予期不安', [
            '「また発作が起きるのではないか」と繰り返し心配した。',
            '身体の小さな変化を、発作の始まりではないかと警戒した。',
            '発作が起きたときの逃げ方や助けを得る方法を考え続けた。',
        ]),
        section('avoidance', '回避・安全行動', [
            '心拍が上がる運動など、発作に似た身体感覚が出る活動を避けた。',
            'カフェイン、暑さ、入浴など、身体感覚が変わる状況を必要以上に避けた。',
            '発作が怖いため、自分の身体を何度も確認した。',
            '逃げにくい、または助けを得にくいと感じる場所を避けた。',
            '一人で外出したり遠くへ行ったりすることを避けた。',
            '安心できる人や物がないと行動しにくかった。',
        ]),
    ],
};

const personalitySections: AssessmentSection[] = [
    ['authority', '対人萎縮・権威への警戒', ['相手が強い立場にいると、必要以上に緊張してしまう。','相手を怖いと感じると、自分の意見を言いにくくなる。']],
    ['approval', '承認希求・他者基準', ['人から認めてもらえるかどうかで、自分の価値が大きく左右される。','相手に合わせているうちに、自分が本当はどうしたいのか分からなくなることがある。']],
    ['criticism', '批判・怒りへの過敏さ', ['注意や批判を受けると、必要以上に傷ついたり動揺したりする。','誰かが怒っていると、自分に向けられた怒りでなくても強く緊張する。']],
    ['unstableRelations', '不安定な関係への反復', ['安定した関係よりも、振り回されるような関係に引きつけられることがある。','問題が多いと分かっている関係を、なかなか手放せないことがある。']],
    ['helplessness', '無力感・主体性の低下', ['対人関係で問題が起きると、自分にはどうすることもできないと感じやすい。','自分よりも弱い立場や傷ついている人に、強く心を引かれることがある。']],
    ['overResponsibility', '過剰責任', ['本来は自分の責任ではないことまで、自分が何とかしなければならないと感じる。','自分のことより、周囲の問題を解決することを優先しやすい。']],
    ['assertionGuilt', '自己主張への罪悪感', ['自分の希望を優先すると、悪いことをしたように感じる。','相手の頼みを断ると、強い罪悪感や不安を感じる。']],
    ['chaos', '刺激・混乱への引きつけ', ['平穏な状態が続くと、かえって落ち着かなかったり退屈に感じたりする。','問題や緊張の多い状況に、いつの間にか入り込んでいることがある。']],
    ['rescuing', '救済・世話役', ['困っている人を見ると、自分が何とかしなければならないと感じる。','相手を助けることが、自分の役割になりすぎることがある。']],
    ['emotionSuppression', '感情抑制', ['自分の感情を感じないようにしたり、考えないようにしたりすることがある。','悲しみや怒りなどを、人に見せないようにすることが多い。']],
    ['selfCriticism', '自己批判・低い自己価値', ['小さな失敗でも、自分自身を厳しく責める。','他の人に比べて、自分には価値がないように感じることがある。']],
    ['abandonment', '見捨てられ不安・依存', ['大切な人との関係が壊れることを強く恐れる。','関係を失わないためなら、自分がかなり我慢してしまうことがある。']],
    ['compulsiveCoping', '強迫的な対処・過剰な没頭', ['不安になったとき、何かを繰り返したり、過度に仕事をしたりすることで気持ちを落ち着かせることがある。','苦しい感情から離れるために、一つの活動にのめり込みすぎることがある。']],
    ['reactivity', '反応性・他者の影響を受けやすい', ['自分で考えて行動するより、相手の言動に反応して行動することが多い。','相手の機嫌や態度によって、その日の自分の状態が大きく左右される。']],
    ['mistrust', '不信・傷つけられる予測', ['人を信用すると、最終的には利用されたり傷つけられたりする気がする。','相手の言葉の裏に悪い意図がないか警戒することが多い。']],
    ['deprivation', '情緒的剥奪', ['本当に必要なときには、誰も自分を支えてくれないように感じる。','他人には、自分の気持ちを十分には理解してもらえないと思うことが多い。']],
    ['failure', '失敗・無能感', ['新しいことに取り組む前から、自分にはうまくできないと思いやすい。','周囲の人より自分の能力が劣っているように感じることが多い。']],
    ['vulnerability', '危険・破局への脆弱感', ['病気、事故、失敗などが起きるのではないかと強く心配しやすい。','一度問題が起きると、取り返しのつかないことになるように感じやすい。']],
    ['perfectionism', '完璧主義・厳格な基準', ['十分にできていても、もっと良くしなければならないと感じる。','失敗や不完全さを、自分にも他人にも許しにくいことがある。']],
    ['entitlement', '権利意識・他者軽視', ['自分には、他の人とは違う特別な扱いがあって当然だと感じることがある。','自分の目的のためなら、相手の都合をあまり考えなくなることがある。']],
    ['selfControl', '自己統制の困難', ['欲しいものやしたいことを、後まで我慢するのが難しい。','後で困ると分かっていても、その場の気持ちで行動してしまうことがある。']],
].map(([id, title, texts]) => section(id as string, title as string, texts as string[]));

const personality: SelfAssessmentDefinition = {
    key: 'personality',
    title: '対人関係・自己評価・感情パターン',
    shortTitle: 'パーソナリティ',
    subtitle: '普段から繰り返される対人関係、自己評価、感情調整のパターンを領域別に確認します。',
    period: '普段の自分',
    defaultOptions: PERSONALITY_0_4,
    showTotal: false,
    primaryTrendIds: [],
    version: 1,
    sections: personalitySections,
};

const ocd: SelfAssessmentDefinition = {
    key: 'ocd',
    title: '強迫症',
    shortTitle: '強迫症',
    subtitle: '強迫観念・強迫行為・回避が、現在の生活にどのくらい影響しているかを確認します。',
    period: '過去7日間',
    defaultOptions: SCALE_0_4,
    showTotal: false,
    primaryTrendIds: ['obsessionSeverity', 'compulsionSeverity', 'avoidanceSeverity'],
    version: 2,
    sections: [
        section('obsessionSeverity', '強迫観念の重症度', [
            '一日のうち、強迫的な考えに注意を奪われる時間はどのくらいだったか。',
            '一度気になり始めた考えから、注意を別のことへ戻すのはどのくらい難しかったか。',
            '強迫的な考えによる不安、不快感、嫌悪感などはどのくらい強かったか。',
            '強迫的な考えは、仕事、学習、家事、人付き合いなどをどのくらい妨げたか。',
            '「気にしなくてよい」と考えても、その問題から離れるのはどのくらい難しかったか。',
        ]),
        section('compulsionSeverity', '強迫行為の重症度', [
            '強迫行為や頭の中の儀式に、一日合計どのくらい時間を使ったか。',
            '「今これをしなければならない」という感覚はどのくらい強かったか。',
            '強迫行為を後回しにしたり、途中でやめたりするのはどのくらい難しかったか。',
            '強迫行為をしないままでいると、どのくらい不安や不快感が続いたか。',
            '強迫行為によって、生活にどのくらい時間的・行動的な制限が生じたか。',
        ]),
        section('avoidanceSeverity', '回避', [
            '強迫症状が起こりそうな場所、人、物、情報、活動などを避けた。',
            '強迫症状を起こさないために、本来したいことや必要なことを諦めた。',
            '自分だけでは避けられないため、他人に代わりにしてもらった。',
            '強迫症状を防ぐため、生活する範囲や行動の選択肢が狭くなった。',
        ]),
    ],
};

const ocdProfile: SelfAssessmentDefinition = {
    key: 'ocd-profile',
    title: '強迫症の症状プロフィール',
    shortTitle: '症状プロフィール',
    subtitle: 'どのような強迫観念・強迫行為があるかを整理します。毎回行う必要はなく、症状内容が変わったときに更新できます。',
    period: '現在・過去',
    defaultOptions: PRESENCE_OPTIONS,
    showTotal: false,
    primaryTrendIds: [],
    includeFunctionImpact: false,
    version: 1,
    sections: [
        section('contamination', '汚染・清潔', [
            '汚れ、菌、体液、化学物質などが付いたのではないかという心配。',
            '汚染が自分から他人や別の場所へ広がるのではないかという心配。',
            '実際の汚れとは別に、「汚された」「内側まで汚れた」という感覚が続くことがある。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('responsibility', '加害・責任', [
            '自分の不注意によって誰かを傷つけるのではないかという心配。',
            '自分が確認しなかったことで事故や問題が起きるのではないかという心配。',
            '悪い結果を防げなかった場合、自分の責任になるのではないかと考え続ける。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('aggressiveIntrusions', '攻撃的な侵入思考', [
            '自分の意思とは反して、人を傷つけるイメージや考えが浮かぶ。',
            '本当は望んでいないのに、危険な行動をしてしまうのではないかと怖くなる。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('sexualIntrusions', '性的な侵入思考', [
            '自分が望んでいない性的な考えやイメージが繰り返し浮かぶ。',
            '浮かんだ考えが、自分の性格や性的なあり方を意味しているのではないかと確かめ続ける。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('moral', '宗教・道徳', [
            '道徳的に間違ったことをしたのではないかと繰り返し心配する。',
            '不適切な考えが浮かんだこと自体を、重大な問題のように感じる。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('symmetry', '対称性・順序', [
            '物の位置や順序が整っていないと強く気になる。',
            '左右や回数などをそろえないと落ち着かない。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('justRight', 'Just-right・不完全感', [
            '理由ははっきりしないが、「これでよい」という感じになるまで行動を繰り返す。',
            '何かが少し違う感じがして、やり直さずにはいられない。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('certainty', '間違い・確実性', [
            '自分が何かを間違えたのではないかと何度も考え直す。',
            '十分確認した後でも、本当に大丈夫か確信できない。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('health', '健康・身体', [
            '身体の小さな変化が重大な病気を意味するのではないかと繰り返し確認する。',
            '身体の感覚が正常かどうかを何度も確かめる。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('relationshipDoubt', '人間関係・自己についての疑い', [
            '大切な人を本当に好きなのかなど、一つの疑問を繰り返し確認する。',
            '「自分は本当はどんな人間なのか」という疑問から離れられなくなる。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('magical', '魔術的思考', [
            '特定の数字、言葉、色、考えなどが悪い出来事につながる気がする。',
            '悪いことを防ぐため、特定の考え方や行動をしなければならないと感じる。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('sensorimotor', '感覚への過剰な注意', [
            '呼吸、まばたき、飲み込み、身体の動きなどを意識すると、注意を外せなくなる。',
            '普通なら自動的に行われる身体の感覚が気になり続ける。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
        section('compulsionList', '強迫行為の内容', [
            '手洗い、入浴、掃除などを必要以上に繰り返す。',
            '鍵、火、書類、記憶などを何度も確認する。',
            '同じ行動を決まった回数や決まった方法で繰り返す。',
            '物を特定の順番や位置に並べ直す。',
            '数字や回数を頭の中で数える。',
            '不安な考えを打ち消すため、心の中で言葉、祈り、イメージなどを繰り返す。',
            '他人に「大丈夫か」「間違っていないか」と繰り返し確認する。',
            '自分が悪いことをしていないか確かめるため、人に詳しく説明したり告白したりする。',
            '文章、メール、会話などを何度も読み返したり確認したりする。',
            'インターネットなどで答えが見つかるまで調べ続ける。',
            '特定の物に触る、叩く、動かすなどの行動を繰り返す。',
            '不快な考えを打ち消すため、別の「よい考え」を思い浮かべる。',
            '汚染や間違いを避けるため、家族や周囲の人にも一定のルールを守ってもらう。',
            '自分で行わず、家族や周囲の人に確認や作業を代わってもらう。',
        ], { options: PRESENCE_OPTIONS, scored: false, scoringMode: 'currentCount' }),
    ],
};

const socialAnxiety: SelfAssessmentDefinition = {
    key: 'social-anxiety',
    title: '社交不安症状',
    shortTitle: '社交不安',
    subtitle: '対人交流、注目される場面、パフォーマンス、不安が見える恐怖、回避・安全行動を確認します。',
    period: '過去2週間',
    defaultOptions: SCALE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('interaction', '対人交流', [
            'あまり親しくない人と会話するとき、強い緊張を感じた。',
            '自分から話しかけたり、会話に入ったりすることが難しかった。',
            '複数人での会話で、自分がどう見られているかが気になった。',
            '人と親しくなる過程で、拒絶されたり嫌われたりすることを強く心配した。',
        ]),
        section('observation', '観察されることへの不安', [
            '人に見られながら作業することに強い緊張を感じた。',
            '食事、記入、操作など、自分の動作を見られることが気になった。',
            '人の視線を感じると、自分の動きが不自然になるように感じた。',
        ]),
        section('performance', 'パフォーマンス', [
            '人前で話したり説明したりする場面を強く恐れた。',
            '発表、発言、電話など、自分に注目が集まる場面を避けたくなった。',
            '失敗や言い間違いによって悪く評価されることを強く心配した。',
        ]),
        section('visibleAnxiety', '不安が見えることへの恐怖', [
            '赤面、発汗、震え、声の震えなどを他人に気づかれることが怖かった。',
            '緊張していること自体を「弱い」「変だ」と思われるのではないかと心配した。',
            '不安を隠そうとするほど、自分の身体や話し方が気になった。',
        ]),
        section('safetyBehavior', '回避・安全行動', [
            '不安を避けるため、会話や集まりへの参加を控えた。',
            '目立たない場所を選ぶ、視線を合わせないなど、安全だと感じる行動を使った。',
            '話す内容を過剰に準備したり、頭の中で何度も練習した。',
            '社交場面の後、自分の言動を何度も振り返って悪かった点を探した。',
        ]),
    ],
};

const dpdr: SelfAssessmentDefinition = {
    key: 'dpdr',
    title: '離人感・現実感喪失',
    shortTitle: 'DP/DR',
    subtitle: '自己・身体、感情、記憶・自己体験、外界の非現実感を分けて確認します。',
    period: '過去2週間',
    defaultOptions: SCALE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('selfBody', '身体・自己の異質感', [
            '自分の身体が、自分のものではないように感じることがあった。',
            '自分を少し離れたところから見ているように感じることがあった。',
            '自分の動作が、自分で動かしているというより自動的に進んでいるように感じた。',
        ]),
        section('emotionalNumbing', '感情の麻痺・遠さ', [
            '本来なら感情が動く場面でも、感情が十分に感じられなかった。',
            '大切な人への気持ちが、頭では分かっていても実感として感じにくかった。',
            '喜び、悲しみ、怒りなどが遠くにあるように感じた。',
        ]),
        section('memorySelf', '記憶・自己体験の異質感', [
            '自分の過去の出来事を思い出しても、「自分に起きたこと」という実感が弱かった。',
            '自分の記憶が、映像や情報としてはあるのに体験として感じられないことがあった。',
            '以前の自分と今の自分が、同じ人間だという感覚が薄れることがあった。',
        ]),
        section('worldUnreality', '外界の非現実感', [
            '周囲の景色が、夢、映画、映像のように感じられた。',
            '人や物が、現実に存在しているという実感が弱く感じられた。',
            '距離、大きさ、音、色などが普段と違って感じられることがあった。',
        ]),
        section('realityTesting', '現実検討の確認', [
            'こうした感覚があっても、「実際に世界が変わったわけではない」と理解できていた。',
            'こうした感覚を、現実そのものが本当に変化した出来事だと確信することがあった。',
        ], { scored: false, profile: false, safetyItems: [2] }),
    ],
};

const ptsdSections = [
    section('reexperiencing', '再体験', [
        '出来事の記憶やイメージが、望んでいないのに突然入り込んできた。',
        '出来事が「過去のこと」ではなく、今また起きているように感じる瞬間があった。',
        '出来事に関連する悪夢を見た。',
        '何かをきっかけに、当時と似た強い感情や身体反応が急に生じた。',
    ]),
    section('traumaAvoidance', '回避', [
        '出来事を思い出す考え、感情、身体感覚を避けようとした。',
        '出来事を思い出させる人、場所、会話、活動などを避けた。',
        '出来事について考えないように、活動や注意を別のことで埋めることがあった。',
    ]),
    section('threat', '現在の脅威', [
        '周囲に危険がないか、常に警戒している感じがした。',
        '予想外の音や動きに、強く驚いたり身体が反応した。',
        '安全な場所でも、何か悪いことが起きそうな感覚が続いた。',
        '緊張が抜けず、身体が休まらない感じがした。',
    ]),
    section('negativeMood', '認知・気分の変化', [
        '出来事のために、自分、他人、世界について否定的な見方が強くなった。',
        '出来事について、自分に必要以上の責任があるように感じた。',
        '以前楽しめたことや大切だったことへの関心が低下した。',
        '他人との間に距離や隔たりを感じた。',
    ]),
    section('arousal', '過覚醒・反応性', [
        'いら立ちや怒りが以前より強くなった。',
        '集中を続けることが難しかった。',
        '睡眠が浅い、寝つきにくい、途中で目が覚めるなどがあった。',
        '危険を十分考えずに行動してしまうことがあった。',
    ]),
];

const ptsd: SelfAssessmentDefinition = {
    key: 'ptsd',
    title: 'PTSD関連症状',
    shortTitle: 'PTSD',
    subtitle: '再体験、回避、現在の脅威、認知・気分、過覚醒を領域別に確認します。',
    period: '過去2週間',
    instruction: '特定のつらい出来事に関連して回答してください。',
    defaultOptions: SCALE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: ptsdSections,
};

const cptsd: SelfAssessmentDefinition = {
    key: 'cptsd',
    title: '複雑性PTSD関連症状',
    shortTitle: 'C-PTSD',
    subtitle: 'PTSD症状に加えて、感情調整、自己概念、対人関係の困難を確認します。',
    period: '過去1か月',
    instruction: '特定のつらい出来事や長期的な逆境体験に関連して回答してください。',
    defaultOptions: SCALE_0_4,
    showTotal: false,
    primaryTrendIds: ['ptsdCore', 'dso'],
    version: 1,
    derivedScores: [
        { id: 'ptsdCore', label: 'PTSD関連', sectionIds: ['reexperiencing','traumaAvoidance','threat'] },
        { id: 'dso', label: '自己組織化の困難', sectionIds: ['affectHyper','affectHypo','negativeSelf','relationships'] },
    ],
    sections: [
        ...ptsdSections.slice(0, 3),
        section('affectHyper', '感情調整：過活性', [
            '強い感情が一度起こると、自分で落ち着かせることが難しかった。',
            '怒り、不安、悲しみなどが急激に強くなり、自分でも圧倒された。',
            '小さな出来事に対しても、感情が非常に強く反応することがあった。',
        ]),
        section('affectHypo', '感情調整：低活性・シャットダウン', [
            '強いストレスのとき、感情が突然なくなったようになることがあった。',
            'つらい状況になると、頭や身体が動かなくなるように感じることがあった。',
            '感情を感じる代わりに、ぼんやりしたり切り離された状態になることがあった。',
        ]),
        section('negativeSelf', '否定的自己概念', [
            '自分には根本的な欠陥があるように感じた。',
            '自分は他の人より価値が低いように感じた。',
            '過去の経験について、強い恥や自己非難が続いた。',
            '「自分はまともな人生を送れない人間だ」と感じることがあった。',
        ]),
        section('relationships', '対人関係の困難', [
            '人と親しくなることや、人を信頼することが難しかった。',
            '関係が近くなると、距離を取りたくなることがあった。',
            '人と一緒にいても、深いところでは一人だと感じた。',
            '安全な相手であっても、助けを求めたり頼ったりすることが難しかった。',
        ]),
    ],
};

const dissociation: SelfAssessmentDefinition = {
    key: 'dissociation',
    title: '解離症状',
    shortTitle: '解離',
    subtitle: '記憶、自己状態、主体感、内的対話、トランス・没入などの解離現象を確認します。',
    period: '過去1か月',
    defaultOptions: SCALE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('amnesia', '記憶の空白', [
            '何をしていたのか思い出せない時間があることに気づいた。',
            '自分がしたらしい行動について、後から他人に教えられて初めて知ることがあった。',
            '持ち物、メモ、メッセージなどから、自分が覚えていない行動をしたことに気づいた。',
            '大切な出来事について、通常の物忘れでは説明しにくい記憶の抜けがあった。',
        ]),
        section('identityDiscontinuity', '自己状態の不連続', [
            '状況によって、自分の考え方、感じ方、振る舞いが大きく変わり、自分でも連続性を感じにくいことがあった。',
            '自分の中に、互いにかなり異なる考え方や気持ちを持つ「部分」があるように感じた。',
            'あるときの自分の決定を、別のときの自分が理解できないことがあった。',
            '自分が何者なのかという感覚が、状態によって大きく変化することがあった。',
        ]),
        section('agencyDiscontinuity', '主体感・行動の不連続', [
            '自分の身体が動いているのに、自分が動かしている感じが弱いことがあった。',
            '自分の口から言葉が出ているのに、自分が話している感じがしないことがあった。',
            '自分が決めていないように感じる行動を、いつの間にかしていることがあった。',
            '自分の考えや感情が、自分のものではないように感じることがあった。',
        ]),
        section('innerVoices', '内的な声・内的対話', [
            '自分の中で、異なる立場や感情を持つ声や考えが会話しているように感じることがあった。',
            '自分の意図とは別に、内側から考えや言葉が強く出てくるように感じることがあった。',
            '内側の別の部分から、批判、警告、指示などを受けているように感じることがあった。',
        ]),
        section('trance', 'トランス・没入', [
            '周囲への注意が薄れ、時間が飛んだように感じるほど深く没入することがあった。',
            'ぼんやりして、周囲の呼びかけや出来事に気づきにくくなることがあった。',
            '起きているのに夢の中にいるような状態へ入り込むことがあった。',
        ]),
        section('dpdrLink', 'DP/DR関連', [
            '自分自身から切り離された感じがあった。',
            '周囲の世界が現実ではないように感じた。',
        ]),
    ],
};

const eating: SelfAssessmentDefinition = {
    key: 'eating',
    title: '摂食に関する症状',
    shortTitle: '摂食',
    subtitle: '制限、過食、代償行動、体重・体型へのとらわれ、回避的・選択的摂食を領域別に確認します。',
    period: '過去2週間',
    defaultOptions: SCALE_0_4,
    showTotal: false,
    primaryTrendIds: [],
    version: 1,
    sections: [
        section('restriction', '食事制限', [
            '体重や体型を変えるため、食べる量を意図的に減らした。',
            '空腹を感じても、食べないように我慢した。',
            '食べてもよい食品を狭く決め、それ以外を避けた。',
            '食事の量やカロリーなどを細かく管理しないと不安になった。',
        ]),
        section('binge', '過食・制御喪失', [
            '短い時間に普段よりかなり多く食べることがあった。',
            '食べ始めると、自分では止められないように感じることがあった。',
            '空腹ではないのに、大量に食べ続けることがあった。',
            '食べた後に強い後悔、恥、自己嫌悪を感じた。',
        ]),
        section('compensation', '代償行動', [
            '食べたことを打ち消すため、意図的に食事を抜いたり大きく減らした。',
            '食べたことを打ち消すため、必要以上に運動した。',
            '食べたことをなかったことにしようとする行動をした。',
            '体重増加を防ぐことを目的に、身体に負担のかかる方法を使うことがあった。',
        ]),
        section('shapeWeight', '体重・体型への過大評価', [
            '体重や体型によって、自分自身の価値を判断することが多かった。',
            '体型の一部分が気になり、繰り返し確認した。',
            '体重が増えることを強く恐れた。',
            '他人と自分の体型を繰り返し比較した。',
        ]),
        section('sensoryAvoidance', '感覚過敏による回避', [
            '味、におい、食感、温度などが苦手で、食べられる食品がかなり限られた。',
            '食品の見た目や口当たりへの強い嫌悪のため、食事が難しかった。',
        ]),
        section('fearEating', '食べることへの恐怖', [
            '吐く、むせる、のどに詰まる、体調が悪くなることへの恐怖から食事を避けた。',
            '過去の嫌な経験を思い出すため、特定の食品や食事場面を避けた。',
        ]),
        section('lowInterest', '食への関心の乏しさ', [
            '空腹や食欲を感じにくく、食べることを忘れることがあった。',
            '食事そのものへの関心が低く、必要量を食べることが負担だった。',
        ]),
        section('safety', '身体的安全確認', [
            'めまい、失神、著しい脱力などがあった。',
            '食事や体重の問題によって、日常生活や身体状態に明らかな悪影響が出ていると感じた。',
        ], { scored: false, profile: false, safetyItems: [1, 2] }),
    ],
};

const sleep: SelfAssessmentDefinition = {
    key: 'sleep',
    title: '睡眠問題',
    shortTitle: '睡眠',
    subtitle: '入眠、途中覚醒、早朝覚醒、過眠、睡眠リズム、日中への影響を確認します。',
    period: '過去7日間',
    defaultOptions: SCALE_0_4,
    showTotal: true,
    primaryTrendIds: ['$total'],
    version: 1,
    sections: [
        section('sleepOnset', '入眠', [
            '布団に入ってから眠るまでに長く時間がかかった。',
            '眠ろうとすると考え事や緊張が強くなった。',
        ]),
        section('sleepMaintenance', '睡眠維持', [
            '夜中に何度も目が覚めた。',
            '夜中に目が覚めると、再び眠るまで長くかかった。',
        ]),
        section('earlyAwakening', '早朝覚醒', [
            '予定よりかなり早く目が覚め、その後眠れなかった。',
        ]),
        section('hypersomnia', '過眠', [
            '十分な時間眠っているのに、さらに長時間眠ることが多かった。',
            '朝起きることが非常に難しく、予定より長く寝続けた。',
        ]),
        section('rhythm', '睡眠リズム', [
            '寝る時刻が日によって大きく変わった。',
            '起きる時刻が日によって大きく変わった。',
            '望んでいる時間帯と実際に眠れる時間帯が大きくずれていた。',
        ]),
        section('daytime', '回復感・日中機能', [
            '睡眠時間を取っても、眠った感じや回復した感じが乏しかった。',
            '日中に強い眠気があった。',
            '睡眠の問題のために、集中、仕事、学習、家事などに影響があった。',
            '睡眠の問題のために、気分や対人関係に影響があった。',
        ]),
    ],
};

export const ASSESSMENT_DEFINITIONS: Record<SelfAssessmentKey, SelfAssessmentDefinition> = {
    depression,
    mania,
    gad,
    panic,
    personality,
    ocd,
    'ocd-profile': ocdProfile,
    'social-anxiety': socialAnxiety,
    dpdr,
    ptsd,
    cptsd,
    dissociation,
    eating,
    sleep,
};

export const ASSESSMENT_ORDER: SelfAssessmentKey[] = [
    'depression',
    'mania',
    'gad',
    'panic',
    'personality',
    'ocd',
    'social-anxiety',
    'dpdr',
    'ptsd',
    'cptsd',
    'dissociation',
    'eating',
    'sleep',
];

export const ASSESSMENT_SUMMARIES = ASSESSMENT_ORDER.map((key) => ({
    key,
    title: ASSESSMENT_DEFINITIONS[key].title,
    shortTitle: ASSESSMENT_DEFINITIONS[key].shortTitle,
}));

export function isSelfAssessmentKey(value: string | null | undefined): value is SelfAssessmentKey {
    return Boolean(value && value in ASSESSMENT_DEFINITIONS);
}

export function optionMax(options: AssessmentOption[]) {
    return Math.max(...options.map((option) => option.value));
}

export function sectionMax(definition: SelfAssessmentDefinition, target: AssessmentSection) {
    if (target.scoringMode === 'currentCount') return target.items.length;
    return target.items.reduce((sum, item) => {
        const options = item.options ?? definition.defaultOptions;
        return sum + optionMax(options);
    }, 0);
}

export function totalMax(definition: SelfAssessmentDefinition) {
    return definition.sections
        .filter((target) => target.scored !== false)
        .reduce((sum, target) => sum + sectionMax(definition, target), 0);
}
