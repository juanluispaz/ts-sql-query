-- Oracle: the functions of the library ts-sql-query for the uuid strategy 'custom-functions' that keep a version 1 uuid
-- in the order of its time: the RAW(16) begins with its time-high, then its time-mid and its time-low, so the values
-- kept sort as they were made and an index of them grows at its end. Only for version 1 uuids: it scrambles the order of
-- a version 7 uuid, whose time already comes first (use tsq-uuid-functions.sql for it). The text read is in lower case.
-- See https://ts-sql-query.readthedocs.io/en/latest/databases/oracle/functions/
-- Run it with: sqlplus <user>/<password>@<service> @tsq-uuid-functions-time-first.sql

-- ===== tsq_uuid_to_raw =====
CREATE OR REPLACE FUNCTION tsq_uuid_to_raw(uuid IN VARCHAR2) RETURN RAW DETERMINISTIC IS
    hex_text VARCHAR2(32);
BEGIN
    IF uuid IS NULL THEN RETURN NULL; END IF;
    hex_text := REPLACE(uuid, '-');
    RETURN HEXTORAW(SUBSTR(hex_text, 13, 4) || SUBSTR(hex_text, 9, 4) || SUBSTR(hex_text, 1, 8) || SUBSTR(hex_text, 17));
END;
/

-- ===== tsq_raw_to_uuid =====
CREATE OR REPLACE FUNCTION tsq_raw_to_uuid(raw_uuid IN RAW) RETURN VARCHAR2 DETERMINISTIC IS
    hex_text VARCHAR2(32);
BEGIN
    IF raw_uuid IS NULL THEN RETURN NULL; END IF;
    hex_text := LOWER(RAWTOHEX(raw_uuid));
    RETURN SUBSTR(hex_text, 9, 8) || '-' || SUBSTR(hex_text, 5, 4) || '-' || SUBSTR(hex_text, 1, 4) || '-' || SUBSTR(hex_text, 17, 4) || '-' || SUBSTR(hex_text, 21);
END;
/
