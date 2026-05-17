-- Schema for the shared "project management" domain, sqlserver dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

IF OBJECT_ID('issue', 'U') IS NOT NULL DROP TABLE issue;
IF OBJECT_ID('project', 'U') IS NOT NULL DROP TABLE project;
IF OBJECT_ID('app_user', 'U') IS NOT NULL DROP TABLE app_user;
IF OBJECT_ID('organization', 'U') IS NOT NULL DROP TABLE organization;

CREATE TABLE organization (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    archived_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organization(id),
    CONSTRAINT uk_project_slug UNIQUE (organization_id, slug)
);

CREATE TABLE issue (
    id INT IDENTITY(1,1) PRIMARY KEY,
    project_id INT NOT NULL,
    [number] INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(MAX) NULL,
    status VARCHAR(32) NOT NULL,
    priority INT NOT NULL,
    assignee_id INT NULL,
    parent_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (assignee_id) REFERENCES app_user(id),
    FOREIGN KEY (parent_id) REFERENCES issue(id),
    CONSTRAINT uk_issue_number UNIQUE (project_id, [number])
);
