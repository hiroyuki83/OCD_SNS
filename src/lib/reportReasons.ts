export const REPORT_REASONS = [
  { value: "HARASSMENT", label: "嫌がらせ・誹謗中傷" },
  { value: "SPAM", label: "スパム" },
  { value: "IMPERSONATION", label: "なりすまし" },
  { value: "SELF_HARM", label: "自傷・危険投稿" },
  { value: "OTHER", label: "その他" },
] as const;

export type ReportReasonValue = (typeof REPORT_REASONS)[number]["value"];

