-- MySQL: the functions of the library ts-sql-query, in the order to create them.
-- See https://ts-sql-query.readthedocs.io/en/latest/databases/mysql/functions/
-- Run it with: mysql <database> < tsq-functions.sql

-- ===== tsq_duration_part =====
DROP FUNCTION IF EXISTS tsq_duration_part;
DELIMITER //
CREATE FUNCTION tsq_duration_part(d VARCHAR(100), part VARCHAR(10)) RETURNS BIGINT DETERMINISTIC NO SQL
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE n INT;
    DECLARE c CHAR(1);
    DECLARE num VARCHAR(40) DEFAULT '';
    DECLARE in_time BOOLEAN DEFAULT FALSE;
    DECLARE sgn INT DEFAULT 1;
    DECLARE r BIGINT DEFAULT 0;
    DECLARE nonzero BOOLEAN DEFAULT FALSE;
    DECLARE lg INT DEFAULT 10;
    DECLARE f BIGINT;
    IF d IS NULL THEN RETURN NULL; END IF;
    SET d = UPPER(TRIM(d));
    SET n = CHAR_LENGTH(d);
    IF LEFT(d, 1) = '-' THEN SET sgn = -1, i = 2; ELSEIF LEFT(d, 1) = '+' THEN SET i = 2; END IF;
    SET i = i + 1;
    WHILE i <= n DO
        SET c = SUBSTRING(d, i, 1);
        IF c = 'T' THEN SET in_time = TRUE;
        ELSEIF c BETWEEN '0' AND '9' OR c = '.' OR c = ',' THEN SET num = CONCAT(num, IF(c = ',', '.', c));
        ELSE
            IF REPLACE(REPLACE(num, '0', ''), '.', '') <> '' THEN
                SET nonzero = TRUE;
                SET f = CAST(RPAD(IF(LOCATE('.', num) > 0, SUBSTRING_INDEX(num, '.', -1), ''), 9, '0') AS SIGNED);
                SET lg = LEAST(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                    WHEN CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED) <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
            END IF;
            IF part = 'M' AND NOT in_time AND c = 'Y' THEN SET r = r + 12 * CAST(num AS SIGNED);
            ELSEIF part = 'M' AND NOT in_time AND c = 'M' THEN SET r = r + CAST(num AS SIGNED);
            ELSEIF part = 'D' AND c = 'W' THEN SET r = r + 7 * CAST(num AS SIGNED);
            ELSEIF part = 'D' AND c = 'D' THEN SET r = r + CAST(num AS SIGNED);
            ELSEIF part = 'S' AND in_time AND c = 'H' THEN SET r = r + 3600 * CAST(num AS SIGNED);
            ELSEIF part = 'S' AND in_time AND c = 'M' THEN SET r = r + 60 * CAST(num AS SIGNED);
            ELSEIF part = 'S' AND c = 'S' THEN SET r = r + CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
            ELSEIF part = 'N' AND c = 'S' AND LOCATE('.', num) > 0 THEN SET r = CAST(RPAD(SUBSTRING_INDEX(num, '.', -1), 9, '0') AS SIGNED);
            ELSEIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN SET r = CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
            END IF;
            SET num = '';
        END IF;
        SET i = i + 1;
    END WHILE;
    IF part = 'sign' THEN RETURN IF(nonzero, sgn, 0); END IF;
    IF part = 'largest' THEN RETURN lg; END IF;
    RETURN sgn * r;
END
//
DELIMITER ;

-- ===== tsq_duration_text =====
DROP FUNCTION IF EXISTS tsq_duration_text;
DELIMITER //
CREATE FUNCTION tsq_duration_text(y BIGINT, mo BIGINT, w BIGINT, d BIGINT, ns DECIMAL(65, 0), unit VARCHAR(6)) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
BEGIN
    DECLARE r VARCHAR(100) DEFAULT '';
    DECLARE t VARCHAR(100) DEFAULT '';
    DECLARE neg BOOLEAN;
    DECLARE f BIGINT;
    IF y IS NULL OR mo IS NULL OR w IS NULL OR d IS NULL OR ns IS NULL THEN RETURN NULL; END IF;
    IF unit = 'year' THEN SET y = y + mo DIV 12, mo = mo MOD 12; END IF;
    IF unit = 'week' OR unit = 'day' THEN
        SET d = d + ns DIV 86400000000000, ns = ns MOD 86400000000000;
        IF unit = 'week' THEN SET w = w + d DIV 7, d = d MOD 7; END IF;
        SET unit = 'hour';
    END IF;
    SET neg = y < 0 OR mo < 0 OR w < 0 OR d < 0 OR ns < 0;
    IF y <> 0 THEN SET r = CONCAT(r, ABS(y), 'Y'); END IF;
    IF mo <> 0 THEN SET r = CONCAT(r, ABS(mo), 'M'); END IF;
    IF w <> 0 THEN SET r = CONCAT(r, ABS(w), 'W'); END IF;
    IF d <> 0 THEN SET r = CONCAT(r, ABS(d), 'D'); END IF;
    SET ns = ABS(ns);
    IF unit = 'hour' AND ns >= 3600000000000 THEN SET t = CONCAT(t, ns DIV 3600000000000, 'H'), ns = ns MOD 3600000000000; END IF;
    IF unit <> 'second' AND ns >= 60000000000 THEN SET t = CONCAT(t, ns DIV 60000000000, 'M'), ns = ns MOD 60000000000; END IF;
    IF ns > 0 THEN
        SET f = ns MOD 1000000000;
        SET t = CONCAT(t, ns DIV 1000000000, IF(f > 0, CONCAT('.', TRIM(TRAILING '0' FROM LPAD(f, 9, '0'))), ''), 'S');
    END IF;
    IF r = '' AND t = '' THEN RETURN 'PT0S'; END IF;
    RETURN CONCAT(IF(neg, '-', ''), 'P', r, IF(t = '', '', CONCAT('T', t)));
END
//
DELIMITER ;

-- ===== tsq_duration_round =====
DROP FUNCTION IF EXISTS tsq_duration_round;
DELIMITER //
CREATE FUNCTION tsq_duration_round(y1 INT, m1 INT, d1 INT, ns1 BIGINT, y2 INT, m2 INT, d2 INT, ns2 BIGINT, largest_unit VARCHAR(5), smallest_unit VARCHAR(11), increment BIGINT, rounding_mode VARCHAR(10), negation INT) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
BEGIN
    DECLARE v_day DECIMAL(65) DEFAULT 86400000000000;
    DECLARE v_one DATE;
    DECLARE v_two DATE;
    DECLARE v_adjusted DATE;
    DECLARE v_t BIGINT;
    DECLARE v_k INT;
    DECLARE v_ya INT;
    DECLARE v_ma INT;
    DECLARE v_da INT;
    DECLARE v_years BIGINT DEFAULT 0;
    DECLARE v_months BIGINT DEFAULT 0;
    DECLARE v_weeks BIGINT DEFAULT 0;
    DECLARE v_days BIGINT;
    DECLARE v_sign BIGINT;
    DECLARE v_mode VARCHAR(12);
    DECLARE v_r1 BIGINT;
    DECLARE v_start DATE;
    DECLARE v_end DATE;
    DECLARE v_num DECIMAL(65);
    DECLARE v_den DECIMAL(65);
    DECLARE v_whole DECIMAL(65);
    DECLARE v_rest DECIMAL(65);
    DECLARE v_steps BIGINT;
    DECLARE v_step BIGINT;
    DECLARE v_to_round BIGINT;
    DECLARE v_rounded BIGINT;
    IF y1 IS NULL OR m1 IS NULL OR d1 IS NULL OR ns1 IS NULL OR y2 IS NULL OR m2 IS NULL OR d2 IS NULL OR ns2 IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
    SET v_one = DATE_ADD(DATE_ADD(MAKEDATE(y1, 1), INTERVAL m1 - 1 MONTH), INTERVAL d1 - 1 DAY);
    SET v_two = DATE_ADD(DATE_ADD(MAKEDATE(y2, 1), INTERVAL m2 - 1 MONTH), INTERVAL d2 - 1 DAY);
    SET v_adjusted = v_two, v_t = ns2 - ns1;
    IF v_t > 0 AND v_two < v_one THEN
        SET v_adjusted = DATE_ADD(v_two, INTERVAL 1 DAY), v_t = v_t - v_day;
    ELSEIF v_t < 0 AND v_two > v_one THEN
        SET v_adjusted = DATE_SUB(v_two, INTERVAL 1 DAY), v_t = v_t + v_day;
    END IF;
    IF largest_unit = 'week' THEN
        SET v_weeks = DATEDIFF(v_adjusted, v_one) DIV 7;
        SET v_days = DATEDIFF(v_adjusted, v_one) - v_weeks * 7;
    ELSE
        SET v_ya = YEAR(v_adjusted), v_ma = MONTH(v_adjusted), v_da = DAY(v_adjusted);
        SET v_k = ((v_ya * 12 + v_ma) * 32 + v_da - (y1 * 12 + m1) * 32 - d1) DIV 32;
        IF largest_unit = 'year' THEN SET v_years = v_k DIV 12; END IF;
        SET v_months = v_k - v_years * 12;
        SET v_days = DATEDIFF(v_adjusted, DATE_ADD(v_one, INTERVAL v_k MONTH));
    END IF;
    SET v_sign = IF(v_two < v_one OR v_two = v_one AND ns2 < ns1, -1, 1);
    SET v_mode = CASE rounding_mode
        WHEN 'ceil' THEN IF(v_sign < 0, 'zero', 'infinity')
        WHEN 'floor' THEN IF(v_sign < 0, 'infinity', 'zero')
        WHEN 'halfCeil' THEN IF(v_sign < 0, 'halfZero', 'halfInfinity')
        WHEN 'halfFloor' THEN IF(v_sign < 0, 'halfInfinity', 'halfZero')
        WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
        ELSE 'halfEven' END;
    IF smallest_unit IN ('year', 'month', 'week') THEN
        IF smallest_unit = 'year' THEN
            SET v_r1 = v_years DIV increment * increment;
            SET v_start = DATE_ADD(v_one, INTERVAL v_r1 * 12 MONTH);
            SET v_end = DATE_ADD(v_one, INTERVAL (v_r1 + increment * v_sign) * 12 MONTH);
        ELSEIF smallest_unit = 'month' THEN
            SET v_r1 = v_months DIV increment * increment;
            SET v_start = DATE_ADD(v_one, INTERVAL v_years * 12 + v_r1 MONTH);
            SET v_end = DATE_ADD(v_one, INTERVAL v_years * 12 + v_r1 + increment * v_sign MONTH);
        ELSE
            SET v_r1 = IF(largest_unit = 'week', v_weeks, v_days DIV 7) DIV increment * increment;
            SET v_start = DATE_ADD(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), INTERVAL v_r1 * 7 DAY);
            SET v_end = DATE_ADD(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), INTERVAL (v_r1 + increment * v_sign) * 7 DAY);
        END IF;
        SET v_num = ABS(DATEDIFF(v_two, v_start) * v_day + ns2 - ns1);
        SET v_den = ABS(DATEDIFF(v_end, v_start) * v_day);
        SET v_whole = v_num DIV v_den;
        SET v_rest = v_num - v_whole * v_den;
        SET v_steps = v_whole + IF(v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_den OR 2 * v_rest = v_den AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND (ABS(v_r1) DIV increment + v_whole) % 2 <> 0))), 1, 0);
        SET v_days = 0, v_t = 0;
        IF smallest_unit = 'year' THEN
            SET v_years = v_r1 + increment * v_sign * v_steps, v_months = 0;
        ELSEIF smallest_unit = 'month' THEN
            SET v_months = v_r1 + increment * v_sign * v_steps;
            IF v_steps > 0 AND largest_unit = 'year' AND v_sign * DATEDIFF(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), DATE_ADD(v_one, INTERVAL (v_years + v_sign) * 12 MONTH)) >= 0 THEN
                SET v_years = v_years + v_sign, v_months = 0;
            END IF;
        ELSE
            SET v_weeks = v_r1 + increment * v_sign * v_steps;
        END IF;
    ELSE
        SET v_step = CASE smallest_unit WHEN 'day' THEN v_day WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
        SET v_to_round = v_days * v_day + v_t;
        SET v_rest = ABS(v_to_round % v_step);
        SET v_rounded = v_to_round - v_to_round % v_step;
        IF v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_step OR 2 * v_rest = v_step AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND (v_rounded DIV v_step) % 2 <> 0))) THEN
            SET v_rounded = v_rounded + v_step * v_sign;
        END IF;
        SET v_days = v_rounded DIV v_day;
        SET v_t = v_rounded - v_days * v_day;
        IF v_rounded DIV v_day <> v_to_round DIV v_day THEN
            IF largest_unit = 'week' THEN
                IF v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL (v_weeks + v_sign) * 7 DAY)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                    SET v_weeks = v_weeks + v_sign, v_days = 0, v_t = 0;
                END IF;
            ELSEIF v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL v_years * 12 + v_months + v_sign MONTH)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                SET v_days = 0, v_t = 0;
                IF largest_unit = 'year' AND v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL (v_years + v_sign) * 12 MONTH)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                    SET v_years = v_years + v_sign, v_months = 0;
                ELSE
                    SET v_months = v_months + v_sign;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN tsq_duration_text(v_years * negation, v_months * negation, v_weeks * negation, v_days * negation, v_t * negation, 'hour');
END
//
DELIMITER ;

-- ===== tsq_duration_total =====
DROP FUNCTION IF EXISTS tsq_duration_total;
DELIMITER //
CREATE FUNCTION tsq_duration_total(months BIGINT, weeks BIGINT, days BIGINT, seconds BIGINT, nanoseconds BIGINT, y INT, m INT, d INT, unit VARCHAR(11)) RETURNS DOUBLE DETERMINISTIC NO SQL
BEGIN
    DECLARE v_day DECIMAL(65, 0) DEFAULT 86400000000000;
    DECLARE v_t DECIMAL(65, 0);
    DECLARE v_time_of_day DECIMAL(65, 0);
    DECLARE v_one DATE;
    DECLARE v_two DATE;
    DECLARE v_adjusted DATE;
    DECLARE v_sign INT;
    DECLARE v_k INT;
    DECLARE v_ya INT;
    DECLARE v_ma INT;
    DECLARE v_da INT;
    DECLARE v_r1 INT;
    DECLARE v_start DATE;
    DECLARE v_end DATE;
    DECLARE v_a DECIMAL(65, 0);
    DECLARE v_b DECIMAL(65, 0);
    DECLARE v_x DECIMAL(65, 0);
    DECLARE v_s INT DEFAULT 0;
    DECLARE v_q DECIMAL(65, 0);
    DECLARE v_rest DECIMAL(65, 0);
    DECLARE v_result DOUBLE;
    IF months IS NULL OR weeks IS NULL OR days IS NULL OR seconds IS NULL OR nanoseconds IS NULL OR y IS NULL OR m IS NULL OR d IS NULL OR unit IS NULL THEN RETURN NULL; END IF;
    SET v_t = seconds * CAST(1000000000 AS DECIMAL(65, 0)) + nanoseconds;
    IF m = 0 THEN
        IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
            SIGNAL SQLSTATE '22023' SET MESSAGE_TEXT = 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference';
        END IF;
        SET v_a = days * v_day + v_t;
    ELSE
        -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
        SET v_time_of_day = MOD(v_t, v_day);
        IF v_time_of_day < 0 THEN SET v_time_of_day = v_time_of_day + v_day; END IF;
        SET v_one = DATE_ADD(DATE_ADD(MAKEDATE(y, 1), INTERVAL m - 1 MONTH), INTERVAL d - 1 DAY);
        SET v_two = DATE_ADD(DATE_ADD(v_one, INTERVAL months MONTH), INTERVAL weeks * 7 + days + (v_t - v_time_of_day) DIV v_day DAY);
        IF unit IN ('year', 'month', 'week') THEN
            IF v_two = v_one AND v_time_of_day = 0 THEN RETURN 0; END IF;
            -- The whole units to the end without passing it (as until), and the progress to the next one
            SET v_adjusted = IF(v_time_of_day > 0 AND v_two < v_one, DATE_ADD(v_two, INTERVAL 1 DAY), v_two);
            SET v_sign = IF(DATEDIFF(v_two, v_one) * v_day + v_time_of_day < 0, -1, 1);
            IF unit = 'week' THEN
                SET v_r1 = DATEDIFF(v_adjusted, v_one) DIV 7;
            ELSE
                SET v_ya = YEAR(v_adjusted), v_ma = MONTH(v_adjusted), v_da = DAY(v_adjusted);
                SET v_k = ((v_ya * 12 + v_ma) * 32 + v_da - (y * 12 + m) * 32 - d) DIV 32;
                SET v_r1 = IF(unit = 'month', v_k, v_k DIV 12);
            END IF;
            SET v_start = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * v_r1 DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1, 12 * v_r1) MONTH));
            SET v_end = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * (v_r1 + v_sign) DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1 + v_sign, 12 * (v_r1 + v_sign)) MONTH));
            IF ABS(DATEDIFF(v_two, v_start) * v_day + v_time_of_day) >= ABS(DATEDIFF(v_end, v_start) * v_day) THEN
                -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                SET v_r1 = v_r1 + v_sign, v_start = v_end;
                SET v_end = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * (v_r1 + v_sign) DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1 + v_sign, 12 * (v_r1 + v_sign)) MONTH));
            END IF;
            SET v_b = ABS(DATEDIFF(v_end, v_start) * v_day);
            SET v_a = v_r1 * v_b + v_sign * ABS(DATEDIFF(v_two, v_start) * v_day + v_time_of_day);
        ELSE
            SET v_a = DATEDIFF(v_two, v_one) * v_day + v_time_of_day;
        END IF;
    END IF;
    IF unit NOT IN ('year', 'month', 'week') THEN
        SET v_b = CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
    END IF;
    -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
    IF v_a = 0 THEN RETURN 0; END IF;
    SET v_x = ABS(v_a);
    WHILE v_x >= v_b * 9007199254740992 DO
        SET v_b = v_b * 2, v_s = v_s - 1;
    END WHILE;
    WHILE v_x < v_b * 4503599627370496 DO
        SET v_x = v_x * 2, v_s = v_s + 1;
    END WHILE;
    SET v_rest = MOD(v_x, v_b);
    SET v_q = (v_x - v_rest) / v_b;
    IF 2 * v_rest > v_b OR 2 * v_rest = v_b AND MOD(v_q, 2) = 1 THEN SET v_q = v_q + 1; END IF;
    SET v_result = v_q;
    RETURN IF(v_a < 0, -1, 1) * v_result * POW(2, -v_s);
END
//
DELIMITER ;

-- ===== tsq_duration_add =====
DROP FUNCTION IF EXISTS tsq_duration_add;
DELIMITER //
CREATE FUNCTION tsq_duration_add(largest1 INT, days1 BIGINT, seconds1 BIGINT, nanoseconds1 BIGINT, largest2 INT, days2 BIGINT, seconds2 BIGINT, nanoseconds2 BIGINT, sgn INT) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
BEGIN
    DECLARE v_day DECIMAL(65, 0) DEFAULT 86400000000000;
    DECLARE v_largest INT;
    DECLARE v_total DECIMAL(65, 0);
    DECLARE v_days DECIMAL(65, 0) DEFAULT 0;
    IF largest1 IS NULL OR days1 IS NULL OR seconds1 IS NULL OR nanoseconds1 IS NULL OR largest2 IS NULL OR days2 IS NULL OR seconds2 IS NULL OR nanoseconds2 IS NULL OR sgn IS NULL THEN RETURN NULL; END IF;
    SET v_largest = LEAST(largest1, largest2);
    IF v_largest <= 2 THEN
        SIGNAL SQLSTATE '22023' SET MESSAGE_TEXT = 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted';
    END IF;
    SET v_total = (days1 + sgn * days2) * v_day + (seconds1 + sgn * seconds2) * CAST(1000000000 AS DECIMAL(65, 0)) + nanoseconds1 + sgn * nanoseconds2;
    IF v_largest = 3 THEN SET v_days = (v_total - MOD(v_total, v_day)) DIV v_day; END IF;
    RETURN tsq_duration_text(0, 0, 0, v_days, v_total - v_days * v_day, CASE WHEN v_largest <= 4 THEN 'hour' WHEN v_largest = 5 THEN 'minute' ELSE 'second' END);
END
//
DELIMITER ;
