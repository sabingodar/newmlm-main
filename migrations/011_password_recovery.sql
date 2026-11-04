CREATE TABLE mail_settings (id INTEGER PRIMARY KEY CHECK(id=1), data JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE member_password_resets (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES member_profiles(user_id), credential_version TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX member_password_reset_user ON member_password_resets(user_id);
