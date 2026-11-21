-- SQL Server: an example of the functions of tsq-strict-functions, in the order to create them.
-- See https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/sqlserver/functions/
-- Run it with: sqlcmd -d <database> -i tsq-strict-functions.sql

-- ===== The functions of minValueFunction and maxValueFunction =====
CREATE FUNCTION dbo.tsq_greatest_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a >= @b THEN @a ELSE @b END
END;
GO
CREATE FUNCTION dbo.tsq_least_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a <= @b THEN @a ELSE @b END
END;
GO
