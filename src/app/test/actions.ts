'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import {
    ASSESSMENT_DEFINITIONS,
    isSelfAssessmentKey,
} from '@/lib/selfAssessmentDefinitions';
import type { SelfAssessmentKey } from '@/lib/selfAssessmentTypes';
import { logOperationalError } from '@/lib/operationalError';

export type SelfAssessmentActionState =
    | {
          message: string;
          success?: boolean;
          safetyTriggered?: boolean;
      }
    | undefined;

const FUNCTION_ITEMS = 5;

async function resolveUserId() {
    const session = await auth();
    let userId = session?.user?.id ?? null;

    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }

    return userId;
}

function parseAllowedAnswer(raw: FormDataEntryValue | null, allowed: number[]) {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
    const value = Number(raw);
    return allowed.includes(value) ? value : null;
}

export async function submitSelfAssessment(
    assessmentKey: SelfAssessmentKey,
    _prevState: SelfAssessmentActionState,
    formData: FormData,
): Promise<SelfAssessmentActionState> {
    if (!isSelfAssessmentKey(assessmentKey)) {
        return { message: 'このセルフチェックは利用できません。' };
    }

    const userId = await resolveUserId();
    if (!userId) return { message: '結果を保存するにはログインしてください。' };

    if (!(await rateLimit(`self-assessment-submit:${assessmentKey}:${userId}`, 30, 60 * 60 * 1000))) {
        return { message: '保存回数が多すぎます。しばらくしてから再度お試しください。' };
    }

    const definition = ASSESSMENT_DEFINITIONS[assessmentKey];
    const answers: Record<string, number> = {};
    const safetyFlags: string[] = [];
    const subscaleScores: Record<string, number> = {};

    for (const section of definition.sections) {
        let sectionScore = 0;

        for (const item of section.items) {
            const options = item.options ?? definition.defaultOptions;
            const value = parseAllowedAnswer(
                formData.get(`answer_${item.id}`),
                options.map((option) => option.value),
            );

            if (value === null) {
                return { message: '未回答または不正な回答があります。すべての項目に回答してください。' };
            }

            answers[item.id] = value;
            if (item.safety && value > 0) safetyFlags.push(item.id);

            if (section.scoringMode === 'currentCount') {
                if (value === 2) sectionScore += 1;
            } else {
                sectionScore += value;
            }
        }

        if (section.profile !== false) {
            subscaleScores[section.id] = sectionScore;
        }
    }

    for (const derived of definition.derivedScores ?? []) {
        subscaleScores[derived.id] = derived.sectionIds.reduce(
            (sum, sectionId) => sum + (subscaleScores[sectionId] ?? 0),
            0,
        );
    }

    let totalScore: number | null = null;
    if (definition.showTotal) {
        totalScore = definition.sections
            .filter((section) => section.scored !== false)
            .reduce((sum, section) => sum + (subscaleScores[section.id] ?? 0), 0);
    }

    let functionScore = 0;
    for (let index = 1; index <= FUNCTION_ITEMS; index += 1) {
        const value = parseAllowedAnswer(formData.get(`function_${index}`), [0, 1, 2, 3, 4]);
        if (value === null) {
            return { message: '生活への影響について、すべての項目に回答してください。' };
        }
        answers[`function_${index}`] = value;
        functionScore += value;
    }

    try {
        await prisma.selfAssessmentResult.create({
            data: {
                userId,
                assessmentKey,
                version: definition.version,
                totalScore,
                functionScore,
                subscaleScores,
                answers,
                safetyFlags,
            },
        });
    } catch (error) {
        logOperationalError('SELF_ASSESSMENT_RESULT_SAVE_FAILED', error);
        return { message: '結果の保存に失敗しました。' };
    }

    revalidatePath('/test');
    return {
        message: '結果を保存しました。',
        success: true,
        safetyTriggered: safetyFlags.length > 0,
    };
}

export async function deleteGenericSelfAssessmentResult(
    assessmentKey: SelfAssessmentKey,
    resultId: string,
) {
    if (!isSelfAssessmentKey(assessmentKey)) return;

    resultId = resultId.trim();
    if (!resultId || resultId.length > 128) return;

    const userId = await resolveUserId();
    if (!userId) return;

    if (!(await rateLimit(`self-assessment-delete:${userId}`, 60, 60 * 60 * 1000))) return;

    await prisma.selfAssessmentResult.deleteMany({
        where: {
            id: resultId,
            userId,
            assessmentKey,
        },
    });

    revalidatePath('/test');
}
