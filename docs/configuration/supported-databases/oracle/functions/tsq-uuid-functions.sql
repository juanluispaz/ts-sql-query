-- Oracle: the functions of the library ts-sql-query for the uuid strategy 'custom-functions': a uuid and its RAW(16),
-- the 16 bytes as they are, for any version of uuid and on any version of Oracle; the text read is in lower case.
-- See https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/oracle/functions/
-- Run it with: sqlplus <user>/<password>@<service> @tsq-uuid-functions.sql

-- ===== tsq_uuid_to_raw =====
CREATE OR REPLACE FUNCTION tsq_uuid_to_raw(uuid IN VARCHAR2) RETURN RAW DETERMINISTIC IS
BEGIN
    RETURN HEXTORAW(REPLACE(uuid, '-'));
END;
/

-- ===== tsq_raw_to_uuid =====
CREATE OR REPLACE FUNCTION tsq_raw_to_uuid(raw_uuid IN RAW) RETURN VARCHAR2 DETERMINISTIC IS
    hex_text VARCHAR2(32);
BEGIN
    IF raw_uuid IS NULL THEN RETURN NULL; END IF;
    hex_text := LOWER(RAWTOHEX(raw_uuid));
    RETURN SUBSTR(hex_text, 1, 8) || '-' || SUBSTR(hex_text, 9, 4) || '-' || SUBSTR(hex_text, 13, 4) || '-' || SUBSTR(hex_text, 17, 4) || '-' || SUBSTR(hex_text, 21);
END;
/
