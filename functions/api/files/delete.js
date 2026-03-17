export async function onRequestDelete(context) {
  const { env, request } = context;

  try {
    const { key } = await request.json();
    if (!key) return Response.json({ error: 'Key required' }, { status: 400 });

    await env.R2.delete(key);
    await env.DB.prepare('DELETE FROM files WHERE r2_key = ?').bind(key).run();

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
