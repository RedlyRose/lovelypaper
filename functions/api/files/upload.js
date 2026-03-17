export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = (formData.get('folder') || '').replace(/^\/|\/$/g, '');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name;
    const key = folder ? `${folder}/${fileName}` : fileName;
    const contentType = file.type || 'application/octet-stream';

    await env.R2.put(key, file.stream(), {
      httpMetadata: { contentType },
    });

    // Save metadata to D1
    const fileType = contentType.startsWith('image/') ? 'image'
      : contentType.startsWith('video/') ? 'video'
      : 'other';

    await env.DB.prepare(
      `INSERT OR REPLACE INTO files (r2_key, display_name, folder, type, size_bytes, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(key, fileName, folder || '/', fileType, file.size, contentType).run();

    return Response.json({ success: true, key, contentType });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
