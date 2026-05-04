CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    google_account_id VARCHAR(255) NOT NULL,  -- "Maximum length of 255 case-sensitive ASCII characters" (https://developers.google.com/identity/openid-connect/openid-connect).
    CONSTRAINT uk_users_google_account_id UNIQUE (google_account_id)
);

CREATE TABLE IF NOT EXISTS docs (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    google_id TEXT NOT NULL,
    CONSTRAINT uk_docs_google_id UNIQUE (google_id)
);

CREATE TABLE IF NOT EXISTS revisions (
    id TEXT,
    doc_id INTEGER,
    path TEXT NOT NULL,
    PRIMARY KEY (id, doc_id),
    CONSTRAINT fk_revisions_docs FOREIGN KEY (doc_id) REFERENCES docs (id),
    CONSTRAINT uk_revisions_path UNIQUE (path)
);

CREATE TABLE IF NOT EXISTS userdocs (
    user_id INTEGER,
    doc_id INTEGER,
    revision_id TEXT NOT NULL,
    path TEXT,
    PRIMARY KEY (user_id, doc_id),
    CONSTRAINT fk_userdocs_users FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_userdocs_docs FOREIGN KEY (doc_id) REFERENCES docs (id)
);
