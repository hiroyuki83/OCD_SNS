export type BlobModeEnv = {
  [key: string]: string | undefined;
  VERCEL_ENV?: string;
  E2E_BLOB_MODE?: string;
};

export function isE2eBlobMode(env: BlobModeEnv) {
  if (env.VERCEL_ENV === 'production') return false;
  return env.E2E_BLOB_MODE === '1';
}
