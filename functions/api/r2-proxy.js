export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) return new Response('Missing key', { status: 400 });

  try {
    const object = await env.R2.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'private, max-age=86400');

    // Support range requests for video seeking
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      headers.set('accept-ranges', 'bytes');
    }

    return new Response(object.body, { headers });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
