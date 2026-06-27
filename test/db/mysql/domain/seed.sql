-- Canonical seed dataset shared by every mariadb variant.
-- IDs are stable on purpose so tests can refer to them by literal.
-- AUTO_INCREMENT continues after MAX(id) on the next insert.

INSERT INTO organization (id, name, plan, verified) VALUES
    (1, 'Acme Corp', 'pro',  'Y'),
    (2, 'Globex Ltd', 'free', 'N');

INSERT INTO app_user (id, email, full_name, verified) VALUES
    (1, 'ada@acme.test',    'Ada Lovelace', 'Y'),
    (2, 'grace@acme.test',  'Grace Hopper', 'Y'),
    (3, 'alan@globex.test', 'Alan Turing',  'N');

INSERT INTO project (id, organization_id, name, slug, published) VALUES
    (1, 1, 'Marketing site',  'mktg-site',  't'),
    (2, 1, 'Internal tools',  'tools',      'f'),
    (3, 2, 'Public API',      'public-api', 't');
INSERT INTO project (id, organization_id, name, slug, published, archived_at) VALUES
    (4, 2, 'Legacy app', 'legacy', 'f', CURRENT_TIMESTAMP);

-- Issues 1 and 2 carry a uuid `external_ref`; 3 and 4 leave it NULL. The
-- column is BINARY(16), so the seed stores the uuid via UUID_TO_BIN (the
-- form the binary uuid strategy reads back with BIN_TO_UUID). The two uuids
-- differ in every substring the insensitive-`like` tests probe and neither
-- contains the `abc` token the dynamic-condition tests filter on.
INSERT INTO issue (id, project_id, `number`, title, body, status, priority, assignee_id, external_ref) VALUES
    (1, 1, 1, 'Update hero copy',     NULL,            'open',        2, 1,    UUID_TO_BIN('0a8f9c1e-1111-4222-8333-444455556666')),
    (2, 1, 2, 'Redesign navbar',      'Use new tokens', 'in_progress', 1, 2,   UUID_TO_BIN('7b3e9d20-2222-4c55-9b66-dddd00009999')),
    (3, 2, 1, 'Migrate to ESM',       NULL,            'open',        3, NULL,  NULL),
    (4, 3, 1, 'Document /v2/users',   'See ADR-014',   'closed',      2, 3,    NULL);

INSERT INTO country (code, name, region) VALUES
    ('US', 'United States',  'Americas'),
    ('GB', 'United Kingdom', 'Europe'),
    ('JP', 'Japan',          'Asia');

INSERT INTO issue_worklog (id, issue_id, work_date, started_at, minutes, duration_ms, billable, activity, approved, billed_amount, invoiced, cost_cents) VALUES
    (1, 1, '2024-03-04', '09:15:00', 90,   5400000, 1,    'coding', 'A', 200, 1, 100),
    (2, 2, '2024-03-05', '14:00:00', NULL, NULL,    0,    'review', 'R', 50, 0, 100),
    (3, 1, '2024-03-06', '10:30:00', 30,   1800000, NULL, 'meeting', NULL, 200, 1, 400);

INSERT INTO project_release (id, project_id, version, channel, signing_key, released_on, cutoff_time, signed_off_at) VALUES
    (1, 1, '1.2.0',        'stable', UUID_TO_BIN('0a8f9c1e-1111-4222-8333-444455556666'), '2024-01-15', '17:00:00', '2024-01-14 12:30:00'),
    (2, 1, '1.3.0-beta.1', 'beta',   NULL,     '2024-02-20', '18:30:00', NULL),
    (3, 2, '0.9.0',        'canary', UUID_TO_BIN('7b3e9d20-2222-4c55-9b66-dddd00009999'), '2024-03-01', '16:00:00', '2024-02-28 09:00:00');

INSERT INTO webhook_event (issue_id, event_type) VALUES (1, 'created'), (2, 'updated');
INSERT INTO calendar_year (year_value, year_label) VALUES (2023, 'FY2023'), (2024, 'FY2024');
