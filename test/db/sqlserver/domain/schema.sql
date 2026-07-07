-- Schema for the shared "project management" domain, sqlserver dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

IF OBJECT_ID('project_overview', 'V') IS NOT NULL DROP VIEW project_overview;
IF OBJECT_ID('release_overview', 'V') IS NOT NULL DROP VIEW release_overview;
IF OBJECT_ID('project_review', 'U') IS NOT NULL DROP TABLE project_review;
IF OBJECT_ID('project_release', 'U') IS NOT NULL DROP TABLE project_release;
IF OBJECT_ID('audit_entry', 'U') IS NOT NULL DROP TABLE audit_entry;
IF OBJECT_ID('webhook_event', 'U') IS NOT NULL DROP TABLE webhook_event;
IF OBJECT_ID('calendar_year', 'U') IS NOT NULL DROP TABLE calendar_year;
IF OBJECT_ID('invoice', 'U') IS NOT NULL DROP TABLE invoice;
IF OBJECT_ID('ledger_entry', 'U') IS NOT NULL DROP TABLE ledger_entry;
IF OBJECT_ID('issue_worklog', 'U') IS NOT NULL DROP TABLE issue_worklog;
IF OBJECT_ID('country', 'U') IS NOT NULL DROP TABLE country;
IF OBJECT_ID('issue', 'U') IS NOT NULL DROP TABLE issue;
IF OBJECT_ID('project', 'U') IS NOT NULL DROP TABLE project;
IF OBJECT_ID('app_user', 'U') IS NOT NULL DROP TABLE app_user;
IF OBJECT_ID('organization', 'U') IS NOT NULL DROP TABLE organization;

IF OBJECT_ID('release_draft', 'U') IS NOT NULL DROP TABLE release_draft;
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
    -- billed amount per worklog (customDouble 'Money') and an `invoiced`
    -- flag stored as int 1/0 (numeric CustomBooleanTypeAdapter overload).
    billed_amount FLOAT NOT NULL DEFAULT 0,
    invoiced INT NOT NULL DEFAULT 0,
    cost_cents INT NOT NULL DEFAULT 0,
    activity VARCHAR(16) NOT NULL,
    -- Nullable DB-computed column (a computed column AS expression).
    activity_label AS (CASE WHEN minutes IS NOT NULL THEN UPPER(activity) ELSE NULL END),
    tag_label AS (UPPER(activity)),
    tag_label_optional AS (CASE WHEN minutes IS NOT NULL THEN LOWER(activity) ELSE NULL END),
    FOREIGN KEY (issue_id) REFERENCES issue(id) ON DELETE CASCADE
);

-- Bigint autogenerated PK + enum-defaulted column.
CREATE TABLE webhook_event (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    issue_id INT NOT NULL,
    event_type VARCHAR(16) NOT NULL DEFAULT 'created',
    FOREIGN KEY (issue_id) REFERENCES issue(id) ON DELETE CASCADE
);

-- Int caller-provided PK.
CREATE TABLE calendar_year (
    year_value INT PRIMARY KEY,
    year_label VARCHAR(64) NOT NULL
);

-- Int caller-provided PK carrying a scaling TypeAdapter (invoice_no stored x10).
CREATE TABLE invoice (
    invoice_no INT PRIMARY KEY,
    total INT NOT NULL
);

-- Every column factory carries its trailing-TypeAdapter overload.
-- entry_no autogenerated (plusOffsetAdapter, read +1000); amount/memo carry
-- scaledTenthAdapter (stored x10, read /10) over a DB DEFAULT; tag is virtual
-- (no DB column).
CREATE TABLE ledger_entry (
    entry_no INT IDENTITY(1,1) PRIMARY KEY,
    amount INT NOT NULL DEFAULT 100,
    memo INT DEFAULT 50,
    discount INT
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
    -- REQUIRED customLocalDateTime twin of signed_off_at.
    published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_signed BIT,
    download_count BIGINT,
    avg_rating FLOAT,
    notes AS ('release-' + version),
    FOREIGN KEY (project_id) REFERENCES project(id),
    CONSTRAINT uk_release_version UNIQUE (project_id, version)
);

-- Project review fixture: non-boolean per-column TypeAdapter on score (int,
-- stored x10) + reviewer_code (string, bracketed), an OPTIONAL localDate
-- (review_date) and a REQUIRED localTime (review_time).
CREATE TABLE project_review (
    id INT IDENTITY(1,1) PRIMARY KEY,
    project_id INT NOT NULL,
    reviewer_code VARCHAR(32) NOT NULL,
    score INT NOT NULL,
    review_date DATE,
    review_time TIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id)
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

-- Constant-returning functions, one per remaining executeFunction return kind.
-- boolean is BIT; ret_uuid returns uniqueidentifier (read back uppercased, then
-- lowercased in transformValueFromDB). Each CREATE FUNCTION leads its own batch.
IF OBJECT_ID('ret_flag',     'FN') IS NOT NULL DROP FUNCTION ret_flag;
IF OBJECT_ID('ret_uuid',     'FN') IS NOT NULL DROP FUNCTION ret_uuid;
IF OBJECT_ID('ret_day',      'FN') IS NOT NULL DROP FUNCTION ret_day;
IF OBJECT_ID('ret_clock',    'FN') IS NOT NULL DROP FUNCTION ret_clock;
IF OBJECT_ID('ret_activity', 'FN') IS NOT NULL DROP FUNCTION ret_activity;
IF OBJECT_ID('ret_channel',  'FN') IS NOT NULL DROP FUNCTION ret_channel;
IF OBJECT_ID('ret_semver',   'FN') IS NOT NULL DROP FUNCTION ret_semver;
GO
CREATE FUNCTION ret_flag(@p_id INT) RETURNS BIT AS BEGIN RETURN 1 END;
GO
CREATE FUNCTION ret_uuid(@p_id INT) RETURNS uniqueidentifier AS BEGIN RETURN '0a8f9c1e-1111-4222-8333-444455556666' END;
GO
CREATE FUNCTION ret_day(@p_id INT) RETURNS DATE AS BEGIN RETURN '2024-02-03' END;
GO
CREATE FUNCTION ret_clock(@p_id INT) RETURNS TIME AS BEGIN RETURN '14:25:36' END;
GO
CREATE FUNCTION ret_activity(@p_id INT) RETURNS VARCHAR(16) AS BEGIN RETURN 'coding' END;
GO
CREATE FUNCTION ret_channel(@p_id INT) RETURNS VARCHAR(16) AS BEGIN RETURN 'stable' END;
GO
CREATE FUNCTION ret_semver(@p_id INT) RETURNS VARCHAR(32) AS BEGIN RETURN '1.0.0' END;
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
       r.published_at AS published_stamp,
       r.published_at AS published_stamp_plain,
       r.version AS version_bracketed,
       CASE WHEN r.channel <> 'beta' THEN r.channel ELSE NULL END AS channel_bracketed,
       r.cutoff_time AS cutoff_clock,
       r.is_signed AS is_signed,
       r.download_count AS download_count,
       r.avg_rating AS avg_rating,
       r.signing_key AS signing_uuid,
       r.released_on AS release_day_plain,
       r.cutoff_time AS cutoff_plain,
       r.id AS release_ordinal,
       CASE WHEN r.download_count IS NOT NULL THEN r.id ELSE NULL END AS optional_release_ordinal,
       p.name AS project_name
FROM project_release r
INNER JOIN project p ON p.id = r.project_id;
GO

-- release_draft (§B-1): OPTIONAL enum/custom/customComparable columns so the
-- Nullable family reaches a real NULL row. Caller-provided int PK (no identity).
CREATE TABLE release_draft (
    id INT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    stage VARCHAR(16),
    channel VARCHAR(16),
    min_version VARCHAR(32),
    budget FLOAT,
    target_day DATE,
    cutoff TIME,
    scaled_cost INT NOT NULL DEFAULT 250,
    shifted_amount FLOAT NOT NULL DEFAULT 300,
    bracket_version VARCHAR(32) NOT NULL DEFAULT '2.0.0',
    bracket_channel VARCHAR(16) NOT NULL DEFAULT 'stable',
    bracket_activity VARCHAR(16) NOT NULL DEFAULT 'coding',
    shifted_stamp DATETIME NOT NULL DEFAULT '2024-06-01 10:00:00',
    shifted_count BIGINT NOT NULL DEFAULT 5000,
    shifted_rating FLOAT NOT NULL DEFAULT 4.5
);
