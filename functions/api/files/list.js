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

    const result = await env.R2.list(listOptions);

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
