const MIME_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  pdf: 'application/pdf', zip: 'application/zip',
};

function guessMime(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

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

    // Always resolve content type — browser sometimes sends empty string
    const contentType = (file.type && file.type !== 'application/octet-stream')
      ? file.type
      : guessMime(fileName);

    // Upload to R2
    await env.R2.put(key, file.stream(), {
      httpMetadata: { contentType },
    });

    // Save metadata to D1
    const fileType = contentType.startsWith('image/') ? 'image'
      : contentType.startsWith('video/') ? 'video'
      : 'other';

    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO files (r2_key, display_name, folder, type, size_bytes, mime_type)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(key, fileName, folder || '/', fileType, file.size, contentType).run();
    } catch (dbErr) {
      // D1 failure is non-fatal — file is already in R2
      console.error('D1 insert failed:', dbErr.message);
    }

    return Response.json({ success: true, key, contentType });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
