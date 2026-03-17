export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const { sourceKey, destKey } = await request.json();
    if (!sourceKey || !destKey) {
      return Response.json({ error: 'sourceKey and destKey required' }, { status: 400 });
    }

    // R2 has no native rename — copy then delete
    const source = await env.R2.get(sourceKey);
    if (!source) return Response.json({ error: 'Source not found' }, { status: 404 });

    await env.R2.put(destKey, source.body, {
      httpMetadata: source.httpMetadata,
      customMetadata: source.customMetadata,
    });
    await env.R2.delete(sourceKey);

    // Update D1
    const newFolder = destKey.includes('/') ? destKey.substring(0, destKey.lastIndexOf('/')) : '/';
    await env.DB.prepare(
      'UPDATE files SET r2_key = ?, folder = ? WHERE r2_key = ?'
    ).bind(destKey, newFolder, sourceKey).run();

    return Response.json({ success: true, newKey: destKey });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
