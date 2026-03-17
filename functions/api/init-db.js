export async function onRequestGet(context) {
  const { env } = context;

  const sql1 = `
    CREATE TABLE IF NOT EXISTS files (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      r2_key       TEXT NOT NULL UNIQUE,
      display_name TEXT,
      folder       TEXT NOT NULL DEFAULT '/',
      type         TEXT,
      size_bytes   INTEGER,
      mime_type    TEXT,
      tags         TEXT,
      uploaded_at  TEXT NOT NULL DEFAULT (datetime('now')),
      notes        TEXT
    );
  `;

  const sql2 = `
    CREATE TABLE IF NOT EXISTS folders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      path         TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;

  try {
    // env.DB.exec() allows running multiple queries at once
    await env.DB.exec(sql1);
    await env.DB.exec(sql2);
    
    return Response.json({ success: true, message: "Tables created successfully! You can now use the dashboard." });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
