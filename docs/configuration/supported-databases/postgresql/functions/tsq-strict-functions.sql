-- PostgreSQL: an example of the functions of tsq-strict-functions, in the order to create them.
-- See https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/postgresql/functions/
-- Run it with: psql -d <database> -f tsq-strict-functions.sql

-- ===== The functions of minValueFunction and maxValueFunction =====
CREATE FUNCTION tsq_greatest_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE greatest(a, b) END $$;

CREATE FUNCTION tsq_least_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE least(a, b) END $$;
