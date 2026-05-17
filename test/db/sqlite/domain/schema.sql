-- Schema for the shared "project management" domain, sqlite dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

DROP TABLE IF EXISTS issue;
DROP TABLE IF EXISTS project;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS organization;

CREATE TABLE organization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organization(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    archived_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, slug)
);

CREATE TABLE issue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES project(id),
    number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    status VARCHAR(32) NOT NULL,
    priority INTEGER NOT NULL,
    assignee_id INTEGER REFERENCES app_user(id),
    parent_id INTEGER REFERENCES issue(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, number)
);
