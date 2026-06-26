-- Schema for the shared "project management" domain, sqlserver dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

IF OBJECT_ID('project_overview', 'V') IS NOT NULL DROP VIEW project_overview;
IF OBJECT_ID('release_overview', 'V') IS NOT NULL DROP VIEW release_overview;
IF OBJECT_ID('project_release', 'U') IS NOT NULL DROP TABLE project_release;
IF OBJECT_ID('audit_entry', 'U') IS NOT NULL DROP TABLE audit_entry;
IF OBJECT_ID('issue_worklog', 'U') IS NOT NULL DROP TABLE issue_worklog;
IF OBJECT_ID('country', 'U') IS NOT NULL DROP TABLE country;
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
    -- New-type columns exercising AbstractConnection value marshalling:
    -- bigint (view_count), double (estimated_hours), uuid (external_ref).
    view_count BIGINT NOT NULL DEFAULT 0,
    estimated_hours FLOAT,
    -- uniqueidentifier, not VARCHAR: SQL Server stores uuids in
    -- `uniqueidentifier` columns. The value comes back uppercased — the
    -- DBConnection lowercases it in transformValueFromDB (see connection.ts).
    external_ref uniqueidentifier,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (assignee_id) REFERENCES app_user(id),
    FOREIGN KEY (parent_id) REFERENCES issue(id),
    CONSTRAINT uk_issue_number UNIQUE (project_id, [number])
);
GO

CREATE TABLE country (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(32) NOT NULL
);

CREATE TABLE issue_worklog (
    id INT IDENTITY(1,1) PRIMARY KEY,
    issue_id INT NOT NULL,
    work_date DATE NOT NULL,
    started_at TIME,
    minutes INT DEFAULT 0,
    duration_ms BIGINT NULL,
    billable BIT NULL,
    approved VARCHAR(1) NULL,
    activity VARCHAR(16) NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES issue(id)
);

CREATE TABLE project_release (
    id INT IDENTITY(1,1) PRIMARY KEY,
    project_id INT NOT NULL,
    version VARCHAR(32) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    signing_key uniqueidentifier NULL,
    released_on DATE NOT NULL,
    cutoff_time TIME NOT NULL,
    signed_off_at DATETIME NULL,
    notes AS ('release-' + version),
    FOREIGN KEY (project_id) REFERENCES project(id),
    CONSTRAINT uk_release_version UNIQUE (project_id, version)
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

IF OBJECT_ID('total_view_count', 'FN') IS NOT NULL DROP FUNCTION total_view_count;
IF OBJECT_ID('latest_issue_at', 'FN') IS NOT NULL DROP FUNCTION latest_issue_at;
IF OBJECT_ID('estimated_total', 'FN') IS NOT NULL DROP FUNCTION estimated_total;
GO

CREATE FUNCTION total_view_count(@p_id INT) RETURNS BIGINT AS BEGIN RETURN (SELECT COALESCE(SUM(view_count),0) FROM issue WHERE project_id = @p_id) END;
GO
CREATE FUNCTION latest_issue_at(@p_id INT) RETURNS DATETIME AS BEGIN RETURN (SELECT MAX(created_at) FROM issue WHERE project_id = @p_id) END;
GO
CREATE FUNCTION estimated_total(@p_id INT) RETURNS FLOAT AS BEGIN RETURN (SELECT COALESCE(SUM(estimated_hours),0) FROM issue WHERE project_id = @p_id) END;
GO

-- Sequences exercised by `sequence.next-current-value.test.ts`.
-- `auditTagSeq` is typed `'bigint'` on the domain connection, so
-- created `AS BIGINT` here; `issueIdSeq` defaults to INT.

IF OBJECT_ID('issue_id_seq',  'SO') IS NOT NULL DROP SEQUENCE issue_id_seq;
IF OBJECT_ID('audit_tag_seq', 'SO') IS NOT NULL DROP SEQUENCE audit_tag_seq;
GO

CREATE SEQUENCE issue_id_seq  AS INT    START WITH 1;
GO
CREATE SEQUENCE audit_tag_seq AS BIGINT START WITH 1;
GO
IF OBJECT_ID('release_tag_seq', 'SO') IS NOT NULL DROP SEQUENCE release_tag_seq;
GO
CREATE SEQUENCE release_tag_seq AS INT START WITH 1;
GO

-- A class-based SQL view exercised by `view.basic.test.ts`. A plain
-- join of project + organization. `plan` is a T-SQL reserved keyword
-- so it stays bracket-quoted in the SELECT; the view's own output
-- columns are plain identifiers matching the View mapping. CREATE VIEW
-- must lead its own batch, so it is wrapped in `GO` separators.
CREATE TABLE audit_entry (
    id INT PRIMARY KEY,
    action VARCHAR(255) NOT NULL
);
GO

CREATE VIEW project_overview AS
SELECT p.id AS id,
       p.organization_id AS organization_id,
       p.name AS name,
       p.archived_at AS archived_at,
       o.name AS organization_name,
       o.[plan] AS organization_plan
FROM project p
INNER JOIN organization o ON o.id = p.organization_id;
GO

-- View side of the release columns (see vReleaseOverview in connection.ts).
-- CREATE VIEW must lead its own batch, hence the GO separators.
GO
CREATE VIEW release_overview AS
SELECT r.id AS id,
       r.project_id AS project_id,
       r.version AS version,
       r.released_on AS released_on,
       r.signed_off_at AS signed_off_at,
       p.name AS project_name
FROM project_release r
INNER JOIN project p ON p.id = r.project_id;
GO
