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
    -- `plan` is a T-SQL reserved keyword, so the column must be
    -- bracket-quoted both in the DDL and in any DML that names it.
    [plan] VARCHAR(32) NOT NULL,
    -- `verified` flag stored as Y/N so the connection.ts mapping can
    -- exercise CustomBooleanTypeAdapter on a real seed column.
    verified VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    -- `verified` stored as Y/N — same CustomBooleanTypeAdapter mapping
    -- as organization.verified so cross-table comparisons need no remap.
    verified VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    -- `published` flag stored as t/f, a deliberately different
    -- CustomBooleanTypeAdapter mapping than organization/app_user.verified
    -- so column-vs-column comparisons hit the remap-with-case branch.
    published VARCHAR(1) NOT NULL DEFAULT 'f',
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
GO

-- Stored procedures and functions exercised by
-- `exec.procedure-function.test.ts`. SQL Server requires CREATE
-- PROCEDURE / CREATE FUNCTION to be the only statement in their
-- batch, so each one is preceded by a `GO` separator that
-- `splitBatch` (the harness helper) treats as a batch boundary.

IF OBJECT_ID('refresh_stats',     'P')  IS NOT NULL DROP PROCEDURE refresh_stats;
IF OBJECT_ID('archive_project',   'P')  IS NOT NULL DROP PROCEDURE archive_project;
IF OBJECT_ID('count_open_issues', 'FN') IS NOT NULL DROP FUNCTION count_open_issues;
IF OBJECT_ID('project_name',      'FN') IS NOT NULL DROP FUNCTION project_name;
GO

CREATE PROCEDURE refresh_stats AS BEGIN SET NOCOUNT ON; END;
GO

CREATE PROCEDURE archive_project @p_id INT, @p_reason VARCHAR(255) AS
BEGIN
    SET NOCOUNT ON;
    UPDATE project
       SET archived_at = CURRENT_TIMESTAMP,
           name        = name + ' [archived: ' + @p_reason + ']'
     WHERE id = @p_id;
END;
GO

CREATE FUNCTION count_open_issues(@p_id INT)
RETURNS INT
AS
BEGIN
    RETURN (SELECT COUNT(*) FROM issue WHERE project_id = @p_id AND status = 'open')
END;
GO

CREATE FUNCTION project_name(@p_id INT)
RETURNS VARCHAR(255)
AS
BEGIN
    RETURN (SELECT name FROM project WHERE id = @p_id)
END;
GO
