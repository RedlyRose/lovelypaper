export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';

  try {
    const result = await env.R2.list({
      prefix: prefix,
      delimiter: '/',
    });

    const objects = (result.objects || []).map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      contentType: obj.httpMetadata?.contentType || '',
    }));

    const prefixes = result.delimitedPrefixes || [];

    return Response.json({ objects, prefixes, truncated: result.truncated });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
