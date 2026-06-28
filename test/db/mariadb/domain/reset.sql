-- Data-only reset for the per-test reseed (onReseed). See the postgres
-- reset.sql header for the rationale; the goal is identical: restore the
-- fresh-post-CREATE state (empty tables, AUTO_INCREMENT and sequences rewound
-- to their start) WITHOUT any DROP/CREATE, so the per-test reseed stops
-- churning the catalog. Re-running the unchanged seed.sql afterwards then lands
-- exactly the same rows + counters a full schema.sql + seed.sql would.
--
-- MariaDB refuses TRUNCATE on a table referenced by a foreign key even when the
-- child is already empty, so foreign-key checks are disabled for the duration
-- (session-scoped on the borrowed connection, restored before the seed runs).
-- TRUNCATE rewinds AUTO_INCREMENT to 1; the standalone sequences are rewound
-- with ALTER SEQUENCE ... RESTART. Statement list mirrors schema.sql's DROP
-- order (children first) — keep it in sync when a table is added.
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE project_release;
TRUNCATE TABLE audit_entry;
TRUNCATE TABLE webhook_event;
TRUNCATE TABLE calendar_year;
TRUNCATE TABLE issue_worklog;
TRUNCATE TABLE country;
TRUNCATE TABLE issue;
TRUNCATE TABLE project;
TRUNCATE TABLE app_user;
TRUNCATE TABLE organization;
SET FOREIGN_KEY_CHECKS = 1;
ALTER SEQUENCE issue_id_seq RESTART;
ALTER SEQUENCE audit_tag_seq RESTART;
ALTER SEQUENCE release_tag_seq RESTART;
