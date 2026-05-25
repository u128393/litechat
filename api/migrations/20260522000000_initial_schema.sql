CREATE TABLE users (
    id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL,
    enabled boolean NOT NULL DEFAULT TRUE,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE TABLE sessions (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    invalidated_at timestamptz
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE provider_configs (
    id text PRIMARY KEY,
    name text NOT NULL,
    provider_type text NOT NULL,
    base_url text,
    api_key_encrypted text NOT NULL,
    enabled boolean NOT NULL DEFAULT TRUE,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE INDEX provider_configs_enabled_idx ON provider_configs (enabled);

CREATE TABLE model_configs (
    id text PRIMARY KEY,
    provider_config_id text NOT NULL REFERENCES provider_configs(id) ON DELETE CASCADE,
    model_id text NOT NULL,
    display_name text NOT NULL,
    visible boolean NOT NULL DEFAULT TRUE,
    supports_web_search boolean NOT NULL DEFAULT FALSE,
    sort_order integer NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE INDEX model_configs_provider_config_id_idx ON model_configs (provider_config_id);
CREATE INDEX model_configs_visible_sort_order_idx ON model_configs (visible, sort_order);

CREATE TABLE user_settings (
    user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    custom_instructions text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE TABLE app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
