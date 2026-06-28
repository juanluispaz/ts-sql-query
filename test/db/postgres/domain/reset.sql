-- Data-only reset for the per-test reseed (onReseed).
--
-- Restores the seeded baseline WITHOUT touching the schema: no DROP/CREATE, so
-- no data-dictionary DDL churn under the parallel matrix. The heavy DROP+CREATE
-- lives only in the once-per-worker bootstrap (schema.sql); every per-test
-- reseed runs THIS instead, which is far lighter and contends far less on the
-- shared catalog.
--
-- It reproduces EXACTLY the row + counter state a fresh `schema.sql + seed.sql`
-- would leave: `TRUNCATE ... RESTART IDENTITY` rewinds every owned identity
-- sequence to its start, the loop rewinds the standalone sequences
-- (audit_tag_seq, release_tag_seq, the SERIAL-owned issue_id_seq, …), and the
-- seed pins the explicit ids by literal — so re-seeding lands the same ids and
-- leaves the auto counters exactly where a CREATE+seed would.
--
-- Dynamic (reads the catalog) so it never drifts when a table or sequence is
-- added to schema.sql. Runs as a single statement, so the multi-driver reseed
-- path (pg / postgres.js / bun:sql / pglite) executes it verbatim with no
-- per-driver row parsing.
DO $$
DECLARE
    seq_name text;
BEGIN
    -- One TRUNCATE over every base table: RESTART IDENTITY rewinds owned
    -- sequences, CASCADE satisfies the FK graph regardless of declaration
    -- order. (pg_tables excludes views, so project_overview / release_overview
    -- are left untouched.)
    EXECUTE (
        SELECT 'TRUNCATE TABLE '
             || string_agg(format('%I.%I', schemaname, tablename), ', ')
             || ' RESTART IDENTITY CASCADE'
        FROM pg_tables
        WHERE schemaname = 'public'
    );
    -- Rewind every sequence (incl. the standalone ones not owned by an
    -- identity column) back to its declared START value. Idempotent over the
    -- identity sequences TRUNCATE already reset.
    FOR seq_name IN
        SELECT format('%I.%I', schemaname, sequencename)
        FROM pg_sequences
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART';
    END LOOP;
END $$;
