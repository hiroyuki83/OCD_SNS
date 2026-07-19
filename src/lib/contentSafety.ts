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

const URGENT_CRISIS_PATTERNS = [
  /今から.{0,12}(死ぬ|自殺|飛び降り|首を吊)/u,
  /(死ぬ|自殺する|自傷する).{0,12}(つもり|予定|決めた)/u,
  /(遺書|最後の投稿|これでさようなら)/u,
  /(自殺|死ぬ).{0,12}(方法|場所|準備)/u,
] as const;

const URL_PATTERN = /(https?:\/\/|www\.)/gi;
const EXCESSIVE_REPEAT_PATTERN = /(.)\1{24,}/u;

export function hasCrisisSignal(text: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  return CRISIS_TERMS.some((term) => normalized.includes(term));
}

export type PostSafetyLevel = "none" | "notice" | "urgent";

export function evaluatePostSafety(text: string): { level: PostSafetyLevel } {
  const normalized = text.trim();
  if (!normalized) return { level: "none" };
  if (URGENT_CRISIS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { level: "urgent" };
  }
  if (hasCrisisSignal(normalized)) return { level: "notice" };
  return { level: "none" };
}

export function getPostSafetyNotice(text: string) {
  if (evaluatePostSafety(text).level === "none") return null;
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

