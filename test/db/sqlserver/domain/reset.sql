-- Data-only reset for the per-test reseed (onReseed). See the postgres
-- reset.sql header for the rationale; restores the fresh-post-CREATE state
-- (empty tables, IDENTITY and sequences rewound to their start) WITHOUT any
-- DROP/CREATE, then the unchanged seed.sql (which wraps its explicit-id inserts
-- in SET IDENTITY_INSERT) re-lands the exact rows + counters a full rebuild
-- would.
--
-- SQL Server cannot TRUNCATE a table referenced by a foreign key (constraints
-- can't simply be toggled off the way MySQL allows), so this deletes in
-- children-first order, then rewinds every IDENTITY table with DBCC CHECKIDENT
-- (RESEED 0 → the next inserted identity is 1, matching a fresh table) and the
-- standalone sequences with ALTER SEQUENCE ... RESTART. The DELETE order and
-- the IDENTITY/sequence lists mirror schema.sql; keep them in sync when a table
-- or sequence is added.
DELETE FROM project_review;
DELETE FROM release_draft;
DELETE FROM project_release;
DELETE FROM audit_entry;
DELETE FROM webhook_event;
DELETE FROM calendar_year;
DELETE FROM invoice;
DELETE FROM ledger_entry;
DELETE FROM issue_worklog;
DELETE FROM col_matrix;
DELETE FROM temporal_precision;
DELETE FROM country;
DELETE FROM issue;
DELETE FROM project;
DELETE FROM app_user;
DELETE FROM organization;
DBCC CHECKIDENT('organization',   RESEED, 0);
DBCC CHECKIDENT('app_user',       RESEED, 0);
DBCC CHECKIDENT('project',        RESEED, 0);
DBCC CHECKIDENT('issue',          RESEED, 0);
DBCC CHECKIDENT('issue_worklog',  RESEED, 0);
DBCC CHECKIDENT('webhook_event',  RESEED, 0);
DBCC CHECKIDENT('project_release', RESEED, 0);
DBCC CHECKIDENT('ledger_entry',   RESEED, 0);
ALTER SEQUENCE issue_id_seq   RESTART;
ALTER SEQUENCE audit_tag_seq  RESTART;
ALTER SEQUENCE release_tag_seq RESTART;
GO
-- A history table can't be written while versioning is on, and the DELETE of a
-- versioned row would add a version: with versioning off both tables end empty.
ALTER TABLE service_plan SET (SYSTEM_VERSIONING = OFF);
GO
DELETE FROM service_plan;
DELETE FROM service_plan_history;
GO
ALTER TABLE service_plan SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.service_plan_history));
