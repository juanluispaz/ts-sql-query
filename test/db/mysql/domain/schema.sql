-- Schema for the shared "project management" domain, mariadb dialect.
-- Idempotent: tests run setup against a fresh database each variant, but
-- having DROP IF EXISTS lets you re-apply by hand for debugging.

DROP VIEW IF EXISTS project_overview;
DROP TABLE IF EXISTS issue;
DROP TABLE IF EXISTS project;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS organization;

CREATE TABLE organization (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(32) NOT NULL,
    -- `verified` flag stored as Y/N so the connection.ts mapping can
    -- exercise CustomBooleanTypeAdapter on a real seed column.
    verified VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    -- `verified` stored as Y/N — same CustomBooleanTypeAdapter mapping
    -- as organization.verified so cross-table comparisons need no remap.
    verified VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    UNIQUE (organization_id, slug)
);

CREATE TABLE issue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    `number` INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NULL,
    status VARCHAR(32) NOT NULL,
    priority INT NOT NULL,
    assignee_id INT NULL,
    parent_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- New-type columns exercising AbstractConnection value marshalling:
    -- bigint (view_count), double (estimated_hours), uuid (external_ref).
    view_count BIGINT NOT NULL DEFAULT 0,
    estimated_hours DOUBLE,
    external_ref CHAR(36),
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (assignee_id) REFERENCES app_user(id),
    FOREIGN KEY (parent_id) REFERENCES issue(id),
    UNIQUE (project_id, `number`)
);

-- Stored procedures and functions exercised by
-- `exec.procedure-function.test.ts`. Each body is intentionally
-- trivial AND single-statement so the `splitStatements` helper (which
-- splits on `;\n`) ships each CREATE in one piece.
DROP PROCEDURE IF EXISTS refresh_stats;
DROP PROCEDURE IF EXISTS archive_project;
DROP FUNCTION IF EXISTS count_open_issues;
DROP FUNCTION IF EXISTS project_name;
CREATE PROCEDURE refresh_stats() SELECT 1;
CREATE PROCEDURE archive_project(IN p_id INT, IN p_reason VARCHAR(255)) UPDATE project SET archived_at = CURRENT_TIMESTAMP, name = CONCAT(name, ' [archived: ', p_reason, ']') WHERE id = p_id;
CREATE FUNCTION count_open_issues(p_id INT) RETURNS INT DETERMINISTIC RETURN (SELECT COUNT(*) FROM issue WHERE project_id = p_id AND status = 'open');
CREATE FUNCTION project_name(p_id INT) RETURNS VARCHAR(255) DETERMINISTIC RETURN (SELECT name FROM project WHERE id = p_id);

-- A class-based SQL view exercised by `view.basic.test.ts`. A plain
-- join of project + organization (no aggregation, no casts), portable
-- across every dialect.
CREATE VIEW project_overview AS
SELECT p.id AS id,
       p.organization_id AS organization_id,
       p.name AS name,
       p.archived_at AS archived_at,
       o.name AS organization_name,
       o.plan AS organization_plan
FROM project p
INNER JOIN organization o ON o.id = p.organization_id;
