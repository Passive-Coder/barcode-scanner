-- Linework server data (Cloudflare D1, SQLite). Apply with:
--   npx wrangler d1 migrations apply linework --local    (development)
--   npx wrangler d1 migrations apply linework --remote   (production)
--
-- People are identified by the email of their Google account, which the server verifies with
-- Google when they sign in. Emails are stored trimmed and lowercased. Times are Unix
-- milliseconds.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  google_sub TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

-- Only a SHA-256 hash of each session token is stored; the token itself lives in an HttpOnly cookie.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Teams are personal contact lists, like a Google Group: names and emails of known people.
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX teams_owner ON teams(owner_id);

CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  added_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, email)
);

-- Roles apply inside one event only. The owner (its creator) is always an organizer.
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE event_members (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('organizer', 'member')),
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, email)
);
CREATE INDEX event_members_email ON event_members(email);

CREATE TABLE subteams (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (event_id, name)
);

-- Removing someone from an event removes them from its sub-teams too.
CREATE TABLE subteam_members (
  subteam_id TEXT NOT NULL REFERENCES subteams(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  is_manager INTEGER NOT NULL DEFAULT 0 CHECK (is_manager IN (0, 1)),
  PRIMARY KEY (subteam_id, email),
  FOREIGN KEY (event_id, email) REFERENCES event_members(event_id, email) ON DELETE CASCADE
);
CREATE INDEX subteam_members_person ON subteam_members(event_id, email);

-- Google Sheets and Docs used by an event. Managed files were created by Linework in their
-- creator's Drive, and the creator's browser keeps their sharing in step with the event.
CREATE TABLE event_docs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('sheet', 'doc')),
  file_id TEXT NOT NULL,
  title TEXT NOT NULL,
  managed INTEGER NOT NULL CHECK (managed IN (0, 1)),
  audience TEXT NOT NULL CHECK (audience IN ('everyone', 'organizers', 'subteams')),
  access TEXT NOT NULL CHECK (access IN ('writer', 'reader')),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (event_id, file_id)
);

CREATE TABLE doc_subteams (
  doc_id TEXT NOT NULL REFERENCES event_docs(id) ON DELETE CASCADE,
  subteam_id TEXT NOT NULL REFERENCES subteams(id) ON DELETE CASCADE,
  PRIMARY KEY (doc_id, subteam_id)
);

-- What Linework has actually shared in Google Drive, so access can be changed or revoked later.
CREATE TABLE doc_grants (
  doc_id TEXT NOT NULL REFERENCES event_docs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('writer', 'reader')),
  permission_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('shared', 'failed')),
  error TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (doc_id, email)
);

-- Every change a person makes to a spreadsheet through Linework, per person and spreadsheet.
-- "pending" changes could not reach Google Sheets and wait to be migrated; "migrating" ones
-- are claimed by one browser (claim_id) until claimed_until, so two browsers never apply the
-- same change; an abandoned claim lapses back to pending.
CREATE TABLE sheet_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_title TEXT NOT NULL DEFAULT '',
  sheet_id INTEGER NOT NULL,
  sheet_title TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'pending', 'migrating', 'conflict', 'discarded')),
  message TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  claim_id TEXT,
  claimed_until INTEGER
);
CREATE INDEX sheet_changes_document ON sheet_changes(user_id, spreadsheet_id, status, created_at);

CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL CHECK (urgency IN ('notice', 'page')),
  audience_label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX alerts_event ON alerts(event_id, created_at);
CREATE INDEX alerts_sender ON alerts(sender_email, created_at);

CREATE TABLE alert_recipients (
  alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  acknowledged_at INTEGER,
  PRIMARY KEY (alert_id, email)
);
CREATE INDEX alert_recipients_email ON alert_recipients(email);

-- Web Push endpoints. Payloads are end-to-end encrypted for the browser (RFC 8291).
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);
