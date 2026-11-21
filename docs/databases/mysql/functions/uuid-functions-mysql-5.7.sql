-- MySQL: an example of the functions of uuid-functions-mysql-5.7, in the order to create them.
-- See https://ts-sql-query.readthedocs.io/en/latest/databases/mysql/functions/
-- Run it with: mysql <database> < uuid-functions-mysql-5.7.sql

-- ===== UUID_TO_BIN and BIN_TO_UUID for MySQL 5.7 =====
CREATE FUNCTION UUID_TO_BIN(uuid CHAR(36)) RETURNS BINARY(16) DETERMINISTIC
    RETURN UNHEX(REPLACE(uuid, '-', ''));

CREATE FUNCTION BIN_TO_UUID(b BINARY(16)) RETURNS CHAR(36) DETERMINISTIC
    RETURN IF(b IS NULL, NULL,
        LOWER(CONCAT_WS('-',
            SUBSTR(HEX(b), 1, 8), SUBSTR(HEX(b), 9, 4), SUBSTR(HEX(b), 13, 4),
            SUBSTR(HEX(b), 17, 4), SUBSTR(HEX(b), 21, 12))));
