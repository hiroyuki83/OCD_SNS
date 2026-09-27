import crypto from 'node:crypto';

export type OperationalErrorRecord = {
  incidentId: string;
  event: string;
  errorName: string;
  occurredAt: string;
};

export function buildOperationalErrorRecord(
  event: string,
  error: unknown,
  now = new Date(),
): OperationalErrorRecord {
  const errorName = error instanceof Error && error.name ? error.name : 'UnknownError';

  return {
    incidentId: crypto.randomUUID(),
    event,
    errorName,
    occurredAt: now.toISOString(),
  };
}

export function logOperationalError(event: string, error: unknown) {
  const record = buildOperationalErrorRecord(event, error);
  console.error('OperationalError', record);
  return record;
}
