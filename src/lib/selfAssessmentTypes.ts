export type SelfAssessmentKey =
    | 'depression'
    | 'mania'
    | 'gad'
    | 'panic'
    | 'personality'
    | 'ocd'
    | 'social-anxiety'
    | 'dpdr'
    | 'ptsd'
    | 'cptsd'
    | 'dissociation'
    | 'eating'
    | 'sleep';

export type AssessmentOption = {
    value: number;
    label: string;
};

export type AssessmentItem = {
    id: string;
    text: string;
    options?: AssessmentOption[];
    safety?: boolean;
};

export type AssessmentSection = {
    id: string;
    title: string;
    items: AssessmentItem[];
    scored?: boolean;
    profile?: boolean;
    scoringMode?: 'sum' | 'currentCount';
    note?: string;
};

export type DerivedAssessmentScore = {
    id: string;
    label: string;
    sectionIds: string[];
};

export type SelfAssessmentDefinition = {
    key: SelfAssessmentKey;
    title: string;
    shortTitle: string;
    subtitle: string;
    period: string;
    instruction?: string;
    defaultOptions: AssessmentOption[];
    sections: AssessmentSection[];
    showTotal: boolean;
    derivedScores?: DerivedAssessmentScore[];
    primaryTrendIds?: string[];
    version: number;
};

export type SelfAssessmentResultView = {
    id: string;
    createdAt: string;
    totalScore: number | null;
    functionScore: number;
    subscaleScores: Record<string, number>;
    safetyFlags: string[];
};
