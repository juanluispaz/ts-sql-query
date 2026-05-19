-- Canonical seed dataset shared by every postgres variant (real pg + pglite).
-- IDs are stable on purpose so tests can refer to them by literal.

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

INSERT INTO issue (id, project_id, number, title, body, status, priority, assignee_id) VALUES
    (1, 1, 1, 'Update hero copy',     NULL,            'open',        2, 1),
    (2, 1, 2, 'Redesign navbar',      'Use new tokens', 'in_progress', 1, 2),
    (3, 2, 1, 'Migrate to ESM',       NULL,            'open',        3, NULL),
    (4, 3, 1, 'Document /v2/users',   'See ADR-014',   'closed',      2, 3);

-- Bump serial sequences past the manually-assigned IDs so subsequent INSERTs
-- without explicit id pick up where we left off.
SELECT setval(pg_get_serial_sequence('organization', 'id'), (SELECT MAX(id) FROM organization));
SELECT setval(pg_get_serial_sequence('app_user',     'id'), (SELECT MAX(id) FROM app_user));
SELECT setval(pg_get_serial_sequence('project',      'id'), (SELECT MAX(id) FROM project));
SELECT setval(pg_get_serial_sequence('issue',        'id'), (SELECT MAX(id) FROM issue));
