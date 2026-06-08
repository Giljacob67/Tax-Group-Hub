-- Migration: Add 2FA columns to app_users
-- Date: 2026-06-05

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMP;
