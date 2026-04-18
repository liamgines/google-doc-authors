CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    google_account_id VARCHAR(255) NOT NULL,  -- "Maximum length of 255 case-sensitive ASCII characters" (https://developers.google.com/identity/openid-connect/openid-connect).
    CONSTRAINT uk_users_google_account_id UNIQUE (google_account_id)
);
