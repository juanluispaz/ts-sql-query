-- Schema for the shared "project management" domain, postgres dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

DROP VIEW IF EXISTS project_overview;
DROP TABLE IF EXISTS issue CASCADE;
DROP TABLE IF EXISTS project CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;
DROP TABLE IF EXISTS organization CASCADE;

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
    external_ref VARCHAR(36),
    UNIQUE (project_id, number)
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

-- Sequences exercised by `sequence.next-current-value.test.ts`.
-- `issueIdSeq` (typed `'int'`) reuses the sequence implicitly
-- created by `issue.id SERIAL` (PostgreSQL names it `issue_id_seq`);
-- dropping it explicitly would fail because `issue.id` depends on
-- it (2BP01). `auditTagSeq` (typed `'bigint'`) is independent and
-- created here. PostgreSQL sequences are 64-bit internally
-- regardless of the type hint, which only affects deserialization.

DROP SEQUENCE IF EXISTS audit_tag_seq;

CREATE SEQUENCE audit_tag_seq START 1;

-- A class-based SQL view exercised by `view.basic.test.ts`. A plain
-- join of project + organization (no aggregation, no casts) so the
-- same shape is portable across every dialect.
CREATE VIEW project_overview AS
SELECT p.id AS id,
       p.organization_id AS organization_id,
       p.name AS name,
       p.archived_at AS archived_at,
       o.name AS organization_name,
       o.plan AS organization_plan
FROM project p
INNER JOIN organization o ON o.id = p.organization_id;
