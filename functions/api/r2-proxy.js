const MIME_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  pdf: 'application/pdf', zip: 'application/zip',
};

function guessMime(key) {
  const ext = key.split('.').pop().toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) return new Response('Missing key', { status: 400 });

  try {
    const object = await env.R2.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    // Safely get content type — fall back to extension-based guess
    let contentType = 'application/octet-stream';
    try {
      if (object.httpMetadata?.contentType) {
        contentType = object.httpMetadata.contentType;
      } else {
        contentType = guessMime(key);
      }
    } catch (_) {
      contentType = guessMime(key);
    }

    const headers = new Headers({
      'content-type': contentType,
      'etag': object.httpEtag || '',
      'cache-control': 'private, max-age=86400',
      'accept-ranges': 'bytes',
      'content-length': String(object.size),
    });

    return new Response(object.body, { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
