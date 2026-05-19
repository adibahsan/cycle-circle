-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RLS helper function
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true);
$$ LANGUAGE sql STABLE;
