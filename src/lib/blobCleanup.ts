import 'server-only';

import { del } from '@vercel/blob';

function isManagedBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.public.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
}

export async function deleteManagedBlob(url: string | null | undefined) {
  if (!url || !isManagedBlobUrl(url)) return false;

  try {
    await del(url);
    return true;
  } catch (error) {
    console.error('Failed to delete managed blob:', error);
    return false;
  }
}

export async function deleteManagedBlobs(
  urls: Array<string | null | undefined>,
) {
  await Promise.all(urls.map((url) => deleteManagedBlob(url)));
}
