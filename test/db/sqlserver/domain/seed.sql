-- Canonical seed dataset shared by every sqlserver variant. IDENTITY
-- columns ignore explicit inserts unless IDENTITY_INSERT is enabled.

SET IDENTITY_INSERT organization ON;
INSERT INTO organization (id, name, plan) VALUES
    (1, 'Acme Corp', 'pro'),
    (2, 'Globex Ltd', 'free');
SET IDENTITY_INSERT organization OFF;

SET IDENTITY_INSERT app_user ON;
INSERT INTO app_user (id, email, full_name) VALUES
    (1, 'ada@acme.test',    'Ada Lovelace'),
    (2, 'grace@acme.test',  'Grace Hopper'),
    (3, 'alan@globex.test', 'Alan Turing');
SET IDENTITY_INSERT app_user OFF;

SET IDENTITY_INSERT project ON;
INSERT INTO project (id, organization_id, name, slug) VALUES
    (1, 1, 'Marketing site',  'mktg-site'),
    (2, 1, 'Internal tools',  'tools'),
    (3, 2, 'Public API',      'public-api');
INSERT INTO project (id, organization_id, name, slug, archived_at) VALUES
    (4, 2, 'Legacy app', 'legacy', CURRENT_TIMESTAMP);
SET IDENTITY_INSERT project OFF;

SET IDENTITY_INSERT issue ON;
INSERT INTO issue (id, project_id, [number], title, body, status, priority, assignee_id) VALUES
    (1, 1, 1, 'Update hero copy',     NULL,            'open',        2, 1),
    (2, 1, 2, 'Redesign navbar',      'Use new tokens', 'in_progress', 1, 2),
    (3, 2, 1, 'Migrate to ESM',       NULL,            'open',        3, NULL),
    (4, 3, 1, 'Document /v2/users',   'See ADR-014',   'closed',      2, 3);
SET IDENTITY_INSERT issue OFF;
