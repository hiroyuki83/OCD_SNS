export type ModerationTimelineItem = {
  id: string;
  createdAt: Date;
  kind: 'warning' | 'report' | 'enforcement';
  title: string;
  detail: string | null;
  status: string | null;
};

type WarningInput = {
  id: string;
  createdAt: Date;
  revokedAt: Date | null;
  reason: string;
};

type ReportInput = {
  id: string;
  createdAt: Date;
  reason: string;
  status: string;
  detail?: string | null;
};

type AuditInput = {
  id: string;
  createdAt: Date;
  action: string;
  meta: unknown;
};

const ENFORCEMENT_ACTIONS = new Set([
  'USER_WARNING',
  'USER_POST_RESTRICTED',
  'USER_SUSPENDED',
  'USER_STATUS_CHANGED',
  'POST_HIDDEN',
  'POST_RESTORED',
  'WARNING_APPEAL_UPHELD',
  'WARNING_APPEAL_OVERTURNED',
]);

function metaSummary(meta: unknown) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  const preferredKeys = ['reason', 'note', 'resolutionNote', 'duration', 'postId', 'reportId'];
  const pairs = preferredKeys
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .map((key) => `${key}: ${String(record[key])}`);
  return pairs.length > 0 ? pairs.join(' / ') : null;
}

export function buildModerationTimeline({
  warnings,
  reports,
  auditLogs,
}: {
  warnings: WarningInput[];
  reports: ReportInput[];
  auditLogs: AuditInput[];
}): ModerationTimelineItem[] {
  const items: ModerationTimelineItem[] = [
    ...warnings.map((warning) => ({
      id: `warning-${warning.id}`,
      createdAt: warning.createdAt,
      kind: 'warning' as const,
      title: warning.revokedAt ? '警告（取消済み）' : '警告',
      detail: warning.reason,
      status: warning.revokedAt ? 'REVOKED' : 'ACTIVE',
    })),
    ...reports.map((report) => ({
      id: `report-${report.id}`,
      createdAt: report.createdAt,
      kind: 'report' as const,
      title: `通報: ${report.reason}`,
      detail: report.detail?.trim() || null,
      status: report.status,
    })),
    ...auditLogs
      .filter((log) => ENFORCEMENT_ACTIONS.has(log.action))
      .map((log) => ({
        id: `audit-${log.id}`,
        createdAt: log.createdAt,
        kind: 'enforcement' as const,
        title: log.action,
        detail: metaSummary(log.meta),
        status: null,
      })),
  ];

  return items.sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
  });
}
