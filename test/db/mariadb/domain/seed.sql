-- Canonical seed dataset shared by every mariadb variant.
-- IDs are stable on purpose so tests can refer to them by literal.
-- AUTO_INCREMENT continues after MAX(id) on the next insert.

-- Every date and time of the seed is a fixed instant, never the clock of the
-- engine: the seed is a backup of known data, so a result that reads a
-- created_at, updated_at or archived_at is the same on every run and every
-- database. The defaults of schema.sql are left for the rows the tests insert.
-- The rows are created in the order of their ids; issue 3 was never updated,
-- its updated_at is its created_at.
INSERT INTO organization (id, name, plan, verified, created_at) VALUES
    (1, 'Acme Corp', 'pro',  'Y', '2023-06-15 08:00:00'),
    (2, 'Globex Ltd', 'free', 'N', '2023-09-20 14:30:00');

INSERT INTO app_user (id, email, full_name, verified, created_at) VALUES
    (1, 'ada@acme.test',    'Ada Lovelace', 'Y', '2023-06-16 09:00:00'),
    (2, 'grace@acme.test',  'Grace Hopper', 'Y', '2023-07-03 10:15:00'),
    (3, 'alan@globex.test', 'Alan Turing',  'N', '2023-09-21 11:45:00');

INSERT INTO project (id, organization_id, name, slug, published, created_at) VALUES
    (1, 1, 'Marketing site',  'mktg-site',  't', '2023-07-10 09:30:00'),
    (2, 1, 'Internal tools',  'tools',      'f', '2023-08-01 13:00:00'),
    (3, 2, 'Public API',      'public-api', 't', '2023-10-02 10:00:00');
INSERT INTO project (id, organization_id, name, slug, published, archived_at, created_at) VALUES
    (4, 2, 'Legacy app', 'legacy', 'f', '2024-02-01 00:00:00', '2023-10-15 16:20:00');

-- Issues 1 and 2 carry a uuid `external_ref` (CHAR(36) here); 3 and 4 leave
-- it NULL. The two uuids differ in every substring the insensitive-`like`
-- tests probe and neither contains the `abc` token the dynamic-condition
-- tests filter on.
INSERT INTO issue (id, project_id, `number`, title, body, status, priority, assignee_id, external_ref, created_at, updated_at) VALUES
    (1, 1, 1, 'Update hero copy',     NULL,            'open',        2, 1,    '0a8f9c1e-1111-4222-8333-444455556666', '2024-02-26 09:00:00', '2024-03-04 11:00:00'),
    (2, 1, 2, 'Redesign navbar',      'Use new tokens', 'in_progress', 1, 2,   '7b3e9d20-2222-4c55-9b66-dddd00009999', '2024-02-27 10:30:00', '2024-03-05 15:00:00'),
    (3, 2, 1, 'Migrate to ESM',       NULL,            'open',        3, NULL,  NULL, '2024-02-28 08:45:00', '2024-02-28 08:45:00'),
    (4, 3, 1, 'Document /v2/users',   'See ADR-014',   'closed',      2, 3,    NULL, '2024-02-29 14:00:00', '2024-03-07 16:00:00');

INSERT INTO country (code, name, region) VALUES
    ('US', 'United States',  'Americas'),
    ('GB', 'United Kingdom', 'Europe'),
    ('JP', 'Japan',          'Asia');

INSERT INTO issue_worklog (id, issue_id, work_date, started_at, minutes, duration_ms, billable, activity, approved, billed_amount, invoiced, cost_cents) VALUES
    (1, 1, '2024-03-04', '09:15:00', 90,   5400000, 1,    'coding', 'A', 200, 1, 100),
    (2, 2, '2024-03-05', '14:00:00', NULL, NULL,    0,    'review', 'R', 50, 0, 100),
    (3, 1, '2024-03-06', '10:30:00', 30,   1800000, NULL, 'meeting', NULL, 200, 1, 400);

INSERT INTO project_release (id, project_id, version, channel, signing_key, released_on, cutoff_time, signed_off_at, published_at, rollout_time, deployed_at, is_signed, download_count, avg_rating) VALUES
    (1, 1, '1.2.0',        'stable', '0a8f9c1e-1111-4222-8333-444455556666', '2024-01-15', '17:00:00', '2024-01-14 12:30:00', '2024-01-16 09:00:00', 'P1DT12H', '2024-01-16 09:30:15.123456', 1, 4200000042, 4.5),
    (2, 1, '1.3.0-beta.1', 'beta',   NULL,     '2024-02-20', '18:30:00', NULL, '2024-02-21 10:00:00', 'PT45M', NULL, NULL, NULL, NULL),
    (3, 2, '0.9.0',        'canary', '7b3e9d20-2222-4c55-9b66-dddd00009999', '2024-03-01', '16:00:00', '2024-02-28 09:00:00', '2024-03-02 11:00:00', 'P2D', '2024-03-02 11:05:00', 0, 100, 3.0);

INSERT INTO project_review (id, project_id, reviewer_code, score, review_date, review_time) VALUES
    (1, 1, 'R-7A2', 850, '2024-05-20', '14:30:45');

INSERT INTO webhook_event (issue_id, event_type) VALUES (1, 'created'), (2, 'updated');
INSERT INTO calendar_year (year_value, year_label) VALUES (2023, 'FY2023'), (2024, 'FY2024');
INSERT INTO exact_amount (id, amount, price, units) VALUES (1, 12345678901234567890.1234567891, 1.50, 123456789012345678901234567890), (2, -0.2500000000, -0.25, -987654321098765432109876543210), (3, 0.0000000000, 0.00, 0), (4, NULL, NULL, NULL), (5, 98765432109876543210.9876543210, 1234.56, 999999999999999999999999999999);
-- invoice_no is stored x10 by the scaledTenthAdapter, so 100 reads back as logical invoice 10.
INSERT INTO invoice (invoice_no, total) VALUES (100, 500);
-- ledger_entry: amount/memo stored x10 by scaledTenthAdapter (250 reads 25, 70 reads 7);
-- entry_no autogenerates to 1, read +1000 by plusOffsetAdapter -> 1001.
INSERT INTO ledger_entry (amount, memo, discount) VALUES (250, 70, 30);

-- release_draft: draft 1 sets all three optional typed columns; draft 2 leaves
-- stage/channel/min_version NULL so the Nullable family hits the real NULL branch.
INSERT INTO release_draft (id, title, stage, channel, min_version, budget, target_day, cutoff) VALUES
    (1, 'Alpha cut', 'candidate', 'beta', '1.0.0', 1500.5, '2024-07-10', '08:30:00'),
    (2, 'Nightly build', NULL, NULL, NULL, NULL, NULL, NULL);

-- col_matrix: one driver-stable row. m_uuid is CHAR(36) (plain string), m_bool
-- TINYINT(1) (1). Temporal seeds mirror select.column-factory-types.test.ts.
INSERT INTO col_matrix (id, m_int, m_bigint, m_double, m_bool, m_uuid, m_date, m_time, m_datetime, m_str) VALUES
    (1, 42, 5000, 3.5, 1, '0a8f9c1e-1111-4222-8333-444455556666', '2024-03-04', '09:15:00', '2024-01-14 12:30:00', 'hello');
-- temporal_precision: a sub-millisecond instant (999600 µs) a JS Date cannot
-- express. getSeconds() reads 59, getMilliseconds() reads 999.
INSERT INTO temporal_precision (id, micro_stamp) VALUES
    (1, '2024-01-15 12:30:59.999600');
-- duration_value: 1 is 3 days 04:05:06.789 and 1 year 2 months; 2 is -1 day -2 hours; 3 is 1 hour 30 minutes;
-- span_text keeps the ISO 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M.
INSERT INTO duration_value (id, span, span_calendar, span_text) VALUES
    (1, 'P3DT4H5M6.789S', 'P1Y2M', 'P1Y2M3DT4H5M6.789S'),
    (2, '-P1DT2H', NULL, '-PT26H'),
    (3, 'PT1H30M', NULL, 'PT90M');
-- calendar_value: 1 is 2024-02 and 02-29 (from 2024-02-29), 2 is 1999-12 and 12-31; 3 is kept out of the reference, on
-- 2025-01-15 and in the year 2000, read as 2025-01 and 03-15.
INSERT INTO calendar_value (id, month_of, day_of, born_on) VALUES
    (1, '2024-02-01', '1972-02-29', '2024-02-29'),
    (2, '1999-12-01', '1972-12-31', '1999-12-31'),
    (3, '2025-01-15', '2000-03-15', '2023-07-04');
-- zoned_value: 1 is 2024-10-27T02:30:00.123456789+02:00[Europe/Madrid], the first of the two 02:30 of that day, with the
-- wall clock 2024-10-27 02:30, which Madrid repeats; 2 is 2024-01-14T14:45:30.123456789+05:30[Asia/Kolkata], with
-- 2024-03-31 02:30, which Madrid skips, and the zone America/New_York; 3 is 1969-07-20T15:17:40-05:00[-05:00], with
-- 2024-01-14 10:00, without a zone.
INSERT INTO zoned_value (id, zoned_at, wall_at, zone_name) VALUES
    (1, '2024-10-27T02:30:00.123456789+02:00[Europe/Madrid]', '2024-10-27 02:30:00', 'Europe/Madrid'),
    (2, '2024-01-14T14:45:30.123456789+05:30[Asia/Kolkata]', '2024-03-31 02:30:00', 'America/New_York'),
    (3, '1969-07-20T15:17:40-05:00[-05:00]', '2024-01-14 10:00:00', NULL);
-- instant_value: 1 is 2024-01-14T09:15:30.123456Z, written with the offset +09:00 where the column keeps one;
-- 2 is 1969-07-20T20:17:40Z, without session_at (a MySQL and MariaDB TIMESTAMP starts in 1970).
INSERT INTO instant_value (id, instant_at, wall_at, session_at) VALUES
    (1, '2024-01-14 09:15:30.123456', '2024-01-14 09:15:30.123456', '2024-01-14 09:15:30.123456'),
    (2, '1969-07-20 20:17:40', '1969-07-20 20:17:40', NULL);
-- service_plan: plan 1 was 'Basic' from 2024-01-01 and is 'Standard' since
-- 2024-06-01, plan 2 is 'Enterprise' since 2024-01-01. A system-versioned row
-- takes the time of its statement, and SET timestamp fixes that time for the
-- session, so the versions get the same periods on every run, not the clock of
-- the engine. The instants are seconds since the epoch, in UTC whatever the
-- zone of the session: 1704067200 is 2024-01-01 00:00:00 UTC and 1717200000 is
-- 2024-06-01 00:00:00 UTC. The seed may run on a connection the tests use next,
-- so the clock is given back at the end.
SET timestamp = 1704067200;
INSERT INTO service_plan (id, name, description) VALUES
    (1, 'Basic', 'Entry plan'),
    (2, 'Enterprise', NULL);
SET timestamp = 1717200000;
UPDATE service_plan SET name = 'Standard' WHERE id = 1;
SET timestamp = DEFAULT;
