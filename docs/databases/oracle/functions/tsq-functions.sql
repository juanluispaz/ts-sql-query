-- Oracle: the functions of the library ts-sql-query, and the ones of its settings of functions, in the order to create them.
-- See https://ts-sql-query.readthedocs.io/en/latest/databases/oracle/functions/
-- Run it with: sqlplus <user>/<password>@<service> @tsq-functions.sql

-- ===== tsq_duration_part =====
CREATE OR REPLACE FUNCTION tsq_duration_part(d IN VARCHAR2, part IN VARCHAR2) RETURN NUMBER DETERMINISTIC IS
    s VARCHAR2(100);
    i PLS_INTEGER := 1;
    n PLS_INTEGER;
    c VARCHAR2(1);
    num VARCHAR2(40);
    in_time BOOLEAN := FALSE;
    sgn NUMBER := 1;
    r NUMBER := 0;
    nonzero BOOLEAN := FALSE;
    lg NUMBER := 10;
    f NUMBER;
BEGIN
    IF d IS NULL THEN RETURN NULL; END IF;
    s := UPPER(TRIM(d));
    n := LENGTH(s);
    IF SUBSTR(s, 1, 1) = '-' THEN sgn := -1; i := 2; ELSIF SUBSTR(s, 1, 1) = '+' THEN i := 2; END IF;
    i := i + 1;
    WHILE i <= n LOOP
        c := SUBSTR(s, i, 1);
        IF c = 'T' THEN in_time := TRUE;
        ELSIF c BETWEEN '0' AND '9' OR c = '.' OR c = ',' THEN num := num || CASE WHEN c = ',' THEN '.' ELSE c END;
        ELSE
            IF TRANSLATE(num, 'x0.', 'x') IS NOT NULL THEN
                nonzero := TRUE;
                f := TO_NUMBER(RPAD(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, INSTR(num, '.') + 1) END || '0', 9, '0'));
                lg := LEAST(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                    WHEN TO_NUMBER(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, 1, INSTR(num, '.') - 1) ELSE num END) <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
            END IF;
            IF part = 'M' AND NOT in_time AND c = 'Y' THEN r := r + 12 * TO_NUMBER(num);
            ELSIF part = 'M' AND NOT in_time AND c = 'M' THEN r := r + TO_NUMBER(num);
            ELSIF part = 'D' AND c = 'W' THEN r := r + 7 * TO_NUMBER(num);
            ELSIF part = 'D' AND c = 'D' THEN r := r + TO_NUMBER(num);
            ELSIF part = 'S' AND in_time AND c = 'H' THEN r := r + 3600 * TO_NUMBER(num);
            ELSIF part = 'S' AND in_time AND c = 'M' THEN r := r + 60 * TO_NUMBER(num);
            ELSIF part = 'S' AND c = 'S' THEN r := r + TO_NUMBER(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, 1, INSTR(num, '.') - 1) ELSE num END);
            ELSIF part = 'N' AND c = 'S' AND INSTR(num, '.') > 0 THEN r := TO_NUMBER(RPAD(SUBSTR(num, INSTR(num, '.') + 1), 9, '0'));
            ELSIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN r := TO_NUMBER(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, 1, INSTR(num, '.') - 1) ELSE num END);
            END IF;
            num := NULL;
        END IF;
        i := i + 1;
    END LOOP;
    IF part = 'sign' THEN RETURN CASE WHEN nonzero THEN sgn ELSE 0 END; END IF;
    IF part = 'largest' THEN RETURN lg; END IF;
    RETURN sgn * r;
END;
/

-- ===== tsq_duration_text =====
CREATE OR REPLACE FUNCTION tsq_duration_text(y IN NUMBER, mo IN NUMBER, w IN NUMBER, d IN NUMBER, ns IN NUMBER, unit IN VARCHAR2) RETURN VARCHAR2 DETERMINISTIC IS
    r VARCHAR2(100);
    t VARCHAR2(100);
    v_y NUMBER := y;
    v_mo NUMBER := mo;
    v_w NUMBER := w;
    v_d NUMBER := d;
    v_ns NUMBER := ns;
    rest NUMBER;
    f NUMBER;
BEGIN
    IF y IS NULL OR mo IS NULL OR w IS NULL OR d IS NULL OR ns IS NULL THEN RETURN NULL; END IF;
    IF unit = 'year' THEN v_y := v_y + TRUNC(v_mo / 12); v_mo := MOD(v_mo, 12); END IF;
    IF unit IN ('week', 'day') THEN
        v_d := v_d + TRUNC(v_ns / 86400000000000);
        v_ns := MOD(v_ns, 86400000000000);
        IF unit = 'week' THEN v_w := v_w + TRUNC(v_d / 7); v_d := MOD(v_d, 7); END IF;
    END IF;
    IF v_y <> 0 THEN r := r || TO_CHAR(ABS(v_y)) || 'Y'; END IF;
    IF v_mo <> 0 THEN r := r || TO_CHAR(ABS(v_mo)) || 'M'; END IF;
    IF v_w <> 0 THEN r := r || TO_CHAR(ABS(v_w)) || 'W'; END IF;
    IF v_d <> 0 THEN r := r || TO_CHAR(ABS(v_d)) || 'D'; END IF;
    rest := ABS(v_ns);
    IF unit IN ('week', 'day', 'hour') AND rest >= 3600000000000 THEN t := t || TO_CHAR(TRUNC(rest / 3600000000000)) || 'H'; rest := MOD(rest, 3600000000000); END IF;
    IF unit <> 'second' AND rest >= 60000000000 THEN t := t || TO_CHAR(TRUNC(rest / 60000000000)) || 'M'; rest := MOD(rest, 60000000000); END IF;
    IF rest > 0 THEN
        f := MOD(rest, 1000000000);
        t := t || TO_CHAR(TRUNC(rest / 1000000000));
        IF f > 0 THEN t := t || '.' || RTRIM(LPAD(TO_CHAR(f), 9, '0'), '0'); END IF;
        t := t || 'S';
    END IF;
    IF r IS NULL AND t IS NULL THEN RETURN 'PT0S'; END IF;
    RETURN CASE WHEN v_y < 0 OR v_mo < 0 OR v_w < 0 OR v_d < 0 OR v_ns < 0 THEN '-' END || 'P' || r || CASE WHEN t IS NOT NULL THEN 'T' || t END;
END;
/

-- ===== tsq_duration_round =====
CREATE OR REPLACE FUNCTION tsq_duration_round(y1 IN NUMBER, m1 IN NUMBER, d1 IN NUMBER, ns1 IN NUMBER, y2 IN NUMBER, m2 IN NUMBER, d2 IN NUMBER, ns2 IN NUMBER, largest_unit IN VARCHAR2, smallest_unit IN VARCHAR2, increment IN NUMBER, rounding_mode IN VARCHAR2, negation IN NUMBER) RETURN VARCHAR2 DETERMINISTIC IS
    v_day CONSTANT NUMBER := 86400000000000;
    v_one DATE;
    v_two DATE;
    v_adjusted DATE;
    v_t NUMBER;
    v_k NUMBER;
    v_years NUMBER := 0;
    v_months NUMBER := 0;
    v_weeks NUMBER := 0;
    v_days NUMBER;
    v_sign NUMBER;
    v_mode VARCHAR2(12);
    v_r1 NUMBER;
    v_start DATE;
    v_end DATE;
    v_num NUMBER;
    v_den NUMBER;
    v_whole NUMBER;
    v_rest NUMBER;
    v_steps NUMBER;
    v_step NUMBER;
    v_to_round NUMBER;
    v_rounded NUMBER;
    -- add_months gives the last day of a month to the last day of another: the days it moves past the day are taken back
    FUNCTION plus_months(d IN DATE, k IN NUMBER) RETURN DATE IS
    BEGIN
        RETURN ADD_MONTHS(d, k) - GREATEST(0, EXTRACT(DAY FROM ADD_MONTHS(d, k)) - EXTRACT(DAY FROM d));
    END;
BEGIN
    IF y1 IS NULL OR m1 IS NULL OR d1 IS NULL OR ns1 IS NULL OR y2 IS NULL OR m2 IS NULL OR d2 IS NULL OR ns2 IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
    v_one := ADD_MONTHS(DATE '0001-01-01', (y1 - 1) * 12 + m1 - 1) + d1 - 1;
    v_two := ADD_MONTHS(DATE '0001-01-01', (y2 - 1) * 12 + m2 - 1) + d2 - 1;
    v_adjusted := v_two;
    v_t := ns2 - ns1;
    IF v_t > 0 AND v_two < v_one THEN
        v_adjusted := v_two + 1;
        v_t := v_t - v_day;
    ELSIF v_t < 0 AND v_two > v_one THEN
        v_adjusted := v_two - 1;
        v_t := v_t + v_day;
    END IF;
    IF largest_unit = 'week' THEN
        v_weeks := TRUNC((v_adjusted - v_one) / 7);
        v_days := (v_adjusted - v_one) - v_weeks * 7;
    ELSE
        v_k := TRUNC(((EXTRACT(YEAR FROM v_adjusted) * 12 + EXTRACT(MONTH FROM v_adjusted)) * 32 + EXTRACT(DAY FROM v_adjusted) - (y1 * 12 + m1) * 32 - d1) / 32);
        IF largest_unit = 'year' THEN v_years := TRUNC(v_k / 12); END IF;
        v_months := v_k - v_years * 12;
        v_days := v_adjusted - plus_months(v_one, v_k);
    END IF;
    v_sign := CASE WHEN (v_two - v_one) * v_day + ns2 - ns1 < 0 THEN -1 ELSE 1 END;
    v_mode := CASE rounding_mode
        WHEN 'ceil' THEN CASE WHEN v_sign < 0 THEN 'zero' ELSE 'infinity' END
        WHEN 'floor' THEN CASE WHEN v_sign < 0 THEN 'infinity' ELSE 'zero' END
        WHEN 'halfCeil' THEN CASE WHEN v_sign < 0 THEN 'halfZero' ELSE 'halfInfinity' END
        WHEN 'halfFloor' THEN CASE WHEN v_sign < 0 THEN 'halfInfinity' ELSE 'halfZero' END
        WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
        ELSE 'halfEven' END;
    IF smallest_unit IN ('year', 'month', 'week') THEN
        IF smallest_unit = 'year' THEN
            v_r1 := TRUNC(v_years / increment) * increment;
            v_start := plus_months(v_one, v_r1 * 12);
            v_end := plus_months(v_one, (v_r1 + increment * v_sign) * 12);
        ELSIF smallest_unit = 'month' THEN
            v_r1 := TRUNC(v_months / increment) * increment;
            v_start := plus_months(v_one, v_years * 12 + v_r1);
            v_end := plus_months(v_one, v_years * 12 + v_r1 + increment * v_sign);
        ELSE
            v_r1 := TRUNC(CASE WHEN largest_unit = 'week' THEN v_weeks ELSE TRUNC(v_days / 7) END / increment) * increment;
            v_start := plus_months(v_one, v_years * 12 + v_months) + v_r1 * 7;
            v_end := plus_months(v_one, v_years * 12 + v_months) + (v_r1 + increment * v_sign) * 7;
        END IF;
        v_num := ABS((v_two - v_start) * v_day + ns2 - ns1);
        v_den := ABS((v_end - v_start) * v_day);
        v_whole := TRUNC(v_num / v_den);
        v_rest := v_num - v_whole * v_den;
        v_steps := v_whole + CASE WHEN v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_den OR 2 * v_rest = v_den AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND MOD(TRUNC(ABS(v_r1) / increment) + v_whole, 2) <> 0))) THEN 1 ELSE 0 END;
        v_days := 0;
        v_t := 0;
        IF smallest_unit = 'year' THEN
            v_years := v_r1 + increment * v_sign * v_steps;
            v_months := 0;
        ELSIF smallest_unit = 'month' THEN
            v_months := v_r1 + increment * v_sign * v_steps;
            IF v_steps > 0 AND largest_unit = 'year' AND v_sign * (plus_months(v_one, v_years * 12 + v_months) - plus_months(v_one, (v_years + v_sign) * 12)) >= 0 THEN
                v_years := v_years + v_sign;
                v_months := 0;
            END IF;
        ELSE
            v_weeks := v_r1 + increment * v_sign * v_steps;
        END IF;
    ELSE
        v_step := CASE smallest_unit WHEN 'day' THEN v_day WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
        v_to_round := v_days * v_day + v_t;
        v_rest := ABS(MOD(v_to_round, v_step));
        v_rounded := v_to_round - MOD(v_to_round, v_step);
        IF v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_step OR 2 * v_rest = v_step AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND MOD(TRUNC(v_rounded / v_step), 2) <> 0))) THEN
            v_rounded := v_rounded + v_step * v_sign;
        END IF;
        v_days := TRUNC(v_rounded / v_day);
        v_t := v_rounded - v_days * v_day;
        IF TRUNC(v_rounded / v_day) <> TRUNC(v_to_round / v_day) THEN
            IF largest_unit = 'week' THEN
                IF v_sign * ((v_two - (v_one + (v_weeks + v_sign) * 7)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                    v_weeks := v_weeks + v_sign;
                    v_days := 0;
                    v_t := 0;
                END IF;
            ELSIF v_sign * ((v_two - plus_months(v_one, v_years * 12 + v_months + v_sign)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                v_days := 0;
                v_t := 0;
                IF largest_unit = 'year' AND v_sign * ((v_two - plus_months(v_one, (v_years + v_sign) * 12)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                    v_years := v_years + v_sign;
                    v_months := 0;
                ELSE
                    v_months := v_months + v_sign;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN tsq_duration_text(v_years * negation, v_months * negation, v_weeks * negation, v_days * negation, v_t * negation, 'hour');
END;
/

-- ===== tsq_duration_total =====
CREATE OR REPLACE FUNCTION tsq_duration_total(months IN NUMBER, weeks IN NUMBER, days IN NUMBER, seconds IN NUMBER, nanoseconds IN NUMBER, y IN NUMBER, m IN NUMBER, d IN NUMBER, unit IN VARCHAR2) RETURN BINARY_DOUBLE DETERMINISTIC IS
    v_day CONSTANT NUMBER := 86400000000000;
    v_t NUMBER;
    v_time_of_day NUMBER;
    v_one DATE;
    v_two DATE;
    v_adjusted DATE;
    v_sign NUMBER;
    v_k NUMBER;
    v_r1 NUMBER;
    v_start DATE;
    v_end DATE;
    v_a NUMBER;
    v_b NUMBER;
    v_x NUMBER;
    v_s NUMBER := 0;
    v_q NUMBER;
    v_rest NUMBER;
    -- add_months gives the last day of a month to the last day of another: the days it moves past the day are taken back
    FUNCTION plus_months(dt IN DATE, k IN NUMBER) RETURN DATE IS
    BEGIN
        RETURN ADD_MONTHS(dt, k) - GREATEST(0, EXTRACT(DAY FROM ADD_MONTHS(dt, k)) - EXTRACT(DAY FROM dt));
    END;
    -- The date plus a number of weeks, months or years, the day kept in the month
    FUNCTION units_from(n IN NUMBER) RETURN DATE IS
    BEGIN
        RETURN CASE WHEN unit = 'week' THEN v_one + 7 * n ELSE plus_months(v_one, CASE WHEN unit = 'month' THEN n ELSE 12 * n END) END;
    END;
BEGIN
    IF months IS NULL OR weeks IS NULL OR days IS NULL OR seconds IS NULL OR nanoseconds IS NULL OR y IS NULL OR m IS NULL OR d IS NULL OR unit IS NULL THEN RETURN NULL; END IF;
    v_t := seconds * 1000000000 + nanoseconds;
    IF m = 0 THEN
        IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
            RAISE_APPLICATION_ERROR(-20001, 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference');
        END IF;
        v_a := days * v_day + v_t;
    ELSE
        -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
        v_time_of_day := MOD(v_t, v_day);
        IF v_time_of_day < 0 THEN v_time_of_day := v_time_of_day + v_day; END IF;
        v_one := ADD_MONTHS(DATE '0001-01-01', (y - 1) * 12 + m - 1) + d - 1;
        v_two := plus_months(v_one, months) + weeks * 7 + days + (v_t - v_time_of_day) / v_day;
        IF unit IN ('year', 'month', 'week') THEN
            IF v_two = v_one AND v_time_of_day = 0 THEN RETURN 0; END IF;
            -- The whole units to the end without passing it (as until), and the progress to the next one
            v_adjusted := CASE WHEN v_time_of_day > 0 AND v_two < v_one THEN v_two + 1 ELSE v_two END;
            v_sign := CASE WHEN (v_two - v_one) * v_day + v_time_of_day < 0 THEN -1 ELSE 1 END;
            IF unit = 'week' THEN
                v_r1 := TRUNC((v_adjusted - v_one) / 7);
            ELSE
                v_k := TRUNC(((EXTRACT(YEAR FROM v_adjusted) * 12 + EXTRACT(MONTH FROM v_adjusted)) * 32 + EXTRACT(DAY FROM v_adjusted) - (y * 12 + m) * 32 - d) / 32);
                v_r1 := CASE WHEN unit = 'month' THEN v_k ELSE TRUNC(v_k / 12) END;
            END IF;
            v_start := units_from(v_r1);
            v_end := units_from(v_r1 + v_sign);
            IF ABS((v_two - v_start) * v_day + v_time_of_day) >= ABS((v_end - v_start) * v_day) THEN
                -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                v_r1 := v_r1 + v_sign;
                v_start := v_end;
                v_end := units_from(v_r1 + v_sign);
            END IF;
            v_b := ABS((v_end - v_start) * v_day);
            v_a := v_r1 * v_b + v_sign * ABS((v_two - v_start) * v_day + v_time_of_day);
        ELSE
            v_a := (v_two - v_one) * v_day + v_time_of_day;
        END IF;
    END IF;
    IF unit NOT IN ('year', 'month', 'week') THEN
        v_b := CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
    END IF;
    -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
    IF v_a = 0 THEN RETURN 0; END IF;
    v_x := ABS(v_a);
    WHILE v_x >= v_b * 9007199254740992 LOOP
        v_b := v_b * 2;
        v_s := v_s - 1;
    END LOOP;
    WHILE v_x < v_b * 4503599627370496 LOOP
        v_x := v_x * 2;
        v_s := v_s + 1;
    END LOOP;
    v_rest := MOD(v_x, v_b);
    v_q := (v_x - v_rest) / v_b;
    IF 2 * v_rest > v_b OR 2 * v_rest = v_b AND MOD(v_q, 2) = 1 THEN v_q := v_q + 1; END IF;
    RETURN CASE WHEN v_a < 0 THEN -1 ELSE 1 END * TO_BINARY_DOUBLE(v_q) * POWER(2d, -v_s);
END;
/

-- ===== tsq_duration_add =====
CREATE OR REPLACE FUNCTION tsq_duration_add(largest1 IN NUMBER, days1 IN NUMBER, seconds1 IN NUMBER, nanoseconds1 IN NUMBER, largest2 IN NUMBER, days2 IN NUMBER, seconds2 IN NUMBER, nanoseconds2 IN NUMBER, sgn IN NUMBER) RETURN VARCHAR2 DETERMINISTIC IS
    v_day CONSTANT NUMBER := 86400000000000;
    v_largest NUMBER;
    v_total NUMBER;
    v_days NUMBER := 0;
BEGIN
    IF largest1 IS NULL OR days1 IS NULL OR seconds1 IS NULL OR nanoseconds1 IS NULL OR largest2 IS NULL OR days2 IS NULL OR seconds2 IS NULL OR nanoseconds2 IS NULL OR sgn IS NULL THEN RETURN NULL; END IF;
    v_largest := LEAST(largest1, largest2);
    IF v_largest <= 2 THEN
        RAISE_APPLICATION_ERROR(-20001, 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted');
    END IF;
    v_total := (days1 + sgn * days2) * v_day + (seconds1 + sgn * seconds2) * 1000000000 + nanoseconds1 + sgn * nanoseconds2;
    IF v_largest = 3 THEN v_days := TRUNC(v_total / v_day); END IF;
    RETURN tsq_duration_text(0, 0, 0, v_days, v_total - v_days * v_day, CASE WHEN v_largest <= 4 THEN 'hour' WHEN v_largest = 5 THEN 'minute' ELSE 'second' END);
END;
/

-- ===== tsq_zoned_of_wall =====
CREATE OR REPLACE FUNCTION tsq_zoned_of_wall(wall IN TIMESTAMP_UNCONSTRAINED, zone IN VARCHAR2, disambiguation IN VARCHAR2, preferred_offset IN VARCHAR2 DEFAULT NULL) RETURN TIMESTAMP_TZ_UNCONSTRAINED DETERMINISTIC IS
    v_candidate TIMESTAMP_TZ_UNCONSTRAINED;
    v_before TIMESTAMP_UNCONSTRAINED;
    v_after TIMESTAMP_UNCONSTRAINED;
    v_is_before BOOLEAN;
    v_is_after BOOLEAN;
    -- The wall clock in the zone of an instant (its wall clock in UTC)
    FUNCTION wall_of(u IN TIMESTAMP_UNCONSTRAINED) RETURN TIMESTAMP_UNCONSTRAINED IS
        v_z TIMESTAMP_TZ_UNCONSTRAINED;
        v_w TIMESTAMP_UNCONSTRAINED;
    BEGIN
        v_z := FROM_TZ(u, '+00:00') AT TIME ZONE zone;
        v_w := v_z;
        RETURN v_w;
    END;
BEGIN
    IF wall IS NULL OR zone IS NULL OR disambiguation IS NULL THEN
        RETURN NULL;
    END IF;
    IF preferred_offset IS NOT NULL THEN
        v_candidate := FROM_TZ(wall, preferred_offset) AT TIME ZONE zone;
        IF wall_of(SYS_EXTRACT_UTC(v_candidate)) = wall THEN
            RETURN v_candidate;
        END IF;
    END IF;
    -- The wall clock minus the offset of the zone a day before and a day after it: an instant of it when the zone gives
    -- it back (two for a wall clock it repeats, none for one it skips)
    v_before := wall - (wall_of(wall - INTERVAL '1' DAY) - (wall - INTERVAL '1' DAY));
    v_after := wall - (wall_of(wall + INTERVAL '1' DAY) - (wall + INTERVAL '1' DAY));
    v_is_before := wall_of(v_before) = wall;
    v_is_after := wall_of(v_after) = wall;
    IF disambiguation = 'reject' AND v_is_before = v_is_after AND (NOT v_is_before OR v_before <> v_after) THEN
        RAISE_APPLICATION_ERROR(-20001, 'tsq_zoned_of_wall: the wall clock is not one instant in ' || zone);
    END IF;
    IF disambiguation = 'later' THEN
        RETURN FROM_TZ(CASE WHEN v_is_after THEN v_after ELSE v_before END, '+00:00') AT TIME ZONE zone;
    ELSIF disambiguation = 'compatible' THEN
        RETURN FROM_TZ(CASE WHEN v_is_before OR NOT v_is_after THEN v_before ELSE v_after END, '+00:00') AT TIME ZONE zone;
    END IF;
    RETURN FROM_TZ(CASE WHEN v_is_before THEN v_before ELSE v_after END, '+00:00') AT TIME ZONE zone;
END;
/

-- ===== tsq_zoned_until =====
CREATE OR REPLACE FUNCTION tsq_zoned_until(one IN TIMESTAMP_TZ_UNCONSTRAINED, two IN TIMESTAMP_TZ_UNCONSTRAINED, largest_unit IN VARCHAR2, smallest_unit IN VARCHAR2, increment IN NUMBER, rounding_mode IN VARCHAR2, negation IN NUMBER) RETURN VARCHAR2 DETERMINISTIC IS
    v_zone VARCHAR2(100);
    v_u1 TIMESTAMP_UNCONSTRAINED;
    v_u2 TIMESTAMP_UNCONSTRAINED;
    v_w1 TIMESTAMP_UNCONSTRAINED;
    v_w2 TIMESTAMP_UNCONSTRAINED;
    v_d1 DATE;
    v_t1 NUMBER;
    v_sign NUMBER;
    v_years NUMBER := 0;
    v_months NUMBER := 0;
    v_weeks NUMBER := 0;
    v_days NUMBER := 0;
    v_t NUMBER := 0;
    v_inter DATE;
    v_correction NUMBER;
    v_found BOOLEAN := FALSE;
    v_m NUMBER;
    v_r1 NUMBER;
    v_r2 NUMBER;
    v_start TIMESTAMP_UNCONSTRAINED;
    v_end TIMESTAMP_UNCONSTRAINED;
    v_nudged TIMESTAMP_UNCONSTRAINED;
    v_num NUMBER;
    v_den NUMBER;
    v_mode VARCHAR2(12);
    v_rounded NUMBER;
    v_step NUMBER;
    v_beyond NUMBER;
    v_expanded BOOLEAN := FALSE;
    v_unit NUMBER;
    v_largest NUMBER;
    v_ey NUMBER;
    v_em NUMBER;
    v_ew NUMBER;
    -- The nanoseconds of an interval
    FUNCTION ns_of(i IN DSINTERVAL_UNCONSTRAINED) RETURN NUMBER IS
    BEGIN
        RETURN ((EXTRACT(DAY FROM i) * 24 + EXTRACT(HOUR FROM i)) * 60 + EXTRACT(MINUTE FROM i)) * 60000000000 + EXTRACT(SECOND FROM i) * 1000000000;
    END;
    -- The wall clock in the zone of an instant (its wall clock in UTC)
    FUNCTION wall_of(u IN TIMESTAMP_UNCONSTRAINED) RETURN TIMESTAMP_UNCONSTRAINED IS
        v_z TIMESTAMP_TZ_UNCONSTRAINED;
        v_w TIMESTAMP_UNCONSTRAINED;
    BEGIN
        v_z := FROM_TZ(u, '+00:00') AT TIME ZONE v_zone;
        v_w := v_z;
        RETURN v_w;
    END;
    -- The instant (its wall clock in UTC) of a wall clock in the zone, as Temporal's 'compatible' disambiguates it
    FUNCTION utc_of(w IN TIMESTAMP_UNCONSTRAINED) RETURN TIMESTAMP_UNCONSTRAINED IS
    BEGIN
        RETURN SYS_EXTRACT_UTC(tsq_zoned_of_wall(w, v_zone, 'compatible'));
    END;
    -- A date plus years and months (the day kept in the month), weeks and days
    FUNCTION plus(d IN DATE, y IN NUMBER, mo IN NUMBER, w IN NUMBER, dd IN NUMBER) RETURN DATE IS
    BEGIN
        RETURN ADD_MONTHS(d, y * 12 + mo) - GREATEST(0, EXTRACT(DAY FROM ADD_MONTHS(d, y * 12 + mo)) - EXTRACT(DAY FROM d)) + w * 7 + dd;
    END;
    -- The instant of the first wall clock plus a duration of its date, in the zone
    FUNCTION utc_plus(y IN NUMBER, mo IN NUMBER, w IN NUMBER, dd IN NUMBER) RETURN TIMESTAMP_UNCONSTRAINED IS
        v_wall TIMESTAMP_UNCONSTRAINED;
    BEGIN
        v_wall := plus(v_d1, y, mo, w, dd);
        RETURN utc_of(v_wall + NUMTODSINTERVAL(v_t1 / 1000000000, 'SECOND'));
    END;
    -- Temporal's rounding mode for a value of a sign: 'zero', 'infinity', 'halfZero', 'halfInfinity' or 'halfEven'
    FUNCTION unsigned_mode(negative IN BOOLEAN) RETURN VARCHAR2 IS
    BEGIN
        RETURN CASE rounding_mode
            WHEN 'ceil' THEN CASE WHEN negative THEN 'zero' ELSE 'infinity' END
            WHEN 'floor' THEN CASE WHEN negative THEN 'infinity' ELSE 'zero' END
            WHEN 'halfCeil' THEN CASE WHEN negative THEN 'halfZero' ELSE 'halfInfinity' END
            WHEN 'halfFloor' THEN CASE WHEN negative THEN 'halfInfinity' ELSE 'halfZero' END
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
    END;
    -- Whether a value num / den between r1 (0) and r2 (1) is rounded to r2, as the unsigned mode says; r1 is the number of increments of r1
    FUNCTION to_second(m IN VARCHAR2, num IN NUMBER, den IN NUMBER, r1 IN NUMBER) RETURN BOOLEAN IS
    BEGIN
        IF num = 0 THEN RETURN FALSE; END IF;
        IF num = den THEN RETURN TRUE; END IF;
        IF m = 'zero' THEN RETURN FALSE; END IF;
        IF m = 'infinity' THEN RETURN TRUE; END IF;
        IF 2 * num < den THEN RETURN FALSE; END IF;
        IF 2 * num > den THEN RETURN TRUE; END IF;
        RETURN m = 'halfInfinity' OR m = 'halfEven' AND MOD(r1, 2) <> 0;
    END;
    -- A number of nanoseconds rounded to a multiple of a step, with the sign of the number: Temporal's RoundNumberToIncrement
    FUNCTION round_to(x IN NUMBER, step IN NUMBER) RETURN NUMBER IS
        v_q NUMBER := ABS(x) / step;
        v_low NUMBER := FLOOR(ABS(x) / step);
        v_result NUMBER;
    BEGIN
        v_result := v_low + CASE WHEN to_second(unsigned_mode(x < 0), v_q - v_low, 1, v_low) THEN 1 ELSE 0 END;
        RETURN SIGN(x) * v_result * step;
    END;
BEGIN
    IF one IS NULL OR two IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
    v_zone := TO_CHAR(one, 'TZR');
    IF UPPER(v_zone) <> UPPER(TO_CHAR(two, 'TZR')) THEN
        RAISE_APPLICATION_ERROR(-20001, 'tsq_zoned_until: a difference in days or larger units needs both zoned dates and times in the same time zone');
    END IF;
    v_u1 := SYS_EXTRACT_UTC(one);
    v_u2 := SYS_EXTRACT_UTC(two);
    IF v_u1 = v_u2 THEN
        RETURN tsq_duration_text(0, 0, 0, 0, 0, 'hour');
    END IF;
    v_w1 := wall_of(v_u1);
    v_w2 := wall_of(v_u2);
    v_d1 := TRUNC(v_w1);
    v_t1 := ns_of(v_w1 - CAST(v_d1 AS TIMESTAMP));
    v_sign := CASE WHEN v_u2 < v_u1 THEN -1 ELSE 1 END;
    -- Temporal's DifferenceZonedDateTime: the days of the calendar to a day of the second at the time of the first that
    -- doesn't pass it, and the exact time from there
    IF TRUNC(v_w2) = v_d1 THEN
        v_t := ns_of(v_u2 - v_u1);
    ELSE
        v_correction := CASE WHEN SIGN(ns_of(v_w2 - CAST(TRUNC(v_w2) AS TIMESTAMP)) - v_t1) = -v_sign THEN 1 ELSE 0 END;
        WHILE v_correction <= CASE WHEN v_sign = 1 THEN 2 ELSE 1 END AND NOT v_found LOOP
            v_inter := TRUNC(v_w2) - v_correction * v_sign;
            v_t := ns_of(v_u2 - utc_of(CAST(v_inter AS TIMESTAMP) + NUMTODSINTERVAL(v_t1 / 1000000000, 'SECOND')));
            IF SIGN(v_t) <> -v_sign THEN v_found := TRUE; END IF;
            v_correction := v_correction + 1;
        END LOOP;
        -- Temporal's CalendarDateUntil: the whole months from the first date that don't pass the other one (the day of the
        -- first not kept in the month), then the days
        IF largest_unit IN ('year', 'month') THEN
            v_m := (EXTRACT(YEAR FROM v_inter) * 12 + EXTRACT(MONTH FROM v_inter)) - (EXTRACT(YEAR FROM v_d1) * 12 + EXTRACT(MONTH FROM v_d1));
            IF v_sign > 0 AND EXTRACT(DAY FROM v_d1) > EXTRACT(DAY FROM v_inter) THEN v_m := v_m - 1; END IF;
            IF v_sign < 0 AND EXTRACT(DAY FROM v_d1) < EXTRACT(DAY FROM v_inter) THEN v_m := v_m + 1; END IF;
            IF largest_unit = 'year' THEN v_years := TRUNC(v_m / 12); END IF;
            v_months := v_m - v_years * 12;
        END IF;
        v_days := v_inter - plus(v_d1, v_years, v_months, 0, 0);
        IF largest_unit = 'week' THEN
            v_weeks := TRUNC(v_days / 7);
            v_days := v_days - v_weeks * 7;
        END IF;
    END IF;
    -- Temporal's RoundRelativeDuration
    IF smallest_unit <> 'nanosecond' OR increment <> 1 THEN
        v_mode := unsigned_mode(v_sign < 0);
        IF smallest_unit IN ('year', 'month', 'week', 'day') THEN
            -- NudgeToCalendarUnit: between the duration truncated to the unit and one increment more, by the instants
            IF smallest_unit = 'year' THEN
                v_r1 := TRUNC(v_years / increment) * increment;
                v_start := utc_plus(v_r1, 0, 0, 0);
                v_end := utc_plus(v_r1 + increment * v_sign, 0, 0, 0);
            ELSIF smallest_unit = 'month' THEN
                v_r1 := TRUNC(v_months / increment) * increment;
                v_start := utc_plus(v_years, v_r1, 0, 0);
                v_end := utc_plus(v_years, v_r1 + increment * v_sign, 0, 0);
            ELSIF smallest_unit = 'week' THEN
                v_r1 := TRUNC((v_weeks + TRUNC(v_days / 7)) / increment) * increment;
                v_start := utc_plus(v_years, v_months, v_r1, 0);
                v_end := utc_plus(v_years, v_months, v_r1 + increment * v_sign, 0);
            ELSE
                v_r1 := TRUNC(v_days / increment) * increment;
                v_start := utc_plus(v_years, v_months, v_weeks, v_r1);
                v_end := utc_plus(v_years, v_months, v_weeks, v_r1 + increment * v_sign);
            END IF;
            v_num := ns_of(v_u2 - v_start);
            v_den := ns_of(v_end - v_start);
            v_r2 := v_r1 + increment * v_sign;
            IF to_second(v_mode, ABS(v_num), ABS(v_den), ABS(v_r1) / increment) THEN
                v_expanded := TRUE;
                v_r1 := v_r2;
                v_nudged := v_end;
            ELSE
                v_nudged := v_start;
            END IF;
            IF smallest_unit = 'year' THEN
                v_years := v_r1; v_months := 0; v_weeks := 0; v_days := 0;
            ELSIF smallest_unit = 'month' THEN
                v_months := v_r1; v_weeks := 0; v_days := 0;
            ELSIF smallest_unit = 'week' THEN
                v_weeks := v_r1; v_days := 0;
            ELSE
                v_days := v_r1;
            END IF;
            v_t := 0;
        ELSE
            -- NudgeToZonedTime: the time rounded in the day it is in, which may round to the next day (of its length there)
            v_step := CASE smallest_unit WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
            v_start := utc_plus(v_years, v_months, v_weeks, v_days);
            v_end := utc_plus(v_years, v_months, v_weeks, v_days + v_sign);
            v_rounded := round_to(v_t, v_step);
            v_beyond := v_rounded - ns_of(v_end - v_start);
            IF SIGN(v_beyond) <> -v_sign THEN
                v_expanded := TRUE;
                v_days := v_days + v_sign;
                v_rounded := round_to(v_beyond, v_step);
                v_nudged := v_end + NUMTODSINTERVAL(v_rounded / 1000000000, 'SECOND');
            ELSE
                v_nudged := v_start + NUMTODSINTERVAL(v_rounded / 1000000000, 'SECOND');
            END IF;
            v_t := v_rounded;
        END IF;
        -- BubbleRelativeDuration: a unit that reached the next larger one gives it, up to the largest unit
        IF v_expanded AND smallest_unit <> 'week' THEN
            v_largest := CASE largest_unit WHEN 'year' THEN 0 WHEN 'month' THEN 1 WHEN 'week' THEN 2 ELSE 3 END;
            v_unit := CASE smallest_unit WHEN 'year' THEN 0 WHEN 'month' THEN 1 WHEN 'week' THEN 2 ELSE 3 END - 1;
            WHILE v_unit >= v_largest LOOP
                IF v_unit <> 2 OR v_largest = 2 THEN
                    v_ey := v_years; v_em := v_months; v_ew := v_weeks;
                    IF v_unit = 0 THEN
                        v_ey := v_years + v_sign; v_em := 0; v_ew := 0;
                    ELSIF v_unit = 1 THEN
                        v_em := v_months + v_sign; v_ew := 0;
                    ELSE
                        v_ew := v_weeks + v_sign;
                    END IF;
                    IF SIGN(ns_of(v_nudged - utc_plus(v_ey, v_em, v_ew, 0))) = -v_sign THEN
                        EXIT;
                    END IF;
                    v_years := v_ey; v_months := v_em; v_weeks := v_ew; v_days := 0; v_t := 0;
                END IF;
                v_unit := v_unit - 1;
            END LOOP;
        END IF;
    END IF;
    RETURN tsq_duration_text(v_years * negation, v_months * negation, v_weeks * negation, v_days * negation, v_t * negation, 'hour');
END;
/

-- ===== tsq_zoned_of_text =====
CREATE OR REPLACE FUNCTION tsq_zoned_of_text(zoned IN VARCHAR2) RETURN TIMESTAMP_TZ_UNCONSTRAINED DETERMINISTIC IS
    v_text VARCHAR2(200) := REPLACE(zoned, 'Z[', '+00:00[');
    v_bracket PLS_INTEGER := INSTR(v_text, '[');
BEGIN
    IF zoned IS NULL THEN RETURN NULL; END IF;
    RETURN TO_TIMESTAMP_TZ(SUBSTR(v_text, 1, v_bracket - 1), 'YYYY-MM-DD"T"HH24:MI:SS.FFTZH:TZM') AT TIME ZONE SUBSTR(v_text, v_bracket + 1, LENGTH(v_text) - v_bracket - 1);
END;
/

-- ===== tsq_round_to =====
CREATE OR REPLACE FUNCTION tsq_round_to(value IN NUMBER, step IN NUMBER, rounding_mode IN VARCHAR2) RETURN NUMBER DETERMINISTIC IS
    v_q NUMBER := TRUNC(value / step);
    v_r NUMBER := value - v_q * step;
    v_away NUMBER := v_q + SIGN(value);
BEGIN
    IF value IS NULL OR step IS NULL OR rounding_mode IS NULL THEN RETURN NULL; END IF;
    IF v_r = 0 THEN RETURN value; END IF;
    RETURN step * CASE
        WHEN rounding_mode = 'trunc' THEN v_q
        WHEN rounding_mode = 'floor' THEN CASE WHEN value < 0 THEN v_away ELSE v_q END
        WHEN rounding_mode = 'ceil' THEN CASE WHEN value > 0 THEN v_away ELSE v_q END
        WHEN rounding_mode = 'expand' THEN v_away
        WHEN 2 * ABS(v_r) > step THEN v_away
        WHEN 2 * ABS(v_r) < step THEN v_q
        WHEN rounding_mode = 'halfExpand' THEN v_away
        WHEN rounding_mode = 'halfTrunc' THEN v_q
        WHEN rounding_mode = 'halfCeil' THEN CASE WHEN value > 0 THEN v_away ELSE v_q END
        WHEN rounding_mode = 'halfFloor' THEN CASE WHEN value < 0 THEN v_away ELSE v_q END
        WHEN MOD(v_q, 2) = 0 THEN v_q
        ELSE v_away
    END;
END;
/

-- ===== tsq_nanoseconds_between =====
CREATE OR REPLACE FUNCTION tsq_nanoseconds_between(one IN TIMESTAMP_UNCONSTRAINED, two IN TIMESTAMP_UNCONSTRAINED) RETURN NUMBER DETERMINISTIC IS
BEGIN
    RETURN (TRUNC(two) - TRUNC(one)) * 86400000000000 + (TO_NUMBER(TO_CHAR(two, 'SSSSSFF9')) - TO_NUMBER(TO_CHAR(one, 'SSSSSFF9')));
END;
/

-- ===== tsq_zoned_hours_in_day =====
CREATE OR REPLACE FUNCTION tsq_zoned_hours_in_day(value IN TIMESTAMP_TZ_UNCONSTRAINED) RETURN NUMBER DETERMINISTIC IS
    v_zone VARCHAR2(100) := TO_CHAR(value, 'TZR');
    v_day DATE := TRUNC(CAST(value AS TIMESTAMP_UNCONSTRAINED));
BEGIN
    IF value IS NULL THEN RETURN NULL; END IF;
    RETURN (CAST(SYS_EXTRACT_UTC(tsq_zoned_of_wall(CAST(v_day + 1 AS TIMESTAMP_UNCONSTRAINED), v_zone, 'compatible')) AS DATE) - CAST(SYS_EXTRACT_UTC(tsq_zoned_of_wall(CAST(v_day AS TIMESTAMP_UNCONSTRAINED), v_zone, 'compatible')) AS DATE)) * 24;
END;
/

-- ===== tsq_zoned_round_day =====
CREATE OR REPLACE FUNCTION tsq_zoned_round_day(value IN TIMESTAMP_TZ_UNCONSTRAINED, rounding_mode IN VARCHAR2) RETURN TIMESTAMP_TZ_UNCONSTRAINED DETERMINISTIC IS
    v_zone VARCHAR2(100) := TO_CHAR(value, 'TZR');
    v_day DATE := TRUNC(CAST(value AS TIMESTAMP_UNCONSTRAINED));
    v_start TIMESTAMP_TZ_UNCONSTRAINED;
    v_next TIMESTAMP_TZ_UNCONSTRAINED;
BEGIN
    IF value IS NULL OR rounding_mode IS NULL THEN RETURN NULL; END IF;
    v_start := tsq_zoned_of_wall(CAST(v_day AS TIMESTAMP_UNCONSTRAINED), v_zone, 'compatible');
    IF rounding_mode = 'trunc' THEN RETURN v_start; END IF;
    v_next := tsq_zoned_of_wall(CAST(v_day + 1 AS TIMESTAMP_UNCONSTRAINED), v_zone, 'compatible');
    IF rounding_mode = 'ceil' THEN
        RETURN CASE WHEN value = v_start THEN v_start ELSE v_next END;
    END IF;
    IF rounding_mode = 'halfExpand' THEN
        RETURN CASE WHEN (value - v_start) * 2 >= (v_next - v_start) THEN v_next ELSE v_start END;
    END IF;
    RETURN CASE WHEN (value - v_start) * 2 > (v_next - v_start) THEN v_next ELSE v_start END;
END;
/

-- ===== tsq_duration_sum =====
CREATE OR REPLACE FUNCTION tsq_duration_sum(a IN VARCHAR2, b IN VARCHAR2, sgn IN NUMBER) RETURN VARCHAR2 DETERMINISTIC IS
BEGIN
    RETURN tsq_duration_add(tsq_duration_part(a, 'largest'), tsq_duration_part(a, 'days'), tsq_duration_part(a, 'S'), tsq_duration_part(a, 'N'),
        tsq_duration_part(b, 'largest'), tsq_duration_part(b, 'days'), tsq_duration_part(b, 'S'), tsq_duration_part(b, 'N'), sgn);
END;
/

-- ===== tsq_duration_total_of =====
CREATE OR REPLACE FUNCTION tsq_duration_total_of(d IN VARCHAR2, y IN NUMBER, m IN NUMBER, dd IN NUMBER, unit IN VARCHAR2) RETURN BINARY_DOUBLE DETERMINISTIC IS
BEGIN
    RETURN tsq_duration_total(tsq_duration_part(d, 'M'), tsq_duration_part(d, 'weeks'), tsq_duration_part(d, 'days'), tsq_duration_part(d, 'S'), tsq_duration_part(d, 'N'), y, m, dd, unit);
END;
/

-- ===== tsq_ds_interval_text and tsq_ym_interval_text =====
CREATE OR REPLACE FUNCTION tsq_ds_interval_text(value IN DSINTERVAL_UNCONSTRAINED) RETURN VARCHAR2 DETERMINISTIC IS
    v_negative BOOLEAN := value < INTERVAL '0' SECOND;
    v_value DSINTERVAL_UNCONSTRAINED := CASE WHEN value < INTERVAL '0' SECOND THEN value * -1 ELSE value END;
    v_seconds NUMBER := EXTRACT(SECOND FROM v_value);
BEGIN
    IF value IS NULL THEN RETURN NULL; END IF;
    RETURN CASE WHEN v_negative THEN '-' END || 'P' || EXTRACT(DAY FROM v_value) || 'DT' || EXTRACT(HOUR FROM v_value) || 'H' || EXTRACT(MINUTE FROM v_value) || 'M'
        || TRUNC(v_seconds) || '.' || LPAD(TO_CHAR(MOD(v_seconds, 1) * 1000000000), 9, '0') || 'S';
END;
/

CREATE OR REPLACE FUNCTION tsq_ym_interval_text(value IN YMINTERVAL_UNCONSTRAINED) RETURN VARCHAR2 DETERMINISTIC IS
    v_value YMINTERVAL_UNCONSTRAINED := CASE WHEN value < INTERVAL '0' MONTH THEN value * -1 ELSE value END;
BEGIN
    IF value IS NULL THEN RETURN NULL; END IF;
    RETURN CASE WHEN value < INTERVAL '0' MONTH THEN '-' END || 'P' || EXTRACT(YEAR FROM v_value) || 'Y' || EXTRACT(MONTH FROM v_value) || 'M';
END;
/

-- ===== tsq_duration_round_of =====
CREATE OR REPLACE FUNCTION tsq_duration_round_of(one IN TIMESTAMP_UNCONSTRAINED, two IN TIMESTAMP_UNCONSTRAINED, largest_unit IN VARCHAR2, smallest_unit IN VARCHAR2, increment IN NUMBER, rounding_mode IN VARCHAR2, negation IN NUMBER) RETURN VARCHAR2 DETERMINISTIC IS
BEGIN
    RETURN tsq_duration_round(EXTRACT(YEAR FROM one), EXTRACT(MONTH FROM one), EXTRACT(DAY FROM one), TO_NUMBER(TO_CHAR(one, 'SSSSSFF9')),
        EXTRACT(YEAR FROM two), EXTRACT(MONTH FROM two), EXTRACT(DAY FROM two), TO_NUMBER(TO_CHAR(two, 'SSSSSFF9')),
        largest_unit, smallest_unit, increment, rounding_mode, negation);
END;
/

-- ===== tsq_time_plus_duration and tsq_instant_plus_duration =====
CREATE OR REPLACE FUNCTION tsq_time_plus_duration(value IN TIMESTAMP_UNCONSTRAINED, duration IN DSINTERVAL_UNCONSTRAINED, sgn IN NUMBER, date_of_times IN TIMESTAMP_UNCONSTRAINED) RETURN TIMESTAMP_UNCONSTRAINED DETERMINISTIC IS
BEGIN
    IF value IS NULL OR duration IS NULL THEN RETURN NULL; END IF;
    RETURN date_of_times + NUMTODSINTERVAL(MOD(MOD(TO_NUMBER(TO_CHAR(value, 'SSSSSFF9')) / 1000000000 + sgn * (EXTRACT(DAY FROM duration) * 86400 + EXTRACT(HOUR FROM duration) * 3600 + EXTRACT(MINUTE FROM duration) * 60 + EXTRACT(SECOND FROM duration)), 86400) + 86400, 86400), 'second');
END;
/

CREATE OR REPLACE FUNCTION tsq_instant_plus_duration(value IN TIMESTAMP_UNCONSTRAINED, duration IN DSINTERVAL_UNCONSTRAINED, sgn IN NUMBER) RETURN TIMESTAMP_UNCONSTRAINED DETERMINISTIC IS
BEGIN
    IF EXTRACT(DAY FROM duration) <> 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'tsq_instant_plus_duration: an instant takes only a duration of hours and smaller units');
    END IF;
    RETURN value + duration * sgn;
END;
/

-- ===== tsq_duration_negated =====
CREATE OR REPLACE FUNCTION tsq_duration_negated(d IN VARCHAR2) RETURN VARCHAR2 DETERMINISTIC IS
BEGIN
    RETURN CASE WHEN SUBSTR(d, 1, 1) = '-' THEN SUBSTR(d, 2) WHEN tsq_duration_part(d, 'sign') = 0 THEN d WHEN SUBSTR(d, 1, 1) = '+' THEN '-' || SUBSTR(d, 2) ELSE '-' || d END;
END;
/

-- ===== tsq_day_in_month_or_error =====
CREATE OR REPLACE FUNCTION tsq_day_in_month_or_error(value IN TIMESTAMP_UNCONSTRAINED, months IN NUMBER) RETURN NUMBER DETERMINISTIC IS
    v_index NUMBER := EXTRACT(YEAR FROM value) * 12 + EXTRACT(MONTH FROM value) - 1 + months;
BEGIN
    IF value IS NULL OR months IS NULL THEN RETURN NULL; END IF;
    RETURN EXTRACT(DAY FROM TO_DATE(TRUNC(v_index / 12) || '-' || (MOD(v_index, 12) + 1) || '-' || EXTRACT(DAY FROM value), 'YYYY-MM-DD')) - EXTRACT(DAY FROM value);
END;
/

-- ===== tsq_utc_of_epoch =====
CREATE OR REPLACE FUNCTION tsq_utc_of_epoch(value IN NUMBER, unit_nanoseconds IN NUMBER) RETURN TIMESTAMP_UNCONSTRAINED DETERMINISTIC IS
    v_total NUMBER := value * unit_nanoseconds;
    v_rest NUMBER := MOD(MOD(v_total, 86400000000000) + 86400000000000, 86400000000000);
BEGIN
    IF value IS NULL OR unit_nanoseconds IS NULL THEN RETURN NULL; END IF;
    RETURN CAST(DATE '1970-01-01' + (v_total - v_rest) / 86400000000000 AS TIMESTAMP_UNCONSTRAINED) + NUMTODSINTERVAL(v_rest / 1000000000, 'second');
END;
/

-- ===== tsq_date_with =====
CREATE OR REPLACE FUNCTION tsq_date_with(value IN DATE, y IN NUMBER, m IN NUMBER, d IN NUMBER, reject IN NUMBER) RETURN DATE DETERMINISTIC IS
    v_year NUMBER := NVL(y, EXTRACT(YEAR FROM value));
    v_month NUMBER := NVL(m, EXTRACT(MONTH FROM value));
    v_day NUMBER := NVL(d, EXTRACT(DAY FROM value));
    v_first DATE;
    v_last NUMBER;
BEGIN
    IF value IS NULL THEN RETURN NULL; END IF;
    v_first := ADD_MONTHS(DATE '0001-01-01', (v_year - 1) * 12 + v_month - 1);
    v_last := EXTRACT(DAY FROM LAST_DAY(v_first));
    IF v_day > v_last THEN
        IF reject = 1 THEN
            RETURN TO_DATE(v_year || '-' || v_month || '-' || v_day, 'YYYY-MM-DD');
        END IF;
        v_day := v_last;
    END IF;
    RETURN v_first + v_day - 1;
END;
/

-- ===== tsq_sql_macros =====
CREATE OR REPLACE FUNCTION tsq_text_of_date(value IN DATE) RETURN VARCHAR2 SQL_MACRO(SCALAR) IS
BEGIN
    RETURN q'[to_char(value, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')]';
END;
/

CREATE OR REPLACE FUNCTION tsq_text_of_timestamp(value IN TIMESTAMP_UNCONSTRAINED) RETURN VARCHAR2 SQL_MACRO(SCALAR) IS
BEGIN
    RETURN q'[to_char(cast(value as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')]';
END;
/

CREATE OR REPLACE FUNCTION tsq_text_of_utc(value IN TIMESTAMP_UNCONSTRAINED) RETURN VARCHAR2 SQL_MACRO(SCALAR) IS
BEGIN
    RETURN q'[to_char(value, 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN')]';
END;
/

CREATE OR REPLACE FUNCTION tsq_text_of_instant(value IN TIMESTAMP_TZ_UNCONSTRAINED) RETURN VARCHAR2 SQL_MACRO(SCALAR) IS
BEGIN
    RETURN q'[to_char(sys_extract_utc(cast(value as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN')]';
END;
/

CREATE OR REPLACE FUNCTION tsq_text_of_zoned(value IN TIMESTAMP_TZ_UNCONSTRAINED) RETURN VARCHAR2 SQL_MACRO(SCALAR) IS
BEGIN
    RETURN q'[to_char(value, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN')]';
END;
/

-- ===== tsq_string_util.concat_strict =====
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
