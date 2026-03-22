ALTER TABLE anime_history_records
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE anime_history_records
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_history_user_anime_unique ON anime_history_records (user_id, anime_id);

CREATE INDEX IF NOT EXISTS idx_history_user_deleted_updated ON anime_history_records (
    user_id,
    is_deleted,
    updated_at DESC
);