-- Data-only reset for the per-test reseed (onReseed). See the postgres
-- reset.sql header for the rationale; restores the fresh-post-CREATE state
-- (empty tables, AUTO_INCREMENT rewound to 1) WITHOUT any DROP/CREATE, then the
-- unchanged seed.sql re-lands the exact rows + counters a full rebuild would.
--
-- MySQL refuses TRUNCATE on a table referenced by a foreign key even when the
-- child is empty, so foreign-key checks are disabled for the duration
-- (session-scoped on the borrowed connection, restored before the seed runs).
-- MySQL has no CREATE SEQUENCE — every id is AUTO_INCREMENT, which TRUNCATE
-- already rewinds — so there are no standalone sequences to reset. Statement
-- list mirrors schema.sql's DROP order (children first); keep it in sync when a
-- table is added.
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE project_review;
TRUNCATE TABLE project_release;
TRUNCATE TABLE webhook_event;
TRUNCATE TABLE calendar_year;
TRUNCATE TABLE issue_worklog;
TRUNCATE TABLE country;
TRUNCATE TABLE issue;
TRUNCATE TABLE project;
TRUNCATE TABLE app_user;
TRUNCATE TABLE organization;
SET FOREIGN_KEY_CHECKS = 1;
