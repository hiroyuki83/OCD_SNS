import type { Instrumentation } from 'next';
import { logOperationalError } from '@/lib/operationalError';

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  logOperationalError(`NEXT_REQUEST_ERROR:${context.routeType}`, error);
};
