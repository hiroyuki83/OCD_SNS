export type ModerationTimelineItem = {
  id: string;
  createdAt: Date;
  kind: 'warning' | 'report' | 'sanction' | 'enforcement';
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

type SanctionInput = {
  id: string;
  createdAt: Date;
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
  type: string;
  status: string;
  reason: string;
};

type AuditInput = {
  id: string;
  createdAt: Date;
  action: string;
  meta: unknown;
};

const ENFORCEMENT_ACTIONS = new Set([
  'USER_WARNING',
  'USER_STATUS_CHANGE',
  'POST_HIDE',
  'POST_RESTORE',
  'WARNING_APPEAL_REVIEWED',
  'SANCTION_APPEAL_REVIEWED',
]);

function metaSummary(meta: unknown) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  const preferredKeys = ['reason', 'note', 'resolutionNote', 'outcome', 'duration', 'postId', 'reportId'];
  const pairs = preferredKeys
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .map((key) => `${key}: ${String(record[key])}`);
  return pairs.length > 0 ? pairs.join(' / ') : null;
}

function sanctionTitle(type: string) {
  if (type === 'POST_RESTRICTION') return '投稿制限';
  if (type === 'SUSPENSION') return 'アカウント停止';
  if (type === 'WARNING') return '警告';
  return `処分: ${type}`;
}

function effectiveSanctionStatus(sanction: SanctionInput, now: Date) {
  if (
    sanction.status === 'ACTIVE' &&
    sanction.endsAt &&
    sanction.endsAt.getTime() <= now.getTime()
  ) {
    return 'EXPIRED';
  }
  return sanction.status;
}

export function buildModerationTimeline({
  warnings,
  reports,
  sanctions = [],
  auditLogs,
  now = new Date(),
}: {
  warnings: WarningInput[];
  reports: ReportInput[];
  sanctions?: SanctionInput[];
  auditLogs: AuditInput[];
  now?: Date;
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
    ...sanctions.map((sanction) => ({
      id: `sanction-${sanction.id}`,
      createdAt: sanction.createdAt,
      kind: 'sanction' as const,
      title: sanctionTitle(sanction.type),
      detail: sanction.reason,
      status: effectiveSanctionStatus(sanction, now),
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
