export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';

  const recursive = url.searchParams.get('recursive') === 'true';

  try {
    const listOptions = {
      prefix: prefix,
    };
    
    // Only use delimiter if not recursive
    if (!recursive) {
      listOptions.delimiter = '/';
    }

    const MIME_TYPES = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
      svg: 'image/svg+xml', bmp: 'image/bmp',
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
      mkv: 'video/x-matroska', avi: 'video/x-msvideo', m4v: 'video/x-m4v',
    };

    const objects = (result.objects || []).map(obj => {
      const ext = obj.key.split('.').pop().toLowerCase();
      const guessedMime = MIME_TYPES[ext] || 'application/octet-stream';
      return {
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        contentType: obj.httpMetadata?.contentType || guessedMime,
      };
    });

    const prefixes = result.delimitedPrefixes || [];

    return Response.json({ objects, prefixes, truncated: result.truncated });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
