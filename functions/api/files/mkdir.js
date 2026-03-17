export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const { path } = await request.json();
    if (!path) return Response.json({ error: 'path required' }, { status: 400 });

    const cleanPath = path.replace(/^\/|\/$/g, '');
    const markerKey = `${cleanPath}/.keep`;

    // Write a zero-byte marker object to represent the folder
    await env.R2.put(markerKey, new Uint8Array(0), {
      httpMetadata: { contentType: 'application/x-directory' },
    });

    // Save to D1
    await env.DB.prepare(
      'INSERT OR IGNORE INTO folders (path) VALUES (?)'
    ).bind(cleanPath).run();

    return Response.json({ success: true, path: cleanPath });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
