CREATE TABLE media_assets (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','image/gif')),
  content BYTEA NOT NULL CHECK(octet_length(content)<=2097152),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
