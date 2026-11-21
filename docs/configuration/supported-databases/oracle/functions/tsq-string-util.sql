-- Oracle: an example of the functions of tsq-string-util, in the order to create them.
-- See https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/oracle/functions/
-- Run it with: sqlplus <user>/<password>@<service> @tsq-string-util.sql

-- ===== The function of concatFunction =====
CREATE OR REPLACE PACKAGE tsq_string_util AS
    FUNCTION concat_strict(a IN VARCHAR2, b IN VARCHAR2) RETURN VARCHAR2;
    FUNCTION concat_strict(a IN CLOB, b IN CLOB) RETURN CLOB;
    FUNCTION concat_strict(a IN CLOB, b IN VARCHAR2) RETURN CLOB;
    FUNCTION concat_strict(a IN VARCHAR2, b IN CLOB) RETURN CLOB;
END tsq_string_util;
/
CREATE OR REPLACE PACKAGE BODY tsq_string_util AS
    FUNCTION concat_strict(a IN VARCHAR2, b IN VARCHAR2) RETURN VARCHAR2 IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
    FUNCTION concat_strict(a IN CLOB, b IN CLOB) RETURN CLOB IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
    FUNCTION concat_strict(a IN CLOB, b IN VARCHAR2) RETURN CLOB IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
    FUNCTION concat_strict(a IN VARCHAR2, b IN CLOB) RETURN CLOB IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
END tsq_string_util;
/
