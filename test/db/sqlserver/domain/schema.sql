-- Schema for the shared "project management" domain, sqlserver dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

IF OBJECT_ID('project_overview', 'V') IS NOT NULL DROP VIEW project_overview;
IF OBJECT_ID('release_overview', 'V') IS NOT NULL DROP VIEW release_overview;
IF OBJECT_ID('col_matrix_view', 'V') IS NOT NULL DROP VIEW col_matrix_view;
IF OBJECT_ID('project_review', 'U') IS NOT NULL DROP TABLE project_review;
IF OBJECT_ID('project_release', 'U') IS NOT NULL DROP TABLE project_release;
IF OBJECT_ID('audit_entry', 'U') IS NOT NULL DROP TABLE audit_entry;
IF OBJECT_ID('webhook_event', 'U') IS NOT NULL DROP TABLE webhook_event;
IF OBJECT_ID('calendar_year', 'U') IS NOT NULL DROP TABLE calendar_year;
IF OBJECT_ID('exact_amount', 'U') IS NOT NULL DROP TABLE exact_amount;
IF OBJECT_ID('invoice', 'U') IS NOT NULL DROP TABLE invoice;
IF OBJECT_ID('ledger_entry', 'U') IS NOT NULL DROP TABLE ledger_entry;
IF OBJECT_ID('issue_worklog', 'U') IS NOT NULL DROP TABLE issue_worklog;
IF OBJECT_ID('col_matrix', 'U') IS NOT NULL DROP TABLE col_matrix;
IF OBJECT_ID('temporal_precision', 'U') IS NOT NULL DROP TABLE temporal_precision;
IF OBJECT_ID('duration_value', 'U') IS NOT NULL DROP TABLE duration_value;
IF OBJECT_ID('calendar_value', 'U') IS NOT NULL DROP TABLE calendar_value;
IF OBJECT_ID('zoned_value', 'U') IS NOT NULL DROP TABLE zoned_value;
IF OBJECT_ID('instant_value', 'U') IS NOT NULL DROP TABLE instant_value;
IF OBJECT_ID('flight_leg', 'U') IS NOT NULL DROP TABLE flight_leg;
IF OBJECT_ID('country', 'U') IS NOT NULL DROP TABLE country;
IF OBJECT_ID('issue', 'U') IS NOT NULL DROP TABLE issue;
IF OBJECT_ID('project', 'U') IS NOT NULL DROP TABLE project;
IF OBJECT_ID('app_user', 'U') IS NOT NULL DROP TABLE app_user;
IF OBJECT_ID('organization', 'U') IS NOT NULL DROP TABLE organization;

IF OBJECT_ID('release_draft', 'U') IS NOT NULL DROP TABLE release_draft;
-- A system-versioned table can't be dropped, nor its history table, until
-- versioning is off.
IF OBJECTPROPERTY(OBJECT_ID('service_plan', 'U'), 'TableTemporalType') = 2 ALTER TABLE service_plan SET (SYSTEM_VERSIONING = OFF);
IF OBJECT_ID('service_plan', 'U') IS NOT NULL DROP TABLE service_plan;
IF OBJECT_ID('service_plan_history', 'U') IS NOT NULL DROP TABLE service_plan_history;
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
    -- billed amount per worklog (ownDouble 'Money') and an `invoiced`
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

-- Exact numbers: a decimal (DecimalsType) of 30 significant digits, one with the scale 2, and an integer of 30 digits
-- (an IntegersType wider than 64 bits).
CREATE TABLE exact_amount (
    id INT PRIMARY KEY,
    amount DECIMAL(38,10),
    price DECIMAL(10,2),
    units DECIMAL(30,0)
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
    -- REQUIRED ownLocalDateTime twin of signed_off_at.
    published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- The time the rollout of the release took (a duration, Temporal.Duration)
    rollout_time NVARCHAR(64),
    -- The instant the release was deployed (an instant, Temporal.Instant)
    deployed_at DATETIMEOFFSET(7),
    is_signed BIT,
    download_count BIGINT,
    avg_rating FLOAT,
    support_months INT,
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

-- Null-propagating min/max helpers for the `libraryFunctions` (tsq_greatest_strict / tsq_least_strict)
-- opt-in (config.min-max-null-handling.test.ts). SQL Server's native `least` / `greatest`
-- (2022+) and the `iif` emulation IGNORE a NULL operand; these poison it to NULL instead,
-- so a user who prefers the function form over the CASE the builder emits by default can
-- name them. A scalar function is not polymorphic, so `float` covers the numeric operands
-- (int / bigint widen to it), and the `CASE` comparison works on every SQL Server version.
-- These are the same helpers the docs (sqlserver.md) tell users to create.
IF OBJECT_ID('tsq_greatest_strict', 'FN') IS NOT NULL DROP FUNCTION tsq_greatest_strict;
IF OBJECT_ID('tsq_least_strict',    'FN') IS NOT NULL DROP FUNCTION tsq_least_strict;
GO
CREATE FUNCTION tsq_greatest_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS BEGIN RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a >= @b THEN @a ELSE @b END END;
GO
CREATE FUNCTION tsq_least_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS BEGIN RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a <= @b THEN @a ELSE @b END END;
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

-- release_draft: OPTIONAL enum/custom/ownComparable columns so the
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
    shifted_rating FLOAT NOT NULL DEFAULT 4.5,
    bracket_signing_key uniqueidentifier NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000',
    shifted_release_day DATE NOT NULL DEFAULT '2025-03-01',
    shifted_cutoff TIME NOT NULL DEFAULT '09:00:00'
);
GO

-- col_matrix: one plain, NOT NULL column per base kind. Every
-- tColMatrix* Table / the vColMatrix View reads these SAME columns through a
-- DIFFERENT column factory; the optionality/default/computed/pk distinction is
-- type-level only. boolean is BIT, uuid uniqueidentifier, localDateTime DATETIME.
-- Caller-provided int PK (no IDENTITY). CREATE VIEW must lead its own batch (GO).
CREATE TABLE col_matrix (
    id INT PRIMARY KEY,
    m_int INT NOT NULL,
    m_bigint BIGINT NOT NULL,
    m_double FLOAT NOT NULL,
    m_bool BIT NOT NULL,
    m_uuid uniqueidentifier NOT NULL,
    m_date DATE NOT NULL,
    m_time TIME NOT NULL,
    m_datetime DATETIME NOT NULL,
    m_str VARCHAR(64) NOT NULL
);
GO

-- temporal_precision: a microsecond-precision localDateTime column (DATETIME2(7))
-- seeded with a sub-millisecond instant (12:30:59.999600) that a JS Date cannot
-- express. Locks the date-part getters' SQL-side truncation on a real microsecond
-- value: getSeconds() must stay 59 (not round to 60) and getMilliseconds() must
-- stay 999 (datepart(millisecond), not a round up to 1000). Int PK, no identity.
CREATE TABLE temporal_precision (
    id INT PRIMARY KEY,
    micro_stamp DATETIME2(7) NOT NULL
);

-- duration_value: durations (Temporal.Duration) kept as the database can: span in its interval (of days to
-- seconds on Oracle) or ISO 8601 text, span_calendar with years and months, span_text as its ISO 8601 text.
CREATE TABLE duration_value (
    id INT PRIMARY KEY,
    span NVARCHAR(64) NOT NULL,
    span_calendar NVARCHAR(64),
    span_text NVARCHAR(64)
);
GO

-- calendar_value: a month of a year (plainYearMonth) and a day of a month (plainMonthDay) in the date of their reference
-- (the 1st of the month, the year 1972), and a date (plainDate) they are taken from: born_on.
CREATE TABLE calendar_value (
    id INT PRIMARY KEY,
    month_of DATE NOT NULL,
    day_of DATE NOT NULL,
    born_on DATE NOT NULL
);
GO

-- zoned_value: exact moments in a time zone (Temporal.ZonedDateTime), zoned_at kept as its RFC 9557 text (the one of
-- Temporal's toString, its wall clock, its offset and its zone); wall_at a wall clock to take to a zone, zone_name the
-- name of a zone.
CREATE TABLE zoned_value (
    id INT PRIMARY KEY,
    zoned_at NVARCHAR(100) NOT NULL,
    wall_at DATETIME2(7),
    zone_name NVARCHAR(40)
);
GO

-- instant_value: exact moments (Temporal.Instant) in the columns a database has for them: instant_at in the one
-- recommended for an instant, wall_at without zone (its wall clock in UTC), session_at converted with the zone of the
-- session where the database has such a column (else as instant_at).
CREATE TABLE instant_value (
    id INT PRIMARY KEY,
    instant_at DATETIMEOFFSET(7) NOT NULL,
    wall_at DATETIME2(7),
    session_at DATETIMEOFFSET(7)
);
GO

-- flight_leg: a date and time stored with the offset it was written with
-- (DATETIMEOFFSET(7)), read and written as text by a type adapter, so the
-- offset is kept.
CREATE TABLE flight_leg (
    id INT PRIMARY KEY,
    departs_at DATETIMEOFFSET(7) NOT NULL,
    arrives_at DATETIMEOFFSET(7) NULL
);
GO

CREATE VIEW col_matrix_view AS
SELECT id, m_int, m_bigint, m_double, m_bool, m_uuid, m_date, m_time, m_datetime, m_str
FROM col_matrix;
GO

-- Zero-arg scalar function per base value kind. Custom kinds
-- reuse the base-kind function. Each is its own GO batch, declared AFTER
-- col_matrix (SQL Server does not defer name resolution for functions). m_uuid is
-- uniqueidentifier (read back uppercased, lowercased by the marshaller); m_bool
-- is BIT. The call site is dbo.cm_<kind>().
IF OBJECT_ID('cm_int',      'FN') IS NOT NULL DROP FUNCTION cm_int;
IF OBJECT_ID('cm_bigint',   'FN') IS NOT NULL DROP FUNCTION cm_bigint;
IF OBJECT_ID('cm_double',   'FN') IS NOT NULL DROP FUNCTION cm_double;
IF OBJECT_ID('cm_bool',     'FN') IS NOT NULL DROP FUNCTION cm_bool;
IF OBJECT_ID('cm_uuid',     'FN') IS NOT NULL DROP FUNCTION cm_uuid;
IF OBJECT_ID('cm_date',     'FN') IS NOT NULL DROP FUNCTION cm_date;
IF OBJECT_ID('cm_time',     'FN') IS NOT NULL DROP FUNCTION cm_time;
IF OBJECT_ID('cm_datetime', 'FN') IS NOT NULL DROP FUNCTION cm_datetime;
IF OBJECT_ID('cm_str',      'FN') IS NOT NULL DROP FUNCTION cm_str;
GO
CREATE FUNCTION cm_int() RETURNS INT AS BEGIN RETURN (SELECT m_int FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_bigint() RETURNS BIGINT AS BEGIN RETURN (SELECT m_bigint FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_double() RETURNS FLOAT AS BEGIN RETURN (SELECT m_double FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_bool() RETURNS BIT AS BEGIN RETURN (SELECT m_bool FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_uuid() RETURNS uniqueidentifier AS BEGIN RETURN (SELECT m_uuid FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_date() RETURNS DATE AS BEGIN RETURN (SELECT m_date FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_time() RETURNS TIME AS BEGIN RETURN (SELECT m_time FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_datetime() RETURNS DATETIME AS BEGIN RETURN (SELECT m_datetime FROM col_matrix WHERE id = 1) END;
GO
CREATE FUNCTION cm_str() RETURNS VARCHAR(64) AS BEGIN RETURN (SELECT m_str FROM col_matrix WHERE id = 1) END;
GO
GO
-- service_plan: a system-versioned temporal table, every change of a row leaves
-- its previous version in service_plan_history.
CREATE TABLE service_plan (
    id INT NOT NULL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    description VARCHAR(255) NULL,
    valid_from DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    valid_to DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (valid_from, valid_to)
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.service_plan_history));
GO

-- The functions that take others with schema binding are dropped first, so the others can be created again
DROP FUNCTION IF EXISTS dbo.tsq_duration_sum;
DROP FUNCTION IF EXISTS dbo.tsq_duration_total_of;
DROP FUNCTION IF EXISTS dbo.tsq_duration_round_of;
DROP FUNCTION IF EXISTS dbo.tsq_instant_plus_duration;
DROP FUNCTION IF EXISTS dbo.tsq_datetime_plus_duration;
DROP FUNCTION IF EXISTS dbo.tsq_duration_negated;
DROP FUNCTION IF EXISTS dbo.tsq_datetime_round;
GO

-- tsq_duration_part: a part of the ISO 8601 text of a duration (Temporal.Duration), the function of the library that
-- reads a duration kept as text: 'M' the months (its years too), 'D' the days (its weeks too), 'S' the whole seconds of
-- its time, 'N' the nanoseconds of the second, to add or subtract it; 'years', 'months', 'weeks', 'days', 'hours',
-- 'minutes' and 'seconds' (without its fraction) each field as written; each with the sign of the duration; 'sign' the
-- sign of the duration (-1, 0 or 1); 'largest' the largest field that isn't zero (0 the years, 1 the months, 2 the weeks,
-- 3 the days, 4 the hours, 5 the minutes, 6 the seconds, 7 the milliseconds, 8 the microseconds, 9 the nanoseconds; 10
-- for a duration of zero).
CREATE OR ALTER FUNCTION dbo.tsq_duration_part(@d NVARCHAR(100), @part VARCHAR(10)) RETURNS BIGINT WITH SCHEMABINDING AS
BEGIN
    IF @d IS NULL RETURN NULL;
    DECLARE @s NVARCHAR(100) = UPPER(LTRIM(RTRIM(@d))), @i INT = 1, @n INT, @c NCHAR(1), @num NVARCHAR(40) = N'', @inTime BIT = 0, @sign INT = 1, @r BIGINT = 0, @nonzero BIT = 0, @largest INT = 10, @f BIGINT;
    SET @n = LEN(@s);
    IF LEFT(@s, 1) = N'-' BEGIN SET @sign = -1; SET @i = 2; END ELSE IF LEFT(@s, 1) = N'+' SET @i = 2;
    SET @i = @i + 1;
    WHILE @i <= @n
    BEGIN
        SET @c = SUBSTRING(@s, @i, 1);
        IF @c = N'T' SET @inTime = 1;
        ELSE IF @c LIKE N'[0-9]' OR @c = N'.' OR @c = N',' SET @num = @num + CASE WHEN @c = N',' THEN N'.' ELSE @c END;
        ELSE
        BEGIN
            IF REPLACE(REPLACE(@num, N'0', N''), N'.', N'') <> N''
            BEGIN
                SET @nonzero = 1;
                SET @f = CAST(LEFT(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN SUBSTRING(@num, CHARINDEX(N'.', @num) + 1, 40) ELSE N'' END + N'000000000', 9) AS BIGINT);
                SET @largest = (SELECT MIN(v) FROM (VALUES (@largest), (CASE WHEN @c = N'Y' THEN 0 WHEN @c = N'M' AND @inTime = 0 THEN 1 WHEN @c = N'W' THEN 2 WHEN @c = N'D' THEN 3 WHEN @c = N'H' THEN 4 WHEN @c = N'M' THEN 5
                    WHEN CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT) <> 0 THEN 6 WHEN @f >= 1000000 THEN 7 WHEN @f >= 1000 THEN 8 ELSE 9 END)) AS t(v));
            END
            IF @part = 'M' AND @inTime = 0 AND @c = N'Y' SET @r = @r + 12 * CAST(@num AS BIGINT);
            ELSE IF @part = 'M' AND @inTime = 0 AND @c = N'M' SET @r = @r + CAST(@num AS BIGINT);
            ELSE IF @part = 'D' AND @c = N'W' SET @r = @r + 7 * CAST(@num AS BIGINT);
            ELSE IF @part = 'D' AND @c = N'D' SET @r = @r + CAST(@num AS BIGINT);
            ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'H' SET @r = @r + 3600 * CAST(@num AS BIGINT);
            ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'M' SET @r = @r + 60 * CAST(@num AS BIGINT);
            ELSE IF @part = 'S' AND @c = N'S' SET @r = @r + CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT);
            ELSE IF @part = 'N' AND @c = N'S' AND CHARINDEX(N'.', @num) > 0 SET @r = CAST(LEFT(SUBSTRING(@num, CHARINDEX(N'.', @num) + 1, 40) + N'000000000', 9) AS BIGINT);
            ELSE IF @part = 'years' AND @inTime = 0 AND @c = N'Y' OR @part = 'months' AND @inTime = 0 AND @c = N'M' OR @part = 'weeks' AND @c = N'W' OR @part = 'days' AND @c = N'D' OR @part = 'hours' AND @inTime = 1 AND @c = N'H' OR @part = 'minutes' AND @inTime = 1 AND @c = N'M' OR @part = 'seconds' AND @c = N'S' SET @r = CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT);
            SET @num = N'';
        END
        SET @i = @i + 1;
    END
    IF @part = 'sign' RETURN CASE WHEN @nonzero = 1 THEN @sign ELSE 0 END;
    IF @part = 'largest' RETURN @largest;
    RETURN @sign * @r;
END
GO

-- tsq_duration_round and tsq_duration_add use tsq_duration_text: they go first to create them again
DROP FUNCTION IF EXISTS dbo.tsq_duration_round;
DROP FUNCTION IF EXISTS dbo.tsq_duration_add;
GO

-- tsq_duration_text: the ISO 8601 text of a duration (Temporal.Duration) of its fields, the function of the library that
-- writes a duration a query computes (until, since) where it is kept as text: its years, months, weeks and days, and the
-- nanoseconds of its time, balanced up to the largest unit given: the months go to the years ('year'), the days of the
-- time to the days ('day'), and the weeks of the days to the weeks too ('week'); the time is written in hours, minutes
-- and seconds ('week', 'day', 'hour'), minutes and seconds ('minute') or seconds ('second'); every field with the sign
-- of the duration. The text is the one of Temporal's toString.
CREATE OR ALTER FUNCTION dbo.tsq_duration_text(@y BIGINT, @mo BIGINT, @w BIGINT, @d BIGINT, @h BIGINT, @mi BIGINT, @ns DECIMAL(38, 0), @unit VARCHAR(6)) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    IF @y IS NULL OR @mo IS NULL OR @w IS NULL OR @d IS NULL OR @h IS NULL OR @mi IS NULL OR @ns IS NULL RETURN NULL;
    IF @unit = 'year' BEGIN SET @y = @y + @mo / 12; SET @mo = @mo % 12; END
    IF @unit = 'week' OR @unit = 'day'
    BEGIN
        SET @d = @d + CAST(ROUND(@ns / 86400000000000, 0, 1) AS BIGINT);
        SET @ns = @ns % 86400000000000;
        IF @unit = 'week' BEGIN SET @w = @w + @d / 7; SET @d = @d % 7; END
        SET @unit = 'hour';
    END
    DECLARE @neg BIT = CASE WHEN @y < 0 OR @mo < 0 OR @w < 0 OR @d < 0 OR @h < 0 OR @mi < 0 OR @ns < 0 THEN 1 ELSE 0 END, @r VARCHAR(100) = '', @t VARCHAR(100) = '';
    DECLARE @hour BIGINT = 3600000000000, @minute BIGINT = 60000000000, @second BIGINT = 1000000000, @f BIGINT, @frac VARCHAR(9);
    IF @y <> 0 SET @r = @r + CAST(ABS(@y) AS VARCHAR(20)) + 'Y';
    IF @mo <> 0 SET @r = @r + CAST(ABS(@mo) AS VARCHAR(20)) + 'M';
    IF @w <> 0 SET @r = @r + CAST(ABS(@w) AS VARCHAR(20)) + 'W';
    IF @d <> 0 SET @r = @r + CAST(ABS(@d) AS VARCHAR(20)) + 'D';
    SET @ns = ABS(@ns); SET @h = ABS(@h); SET @mi = ABS(@mi);
    IF @unit = 'hour' BEGIN SET @h = @h + CAST(FLOOR(@ns / @hour) AS BIGINT); SET @ns = @ns % @hour; END
    IF @h <> 0 SET @t = @t + CAST(@h AS VARCHAR(20)) + 'H';
    IF @unit <> 'second' BEGIN SET @mi = @mi + CAST(FLOOR(@ns / @minute) AS BIGINT); SET @ns = @ns % @minute; END
    IF @mi <> 0 SET @t = @t + CAST(@mi AS VARCHAR(20)) + 'M';
    IF @ns > 0
    BEGIN
        SET @f = @ns % @second;
        SET @t = @t + CAST(FLOOR(@ns / @second) AS VARCHAR(20));
        IF @f > 0
        BEGIN
            SET @frac = RIGHT('000000000' + CAST(@f AS VARCHAR(9)), 9);
            WHILE RIGHT(@frac, 1) = '0' SET @frac = LEFT(@frac, LEN(@frac) - 1);
            SET @t = @t + '.' + @frac;
        END
        SET @t = @t + 'S';
    END
    IF @r = '' AND @t = '' RETURN 'PT0S';
    RETURN CASE WHEN @neg = 1 THEN '-' ELSE '' END + 'P' + @r + CASE WHEN @t = '' THEN '' ELSE 'T' + @t END;
END
GO

-- tsq_duration_round: the duration from one date and time to another (the year, month, day and nanoseconds of the day
-- of each one; a date is at 00:00) as Temporal's until with a largest unit of weeks, months or years ('week', 'month',
-- 'year') rounded to the smallest unit, increment and mode given, the function of the library that rounds a difference
-- to the calendar (counting from the first date, as Temporal does); since passes its mode negated and -1 to negate the
-- result.
CREATE OR ALTER FUNCTION dbo.tsq_duration_round(@y1 INT, @m1 INT, @d1 INT, @ns1 BIGINT, @y2 INT, @m2 INT, @d2 INT, @ns2 BIGINT, @largest VARCHAR(5), @smallest VARCHAR(11), @increment BIGINT, @mode VARCHAR(10), @negation INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    IF @y1 IS NULL OR @m1 IS NULL OR @d1 IS NULL OR @ns1 IS NULL OR @y2 IS NULL OR @m2 IS NULL OR @d2 IS NULL OR @ns2 IS NULL OR @largest IS NULL OR @smallest IS NULL OR @increment IS NULL OR @mode IS NULL OR @negation IS NULL RETURN NULL;
    DECLARE @day BIGINT = 86400000000000, @one DATE = DATEFROMPARTS(@y1, @m1, @d1), @two DATE = DATEFROMPARTS(@y2, @m2, @d2);
    DECLARE @adjusted DATE = @two, @t BIGINT = @ns2 - @ns1, @k INT, @years BIGINT = 0, @months BIGINT = 0, @weeks BIGINT = 0, @days BIGINT;
    DECLARE @sign BIGINT, @um VARCHAR(12), @r1 BIGINT, @start DATE, @end DATE, @num DECIMAL(38), @den DECIMAL(38), @whole DECIMAL(38), @rest DECIMAL(38), @steps BIGINT, @step BIGINT, @toRound BIGINT, @rounded BIGINT;
    IF @t > 0 AND @two < @one BEGIN SET @adjusted = DATEADD(day, 1, @two); SET @t = @t - @day; END
    ELSE IF @t < 0 AND @two > @one BEGIN SET @adjusted = DATEADD(day, -1, @two); SET @t = @t + @day; END
    IF @largest = 'week'
    BEGIN
        SET @weeks = DATEDIFF(day, @one, @adjusted) / 7;
        SET @days = DATEDIFF(day, @one, @adjusted) - @weeks * 7;
    END
    ELSE
    BEGIN
        SET @k = ((YEAR(@adjusted) * 12 + MONTH(@adjusted)) * 32 + DAY(@adjusted) - (@y1 * 12 + @m1) * 32 - @d1) / 32;
        IF @largest = 'year' SET @years = @k / 12;
        SET @months = @k - @years * 12;
        SET @days = DATEDIFF(day, DATEADD(month, @k, @one), @adjusted);
    END
    SET @sign = CASE WHEN @two < @one OR @two = @one AND @ns2 < @ns1 THEN -1 ELSE 1 END;
    SET @um = CASE @mode
        WHEN 'ceil' THEN CASE WHEN @sign < 0 THEN 'zero' ELSE 'infinity' END
        WHEN 'floor' THEN CASE WHEN @sign < 0 THEN 'infinity' ELSE 'zero' END
        WHEN 'halfCeil' THEN CASE WHEN @sign < 0 THEN 'halfZero' ELSE 'halfInfinity' END
        WHEN 'halfFloor' THEN CASE WHEN @sign < 0 THEN 'halfInfinity' ELSE 'halfZero' END
        WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
        ELSE 'halfEven' END;
    IF @smallest IN ('year', 'month', 'week')
    BEGIN
        IF @smallest = 'year'
        BEGIN
            SET @r1 = @years / @increment * @increment;
            SET @start = DATEADD(month, @r1 * 12, @one);
            SET @end = DATEADD(month, (@r1 + @increment * @sign) * 12, @one);
        END
        ELSE IF @smallest = 'month'
        BEGIN
            SET @r1 = @months / @increment * @increment;
            SET @start = DATEADD(month, @years * 12 + @r1, @one);
            SET @end = DATEADD(month, @years * 12 + @r1 + @increment * @sign, @one);
        END
        ELSE
        BEGIN
            SET @r1 = CASE WHEN @largest = 'week' THEN @weeks ELSE @days / 7 END / @increment * @increment;
            SET @start = DATEADD(day, @r1 * 7, DATEADD(month, @years * 12 + @months, @one));
            SET @end = DATEADD(day, (@r1 + @increment * @sign) * 7, DATEADD(month, @years * 12 + @months, @one));
        END
        SET @num = ABS(CAST(DATEDIFF(day, @start, @two) AS DECIMAL(38)) * @day + @ns2 - @ns1);
        SET @den = ABS(CAST(DATEDIFF(day, @start, @end) AS DECIMAL(38)) * @day);
        SET @whole = ROUND(@num / @den, 0, 1);
        SET @rest = @num - @whole * @den;
        SET @steps = @whole + CASE WHEN @rest <> 0 AND (@um = 'infinity' OR @um LIKE 'half%' AND (2 * @rest > @den OR 2 * @rest = @den AND (@um = 'halfInfinity' OR @um = 'halfEven' AND (ABS(@r1) / @increment + @whole) % 2 <> 0))) THEN 1 ELSE 0 END;
        SET @days = 0;
        SET @t = 0;
        IF @smallest = 'year' BEGIN SET @years = @r1 + @increment * @sign * @steps; SET @months = 0; END
        ELSE IF @smallest = 'month'
        BEGIN
            SET @months = @r1 + @increment * @sign * @steps;
            IF @steps > 0 AND @largest = 'year' AND @sign * DATEDIFF(day, DATEADD(month, (@years + @sign) * 12, @one), DATEADD(month, @years * 12 + @months, @one)) >= 0 BEGIN SET @years = @years + @sign; SET @months = 0; END
        END
        ELSE SET @weeks = @r1 + @increment * @sign * @steps;
    END
    ELSE
    BEGIN
        SET @step = CASE @smallest WHEN 'day' THEN @day WHEN 'hour' THEN CAST(3600000000000 AS BIGINT) WHEN 'minute' THEN CAST(60000000000 AS BIGINT) WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * @increment;
        SET @toRound = @days * @day + @t;
        SET @rest = ABS(@toRound % @step);
        SET @rounded = @toRound - @toRound % @step;
        IF @rest <> 0 AND (@um = 'infinity' OR @um LIKE 'half%' AND (2 * @rest > @step OR 2 * @rest = @step AND (@um = 'halfInfinity' OR @um = 'halfEven' AND (@rounded / @step) % 2 <> 0))) SET @rounded = @rounded + @step * @sign;
        SET @days = @rounded / @day;
        SET @t = @rounded - @days * @day;
        IF @rounded / @day <> @toRound / @day
        BEGIN
            IF @largest = 'week'
            BEGIN
                IF @sign * (CAST(DATEDIFF(day, DATEADD(day, (@weeks + @sign) * 7, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0 BEGIN SET @weeks = @weeks + @sign; SET @days = 0; SET @t = 0; END
            END
            ELSE IF @sign * (CAST(DATEDIFF(day, DATEADD(month, @years * 12 + @months + @sign, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0
            BEGIN
                SET @days = 0;
                SET @t = 0;
                IF @largest = 'year' AND @sign * (CAST(DATEDIFF(day, DATEADD(month, (@years + @sign) * 12, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0 BEGIN SET @years = @years + @sign; SET @months = 0; END
                ELSE SET @months = @months + @sign;
            END
        END
    END
    RETURN dbo.tsq_duration_text(@years * @negation, @months * @negation, @weeks * @negation, @days * @negation, 0, 0, @t * @negation, 'hour');
END
GO

-- tsq_duration_total: a duration (its months, its years too; its weeks; its days; the whole seconds of its time and the
-- nanoseconds of the second, each with the sign of the duration) in a unit ('year' ... 'nanosecond'), the function of
-- the library that gives Temporal's total. With a date of reference (its year, month and day; 0, 0, 0 without one) the
-- duration is added to it, the months first with the day kept in the month, and the unit is counted from it, a month or
-- a year with the days of the calendar there; without one a day is 24 hours, and a duration with months or weeks, or a
-- unit of them, is an error (a function can't raise one: a text that isn't a number, converted to one). The double is
-- the quotient rounded once, as Temporal's.
CREATE OR ALTER FUNCTION dbo.tsq_duration_total(@months BIGINT, @weeks BIGINT, @days BIGINT, @seconds BIGINT, @nanoseconds BIGINT, @y INT, @m INT, @d INT, @unit VARCHAR(11)) RETURNS FLOAT WITH SCHEMABINDING AS
BEGIN
    IF @months IS NULL OR @weeks IS NULL OR @days IS NULL OR @seconds IS NULL OR @nanoseconds IS NULL OR @y IS NULL OR @m IS NULL OR @d IS NULL OR @unit IS NULL RETURN NULL;
    DECLARE @day DECIMAL(38, 0) = 86400000000000, @t DECIMAL(38, 0) = CAST(@seconds AS DECIMAL(38, 0)) * 1000000000 + @nanoseconds, @timeOfDay DECIMAL(38, 0);
    DECLARE @one DATE, @two DATE, @adjusted DATE, @sign INT, @k INT, @r1 INT, @start DATE, @end DATE;
    DECLARE @a DECIMAL(38, 0), @b DECIMAL(38, 0), @x DECIMAL(38, 0), @s INT = 0, @q DECIMAL(38, 0), @rest DECIMAL(38, 0);
    IF @m = 0
    BEGIN
        IF @months <> 0 OR @weeks <> 0 OR @unit IN ('year', 'month', 'week')
            RETURN CAST('tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference, unit ' + @unit AS INT);
        SET @a = @days * @day + @t;
    END
    ELSE
    BEGIN
        -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
        SET @timeOfDay = @t % @day;
        IF @timeOfDay < 0 SET @timeOfDay = @timeOfDay + @day;
        SET @one = DATEFROMPARTS(@y, @m, @d);
        SET @two = DATEADD(day, CAST(@weeks * 7 + @days + (@t - @timeOfDay) / @day AS INT), DATEADD(month, @months, @one));
        IF @unit IN ('year', 'month', 'week')
        BEGIN
            IF @two = @one AND @timeOfDay = 0 RETURN 0;
            -- The whole units to the end without passing it (as until), and the progress to the next one
            SET @adjusted = CASE WHEN @timeOfDay > 0 AND @two < @one THEN DATEADD(day, 1, @two) ELSE @two END;
            SET @sign = CASE WHEN DATEDIFF(day, @one, @two) * @day + @timeOfDay < 0 THEN -1 ELSE 1 END;
            IF @unit = 'week'
                SET @r1 = DATEDIFF(day, @one, @adjusted) / 7;
            ELSE
            BEGIN
                SET @k = ((YEAR(@adjusted) * 12 + MONTH(@adjusted)) * 32 + DAY(@adjusted) - (@y * 12 + @m) * 32 - @d) / 32;
                SET @r1 = CASE WHEN @unit = 'month' THEN @k ELSE @k / 12 END;
            END
            SET @start = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * @r1, @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 ELSE 12 * @r1 END, @one) END;
            SET @end = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * (@r1 + @sign), @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 + @sign ELSE 12 * (@r1 + @sign) END, @one) END;
            IF ABS(DATEDIFF(day, @start, @two) * @day + @timeOfDay) >= ABS(DATEDIFF(day, @start, @end) * @day)
            BEGIN
                -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                SET @r1 = @r1 + @sign;
                SET @start = @end;
                SET @end = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * (@r1 + @sign), @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 + @sign ELSE 12 * (@r1 + @sign) END, @one) END;
            END
            SET @b = ABS(DATEDIFF(day, @start, @end) * @day);
            SET @a = @r1 * @b + @sign * ABS(DATEDIFF(day, @start, @two) * @day + @timeOfDay);
        END
        ELSE
            SET @a = DATEDIFF(day, @one, @two) * @day + @timeOfDay;
    END
    IF @unit NOT IN ('year', 'month', 'week')
        SET @b = CASE @unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
    -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
    IF @a = 0 RETURN 0;
    SET @x = ABS(@a);
    WHILE @x >= @b * 9007199254740992 BEGIN SET @b = @b * 2; SET @s = @s - 1; END
    WHILE @x < @b * 4503599627370496 BEGIN SET @x = @x * 2; SET @s = @s + 1; END
    SET @rest = @x % @b;
    SET @q = (@x - @rest) / @b;
    IF 2 * @rest > @b OR 2 * @rest = @b AND @q % 2 = 1 SET @q = @q + 1;
    RETURN CASE WHEN @a < 0 THEN -1 ELSE 1 END * CAST(@q AS FLOAT) * POWER(CAST(2 AS FLOAT), -@s);
END
GO

-- tsq_duration_add: the sum of two durations, the second times sign (1 to add it, -1 to subtract it), each given by its
-- largest field that isn't zero (tsq_duration_part 'largest'), its days, the whole seconds of its time and the
-- nanoseconds of the second, each with its sign; the function of the library that adds and subtracts durations as
-- Temporal's add and subtract: a duration with years, months or weeks is an error, a day is 24 hours, and the sum is
-- balanced up to the largest field of the two (days and a time, or a time in hours, in minutes or in seconds).
CREATE OR ALTER FUNCTION dbo.tsq_duration_add(@largest1 INT, @days1 BIGINT, @seconds1 BIGINT, @nanoseconds1 BIGINT, @largest2 INT, @days2 BIGINT, @seconds2 BIGINT, @nanoseconds2 BIGINT, @sign INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    IF @largest1 IS NULL OR @days1 IS NULL OR @seconds1 IS NULL OR @nanoseconds1 IS NULL OR @largest2 IS NULL OR @days2 IS NULL OR @seconds2 IS NULL OR @nanoseconds2 IS NULL OR @sign IS NULL RETURN NULL;
    DECLARE @day DECIMAL(38, 0) = 86400000000000, @largest INT = CASE WHEN @largest1 < @largest2 THEN @largest1 ELSE @largest2 END, @total DECIMAL(38, 0), @days DECIMAL(38, 0) = 0;
    IF @largest <= 2
        RETURN CAST(CAST('tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted, sign ' + CAST(@sign AS VARCHAR(2)) AS INT) AS VARCHAR(100));
    SET @total = CAST(@days1 + @sign * @days2 AS DECIMAL(38, 0)) * @day + CAST(@seconds1 + @sign * @seconds2 AS DECIMAL(38, 0)) * 1000000000 + @nanoseconds1 + @sign * @nanoseconds2;
    IF @largest = 3 SET @days = (@total - @total % @day) / @day;
    RETURN dbo.tsq_duration_text(0, 0, 0, @days, 0, 0, @total - @days * @day, CASE WHEN @largest <= 4 THEN 'hour' WHEN @largest = 5 THEN 'minute' ELSE 'second' END);
END
GO

-- tsq_round_to: an integer rounded to a multiple of a step (a positive integer) in a rounding mode of Temporal
-- ('ceil', 'floor', 'expand', 'trunc', 'halfCeil', 'halfFloor', 'halfExpand', 'halfTrunc', 'halfEven'), as Temporal
-- rounds a difference or a time of the day; the function of the library that writes the integer once
-- (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_round_to(@value DECIMAL(38, 0), @step DECIMAL(38, 0), @rounding_mode VARCHAR(10)) RETURNS DECIMAL(38, 0) WITH SCHEMABINDING AS
BEGIN
    IF @value IS NULL OR @step IS NULL OR @rounding_mode IS NULL RETURN NULL;
    DECLARE @q DECIMAL(38, 0) = ROUND(@value / @step, 0, 1);
    DECLARE @r DECIMAL(38, 0) = @value - @q * @step;
    IF @r = 0 RETURN @value;
    DECLARE @away DECIMAL(38, 0) = @q + SIGN(@value);
    RETURN @step * CASE
        WHEN @rounding_mode = 'trunc' THEN @q
        WHEN @rounding_mode = 'floor' THEN CASE WHEN @value < 0 THEN @away ELSE @q END
        WHEN @rounding_mode = 'ceil' THEN CASE WHEN @value > 0 THEN @away ELSE @q END
        WHEN @rounding_mode = 'expand' THEN @away
        WHEN 2 * ABS(@r) > @step THEN @away
        WHEN 2 * ABS(@r) < @step THEN @q
        WHEN @rounding_mode = 'halfExpand' THEN @away
        WHEN @rounding_mode = 'halfTrunc' THEN @q
        WHEN @rounding_mode = 'halfCeil' THEN CASE WHEN @value > 0 THEN @away ELSE @q END
        WHEN @rounding_mode = 'halfFloor' THEN CASE WHEN @value < 0 THEN @away ELSE @q END
        WHEN @q % 2 = 0 THEN @q
        ELSE @away
    END;
END
GO

-- tsq_ticks_between: the hundreds of nanoseconds (the unit a datetime2(7) keeps) from one date and time to another:
-- the days of their dates and the time of their times of the day; the function of the library that writes each one
-- once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_ticks_between(@one DATETIME2(7), @two DATETIME2(7)) RETURNS BIGINT WITH SCHEMABINDING AS
BEGIN
    RETURN DATEDIFF(DAY, CAST(@one AS DATE), CAST(@two AS DATE)) * CAST(864000000000 AS BIGINT) + DATEDIFF_BIG(NANOSECOND, CAST(@one AS TIME), CAST(@two AS TIME)) / 100;
END
GO

-- tsq_time_of_ticks: the time of the day of a number of hundreds of nanoseconds since midnight, going round at
-- midnight; the function of the library that writes the number once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_time_of_ticks(@ticks BIGINT) RETURNS TIME(7) WITH SCHEMABINDING AS
BEGIN
    RETURN DATEADD(NANOSECOND, @ticks % 10000000 * 100, DATEADD(SECOND, @ticks / 10000000 % 86400, CAST('00:00' AS TIME(7))));
END
GO

-- tsq_datetime_of_ticks: a date plus a number of hundreds of nanoseconds, a datetime2(7); the function of the library
-- that writes the number once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_datetime_of_ticks(@date DATE, @ticks BIGINT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    RETURN DATEADD(NANOSECOND, @ticks % 10000000 * 100, DATEADD(SECOND, @ticks / 10000000, CAST(@date AS DATETIME2(7))));
END
GO

-- tsq_duration_sum: the sum of two durations (Temporal.Duration), the second times sign (1 to add it, -1 to subtract
-- it), each given whole: tsq_duration_add of their parts; the function of the library that writes each one once
-- (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_duration_sum(@a NVARCHAR(100), @b NVARCHAR(100), @sign INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_duration_add(dbo.tsq_duration_part(@a, 'largest'), dbo.tsq_duration_part(@a, 'days'), dbo.tsq_duration_part(@a, 'S'), dbo.tsq_duration_part(@a, 'N'),
        dbo.tsq_duration_part(@b, 'largest'), dbo.tsq_duration_part(@b, 'days'), dbo.tsq_duration_part(@b, 'S'), dbo.tsq_duration_part(@b, 'N'), @sign);
END
GO

-- tsq_duration_total_of: a duration (Temporal.Duration) given whole in one unit, as Temporal's total, with the year,
-- the month and the day of the date of reference (0, 0, 0 without one): tsq_duration_total of its parts; the function
-- of the library that writes it once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_duration_total_of(@d NVARCHAR(100), @y INT, @m INT, @dd INT, @unit VARCHAR(11)) RETURNS FLOAT WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_duration_total(dbo.tsq_duration_part(@d, 'M'), dbo.tsq_duration_part(@d, 'weeks'), dbo.tsq_duration_part(@d, 'days'), dbo.tsq_duration_part(@d, 'S'), dbo.tsq_duration_part(@d, 'N'), @y, @m, @dd, @unit);
END
GO

-- tsq_duration_round_of: the duration from one date or date and time to another rounded to the calendar, as
-- Temporal's until: tsq_duration_round of the year, the month, the day and the nanoseconds of the day of each one;
-- the function of the library that writes each one once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_duration_round_of(@one DATETIME2(7), @two DATETIME2(7), @largest VARCHAR(5), @smallest VARCHAR(11), @increment BIGINT, @mode VARCHAR(10), @negation INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_duration_round(YEAR(@one), MONTH(@one), DAY(@one), DATEDIFF_BIG(NANOSECOND, CAST('00:00' AS TIME), CAST(@one AS TIME)),
        YEAR(@two), MONTH(@two), DAY(@two), DATEDIFF_BIG(NANOSECOND, CAST('00:00' AS TIME), CAST(@two AS TIME)),
        @largest, @smallest, @increment, @mode, @negation);
END
GO

-- tsq_datetime_plus_duration and tsq_instant_plus_duration: a date and time or an instant (its date and time in UTC) plus a duration of the query given whole,
-- multiplied by sign (1 to add it, -1 to subtract it), as Temporal adds it: its years and months first, keeping the day in
-- the month, then its weeks and days, then its time; an instant takes only a duration of time; the functions of the
-- library that read the duration once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_datetime_plus_duration(@value DATETIME2(7), @duration NVARCHAR(100), @sign INT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    RETURN DATEADD(NANOSECOND, @sign * dbo.tsq_duration_part(@duration, 'N'), CAST(DATEADD(SECOND, @sign * dbo.tsq_duration_part(@duration, 'S') % 86400, DATEADD(DAY, (@sign * dbo.tsq_duration_part(@duration, 'D') + @sign * dbo.tsq_duration_part(@duration, 'S') / 86400), DATEADD(MONTH, @sign * dbo.tsq_duration_part(@duration, 'M'), @value))) AS DATETIME2(7)));
END
GO

CREATE OR ALTER FUNCTION dbo.tsq_instant_plus_duration(@value DATETIME2(7), @duration NVARCHAR(100), @sign INT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    -- A duration with days, weeks, months or years makes the query fail: the day 29 of February 2001, which it hasn't
    RETURN DATEADD(DAY, DAY(DATEFROMPARTS(2001, 2, CASE WHEN dbo.tsq_duration_part(@duration, 'M') <> 0 OR dbo.tsq_duration_part(@duration, 'D') <> 0 THEN 29 ELSE 28 END)) - 28, dbo.tsq_datetime_plus_duration(@value, @duration, @sign));
END
GO

-- tsq_duration_negated: the ISO 8601 text of a duration (Temporal.Duration) negated: without its minus, or with one; a
-- duration of zero as it is (Temporal writes it without sign); the function of the library that writes the text once
-- (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_duration_negated(@d NVARCHAR(100)) RETURNS NVARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    RETURN CASE WHEN SUBSTRING(@d, 1, 1) = N'-' THEN SUBSTRING(@d, 2, 100) WHEN dbo.tsq_duration_part(@d, 'sign') = 0 THEN @d WHEN SUBSTRING(@d, 1, 1) = N'+' THEN N'-' + SUBSTRING(@d, 2, 100) ELSE N'-' + @d END;
END
GO

-- tsq_day_in_month_or_error: 0, or an error when the day of a date (or a date and time) isn't in the month that the
-- months given reach from it, as Temporal's overflow 'reject' fails; the function of the library that writes the value
-- once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_day_in_month_or_error(@value DATETIME2(7), @months INT) RETURNS INT WITH SCHEMABINDING AS
BEGIN
    DECLARE @index INT = YEAR(@value) * 12 + MONTH(@value) - 1 + @months;
    RETURN DAY(DATEFROMPARTS(@index / 12, @index % 12 + 1, DAY(@value))) - DAY(@value);
END
GO

-- tsq_utc_of_epoch: the date and time in UTC of an instant given as a number of units since 1970-01-01T00:00Z, of the
-- nanoseconds given each (1000000 for milliseconds, 1 for nanoseconds), as Temporal's Instant.fromEpochMilliseconds and
-- fromEpochNanoseconds: the whole days rounded down and the rest of the day; the function of the library that writes the
-- number once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_utc_of_epoch(@value DECIMAL(38, 0), @unit_nanoseconds BIGINT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    DECLARE @total DECIMAL(38, 0) = @value * @unit_nanoseconds;
    DECLARE @rest DECIMAL(38, 0) = (@total % 86400000000000 + 86400000000000) % 86400000000000;
    RETURN DATEADD(NANOSECOND, @rest % 1000000000, DATEADD(SECOND, FLOOR(@rest / 1000000000), CAST(DATEADD(DAY, (@total - @rest) / 86400000000000, CAST('1970-01-01' AS DATE)) AS DATETIME2(7))));
END
GO

-- tsq_date_with: a date with the year, the month and the day given in place of its own (null keeps its own), as
-- Temporal's with: a day the month hasn't is its last day, or an error with reject (1); the function of the library that
-- writes the date once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_date_with(@value DATE, @year INT, @month INT, @day INT, @reject INT) RETURNS DATE WITH SCHEMABINDING AS
BEGIN
    IF @value IS NULL RETURN NULL;
    DECLARE @y INT = ISNULL(@year, YEAR(@value)), @m INT = ISNULL(@month, MONTH(@value)), @d INT = ISNULL(@day, DAY(@value));
    DECLARE @last INT = DAY(EOMONTH(DATEFROMPARTS(@y, @m, 1)));
    IF @d > @last AND @reject = 0 SET @d = @last;
    RETURN DATEFROMPARTS(@y, @m, @d);
END
GO

-- tsq_datetime_round: a date and time rounded to a step of hundreds of nanoseconds in a rounding mode of Temporal, as
-- Temporal's round of a PlainDateTime (and of an Instant, given its date and time in UTC): its time since midnight
-- rounded with tsq_round_to and added to its date, the next day for the end of the day; the function of the library that
-- writes the value once (libraryFunctions installed).
CREATE OR ALTER FUNCTION dbo.tsq_datetime_round(@value DATETIME2(7), @step BIGINT, @rounding_mode VARCHAR(10)) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_datetime_of_ticks(CAST(@value AS DATE), dbo.tsq_round_to(DATEDIFF_BIG(NANOSECOND, CAST('00:00' AS TIME), CAST(@value AS TIME)) / 100, @step, @rounding_mode));
END
GO
