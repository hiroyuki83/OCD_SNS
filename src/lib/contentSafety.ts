const CRISIS_TERMS = [
  "死にたい",
  "消えたい",
  "自殺",
  "自傷",
  "リスカ",
  "飛び降り",
  "首を吊",
  "首吊",
  "もう無理",
  "生きていたくない",
  "生きるの疲れた",
] as const;

const URL_PATTERN = /(https?:\/\/|www\.)/gi;
const EXCESSIVE_REPEAT_PATTERN = /(.)\1{24,}/u;

export function hasCrisisSignal(text: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  return CRISIS_TERMS.some((term) => normalized.includes(term));
}

export function getPostSafetyNotice(text: string) {
  if (!hasCrisisSignal(text)) return null;
  return "つらさが強い言葉が含まれています。今すぐ危ない時は地域の緊急番号へ連絡し、ひとりで抱えないでください。";
}

export function validatePublicPostContent(text: string) {
  const urlCount = text.match(URL_PATTERN)?.length ?? 0;
  if (urlCount > 2) {
    return "URLは1投稿につき2件までにしてください。";
  }
  if (EXCESSIVE_REPEAT_PATTERN.test(text)) {
    return "同じ文字の連続が多すぎます。内容を短く整えてください。";
  }
  return null;
}

