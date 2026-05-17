-- Schema for the shared "project management" domain, postgres dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

DROP TABLE IF EXISTS issue CASCADE;
DROP TABLE IF EXISTS project CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;
DROP TABLE IF EXISTS organization CASCADE;

CREATE TABLE organization (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organization(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    archived_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, slug)
);

CREATE TABLE issue (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES project(id),
    number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    status VARCHAR(32) NOT NULL,
    priority INTEGER NOT NULL,
    assignee_id INTEGER REFERENCES app_user(id),
    parent_id INTEGER REFERENCES issue(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, number)
);
