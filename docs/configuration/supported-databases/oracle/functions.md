---
search:
  boost: 0.5
---
# Oracle functions

Some queries call a function that Oracle doesn't have built in. This page has the code of each one, to create once in the database, with what it is for and when a query calls it. A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of two kinds:

- **The functions of the library**, whose names start with `tsq_`. The queries of durations call them, and those of zoned dates and times (see [Dates and times](../../dates-and-times.md)). Create them with the code of this page, as it is.
- **Functions of your own**, which a setting of the connection names, or that the library calls with a [uuid strategy](index.md#uuid-strategies). The code of this page is an example of them.

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | a duration of a column that keeps it as text is added, has its fields, its sign or its total read, or is negated | — |
| [`tsq_duration_text`](#tsq_duration_text) | `until` or `since` computes a duration | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | `tsq_duration_text` |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | `tsq_duration_text` |
| [`tsq_zoned_until`](#tsq_zoned_until) | `until` or `since` of two zoned dates and times, in days or larger units | `tsq_duration_text` |
| [The function of `concatFunction`](#the-function-of-concatfunction) | `concat` or an affix pattern is written, with `concatFunction` set | — |
| [`uuid_to_raw` and `raw_to_uuid`](#uuid_to_raw-and-raw_to_uuid) | a uuid is read or written with the `'custom-functions'` uuid strategy | — |

## The order to create them

Create `tsq_duration_text` before `tsq_duration_round`, `tsq_duration_add` and `tsq_zoned_until`, which call it; the others in any order.

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. Oracle keeps a duration in an interval, and only a column that keeps it as text needs it (see [A column that keeps it in its own way](../../dates-and-times.md#a-column-that-keeps-it-in-its-own-way)): a query calls it to add a duration of such a column to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

```sql
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
```

## `tsq_duration_text`

`tsq_duration_text` writes the ISO 8601 text of a duration from its fields, the text of Temporal's `toString`. A query calls it to give the duration that `until` or `since` computes (see [The duration between two dates and times](../../dates-and-times.md#the-duration-between-two-dates-and-times)), and `tsq_duration_round`, `tsq_duration_add` and `tsq_zoned_until` call it to write their result: create it before them.

```sql
CREATE OR REPLACE FUNCTION tsq_duration_text(y IN NUMBER, mo IN NUMBER, w IN NUMBER, d IN NUMBER, ns IN NUMBER, unit IN VARCHAR2) RETURN VARCHAR2 DETERMINISTIC IS
    r VARCHAR2(100);
    t VARCHAR2(100);
    rest NUMBER;
    f NUMBER;
BEGIN
    IF y IS NULL OR mo IS NULL OR w IS NULL OR d IS NULL OR ns IS NULL THEN RETURN NULL; END IF;
    IF y <> 0 THEN r := r || TO_CHAR(ABS(y)) || 'Y'; END IF;
    IF mo <> 0 THEN r := r || TO_CHAR(ABS(mo)) || 'M'; END IF;
    IF w <> 0 THEN r := r || TO_CHAR(ABS(w)) || 'W'; END IF;
    IF d <> 0 THEN r := r || TO_CHAR(ABS(d)) || 'D'; END IF;
    rest := ABS(ns);
    IF unit = 'hour' AND rest >= 3600000000000 THEN t := t || TO_CHAR(TRUNC(rest / 3600000000000)) || 'H'; rest := MOD(rest, 3600000000000); END IF;
    IF unit <> 'second' AND rest >= 60000000000 THEN t := t || TO_CHAR(TRUNC(rest / 60000000000)) || 'M'; rest := MOD(rest, 60000000000); END IF;
    IF rest > 0 THEN
        f := MOD(rest, 1000000000);
        t := t || TO_CHAR(TRUNC(rest / 1000000000));
        IF f > 0 THEN t := t || '.' || RTRIM(LPAD(TO_CHAR(f), 9, '0'), '0'); END IF;
        t := t || 'S';
    END IF;
    IF r IS NULL AND t IS NULL THEN RETURN 'PT0S'; END IF;
    RETURN CASE WHEN y < 0 OR mo < 0 OR w < 0 OR d < 0 OR ns < 0 THEN '-' END || 'P' || r || CASE WHEN t IS NOT NULL THEN 'T' || t END;
END;
```

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../dates-and-times.md#the-options-of-until-and-since)). It calls `tsq_duration_text`.

```sql
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
```

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../dates-and-times.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error that says it needs a date of reference.

```sql
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
```

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../dates-and-times.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`. It calls `tsq_duration_text`.

```sql
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
```

## `tsq_zoned_until`

`tsq_zoned_until` gives the duration from one zoned date and time to another as Temporal's `until` with a largest unit of days or larger: it counts the days of the calendar in their zone, each one with its length there (23 or 25 hours where the zone changes its offset), and rounds as Temporal rounds. A query calls it for `until` and `since` of two zoned dates and times in days or larger units (see [The functions `tsq_zoned_until` and `tsq_zoned_of_wall`](../../dates-and-times.md#the-functions-tsq_zoned_until-and-tsq_zoned_of_wall)). Two zoned dates and times in different zones make it fail with `ORA-20001`. It calls `tsq_duration_text`: create it after that one.

```sql
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
        v_before TIMESTAMP_UNCONSTRAINED;
        v_after TIMESTAMP_UNCONSTRAINED;
    BEGIN
        v_before := w - (wall_of(w - INTERVAL '1' DAY) - (w - INTERVAL '1' DAY));
        v_after := w - (wall_of(w + INTERVAL '1' DAY) - (w + INTERVAL '1' DAY));
        IF wall_of(v_before) <> w AND wall_of(v_after) = w THEN
            RETURN v_after;
        END IF;
        RETURN v_before;
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
```

## The function of `concatFunction`

`concat` and the patterns of `startsWith`, `endsWith` and `contains` give NULL when an operand is NULL, with a `CASE` around `||`. With `concatFunction`, a query calls a function of yours instead, which gives the same and writes each operand once (see [Propagating NULL through a function instead of a `CASE`](index.md#propagating-null-through-a-function-instead-of-a-case)). Without that setting, a query doesn't call it. The name is yours; `string_util.concat_strict` is the one of that example.

!!! warning "It must be a package, not a standalone function"

    Oracle cannot overload standalone subprograms — a second `CREATE OR REPLACE FUNCTION` of the same name **replaces** the first. Overloads live in a package, and you want the overloads: without them a `CLOB` argument is implicitly converted to `VARCHAR2` and silently truncated at 32767 characters.

    Four overloads, not two. With only `(VARCHAR2, VARCHAR2)` and `(CLOB, CLOB)`, Oracle cannot resolve the commonest call of all — a `CLOB` column against a `VARCHAR2` literal — and raises `ORA-06553: PLS-307: too many declarations of ... match this call`. The two mixed overloads are what make it resolvable. `NVARCHAR2` and `NCLOB` arguments reach these through implicit conversion and need no overloads of their own.

```sql
CREATE OR REPLACE PACKAGE string_util AS
    FUNCTION concat_strict(a IN VARCHAR2, b IN VARCHAR2) RETURN VARCHAR2;
    FUNCTION concat_strict(a IN CLOB, b IN CLOB) RETURN CLOB;
    FUNCTION concat_strict(a IN CLOB, b IN VARCHAR2) RETURN CLOB;
    FUNCTION concat_strict(a IN VARCHAR2, b IN CLOB) RETURN CLOB;
END string_util;

CREATE OR REPLACE PACKAGE BODY string_util AS
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
END string_util;
```

## `uuid_to_raw` and `raw_to_uuid`

The `'custom-functions'` [uuid strategy](index.md#uuid-strategies) requires the `uuid_to_raw` and `raw_to_uuid` functions to exist in the database. Two implementations are documented below — pick the one that matches the UUID version your application generates, since each preserves the time-ordering of a different version. The `'built-in'` strategy doesn't need either implementation, because Oracle 23ai (23.9)+ already ships built-ins that behave like the canonical (non-reordering) variant — but those built-ins accept **only version-4 UUIDs**, so reach for `'custom-functions'` (the canonical implementation below) whenever you store v7 or v1 values.

### For UUID v7 (or UUID v4) — preserve canonical byte order

UUID v7 already places the 48-bit timestamp at the start of the value, so storing the bytes as-is yields a chronologically sortable `RAW(16)`. UUID v4 is random, so byte ordering is irrelevant. **This is the recommended implementation for new applications:**

```sql
CREATE FUNCTION uuid_to_raw(uuid IN char) RETURN raw AS
BEGIN 
    RETURN HEXTORAW(REPLACE(uuid, '-'));
END uuid_to_raw;

CREATE FUNCTION raw_to_uuid(raw_uuid IN raw) RETURN char IS
	hex_text char(32);
BEGIN 
	hex_text := RAWTOHEX(raw_uuid);
    -- If you want the lower-case version wrap the expression in lower( ... )
    RETURN SUBSTR (hex_text, 1, 8) || '-' || 
           SUBSTR (hex_text, 9, 4) || '-' || 
           SUBSTR (hex_text, 13, 4) || '-' || 
           SUBSTR (hex_text, 17, 4) || '-' || 
           SUBSTR (hex_text, 21);
END raw_to_uuid;
```

### For UUID v1 — reorder bytes so the timestamp segment sorts first

UUID v1 places the 60-bit timestamp split across the `time-low`, `time-mid` and `time-hi` fields, with `time-low` at the start of the string but the most-significant bits sitting in `time-hi`. To make a v1 UUID sortable inside `RAW(16)`, the fields are rearranged on store and put back on read. **Use this only if your application generates UUID v1; it will scramble v7's timestamp prefix.**

```sql
CREATE FUNCTION uuid_to_raw(uuid IN char) RETURN raw IS
	hex_text nvarchar2(36);
BEGIN 
	hex_text := REPLACE(uuid, '-');
	RETURN HEXTORAW(SUBSTR (hex_text, 13, 4) || 
                    SUBSTR (hex_text, 9, 4) || 
                    SUBSTR (hex_text, 0, 8) || 
                    SUBSTR (hex_text, 17));
END uuid_to_raw;

CREATE FUNCTION raw_to_uuid(raw_uuid IN raw) RETURN char IS
	hex_text char(32);
BEGIN 
	hex_text := RAWTOHEX(raw_uuid);
    -- If you want the lower-case version wrap the expression in lower( ... )
    RETURN SUBSTR (hex_text, 9, 8) || '-' || 
           SUBSTR (hex_text, 5, 4) || '-' || 
           SUBSTR (hex_text, 0, 4) || '-' || 
           SUBSTR (hex_text, 17, 4) || '-' || 
           SUBSTR (hex_text, 21);
END raw_to_uuid;
```
