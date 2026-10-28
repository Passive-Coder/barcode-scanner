-- Devices running the iOS or Android app that turned alerts on, as Expo push tokens.
CREATE TABLE native_push_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at INTEGER NOT NULL
);
CREATE INDEX native_push_tokens_user ON native_push_tokens(user_id);
