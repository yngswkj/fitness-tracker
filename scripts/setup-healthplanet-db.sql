-- HealthPlanetトークン管理テーブル
CREATE TABLE IF NOT EXISTS healthplanet_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_healthplanet_tokens_user_id ON healthplanet_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_healthplanet_tokens_expires_at ON healthplanet_tokens(expires_at);