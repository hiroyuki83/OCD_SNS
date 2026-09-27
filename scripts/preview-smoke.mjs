const rawBaseUrl = process.argv[2]?.trim();

if (!rawBaseUrl) {
  console.error('Usage: npm run smoke:preview -- https://<preview-url>');
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(rawBaseUrl);
} catch {
  console.error('Preview URL is invalid.');
  process.exit(1);
}

if (baseUrl.protocol !== 'https:' && baseUrl.hostname !== 'localhost') {
  console.error('Preview smoke test requires HTTPS (or localhost).');
  process.exit(1);
}

const paths = ['/', '/login', '/register', '/explore', '/safety'];
let failed = false;

for (const path of paths) {
  const url = new URL(path, baseUrl);
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'coco-preview-smoke/1.0' },
    });

    const acceptable =
      response.status >= 200 &&
      response.status < 400;

    console.log(`${acceptable ? 'OK' : 'FAIL'} ${response.status} ${url.pathname}`);
    if (!acceptable) failed = true;
  } catch (error) {
    console.error(`FAIL network ${url.pathname}`, error instanceof Error ? error.name : 'UnknownError');
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Preview public smoke test passed.');
