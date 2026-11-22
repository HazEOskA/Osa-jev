-- OSA JEFF READY P0 | PostgreSQL 17 | deploy only after separate approval.
-- Run as a migration role; the application MUST use a distinct NOBYPASSRLS role.
-- No destructive DDL. All tables are empty at initial deployment.
BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 6 AND 100),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nowa rozmowa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS conversations_by_owner ON conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  ordinal bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  conversation_id uuid NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('streaming','completed','interrupted','error')),
  error_code text,
  execution_id text,
  proof_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, user_id) REFERENCES conversations(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS messages_conversation_order ON messages (conversation_id, ordinal);
CREATE UNIQUE INDEX IF NOT EXISTS only_one_active_reply
  ON messages (conversation_id) WHERE role='assistant' AND status='streaming';

CREATE TABLE IF NOT EXISTS chat_turns (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  conversation_id uuid NOT NULL,
  client_request_id uuid NOT NULL,
  user_message_id uuid NOT NULL,
  assistant_message_id uuid NOT NULL,
  model_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','running','completed','interrupted','error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, user_id) REFERENCES conversations(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_message_id, user_id) REFERENCES messages(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (assistant_message_id, user_id) REFERENCES messages(id, user_id) ON DELETE CASCADE,
  UNIQUE (user_id, client_request_id),
  UNIQUE (assistant_message_id)
);
CREATE INDEX IF NOT EXISTS turns_by_owner ON chat_turns (user_id, conversation_id);

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai','anthropic','google','openrouter','nvidia','custom')),
  envelope text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

-- Privacy enforced in PostgreSQL as well as in every API handler.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE chat_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_turns FORCE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials FORCE ROW LEVEL SECURITY;

CREATE POLICY own_users ON users FOR ALL
  USING (id = current_setting('app.user_id', true))
  WITH CHECK (id = current_setting('app.user_id', true));
CREATE POLICY own_conversations ON conversations FOR ALL
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));
CREATE POLICY own_messages ON messages FOR ALL
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));
CREATE POLICY own_turns ON chat_turns FOR ALL
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));
CREATE POLICY own_credentials ON user_credentials FOR ALL
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

COMMIT;
