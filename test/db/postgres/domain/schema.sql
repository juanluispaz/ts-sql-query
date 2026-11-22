-- Schema for the shared "project management" domain, postgres dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

DROP VIEW IF EXISTS project_overview;
DROP VIEW IF EXISTS release_overview;
DROP VIEW IF EXISTS col_matrix_view;
DROP TABLE IF EXISTS project_review CASCADE;
DROP TABLE IF EXISTS project_release CASCADE;
DROP TABLE IF EXISTS audit_entry CASCADE;
DROP TABLE IF EXISTS webhook_event CASCADE;
DROP TABLE IF EXISTS calendar_year CASCADE;
DROP TABLE IF EXISTS exact_amount CASCADE;
DROP TABLE IF EXISTS invoice CASCADE;
DROP TABLE IF EXISTS ledger_entry CASCADE;
DROP TABLE IF EXISTS issue_worklog CASCADE;
DROP TABLE IF EXISTS col_matrix CASCADE;
DROP TABLE IF EXISTS temporal_precision CASCADE;
DROP TABLE IF EXISTS duration_value CASCADE;
DROP TABLE IF EXISTS calendar_value CASCADE;
DROP TABLE IF EXISTS instant_value CASCADE;
DROP TABLE IF EXISTS zoned_value CASCADE;
DROP TABLE IF EXISTS country CASCADE;
DROP TABLE IF EXISTS issue CASCADE;
DROP TABLE IF EXISTS project CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;
DROP TABLE IF EXISTS organization CASCADE;

DROP TABLE IF EXISTS release_draft;

-- Non-deterministic ICU collation backing the case-insensitive levers on this dialect
-- (`insensitiveCollation` and per-value `.collate()` case-insensitive equality). PostgreSQL's
-- built-in collations are deterministic — they byte-tiebreak on equality — so a case-insensitive
-- EQUALITY needs a non-deterministic collation object; `und-u-ks-level2` folds case (keeps accents).
-- Non-deterministic collations are NOT supported by LIKE on PostgreSQL, so the insensitive-LIKE
-- levers over a forced collation remain NOT-APPLICABLE here.
DROP COLLATION IF EXISTS case_insensitive;
CREATE COLLATION case_insensitive (provider = icu, locale = 'und-u-ks-level2', deterministic = false);

CREATE TABLE organization (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(32) NOT NULL,
    -- `verified` flag stored as Y/N so the connection.ts mapping can
    -- exercise CustomBooleanTypeAdapter on a real seed column.
    verified VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    -- `verified` stored as Y/N — same CustomBooleanTypeAdapter mapping
    -- as organization.verified so cross-table comparisons need no remap.
    verified VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organization(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    -- `published` flag stored as t/f, a deliberately different
    -- CustomBooleanTypeAdapter mapping than organization/app_user.verified
    -- so column-vs-column comparisons hit the remap-with-case branch.
    published VARCHAR(1) NOT NULL DEFAULT 'f',
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
    -- New-type columns exercising AbstractConnection value marshalling:
    -- bigint (view_count), double (estimated_hours), uuid (external_ref).
    view_count BIGINT NOT NULL DEFAULT 0,
    estimated_hours DOUBLE PRECISION,
    external_ref UUID,
    UNIQUE (project_id, number)
);

CREATE TABLE country (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(32) NOT NULL
);

CREATE TABLE issue_worklog (
    id SERIAL PRIMARY KEY,
    issue_id INTEGER NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    started_at TIME,
    minutes INTEGER DEFAULT 0,
    duration_ms BIGINT,
    billable BOOLEAN,
    approved VARCHAR(1),
    -- billed amount per worklog (ownDouble 'Money') and an `invoiced`
    -- flag stored as int 1/0 (numeric CustomBooleanTypeAdapter overload).
    billed_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    invoiced INTEGER NOT NULL DEFAULT 0,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    activity VARCHAR(16) NOT NULL,
    -- Nullable DB-computed column (declared optionalComputedColumn).
    activity_label VARCHAR(16) GENERATED ALWAYS AS (CASE WHEN minutes IS NOT NULL THEN UPPER(activity) ELSE NULL END) STORED,
    tag_label VARCHAR(16) GENERATED ALWAYS AS (UPPER(activity)) STORED,
    tag_label_optional VARCHAR(16) GENERATED ALWAYS AS (CASE WHEN minutes IS NOT NULL THEN LOWER(activity) ELSE NULL END) STORED
);

-- Bigint autogenerated PK + enum-defaulted column.
CREATE TABLE webhook_event (
    id BIGSERIAL PRIMARY KEY,
    issue_id INTEGER NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
    event_type VARCHAR(16) NOT NULL DEFAULT 'created'
);

-- Int caller-provided PK.
CREATE TABLE calendar_year (
    year_value INTEGER PRIMARY KEY,
    year_label VARCHAR(64) NOT NULL
);

-- Exact numbers: a decimal (DecimalsType) of 30 significant digits, one with the scale 2, and an integer of 30 digits
-- (an IntegersType wider than 64 bits).
CREATE TABLE exact_amount (
    id INTEGER PRIMARY KEY,
    amount NUMERIC(38,10),
    price NUMERIC(10,2),
    units NUMERIC(30,0)
);

-- Int caller-provided PK carrying a scaling TypeAdapter (invoice_no stored x10).
CREATE TABLE invoice (
    invoice_no INTEGER PRIMARY KEY,
    total INTEGER NOT NULL
);

-- Every column factory carries its trailing-TypeAdapter overload.
-- entry_no autogenerated (plusOffsetAdapter, read +1000); amount/memo carry
-- scaledTenthAdapter (stored x10, read /10) over a DB DEFAULT; tag is virtual
-- (no DB column).
CREATE TABLE ledger_entry (
    entry_no SERIAL PRIMARY KEY,
    amount INTEGER NOT NULL DEFAULT 100,
    memo INTEGER DEFAULT 50,
    discount INTEGER
);

CREATE TABLE project_release (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES project(id),
    version VARCHAR(32) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    signing_key UUID,
    released_on DATE NOT NULL,
    cutoff_time TIME NOT NULL,
    signed_off_at TIMESTAMP,
    -- REQUIRED ownLocalDateTime twin of signed_off_at.
    published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- The time the rollout of the release took (a duration, Temporal.Duration)
    rollout_time INTERVAL,
    -- The instant the release was deployed (an instant, Temporal.Instant)
    deployed_at TIMESTAMPTZ,
    -- Plain-kind sources for the release_overview VIEW's per-kind read columns
    -- (boolean/bigint/double). uuid/localDate/localTime reuse signing_key/
    -- released_on/cutoff_time; the custom+adapter column reuses id.
    is_signed BOOLEAN,
    download_count BIGINT,
    avg_rating DOUBLE PRECISION,
    support_months INTEGER,
    notes VARCHAR(255) GENERATED ALWAYS AS ('release-' || version) STORED,
    UNIQUE (project_id, version)
);

-- Project review fixture: hosts the column-factory kinds the other tables
-- don't expose — a non-boolean per-column TypeAdapter on `score` (int, stored
-- ×10 fixed-point) and `reviewer_code` (string, bracketed on read), an OPTIONAL
-- plain `localDate` (review_date) and a REQUIRED plain `localTime` (review_time).
CREATE TABLE project_review (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES project(id),
    reviewer_code VARCHAR(32) NOT NULL,
    score INTEGER NOT NULL,
    review_date DATE,
    review_time TIME NOT NULL
);

-- Stored procedures and functions exercised by
-- `exec.procedure-function.test.ts`. Each body is intentionally
-- trivial: the tests only assert on the SQL the SqlBuilder emits and
-- the round-trip through the driver / `executeProcedure` /
-- `executeFunction` plumbing.

DROP PROCEDURE IF EXISTS refresh_stats();
DROP PROCEDURE IF EXISTS archive_project(integer, varchar);
DROP FUNCTION IF EXISTS count_open_issues(integer);
DROP FUNCTION IF EXISTS project_name(integer);

CREATE PROCEDURE refresh_stats()
LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$;

CREATE PROCEDURE archive_project(p_id integer, p_reason varchar)
LANGUAGE sql AS $$
    UPDATE project
       SET archived_at = CURRENT_TIMESTAMP,
           name        = name || ' [archived: ' || p_reason || ']'
     WHERE id = p_id
$$;

CREATE FUNCTION count_open_issues(p_id integer) RETURNS integer
LANGUAGE sql AS $$
    SELECT COUNT(*)::int FROM issue WHERE project_id = p_id AND status = 'open'
$$;

CREATE FUNCTION project_name(p_id integer) RETURNS varchar
LANGUAGE sql AS $$
    SELECT name FROM project WHERE id = p_id
$$;

DROP FUNCTION IF EXISTS total_view_count(integer);
DROP FUNCTION IF EXISTS latest_issue_at(integer);
DROP FUNCTION IF EXISTS estimated_total(integer);

CREATE FUNCTION total_view_count(p_id integer) RETURNS bigint
LANGUAGE sql AS $$ SELECT COALESCE(SUM(view_count), 0)::bigint FROM issue WHERE project_id = p_id $$;

CREATE FUNCTION latest_issue_at(p_id integer) RETURNS timestamp
LANGUAGE sql AS $$ SELECT MAX(created_at) FROM issue WHERE project_id = p_id $$;

CREATE FUNCTION estimated_total(p_id integer) RETURNS double precision
LANGUAGE sql AS $$ SELECT COALESCE(SUM(estimated_hours), 0)::double precision FROM issue WHERE project_id = p_id $$;

-- Null-propagating min/max helpers for the `libraryFunctions` (tsq_greatest_strict / tsq_least_strict)
-- opt-in (config.min-max-null-handling.test.ts). PostgreSQL's native `least` / `greatest`
-- IGNORE a NULL operand; these poison it to NULL instead, so a user who prefers the
-- function form over the CASE the builder emits by default can name them. `anycompatible`
-- keeps the operand's numeric type (int stays int, double stays double) — the same helper
-- the docs (postgresql.md) tell users to create.
DROP FUNCTION IF EXISTS tsq_greatest_strict(anycompatible, anycompatible);
DROP FUNCTION IF EXISTS tsq_least_strict(anycompatible, anycompatible);

CREATE FUNCTION tsq_greatest_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE greatest(a, b) END $$;

CREATE FUNCTION tsq_least_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE least(a, b) END $$;

-- Constant-returning functions, one per remaining executeFunction return kind
-- (boolean / uuid / date / time / and the varchar bases behind enum / custom /
-- ownComparable). Each takes an ignored int arg to keep the `select fn($1)`
-- call shape identical to the functions above.
DROP FUNCTION IF EXISTS ret_flag(integer);
DROP FUNCTION IF EXISTS ret_uuid(integer);
DROP FUNCTION IF EXISTS ret_day(integer);
DROP FUNCTION IF EXISTS ret_clock(integer);
DROP FUNCTION IF EXISTS ret_activity(integer);
DROP FUNCTION IF EXISTS ret_channel(integer);
DROP FUNCTION IF EXISTS ret_semver(integer);

CREATE FUNCTION ret_flag(p_id integer) RETURNS boolean
LANGUAGE sql AS $$ SELECT true $$;

CREATE FUNCTION ret_uuid(p_id integer) RETURNS uuid
LANGUAGE sql AS $$ SELECT CAST('0a8f9c1e-1111-4222-8333-444455556666' AS uuid) $$;

CREATE FUNCTION ret_day(p_id integer) RETURNS date
LANGUAGE sql AS $$ SELECT DATE '2024-02-03' $$;

CREATE FUNCTION ret_clock(p_id integer) RETURNS time
LANGUAGE sql AS $$ SELECT TIME '14:25:36' $$;

CREATE FUNCTION ret_activity(p_id integer) RETURNS varchar
LANGUAGE sql AS $$ SELECT CAST('coding' AS varchar) $$;

CREATE FUNCTION ret_channel(p_id integer) RETURNS varchar
LANGUAGE sql AS $$ SELECT CAST('stable' AS varchar) $$;

CREATE FUNCTION ret_semver(p_id integer) RETURNS varchar
LANGUAGE sql AS $$ SELECT CAST('1.0.0' AS varchar) $$;

-- Sequences exercised by `sequence.next-current-value.test.ts`.
-- `issueIdSeq` (typed `'int'`) reuses the sequence implicitly
-- created by `issue.id SERIAL` (PostgreSQL names it `issue_id_seq`);
-- dropping it explicitly would fail because `issue.id` depends on
-- it (2BP01). `auditTagSeq` (typed `'bigint'`) is independent and
-- created here. PostgreSQL sequences are 64-bit internally
-- regardless of the type hint, which only affects deserialization.

DROP SEQUENCE IF EXISTS audit_tag_seq;

CREATE SEQUENCE audit_tag_seq START 1;

DROP SEQUENCE IF EXISTS release_tag_seq;
CREATE SEQUENCE release_tag_seq START 1;

-- A class-based SQL view exercised by `view.basic.test.ts`. A plain
-- join of project + organization (no aggregation, no casts) so the
-- same shape is portable across every dialect.
CREATE TABLE audit_entry (
    id integer PRIMARY KEY,
    action VARCHAR(255) NOT NULL
);

CREATE VIEW project_overview AS
SELECT p.id AS id,
       p.organization_id AS organization_id,
       p.name AS name,
       p.archived_at AS archived_at,
       o.name AS organization_name,
       o.plan AS organization_plan
FROM project p
INNER JOIN organization o ON o.id = p.organization_id;

-- View side of the release columns (see vReleaseOverview in connection.ts).
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

-- release_draft: OPTIONAL enum/custom/ownComparable columns so the
-- Nullable family reaches a real NULL row. Caller-provided int PK (no identity).
CREATE TABLE release_draft (
    id INTEGER PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    stage VARCHAR(16),
    channel VARCHAR(16),
    min_version VARCHAR(32),
    budget DOUBLE PRECISION,
    target_day DATE,
    cutoff TIME,
    scaled_cost INTEGER NOT NULL DEFAULT 250,
    shifted_amount DOUBLE PRECISION NOT NULL DEFAULT 300,
    bracket_version VARCHAR(32) NOT NULL DEFAULT '2.0.0',
    bracket_channel VARCHAR(16) NOT NULL DEFAULT 'stable',
    bracket_activity VARCHAR(16) NOT NULL DEFAULT 'coding',
    shifted_stamp TIMESTAMP NOT NULL DEFAULT '2024-06-01 10:00:00',
    shifted_count BIGINT NOT NULL DEFAULT 5000,
    shifted_rating DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    bracket_signing_key UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000',
    shifted_release_day DATE NOT NULL DEFAULT '2025-03-01',
    shifted_cutoff TIME NOT NULL DEFAULT '09:00:00'
);

-- col_matrix: one plain, NOT NULL column per base value kind.
-- Every tColMatrix* Table class and the vColMatrix View read these SAME columns
-- through a DIFFERENT column factory (column / optionalColumn /
-- columnWithDefaultValue / optionalColumnWithDefaultValue / computedColumn /
-- optionalComputedColumn / primaryKey + View column / optionalColumn). The
-- optionality / default / computed / primary-key distinction is type-level only,
-- so a single plain row drives every factory's per-kind read path. Caller-provided
-- int PK (no identity) keeps the per-dialect reset trivial.
CREATE TABLE col_matrix (
    id INTEGER PRIMARY KEY,
    m_int INTEGER NOT NULL,
    m_bigint BIGINT NOT NULL,
    m_double DOUBLE PRECISION NOT NULL,
    m_bool BOOLEAN NOT NULL,
    m_uuid UUID NOT NULL,
    m_date DATE NOT NULL,
    m_time TIME NOT NULL,
    m_datetime TIMESTAMP NOT NULL,
    m_str VARCHAR(64) NOT NULL
);

-- temporal_precision: a single microsecond-precision localDateTime column. Its
-- seed instant (12:30:59.999600) cannot be reached by the const-based subsecond
-- test — a JS Date only carries milliseconds — so this column is the only way to
-- lock the date-part getters' SQL-side truncation on a real microsecond value:
-- getSeconds() must stay 59 (not round to 60) and getMilliseconds() must stay 999
-- (not round to 1000, nor wrap to 0). Caller-provided int PK keeps reset trivial.
CREATE TABLE temporal_precision (
    id INTEGER PRIMARY KEY,
    micro_stamp TIMESTAMP NOT NULL
);

-- duration_value: durations (Temporal.Duration) kept as the database can: span in its interval (of days to
-- seconds on Oracle) or ISO 8601 text, span_calendar with years and months, span_text as its ISO 8601 text.
CREATE TABLE duration_value (
    id INTEGER PRIMARY KEY,
    span INTERVAL NOT NULL,
    span_calendar INTERVAL,
    span_text VARCHAR(64)
);

-- calendar_value: a month of a year (plainYearMonth) and a day of a month (plainMonthDay) in the date of their reference
-- (the 1st of the month, the year 1972), and a date (plainDate) they are taken from: born_on.
CREATE TABLE calendar_value (
    id INTEGER PRIMARY KEY,
    month_of DATE NOT NULL,
    day_of DATE NOT NULL,
    born_on DATE NOT NULL
);

-- instant_value: exact moments (Temporal.Instant) in the columns a database has for them: instant_at in the one
-- recommended for an instant, wall_at without zone (its wall clock in UTC), session_at converted with the zone of the
-- session where the database has such a column (else as instant_at).
CREATE TABLE instant_value (
    id INTEGER PRIMARY KEY,
    instant_at TIMESTAMPTZ NOT NULL,
    wall_at TIMESTAMP,
    session_at TIMESTAMPTZ
);

-- zoned_value: exact moments in a time zone (Temporal.ZonedDateTime), which PostgreSQL computes: the instant instant_at
-- in the zone value_zone, and the same moment kept as its RFC 9557 text in zoned_at; wall_at a wall clock to take to a
-- zone, zone_name the name of a zone.
CREATE TABLE zoned_value (
    id INTEGER PRIMARY KEY,
    instant_at TIMESTAMPTZ NOT NULL,
    value_zone TEXT NOT NULL,
    wall_at TIMESTAMP,
    zone_name TEXT,
    zoned_at TEXT
);

-- View side of col_matrix — surfaces the same per-kind read marshalling through
-- the View column / optionalColumn factories (vColMatrix).
CREATE VIEW col_matrix_view AS
SELECT id, m_int, m_bigint, m_double, m_bool, m_uuid, m_date, m_time, m_datetime, m_str
FROM col_matrix;

-- One zero-arg function per base value kind, each returning the col_matrix row-1
-- value of that kind (executeFunction return-kind + trailing
-- adapter fan-out, exercised by `exec.function-value-kinds.test.ts`). Custom
-- kinds reuse the base-kind function (ownInt→cm_int, ownDouble→cm_double,
-- ownUuid→cm_uuid, ownLocalDate→cm_date, ownLocalTime→cm_time,
-- ownLocalDateTime→cm_datetime, enum/custom/ownComparable→cm_str). These
-- are declared AFTER col_matrix because a `LANGUAGE sql` body is parsed and
-- validated against the referenced table at CREATE time.
DROP FUNCTION IF EXISTS cm_int();
DROP FUNCTION IF EXISTS cm_bigint();
DROP FUNCTION IF EXISTS cm_double();
DROP FUNCTION IF EXISTS cm_bool();
DROP FUNCTION IF EXISTS cm_uuid();
DROP FUNCTION IF EXISTS cm_date();
DROP FUNCTION IF EXISTS cm_time();
DROP FUNCTION IF EXISTS cm_datetime();
DROP FUNCTION IF EXISTS cm_str();

CREATE FUNCTION cm_int() RETURNS integer
LANGUAGE sql AS $$ SELECT m_int FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_bigint() RETURNS bigint
LANGUAGE sql AS $$ SELECT m_bigint FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_double() RETURNS double precision
LANGUAGE sql AS $$ SELECT m_double FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_bool() RETURNS boolean
LANGUAGE sql AS $$ SELECT m_bool FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_uuid() RETURNS uuid
LANGUAGE sql AS $$ SELECT m_uuid FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_date() RETURNS date
LANGUAGE sql AS $$ SELECT m_date FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_time() RETURNS time
LANGUAGE sql AS $$ SELECT m_time FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_datetime() RETURNS timestamp
LANGUAGE sql AS $$ SELECT m_datetime FROM col_matrix WHERE id = 1 $$;

CREATE FUNCTION cm_str() RETURNS varchar
LANGUAGE sql AS $$ SELECT m_str FROM col_matrix WHERE id = 1 $$;

-- tsq_duration_part: a part of the ISO 8601 text of a duration (Temporal.Duration), the function of the library that
-- reads a duration kept as text: 'M' the months (its years too), 'D' the days (its weeks too), 'S' the whole seconds of
-- its time, 'N' the nanoseconds of the second, to add or subtract it; 'years', 'months', 'weeks', 'days', 'hours',
-- 'minutes' and 'seconds' (without its fraction) each field as written; each with the sign of the duration; 'sign' the
-- sign of the duration (-1, 0 or 1); 'largest' the largest field that isn't zero (0 the years, 1 the months, 2 the weeks,
-- 3 the days, 4 the hours, 5 the minutes, 6 the seconds, 7 the milliseconds, 8 the microseconds, 9 the nanoseconds; 10
-- for a duration of zero).
CREATE OR REPLACE FUNCTION tsq_duration_part(d text, part text) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    s text;
    i integer := 1;
    n integer;
    c text;
    num text := '';
    in_time boolean := false;
    sgn integer := 1;
    r bigint := 0;
    nonzero boolean := false;
    lg integer := 10;
    f bigint;
BEGIN
    IF d IS NULL THEN RETURN NULL; END IF;
    s := upper(trim(d));
    n := length(s);
    IF substr(s, 1, 1) = '-' THEN sgn := -1; i := 2; ELSIF substr(s, 1, 1) = '+' THEN i := 2; END IF;
    i := i + 1;
    WHILE i <= n LOOP
        c := substr(s, i, 1);
        IF c = 'T' THEN in_time := true;
        ELSIF position(c in '0123456789.,') > 0 THEN num := num || CASE WHEN c = ',' THEN '.' ELSE c END;
        ELSE
            IF translate(num, '0.', '') <> '' THEN
                nonzero := true;
                f := rpad(split_part(num, '.', 2), 9, '0')::bigint;
                lg := least(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                    WHEN split_part(num, '.', 1)::bigint <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
            END IF;
            IF part = 'M' AND NOT in_time AND c = 'Y' THEN r := r + 12 * num::bigint;
            ELSIF part = 'M' AND NOT in_time AND c = 'M' THEN r := r + num::bigint;
            ELSIF part = 'D' AND c = 'W' THEN r := r + 7 * num::bigint;
            ELSIF part = 'D' AND c = 'D' THEN r := r + num::bigint;
            ELSIF part = 'S' AND in_time AND c = 'H' THEN r := r + 3600 * num::bigint;
            ELSIF part = 'S' AND in_time AND c = 'M' THEN r := r + 60 * num::bigint;
            ELSIF part = 'S' AND c = 'S' THEN r := r + split_part(num, '.', 1)::bigint;
            ELSIF part = 'N' AND c = 'S' AND position('.' in num) > 0 THEN r := rpad(split_part(num, '.', 2), 9, '0')::bigint;
            ELSIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN r := split_part(num, '.', 1)::bigint;
            END IF;
            num := '';
        END IF;
        i := i + 1;
    END LOOP;
    IF part = 'sign' THEN RETURN CASE WHEN nonzero THEN sgn ELSE 0 END; END IF;
    IF part = 'largest' THEN RETURN lg; END IF;
    RETURN sgn * r;
END;
$$;

-- tsq_duration_round: the duration from one date and time to another (the year, month, day and nanoseconds of the day
-- of each one; a date is at 00:00) as Temporal's until with a largest unit of weeks, months or years ('week', 'month',
-- 'year') rounded to the smallest unit, increment and mode given, the function of the library that rounds a difference
-- to the calendar (counting from the first date, as Temporal does); since passes its mode negated and -1 to negate the
-- result.
CREATE OR REPLACE FUNCTION tsq_duration_round(y1 integer, m1 integer, d1 integer, ns1 bigint, y2 integer, m2 integer, d2 integer, ns2 bigint, largest_unit text, smallest_unit text, increment bigint, rounding_mode text, negation integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    day_ns CONSTANT bigint := 86400000000000;
    one date := make_date(y1, m1, d1);
    two date := make_date(y2, m2, d2);
    adjusted date := make_date(y2, m2, d2);
    t bigint := ns2 - ns1;
    k integer;
    years bigint := 0;
    months bigint := 0;
    weeks bigint := 0;
    days bigint;
    sgn bigint;
    um text;
    r1 bigint;
    start_day date;
    end_day date;
    num numeric;
    den numeric;
    whole numeric;
    rest numeric;
    steps bigint;
    step bigint;
    to_round bigint;
    rounded bigint;
BEGIN
    IF t > 0 AND two < one THEN
        adjusted := two + 1;
        t := t - day_ns;
    ELSIF t < 0 AND two > one THEN
        adjusted := two - 1;
        t := t + day_ns;
    END IF;
    IF largest_unit = 'week' THEN
        weeks := (adjusted - one) / 7;
        days := (adjusted - one) - weeks * 7;
    ELSE
        k := ((extract(year from adjusted)::integer * 12 + extract(month from adjusted)::integer) * 32 + extract(day from adjusted)::integer - (y1 * 12 + m1) * 32 - d1) / 32;
        IF largest_unit = 'year' THEN
            years := k / 12;
        END IF;
        months := k - years * 12;
        days := adjusted - (one + make_interval(months => k))::date;
    END IF;
    sgn := CASE WHEN two < one OR two = one AND ns2 < ns1 THEN -1 ELSE 1 END;
    um := CASE rounding_mode
        WHEN 'ceil' THEN CASE WHEN sgn < 0 THEN 'zero' ELSE 'infinity' END
        WHEN 'floor' THEN CASE WHEN sgn < 0 THEN 'infinity' ELSE 'zero' END
        WHEN 'halfCeil' THEN CASE WHEN sgn < 0 THEN 'halfZero' ELSE 'halfInfinity' END
        WHEN 'halfFloor' THEN CASE WHEN sgn < 0 THEN 'halfInfinity' ELSE 'halfZero' END
        WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
        ELSE 'halfEven' END;
    IF smallest_unit IN ('year', 'month', 'week') THEN
        IF smallest_unit = 'year' THEN
            r1 := years / increment * increment;
            start_day := (one + make_interval(months => (r1 * 12)::integer))::date;
            end_day := (one + make_interval(months => ((r1 + increment * sgn) * 12)::integer))::date;
        ELSIF smallest_unit = 'month' THEN
            r1 := months / increment * increment;
            start_day := (one + make_interval(months => (years * 12 + r1)::integer))::date;
            end_day := (one + make_interval(months => (years * 12 + r1 + increment * sgn)::integer))::date;
        ELSE
            r1 := (CASE WHEN largest_unit = 'week' THEN weeks ELSE days / 7 END) / increment * increment;
            start_day := (one + make_interval(months => (years * 12 + months)::integer))::date + (r1 * 7)::integer;
            end_day := (one + make_interval(months => (years * 12 + months)::integer))::date + ((r1 + increment * sgn) * 7)::integer;
        END IF;
        num := abs((two - start_day)::numeric * day_ns + ns2 - ns1);
        den := abs((end_day - start_day)::numeric * day_ns);
        whole := div(num, den);
        rest := num - whole * den;
        steps := whole + CASE WHEN rest <> 0 AND (um = 'infinity' OR um LIKE 'half%' AND (2 * rest > den OR 2 * rest = den AND (um = 'halfInfinity' OR um = 'halfEven' AND (abs(r1) / increment + whole) % 2 <> 0))) THEN 1 ELSE 0 END;
        days := 0;
        t := 0;
        IF smallest_unit = 'year' THEN
            years := r1 + increment * sgn * steps;
            months := 0;
        ELSIF smallest_unit = 'month' THEN
            months := r1 + increment * sgn * steps;
            IF steps > 0 AND largest_unit = 'year' AND sgn * ((one + make_interval(months => (years * 12 + months)::integer))::date - (one + make_interval(months => ((years + sgn) * 12)::integer))::date) >= 0 THEN
                years := years + sgn;
                months := 0;
            END IF;
        ELSE
            weeks := r1 + increment * sgn * steps;
        END IF;
    ELSE
        step := CASE smallest_unit WHEN 'day' THEN day_ns WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
        to_round := days * day_ns + t;
        rest := abs(to_round % step);
        rounded := to_round - to_round % step;
        IF rest <> 0 AND (um = 'infinity' OR um LIKE 'half%' AND (2 * rest > step OR 2 * rest = step AND (um = 'halfInfinity' OR um = 'halfEven' AND (rounded / step) % 2 <> 0))) THEN
            rounded := rounded + step * sgn;
        END IF;
        days := rounded / day_ns;
        t := rounded - days * day_ns;
        IF rounded / day_ns <> to_round / day_ns THEN
            IF largest_unit = 'week' THEN
                IF sgn * ((two - (one + ((weeks + sgn) * 7)::integer))::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                    weeks := weeks + sgn;
                    days := 0;
                    t := 0;
                END IF;
            ELSIF sgn * ((two - (one + make_interval(months => (years * 12 + months + sgn)::integer))::date)::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                days := 0;
                t := 0;
                IF largest_unit = 'year' AND sgn * ((two - (one + make_interval(months => ((years + sgn) * 12)::integer))::date)::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                    years := years + sgn;
                    months := 0;
                ELSE
                    months := months + sgn;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN make_interval(years => (years * negation)::integer, months => (months * negation)::integer, weeks => (weeks * negation)::integer, days => (days * negation)::integer, secs => t * negation / 1000000000.0);
END
$$;

-- tsq_zoned_of_wall: the instant of a wall clock in a zone (a name or an offset like '+05:30'), as Temporal
-- disambiguates it ('compatible', 'earlier', 'later', or 'reject', an error for a wall clock the zone repeats or skips);
-- with a preferred offset, the wall clock with it when the zone gives it back with it (Temporal's offset 'prefer');
-- tsq_zoned_until: the duration from one zoned date and time to another (each one its instant and the name of its
-- zone, the same one) as Temporal's until with a largest unit of days or larger ('day', 'week', 'month', 'year'),
-- rounded to the smallest unit, increment and mode given, the functions of the library that count the days of the
-- calendar in the zone, each one with its length there (23 or 25 hours where the zone changes its offset); since passes
-- its mode negated and -1 to negate the result. Two zones that aren't the same are an error, as in Temporal.

CREATE OR REPLACE FUNCTION tsq_zoned_of_wall(wall timestamp, zone text, disambiguation text, preferred_offset interval DEFAULT NULL) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    -- An offset like '+05:30' is read by PostgreSQL as a POSIX zone, west of UTC: its sign inverted
    v_zone text := CASE WHEN zone ~ '^[+-]' THEN translate(zone, '+-', '-+') ELSE zone END;
    v_before timestamp;
    v_after timestamp;
    v_is_before boolean;
    v_is_after boolean;
BEGIN
    IF wall IS NULL OR zone IS NULL OR disambiguation IS NULL THEN
        RETURN NULL;
    END IF;
    IF preferred_offset IS NOT NULL AND (((wall - preferred_offset) AT TIME ZONE 'UTC') AT TIME ZONE v_zone) = wall THEN
        RETURN (wall - preferred_offset) AT TIME ZONE 'UTC';
    END IF;
    -- The wall clock minus the offset of the zone a day before and a day after it: an instant of it when the zone gives
    -- it back (two for a wall clock it repeats, none for one it skips)
    v_before := wall - ((((wall - interval '1 day') AT TIME ZONE 'UTC') AT TIME ZONE v_zone) - (wall - interval '1 day'));
    v_after := wall - ((((wall + interval '1 day') AT TIME ZONE 'UTC') AT TIME ZONE v_zone) - (wall + interval '1 day'));
    v_is_before := ((v_before AT TIME ZONE 'UTC') AT TIME ZONE v_zone) = wall;
    v_is_after := ((v_after AT TIME ZONE 'UTC') AT TIME ZONE v_zone) = wall;
    IF disambiguation = 'reject' AND v_is_before = v_is_after AND (NOT v_is_before OR v_before <> v_after) THEN
        RAISE EXCEPTION 'tsq_zoned_of_wall: % is not one instant in %', wall, zone;
    END IF;
    IF disambiguation = 'later' THEN
        RETURN (CASE WHEN v_is_after THEN v_after ELSE v_before END) AT TIME ZONE 'UTC';
    ELSIF disambiguation = 'compatible' THEN
        RETURN (CASE WHEN v_is_before OR NOT v_is_after THEN v_before ELSE v_after END) AT TIME ZONE 'UTC';
    END IF;
    RETURN (CASE WHEN v_is_before THEN v_before ELSE v_after END) AT TIME ZONE 'UTC';
END $$;

CREATE OR REPLACE FUNCTION tsq_zoned_until(one timestamptz, one_zone text, two timestamptz, two_zone text, largest_unit text, smallest_unit text, increment bigint, rounding_mode text, negation integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    -- An offset like '+05:30' is read by PostgreSQL as a POSIX zone, west of UTC: its sign inverted
    v_zone text := CASE WHEN one_zone ~ '^[+-]' THEN translate(one_zone, '+-', '-+') ELSE one_zone END;
    v_u1 timestamp;
    v_u2 timestamp;
    v_w1 timestamp;
    v_w2 timestamp;
    v_d1 date;
    v_t1 interval;
    v_sign integer;
    v_years bigint := 0;
    v_months bigint := 0;
    v_weeks bigint := 0;
    v_days bigint := 0;
    v_t numeric := 0;
    v_inter date;
    v_correction integer;
    v_found boolean := false;
    v_m bigint;
    v_r1 bigint;
    v_start timestamp;
    v_end timestamp;
    v_nudged timestamp;
    v_num numeric;
    v_den numeric;
    v_mode text;
    v_rounded numeric;
    v_step numeric;
    v_beyond numeric;
    v_q numeric;
    v_low numeric;
    v_up boolean;
    v_expanded boolean := false;
    v_unit integer;
    v_largest integer;
    v_ey bigint;
    v_em bigint;
    v_ew bigint;
    v_pass integer;
BEGIN
    IF one IS NULL OR one_zone IS NULL OR two IS NULL OR two_zone IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
    IF upper(one_zone) <> upper(two_zone) THEN
        RAISE EXCEPTION 'tsq_zoned_until: a difference in days or larger units needs both zoned dates and times in the same time zone';
    END IF;
    v_u1 := one AT TIME ZONE 'UTC';
    v_u2 := two AT TIME ZONE 'UTC';
    IF v_u1 = v_u2 THEN
        RETURN interval '0';
    END IF;
    v_w1 := (v_u1 AT TIME ZONE 'UTC') AT TIME ZONE v_zone;
    v_w2 := (v_u2 AT TIME ZONE 'UTC') AT TIME ZONE v_zone;
    v_d1 := v_w1::date;
    v_t1 := v_w1 - v_d1::timestamp;
    v_sign := CASE WHEN v_u2 < v_u1 THEN -1 ELSE 1 END;
    -- Temporal's DifferenceZonedDateTime: the days of the calendar to a day of the second at the time of the first that
    -- doesn't pass it, and the exact time from there
    IF v_w2::date = v_d1 THEN
        v_t := extract(epoch from v_u2 - v_u1) * 1000000000;
    ELSE
        v_correction := CASE WHEN sign(extract(epoch from (v_w2 - v_w2::date::timestamp) - v_t1)) = -v_sign THEN 1 ELSE 0 END;
        WHILE v_correction <= CASE WHEN v_sign = 1 THEN 2 ELSE 1 END AND NOT v_found LOOP
            v_inter := v_w2::date - v_correction * v_sign;
            v_t := extract(epoch from v_u2 - (tsq_zoned_of_wall(v_inter + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC')) * 1000000000;
            IF sign(v_t) <> -v_sign THEN v_found := true; END IF;
            v_correction := v_correction + 1;
        END LOOP;
        -- Temporal's CalendarDateUntil: the whole months from the first date that don't pass the other one (the day of the
        -- first not kept in the month), then the days
        IF largest_unit IN ('year', 'month') THEN
            v_m := (extract(year from v_inter) * 12 + extract(month from v_inter)) - (extract(year from v_d1) * 12 + extract(month from v_d1));
            IF v_sign > 0 AND extract(day from v_d1) > extract(day from v_inter) THEN v_m := v_m - 1; END IF;
            IF v_sign < 0 AND extract(day from v_d1) < extract(day from v_inter) THEN v_m := v_m + 1; END IF;
            IF largest_unit = 'year' THEN v_years := trunc(v_m / 12.0); END IF;
            v_months := v_m - v_years * 12;
        END IF;
        v_days := v_inter - (v_d1 + make_interval(months => (v_years * 12 + v_months)::integer))::date;
        IF largest_unit = 'week' THEN
            v_weeks := trunc(v_days / 7.0);
            v_days := v_days - v_weeks * 7;
        END IF;
    END IF;
    -- Temporal's RoundRelativeDuration
    IF smallest_unit <> 'nanosecond' OR increment <> 1 THEN
        v_mode := CASE rounding_mode
            WHEN 'ceil' THEN CASE WHEN v_sign < 0 THEN 'zero' ELSE 'infinity' END
            WHEN 'floor' THEN CASE WHEN v_sign < 0 THEN 'infinity' ELSE 'zero' END
            WHEN 'halfCeil' THEN CASE WHEN v_sign < 0 THEN 'halfZero' ELSE 'halfInfinity' END
            WHEN 'halfFloor' THEN CASE WHEN v_sign < 0 THEN 'halfInfinity' ELSE 'halfZero' END
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
        IF smallest_unit IN ('year', 'month', 'week', 'day') THEN
            -- NudgeToCalendarUnit: between the duration truncated to the unit and one increment more, by the instants
            IF smallest_unit = 'year' THEN
                v_r1 := trunc(v_years / increment::numeric) * increment;
                v_ey := v_r1; v_em := 0; v_ew := 0; v_m := 0;
            ELSIF smallest_unit = 'month' THEN
                v_r1 := trunc(v_months / increment::numeric) * increment;
                v_ey := v_years; v_em := v_r1; v_ew := 0; v_m := 0;
            ELSIF smallest_unit = 'week' THEN
                v_r1 := trunc((v_weeks + trunc(v_days / 7.0)) / increment::numeric) * increment;
                v_ey := v_years; v_em := v_months; v_ew := v_r1; v_m := 0;
            ELSE
                v_r1 := trunc(v_days / increment::numeric) * increment;
                v_ey := v_years; v_em := v_months; v_ew := v_weeks; v_m := v_r1;
            END IF;
            -- The start and the end: the first wall clock plus the duration truncated, and plus one increment more
            v_start := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_ey * 12 + v_em)::integer))::date + (v_ew * 7 + v_m)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            IF smallest_unit = 'year' THEN v_ey := v_ey + increment * v_sign;
            ELSIF smallest_unit = 'month' THEN v_em := v_em + increment * v_sign;
            ELSIF smallest_unit = 'week' THEN v_ew := v_ew + increment * v_sign;
            ELSE v_m := v_m + increment * v_sign;
            END IF;
            v_end := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_ey * 12 + v_em)::integer))::date + (v_ew * 7 + v_m)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            v_num := abs(extract(epoch from v_u2 - v_start));
            v_den := abs(extract(epoch from v_end - v_start));
            v_up := v_num <> 0 AND (v_num = v_den OR v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_num > v_den OR 2 * v_num = v_den AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND mod(abs(v_r1) / increment, 2) <> 0)));
            IF v_up THEN
                v_expanded := true;
                v_r1 := v_r1 + increment * v_sign;
                v_nudged := v_end;
            ELSE
                v_nudged := v_start;
            END IF;
            IF smallest_unit = 'year' THEN
                v_years := v_r1; v_months := 0; v_weeks := 0; v_days := 0;
            ELSIF smallest_unit = 'month' THEN
                v_months := v_r1; v_weeks := 0; v_days := 0;
            ELSIF smallest_unit = 'week' THEN
                v_weeks := v_r1; v_days := 0;
            ELSE
                v_days := v_r1;
            END IF;
            v_t := 0;
        ELSE
            -- NudgeToZonedTime: the time rounded in the day it is in, which may round to the next day (of its length there)
            v_step := CASE smallest_unit WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
            v_start := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_years * 12 + v_months)::integer))::date + (v_weeks * 7 + v_days)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            v_end := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_years * 12 + v_months)::integer))::date + (v_weeks * 7 + v_days + v_sign)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            v_pass := 0;
            v_beyond := v_t;
            -- The time rounded (Temporal's RoundNumberToIncrement), and again beyond the day when it reaches its end
            LOOP
                v_q := abs(v_beyond) / v_step;
                v_low := floor(v_q);
                v_mode := CASE rounding_mode
                    WHEN 'ceil' THEN CASE WHEN v_beyond < 0 THEN 'zero' ELSE 'infinity' END
                    WHEN 'floor' THEN CASE WHEN v_beyond < 0 THEN 'infinity' ELSE 'zero' END
                    WHEN 'halfCeil' THEN CASE WHEN v_beyond < 0 THEN 'halfZero' ELSE 'halfInfinity' END
                    WHEN 'halfFloor' THEN CASE WHEN v_beyond < 0 THEN 'halfInfinity' ELSE 'halfZero' END
                    WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
                    ELSE 'halfEven' END;
                v_up := v_q <> v_low AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * (v_q - v_low) > 1 OR 2 * (v_q - v_low) = 1 AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND mod(v_low, 2) <> 0)));
                v_rounded := sign(v_beyond) * (v_low + CASE WHEN v_up THEN 1 ELSE 0 END) * v_step;
                EXIT WHEN v_pass = 1;
                v_beyond := v_rounded - extract(epoch from v_end - v_start) * 1000000000;
                IF sign(v_beyond) = -v_sign THEN
                    v_nudged := v_start + make_interval(secs => v_rounded / 1000000000);
                    EXIT;
                END IF;
                v_expanded := true;
                v_days := v_days + v_sign;
                v_pass := 1;
            END LOOP;
            IF v_pass = 1 THEN
                v_nudged := v_end + make_interval(secs => v_rounded / 1000000000);
            END IF;
            v_t := v_rounded;
        END IF;
        -- BubbleRelativeDuration: a unit that reached the next larger one gives it, up to the largest unit
        IF v_expanded AND smallest_unit <> 'week' THEN
            v_largest := CASE largest_unit WHEN 'year' THEN 0 WHEN 'month' THEN 1 WHEN 'week' THEN 2 ELSE 3 END;
            v_unit := CASE smallest_unit WHEN 'year' THEN 0 WHEN 'month' THEN 1 WHEN 'week' THEN 2 ELSE 3 END - 1;
            WHILE v_unit >= v_largest LOOP
                IF v_unit <> 2 OR v_largest = 2 THEN
                    v_ey := v_years; v_em := v_months; v_ew := v_weeks;
                    IF v_unit = 0 THEN
                        v_ey := v_years + v_sign; v_em := 0; v_ew := 0;
                    ELSIF v_unit = 1 THEN
                        v_em := v_months + v_sign; v_ew := 0;
                    ELSE
                        v_ew := v_weeks + v_sign;
                    END IF;
                    IF sign(extract(epoch from v_nudged - (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_ey * 12 + v_em)::integer))::date + (v_ew * 7)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC'))) = -v_sign THEN
                        EXIT;
                    END IF;
                    v_years := v_ey; v_months := v_em; v_weeks := v_ew; v_days := 0; v_t := 0;
                END IF;
                v_unit := v_unit - 1;
            END LOOP;
        END IF;
    END IF;
    RETURN make_interval(years => (v_years * negation)::integer, months => (v_months * negation)::integer, weeks => (v_weeks * negation)::integer, days => (v_days * negation)::integer, secs => v_t * negation / 1000000000.0);
END $$;

-- tsq_duration_total: a duration (its months, its years too; its weeks; its days; the whole seconds of its time and the
-- nanoseconds of the second, each with the sign of the duration) in a unit ('year' ... 'nanosecond'), the function of
-- the library that gives Temporal's total. With a date of reference (its year, month and day; 0, 0, 0 without one) the
-- duration is added to it, the months first with the day kept in the month, and the unit is counted from it, a month or
-- a year with the days of the calendar there; without one a day is 24 hours, and a duration with months or weeks, or a
-- unit of them, is an error. The double is the quotient rounded once, as Temporal's.
CREATE OR REPLACE FUNCTION tsq_duration_total(months bigint, weeks bigint, days bigint, seconds bigint, nanoseconds bigint, y integer, m integer, d integer, unit text) RETURNS double precision LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    day_ns CONSTANT numeric := 86400000000000;
    unit_ns CONSTANT numeric := CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
    t numeric := seconds * 1000000000::numeric + nanoseconds;
    time_of_day numeric;
    one date;
    two date;
    adjusted date;
    sgn integer;
    k integer;
    r1 integer;
    start_day date;
    end_day date;
    a numeric;
    b numeric;
    x numeric;
    s integer := 0;
    q numeric;
    rest numeric;
BEGIN
    IF m = 0 THEN
        IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
            RAISE EXCEPTION 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference';
        END IF;
        a := days * day_ns + t;
        b := unit_ns;
    ELSE
        -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
        time_of_day := mod(t, day_ns);
        IF time_of_day < 0 THEN
            time_of_day := time_of_day + day_ns;
        END IF;
        one := make_date(y, m, d);
        two := (one + make_interval(months => months::integer))::date + (weeks * 7 + days + (t - time_of_day) / day_ns)::integer;
        IF unit NOT IN ('year', 'month', 'week') THEN
            a := (two - one) * day_ns + time_of_day;
            b := unit_ns;
        ELSE
            IF two = one AND time_of_day = 0 THEN
                RETURN 0;
            END IF;
            -- The whole units to the end without passing it (as until), and the progress to the next one
            adjusted := CASE WHEN time_of_day > 0 AND two < one THEN two + 1 ELSE two END;
            sgn := CASE WHEN (two - one) * day_ns + time_of_day < 0 THEN -1 ELSE 1 END;
            IF unit = 'week' THEN
                r1 := (adjusted - one) / 7;
            ELSE
                k := ((extract(year from adjusted)::integer * 12 + extract(month from adjusted)::integer) * 32 + extract(day from adjusted)::integer - (y * 12 + m) * 32 - d) / 32;
                r1 := CASE WHEN unit = 'month' THEN k ELSE k / 12 END;
            END IF;
            start_day := CASE WHEN unit = 'week' THEN one + 7 * r1 ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 ELSE 12 * r1 END))::date END;
            end_day := CASE WHEN unit = 'week' THEN one + 7 * (r1 + sgn) ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 + sgn ELSE 12 * (r1 + sgn) END))::date END;
            IF abs((two - start_day) * day_ns + time_of_day) >= abs((end_day - start_day) * day_ns) THEN
                -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                r1 := r1 + sgn;
                start_day := end_day;
                end_day := CASE WHEN unit = 'week' THEN one + 7 * (r1 + sgn) ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 + sgn ELSE 12 * (r1 + sgn) END))::date END;
            END IF;
            b := abs((end_day - start_day) * day_ns);
            a := r1 * b + sgn * abs((two - start_day) * day_ns + time_of_day);
        END IF;
    END IF;
    -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
    IF a = 0 THEN
        RETURN 0;
    END IF;
    x := abs(a);
    WHILE x >= b * 9007199254740992 LOOP
        b := b * 2;
        s := s - 1;
    END LOOP;
    WHILE x < b * 4503599627370496 LOOP
        x := x * 2;
        s := s + 1;
    END LOOP;
    q := div(x, b);
    rest := x - q * b;
    IF 2 * rest > b OR 2 * rest = b AND mod(q, 2) = 1 THEN
        q := q + 1;
    END IF;
    RETURN CASE WHEN a < 0 THEN -1 ELSE 1 END * q::double precision * power(2::double precision, -s);
END
$$;

-- tsq_duration_add: the sum of two durations, the second times sign (1 to add it, -1 to subtract it), each given by its
-- largest field that isn't zero (tsq_duration_part 'largest'), its days, the whole seconds of its time and the
-- nanoseconds of the second, each with its sign; the function of the library that adds and subtracts durations as
-- Temporal's add and subtract: a duration with years, months or weeks is an error, a day is 24 hours, and the sum is
-- balanced up to the largest field of the two (days and a time, or a time in hours, in minutes or in seconds).
CREATE OR REPLACE FUNCTION tsq_duration_add(largest1 bigint, days1 bigint, seconds1 bigint, nanoseconds1 bigint, largest2 bigint, days2 bigint, seconds2 bigint, nanoseconds2 bigint, sgn integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    day_ns CONSTANT numeric := 86400000000000;
    largest bigint := least(largest1, largest2);
    total numeric := (days1 + sgn * days2) * day_ns + (seconds1 + sgn * seconds2) * 1000000000::numeric + nanoseconds1 + sgn * nanoseconds2;
    days numeric := 0;
    t numeric;
BEGIN
    IF largest <= 2 THEN
        RAISE EXCEPTION 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted';
    END IF;
    IF largest = 3 THEN
        days := div(total, day_ns);
    END IF;
    t := total - days * day_ns;
    RETURN make_interval(days => days::integer, secs => div(t, 1000000000)::double precision) + make_interval(secs => mod(t, 1000000000) / 1000000000.0);
END
$$;

-- tsq_zone: a zone of Temporal (a name, or an offset like '+05:30') as `at time zone` takes it, which reads a text like
-- '+05:30' as a POSIX zone, west of UTC: the sign of an offset inverted; the function of the library that writes the
-- zone of a value of the query once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_zone(zone text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN zone ~ '^[+-]' THEN translate(zone, '+-', '-+') ELSE zone END
$$;

-- tsq_zoned_offset: the offset of an instant in a zone of Temporal, as Temporal writes it: '+01:00', with its seconds
-- when it has them ('-00:14:44'); the function of the library that writes it once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_zoned_offset(instant timestamptz, zone text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN o.s < 0 THEN '-' ELSE '+' END || lpad((abs(o.s) / 3600)::text, 2, '0') || ':' || lpad((abs(o.s) / 60 % 60)::text, 2, '0')
        || CASE WHEN abs(o.s) % 60 <> 0 THEN ':' || lpad((abs(o.s) % 60)::text, 2, '0') ELSE '' END
    FROM (SELECT extract(epoch FROM (instant AT TIME ZONE tsq_zone(zone)) - (instant AT TIME ZONE 'UTC'))::integer AS s) o
$$;

-- tsq_round_to: an integer rounded to a multiple of a step (a positive integer) in a rounding mode of Temporal
-- ('ceil', 'floor', 'expand', 'trunc', 'halfCeil', 'halfFloor', 'halfExpand', 'halfTrunc', 'halfEven'), as Temporal
-- rounds a difference or a time of the day; the function of the library that writes the integer once
-- (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_round_to(value numeric, step numeric, rounding_mode text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    q numeric := div(value, step);
    r numeric := value - q * step;
    away numeric := q + sign(value);
BEGIN
    IF r = 0 THEN RETURN value; END IF;
    RETURN step * CASE
        WHEN rounding_mode = 'trunc' THEN q
        WHEN rounding_mode = 'floor' THEN CASE WHEN value < 0 THEN away ELSE q END
        WHEN rounding_mode = 'ceil' THEN CASE WHEN value > 0 THEN away ELSE q END
        WHEN rounding_mode = 'expand' THEN away
        WHEN 2 * abs(r) > step THEN away
        WHEN 2 * abs(r) < step THEN q
        WHEN rounding_mode = 'halfExpand' THEN away
        WHEN rounding_mode = 'halfTrunc' THEN q
        WHEN rounding_mode = 'halfCeil' THEN CASE WHEN value > 0 THEN away ELSE q END
        WHEN rounding_mode = 'halfFloor' THEN CASE WHEN value < 0 THEN away ELSE q END
        WHEN mod(q, 2) = 0 THEN q
        ELSE away
    END;
END $$;

-- tsq_zoned_hours_in_day: the hours from the start of the day of a zoned date and time to the start of the next one,
-- in its zone, as Temporal's hoursInDay: 23 or 25 where the zone changes its offset that day; the function of the
-- library that writes the value once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_zoned_hours_in_day(instant timestamptz, zone text) RETURNS double precision LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    wall timestamp := date_trunc('day', instant AT TIME ZONE tsq_zone(zone));
BEGIN
    RETURN (extract(epoch FROM tsq_zoned_of_wall(wall + interval '1 day', zone, 'compatible') - tsq_zoned_of_wall(wall, zone, 'compatible')) / 3600)::float8;
END $$;

-- tsq_zoned_round_day: a zoned date and time rounded to a day in its zone, as Temporal's round('day'): the start of its
-- day or of the next one, the nearer one by the length of its day ('trunc', 'ceil', 'halfExpand', 'halfTrunc',
-- 'halfEven'); the function of the library that writes the value once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_zoned_round_day(instant timestamptz, zone text, rounding_mode text) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    wall timestamp := date_trunc('day', instant AT TIME ZONE tsq_zone(zone));
    start_of_day timestamptz := tsq_zoned_of_wall(wall, zone, 'compatible');
    next_day timestamptz;
BEGIN
    IF rounding_mode = 'trunc' THEN RETURN start_of_day; END IF;
    next_day := tsq_zoned_of_wall(wall + interval '1 day', zone, 'compatible');
    IF rounding_mode = 'ceil' THEN
        RETURN CASE WHEN instant = start_of_day THEN start_of_day ELSE next_day END;
    END IF;
    IF rounding_mode = 'halfExpand' THEN
        RETURN CASE WHEN (instant - start_of_day) * 2 >= next_day - start_of_day THEN next_day ELSE start_of_day END;
    END IF;
    RETURN CASE WHEN (instant - start_of_day) * 2 > next_day - start_of_day THEN next_day ELSE start_of_day END;
END $$;

-- tsq_duration_sum: the sum of two durations (Temporal.Duration), the second times sign (1 to add it, -1 to subtract
-- it), each given whole: tsq_duration_add of their parts; the function of the library that writes each one once
-- (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_duration_sum(a text, b text, sgn integer) RETURNS interval LANGUAGE sql IMMUTABLE AS $$
    SELECT tsq_duration_add(tsq_duration_part(a, 'largest'), tsq_duration_part(a, 'days'), tsq_duration_part(a, 'S'), tsq_duration_part(a, 'N'),
        tsq_duration_part(b, 'largest'), tsq_duration_part(b, 'days'), tsq_duration_part(b, 'S'), tsq_duration_part(b, 'N'), sgn)
$$;

CREATE OR REPLACE FUNCTION tsq_duration_sum(a text, b interval, sgn integer) RETURNS interval LANGUAGE sql IMMUTABLE AS $$
    SELECT tsq_duration_add(tsq_duration_part(a, 'largest'), tsq_duration_part(a, 'days'), tsq_duration_part(a, 'S'), tsq_duration_part(a, 'N'),
        CASE WHEN extract(year FROM b) <> 0 OR extract(month FROM b) <> 0 THEN 1 WHEN extract(day FROM b) <> 0 THEN 3 ELSE 4 END, extract(day FROM b)::bigint, (extract(hour FROM b) * 3600 + extract(minute FROM b) * 60 + trunc(extract(second FROM b)))::bigint, extract(microseconds FROM b)::bigint % 1000000 * 1000, sgn)
$$;

CREATE OR REPLACE FUNCTION tsq_duration_sum(a interval, b text, sgn integer) RETURNS interval LANGUAGE sql IMMUTABLE AS $$
    SELECT tsq_duration_add(CASE WHEN extract(year FROM a) <> 0 OR extract(month FROM a) <> 0 THEN 1 WHEN extract(day FROM a) <> 0 THEN 3 ELSE 4 END, extract(day FROM a)::bigint, (extract(hour FROM a) * 3600 + extract(minute FROM a) * 60 + trunc(extract(second FROM a)))::bigint, extract(microseconds FROM a)::bigint % 1000000 * 1000,
        tsq_duration_part(b, 'largest'), tsq_duration_part(b, 'days'), tsq_duration_part(b, 'S'), tsq_duration_part(b, 'N'), sgn)
$$;

CREATE OR REPLACE FUNCTION tsq_duration_sum(a interval, b interval, sgn integer) RETURNS interval LANGUAGE sql IMMUTABLE AS $$
    SELECT tsq_duration_add(CASE WHEN extract(year FROM a) <> 0 OR extract(month FROM a) <> 0 THEN 1 WHEN extract(day FROM a) <> 0 THEN 3 ELSE 4 END, extract(day FROM a)::bigint, (extract(hour FROM a) * 3600 + extract(minute FROM a) * 60 + trunc(extract(second FROM a)))::bigint, extract(microseconds FROM a)::bigint % 1000000 * 1000,
        CASE WHEN extract(year FROM b) <> 0 OR extract(month FROM b) <> 0 THEN 1 WHEN extract(day FROM b) <> 0 THEN 3 ELSE 4 END, extract(day FROM b)::bigint, (extract(hour FROM b) * 3600 + extract(minute FROM b) * 60 + trunc(extract(second FROM b)))::bigint, extract(microseconds FROM b)::bigint % 1000000 * 1000, sgn)
$$;

-- tsq_duration_total_of: a duration (Temporal.Duration) given whole in one unit, as Temporal's total, with the year,
-- the month and the day of the date of reference (0, 0, 0 without one): tsq_duration_total of its parts; the function
-- of the library that writes it once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_duration_total_of(d text, y integer, m integer, dd integer, unit text) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
    SELECT tsq_duration_total(tsq_duration_part(d, 'M'), tsq_duration_part(d, 'weeks'), tsq_duration_part(d, 'days'), tsq_duration_part(d, 'S'), tsq_duration_part(d, 'N'), y, m, dd, unit)
$$;

CREATE OR REPLACE FUNCTION tsq_duration_total_of(d interval, y integer, m integer, dd integer, unit text) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
    SELECT tsq_duration_total((extract(year FROM d) * 12 + extract(month FROM d))::bigint, 0, extract(day FROM d)::bigint, (extract(hour FROM d) * 3600 + extract(minute FROM d) * 60 + trunc(extract(second FROM d)))::bigint, extract(microseconds FROM d)::bigint % 1000000 * 1000, y, m, dd, unit)
$$;

-- tsq_duration_round_of: the duration from one date or date and time to another rounded to the calendar, as
-- Temporal's until: tsq_duration_round of the year, the month, the day and the nanoseconds of the day of each one;
-- the function of the library that writes each one once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_duration_round_of(one timestamp, two timestamp, largest_unit text, smallest_unit text, increment bigint, rounding_mode text, negation integer) RETURNS interval LANGUAGE sql IMMUTABLE AS $$
    SELECT tsq_duration_round(extract(year FROM one)::integer, extract(month FROM one)::integer, extract(day FROM one)::integer, round(extract(epoch FROM one::time) * 1000000)::bigint * 1000,
        extract(year FROM two)::integer, extract(month FROM two)::integer, extract(day FROM two)::integer, round(extract(epoch FROM two::time) * 1000000)::bigint * 1000,
        largest_unit, smallest_unit, increment, rounding_mode, negation)
$$;

-- tsq_date_plus_duration and tsq_instant_plus_duration: a date or an instant plus a duration of the query given whole,
-- multiplied by sign (1 to add it, -1 to subtract it), as Temporal adds it: its years and months first, keeping the day in
-- the month, then its weeks and days, then its time; an instant takes only a duration of time; the functions of the
-- library that read the duration once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_date_plus_duration(value date, duration interval, sgn integer) RETURNS date LANGUAGE sql IMMUTABLE AS $$
    SELECT cast(value + make_interval(months => (extract(year FROM duration) * 12 + extract(month FROM duration))::integer, days => (extract(day FROM duration) + trunc(extract(epoch FROM duration - date_trunc('day', duration)) / 86400))::integer) * sgn AS date)
$$;

CREATE OR REPLACE FUNCTION tsq_instant_plus_duration(value timestamptz, duration interval, sgn integer) RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF extract(year FROM duration) <> 0 OR extract(month FROM duration) <> 0 OR extract(day FROM duration) <> 0 THEN
        RAISE EXCEPTION 'tsq_instant_plus_duration: an instant takes only a duration of hours and smaller units' USING ERRCODE = '22023';
    END IF;
    RETURN value + duration * sgn;
END $$;

-- tsq_duration_negated: the ISO 8601 text of a duration (Temporal.Duration) negated: without its minus, or with one; a
-- duration of zero as it is (Temporal writes it without sign); the function of the library that writes the text once
-- (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_duration_negated(d text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN substr(d, 1, 1) = '-' THEN substr(d, 2) WHEN tsq_duration_part(d, 'sign') = 0 THEN d WHEN substr(d, 1, 1) = '+' THEN '-' || substr(d, 2) ELSE '-' || d END
$$;

-- tsq_day_in_month_or_error: 0, or an error when the day of a date (or a date and time) isn't in the month that the
-- months given reach from it, as Temporal's overflow 'reject' fails; the function of the library that writes the value
-- once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_day_in_month_or_error(value timestamp, months integer) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
    SELECT extract(day FROM make_date((extract(year FROM value)::integer * 12 + extract(month FROM value)::integer - 1 + months) / 12, (extract(year FROM value)::integer * 12 + extract(month FROM value)::integer - 1 + months) % 12 + 1, extract(day FROM value)::integer))::integer - extract(day FROM value)::integer
$$;

-- tsq_utc_of_epoch: the date and time in UTC of an instant given as a number of units since 1970-01-01T00:00Z, of the
-- nanoseconds given each (1000000 for milliseconds, 1 for nanoseconds), as Temporal's Instant.fromEpochMilliseconds and
-- fromEpochNanoseconds: the whole days rounded down and the rest of the day; the function of the library that writes the
-- number once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_utc_of_epoch(value numeric, unit_nanoseconds bigint) RETURNS timestamp LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    total numeric := value * unit_nanoseconds;
    rest numeric := mod(mod(total, 86400000000000) + 86400000000000, 86400000000000);
BEGIN
    RETURN (date '1970-01-01' + ((total - rest) / 86400000000000)::integer) + make_interval(secs => rest / 1000000000.0);
END $$;

-- tsq_date_with: a date with the year, the month and the day given in place of its own (null keeps its own), as
-- Temporal's with: a day the month hasn't is its last day, or an error with reject (1); the function of the library that
-- writes the date once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_date_with(value date, y integer, m integer, d integer, reject integer) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_year integer := coalesce(y, extract(year FROM value)::integer);
    v_month integer := coalesce(m, extract(month FROM value)::integer);
    v_day integer := coalesce(d, extract(day FROM value)::integer);
    v_last integer;
BEGIN
    IF value IS NULL THEN RETURN NULL; END IF;
    v_last := extract(day FROM make_date(v_year, v_month, 1) + interval '1 month - 1 day')::integer;
    IF v_day > v_last AND reject = 0 THEN v_day := v_last; END IF;
    RETURN make_date(v_year, v_month, v_day);
END $$;

-- tsq_zoned_plus_date: a zoned date and time (its instant and its zone) plus months and days, as Temporal's add of a
-- ZonedDateTime adds the years, months, weeks and days of a duration: to its wall clock in its zone, the day kept in
-- the month (or an error with reject), taken back to the zone as 'compatible' disambiguates it; the value itself
-- without months nor days. The function of the library that writes the value once (libraryFunctions installed).
CREATE OR REPLACE FUNCTION tsq_zoned_plus_date(instant timestamptz, zone text, months integer, days integer, reject integer) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    wall timestamp;
BEGIN
    IF months = 0 AND days = 0 THEN RETURN instant; END IF;
    wall := instant AT TIME ZONE tsq_zone(zone);
    IF reject <> 0 AND months <> 0 THEN PERFORM tsq_day_in_month_or_error(wall, months); END IF;
    RETURN tsq_zoned_of_wall(wall + make_interval(months => months, days => days), zone, 'compatible');
END $$;
