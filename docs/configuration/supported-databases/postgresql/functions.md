---
search:
  boost: 0.5
---
# PostgreSQL functions

Some queries call a function that PostgreSQL doesn't have built in. This page has the code of each one, to create once in the database, with what it is for and when a query calls it. A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of two kinds:

- **The functions of the library**, whose names start with `tsq_`. The queries of durations call them, and those of zoned dates and times (see [Dates and times](../../dates-and-times.md)). Create them with the code of this page, as it is.
- **Functions of your own**, which a setting of the connection names. The code of this page is an example of them.

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | a duration of a column that keeps it as text is added, has its fields, its sign or its total read, or is negated | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` rounds to a week, a month or a year | — |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | — |
| [`tsq_zoned_of_wall`](#tsq_zoned_of_wall) | a wall clock is taken to its zone, with `temporalFunctions = 'installed'` | — |
| [`tsq_zoned_until`](#tsq_zoned_until) | `until` or `since` of two zoned dates and times, in days or larger units | `tsq_zoned_of_wall` |
| [The functions of `minValueFunction` and `maxValueFunction`](#the-functions-of-minvaluefunction-and-maxvaluefunction) | `minValue` or `maxValue` is written, with those settings | — |

## The order to create them

Create `tsq_zoned_of_wall` before `tsq_zoned_until`, which calls it; the others in any order.

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. PostgreSQL keeps a duration in an interval, and only a column that keeps it as text needs it (see [A column that keeps it in its own way](../../dates-and-times.md#a-column-that-keeps-it-in-its-own-way)): a query calls it to add a duration of such a column to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

```sql
CREATE OR REPLACE FUNCTION tsq_duration_part(d text, part text) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    s text;
    i integer := 1;
    n integer;
    c text;
    num text := '';
    in_time boolean := false;
    sgn integer := 1;
    r bigint := 0;
    nonzero boolean := false;
    lg integer := 10;
    f bigint;
BEGIN
    IF d IS NULL THEN RETURN NULL; END IF;
    s := upper(trim(d));
    n := length(s);
    IF substr(s, 1, 1) = '-' THEN sgn := -1; i := 2; ELSIF substr(s, 1, 1) = '+' THEN i := 2; END IF;
    i := i + 1;
    WHILE i <= n LOOP
        c := substr(s, i, 1);
        IF c = 'T' THEN in_time := true;
        ELSIF position(c in '0123456789.,') > 0 THEN num := num || CASE WHEN c = ',' THEN '.' ELSE c END;
        ELSE
            IF translate(num, '0.', '') <> '' THEN
                nonzero := true;
                f := rpad(split_part(num, '.', 2), 9, '0')::bigint;
                lg := least(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                    WHEN split_part(num, '.', 1)::bigint <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
            END IF;
            IF part = 'M' AND NOT in_time AND c = 'Y' THEN r := r + 12 * num::bigint;
            ELSIF part = 'M' AND NOT in_time AND c = 'M' THEN r := r + num::bigint;
            ELSIF part = 'D' AND c = 'W' THEN r := r + 7 * num::bigint;
            ELSIF part = 'D' AND c = 'D' THEN r := r + num::bigint;
            ELSIF part = 'S' AND in_time AND c = 'H' THEN r := r + 3600 * num::bigint;
            ELSIF part = 'S' AND in_time AND c = 'M' THEN r := r + 60 * num::bigint;
            ELSIF part = 'S' AND c = 'S' THEN r := r + split_part(num, '.', 1)::bigint;
            ELSIF part = 'N' AND c = 'S' AND position('.' in num) > 0 THEN r := rpad(split_part(num, '.', 2), 9, '0')::bigint;
            ELSIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN r := split_part(num, '.', 1)::bigint;
            END IF;
            num := '';
        END IF;
        i := i + 1;
    END LOOP;
    IF part = 'sign' THEN RETURN CASE WHEN nonzero THEN sgn ELSE 0 END; END IF;
    IF part = 'largest' THEN RETURN lg; END IF;
    RETURN sgn * r;
END;
$$;
```

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` rounds to the calendar: a largest unit of a week, a month or a year with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../dates-and-times.md#the-options-of-until-and-since)).

```sql
CREATE OR REPLACE FUNCTION tsq_duration_round(y1 integer, m1 integer, d1 integer, ns1 bigint, y2 integer, m2 integer, d2 integer, ns2 bigint, largest_unit text, smallest_unit text, increment bigint, rounding_mode text, negation integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    day_ns CONSTANT bigint := 86400000000000;
    one date := make_date(y1, m1, d1);
    two date := make_date(y2, m2, d2);
    adjusted date := make_date(y2, m2, d2);
    t bigint := ns2 - ns1;
    k integer;
    years bigint := 0;
    months bigint := 0;
    weeks bigint := 0;
    days bigint;
    sgn bigint;
    um text;
    r1 bigint;
    start_day date;
    end_day date;
    num bigint;
    den bigint;
    whole bigint;
    rest bigint;
    steps bigint;
    step bigint;
    to_round bigint;
    rounded bigint;
BEGIN
    IF t > 0 AND two < one THEN
        adjusted := two + 1;
        t := t - day_ns;
    ELSIF t < 0 AND two > one THEN
        adjusted := two - 1;
        t := t + day_ns;
    END IF;
    IF largest_unit = 'week' THEN
        weeks := (adjusted - one) / 7;
        days := (adjusted - one) - weeks * 7;
    ELSE
        k := ((extract(year from adjusted)::integer * 12 + extract(month from adjusted)::integer) * 32 + extract(day from adjusted)::integer - (y1 * 12 + m1) * 32 - d1) / 32;
        IF largest_unit = 'year' THEN
            years := k / 12;
        END IF;
        months := k - years * 12;
        days := adjusted - (one + make_interval(months => k))::date;
    END IF;
    sgn := CASE WHEN (two - one)::bigint * day_ns + ns2 - ns1 < 0 THEN -1 ELSE 1 END;
    um := CASE rounding_mode
        WHEN 'ceil' THEN CASE WHEN sgn < 0 THEN 'zero' ELSE 'infinity' END
        WHEN 'floor' THEN CASE WHEN sgn < 0 THEN 'infinity' ELSE 'zero' END
        WHEN 'halfCeil' THEN CASE WHEN sgn < 0 THEN 'halfZero' ELSE 'halfInfinity' END
        WHEN 'halfFloor' THEN CASE WHEN sgn < 0 THEN 'halfInfinity' ELSE 'halfZero' END
        WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
        ELSE 'halfEven' END;
    IF smallest_unit IN ('year', 'month', 'week') THEN
        IF smallest_unit = 'year' THEN
            r1 := years / increment * increment;
            start_day := (one + make_interval(months => (r1 * 12)::integer))::date;
            end_day := (one + make_interval(months => ((r1 + increment * sgn) * 12)::integer))::date;
        ELSIF smallest_unit = 'month' THEN
            r1 := months / increment * increment;
            start_day := (one + make_interval(months => (years * 12 + r1)::integer))::date;
            end_day := (one + make_interval(months => (years * 12 + r1 + increment * sgn)::integer))::date;
        ELSE
            r1 := (CASE WHEN largest_unit = 'week' THEN weeks ELSE days / 7 END) / increment * increment;
            start_day := (one + make_interval(months => (years * 12 + months)::integer))::date + (r1 * 7)::integer;
            end_day := (one + make_interval(months => (years * 12 + months)::integer))::date + ((r1 + increment * sgn) * 7)::integer;
        END IF;
        num := abs((two - start_day)::bigint * day_ns + ns2 - ns1);
        den := abs((end_day - start_day)::bigint * day_ns);
        whole := num / den;
        rest := num - whole * den;
        steps := whole + CASE WHEN rest <> 0 AND (um = 'infinity' OR um LIKE 'half%' AND (2 * rest > den OR 2 * rest = den AND (um = 'halfInfinity' OR um = 'halfEven' AND (abs(r1) / increment + whole) % 2 <> 0))) THEN 1 ELSE 0 END;
        days := 0;
        t := 0;
        IF smallest_unit = 'year' THEN
            years := r1 + increment * sgn * steps;
            months := 0;
        ELSIF smallest_unit = 'month' THEN
            months := r1 + increment * sgn * steps;
            IF steps > 0 AND largest_unit = 'year' AND sgn * ((one + make_interval(months => (years * 12 + months)::integer))::date - (one + make_interval(months => ((years + sgn) * 12)::integer))::date) >= 0 THEN
                years := years + sgn;
                months := 0;
            END IF;
        ELSE
            weeks := r1 + increment * sgn * steps;
        END IF;
    ELSE
        step := CASE smallest_unit WHEN 'day' THEN day_ns WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
        to_round := days * day_ns + t;
        rest := abs(to_round % step);
        rounded := to_round - to_round % step;
        IF rest <> 0 AND (um = 'infinity' OR um LIKE 'half%' AND (2 * rest > step OR 2 * rest = step AND (um = 'halfInfinity' OR um = 'halfEven' AND (rounded / step) % 2 <> 0))) THEN
            rounded := rounded + step * sgn;
        END IF;
        days := rounded / day_ns;
        t := rounded - days * day_ns;
        IF rounded / day_ns <> to_round / day_ns THEN
            IF largest_unit = 'week' THEN
                IF sgn * ((two - (one + ((weeks + sgn) * 7)::integer))::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                    weeks := weeks + sgn;
                    days := 0;
                    t := 0;
                END IF;
            ELSIF sgn * ((two - (one + make_interval(months => (years * 12 + months + sgn)::integer))::date)::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                days := 0;
                t := 0;
                IF largest_unit = 'year' AND sgn * ((two - (one + make_interval(months => ((years + sgn) * 12)::integer))::date)::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                    years := years + sgn;
                    months := 0;
                ELSE
                    months := months + sgn;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN make_interval(years => (years * negation)::integer, months => (months * negation)::integer, weeks => (weeks * negation)::integer, days => (days * negation)::integer, secs => t * negation / 1000000000.0);
END
$$;
```

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../dates-and-times.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error that says it needs a date of reference.

```sql
CREATE OR REPLACE FUNCTION tsq_duration_total(months bigint, weeks bigint, days bigint, seconds bigint, nanoseconds bigint, y integer, m integer, d integer, unit text) RETURNS double precision LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    day_ns CONSTANT numeric := 86400000000000;
    unit_ns CONSTANT numeric := CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
    t numeric := seconds * 1000000000::numeric + nanoseconds;
    time_of_day numeric;
    one date;
    two date;
    adjusted date;
    sgn integer;
    k integer;
    r1 integer;
    start_day date;
    end_day date;
    a numeric;
    b numeric;
    x numeric;
    s integer := 0;
    q numeric;
    rest numeric;
BEGIN
    IF m = 0 THEN
        IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
            RAISE EXCEPTION 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference';
        END IF;
        a := days * day_ns + t;
        b := unit_ns;
    ELSE
        -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
        time_of_day := mod(t, day_ns);
        IF time_of_day < 0 THEN
            time_of_day := time_of_day + day_ns;
        END IF;
        one := make_date(y, m, d);
        two := (one + make_interval(months => months::integer))::date + (weeks * 7 + days + (t - time_of_day) / day_ns)::integer;
        IF unit NOT IN ('year', 'month', 'week') THEN
            a := (two - one) * day_ns + time_of_day;
            b := unit_ns;
        ELSE
            IF two = one AND time_of_day = 0 THEN
                RETURN 0;
            END IF;
            -- The whole units to the end without passing it (as until), and the progress to the next one
            adjusted := CASE WHEN time_of_day > 0 AND two < one THEN two + 1 ELSE two END;
            sgn := CASE WHEN (two - one) * day_ns + time_of_day < 0 THEN -1 ELSE 1 END;
            IF unit = 'week' THEN
                r1 := (adjusted - one) / 7;
            ELSE
                k := ((extract(year from adjusted)::integer * 12 + extract(month from adjusted)::integer) * 32 + extract(day from adjusted)::integer - (y * 12 + m) * 32 - d) / 32;
                r1 := CASE WHEN unit = 'month' THEN k ELSE k / 12 END;
            END IF;
            start_day := CASE WHEN unit = 'week' THEN one + 7 * r1 ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 ELSE 12 * r1 END))::date END;
            end_day := CASE WHEN unit = 'week' THEN one + 7 * (r1 + sgn) ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 + sgn ELSE 12 * (r1 + sgn) END))::date END;
            IF abs((two - start_day) * day_ns + time_of_day) >= abs((end_day - start_day) * day_ns) THEN
                -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                r1 := r1 + sgn;
                start_day := end_day;
                end_day := CASE WHEN unit = 'week' THEN one + 7 * (r1 + sgn) ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 + sgn ELSE 12 * (r1 + sgn) END))::date END;
            END IF;
            b := abs((end_day - start_day) * day_ns);
            a := r1 * b + sgn * abs((two - start_day) * day_ns + time_of_day);
        END IF;
    END IF;
    -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
    IF a = 0 THEN
        RETURN 0;
    END IF;
    x := abs(a);
    WHILE x >= b * 9007199254740992 LOOP
        b := b * 2;
        s := s - 1;
    END LOOP;
    WHILE x < b * 4503599627370496 LOOP
        x := x * 2;
        s := s + 1;
    END LOOP;
    q := div(x, b);
    rest := x - q * b;
    IF 2 * rest > b OR 2 * rest = b AND mod(q, 2) = 1 THEN
        q := q + 1;
    END IF;
    RETURN CASE WHEN a < 0 THEN -1 ELSE 1 END * q::double precision * power(2::double precision, -s);
END
$$;
```

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../dates-and-times.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`.

```sql
CREATE OR REPLACE FUNCTION tsq_duration_add(largest1 bigint, days1 bigint, seconds1 bigint, nanoseconds1 bigint, largest2 bigint, days2 bigint, seconds2 bigint, nanoseconds2 bigint, sgn integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
    day_ns CONSTANT numeric := 86400000000000;
    largest bigint := least(largest1, largest2);
    total numeric := (days1 + sgn * days2) * day_ns + (seconds1 + sgn * seconds2) * 1000000000::numeric + nanoseconds1 + sgn * nanoseconds2;
    days numeric := 0;
    t numeric;
BEGIN
    IF largest <= 2 THEN
        RAISE EXCEPTION 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted';
    END IF;
    IF largest = 3 THEN
        days := div(total, day_ns);
    END IF;
    t := total - days * day_ns;
    RETURN make_interval(days => days::integer, secs => div(t, 1000000000)::double precision) + make_interval(secs => mod(t, 1000000000) / 1000000000.0);
END
$$;
```

## `tsq_zoned_of_wall`

`tsq_zoned_of_wall` gives the instant of a wall clock in a zone, a name or an offset like `+05:30`, as Temporal's `disambiguation` takes it: `'compatible'`, `'earlier'`, `'later'` or `'reject'`, which fails for a wall clock the zone repeats or skips. `tsq_zoned_until` calls it: create it first. A query calls it in each wall clock taken to its zone when the connection has `temporalFunctions = 'installed'`; without that setting, PostgreSQL takes the later instant of a wall clock its zone repeats (see [A wall clock the zone repeats, on PostgreSQL](../../dates-and-times.md#a-wall-clock-the-zone-repeats-on-postgresql)).

```sql
CREATE OR REPLACE FUNCTION tsq_zoned_of_wall(wall timestamp, zone text, disambiguation text, preferred_offset interval DEFAULT NULL) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    -- An offset like '+05:30' is read by PostgreSQL as a POSIX zone, west of UTC: its sign inverted
    v_zone text := CASE WHEN zone ~ '^[+-]' THEN translate(zone, '+-', '-+') ELSE zone END;
    v_before timestamp;
    v_after timestamp;
    v_is_before boolean;
    v_is_after boolean;
BEGIN
    IF wall IS NULL OR zone IS NULL OR disambiguation IS NULL THEN
        RETURN NULL;
    END IF;
    IF preferred_offset IS NOT NULL AND (((wall - preferred_offset) AT TIME ZONE 'UTC') AT TIME ZONE v_zone) = wall THEN
        RETURN (wall - preferred_offset) AT TIME ZONE 'UTC';
    END IF;
    -- The wall clock minus the offset of the zone a day before and a day after it: an instant of it when the zone gives
    -- it back (two for a wall clock it repeats, none for one it skips)
    v_before := wall - ((((wall - interval '1 day') AT TIME ZONE 'UTC') AT TIME ZONE v_zone) - (wall - interval '1 day'));
    v_after := wall - ((((wall + interval '1 day') AT TIME ZONE 'UTC') AT TIME ZONE v_zone) - (wall + interval '1 day'));
    v_is_before := ((v_before AT TIME ZONE 'UTC') AT TIME ZONE v_zone) = wall;
    v_is_after := ((v_after AT TIME ZONE 'UTC') AT TIME ZONE v_zone) = wall;
    IF disambiguation = 'reject' AND v_is_before = v_is_after AND (NOT v_is_before OR v_before <> v_after) THEN
        RAISE EXCEPTION 'tsq_zoned_of_wall: % is not one instant in %', wall, zone;
    END IF;
    IF disambiguation = 'later' THEN
        RETURN (CASE WHEN v_is_after THEN v_after ELSE v_before END) AT TIME ZONE 'UTC';
    ELSIF disambiguation = 'compatible' THEN
        RETURN (CASE WHEN v_is_before OR NOT v_is_after THEN v_before ELSE v_after END) AT TIME ZONE 'UTC';
    END IF;
    RETURN (CASE WHEN v_is_before THEN v_before ELSE v_after END) AT TIME ZONE 'UTC';
END $$;
```

## `tsq_zoned_until`

`tsq_zoned_until` gives the duration from one zoned date and time to another as Temporal's `until` with a largest unit of days or larger: it counts the days of the calendar in their zone, each one with its length there (23 or 25 hours where the zone changes its offset), and rounds as Temporal rounds. A query calls it for `until` and `since` of two zoned dates and times in days or larger units (see [The functions `tsq_zoned_until` and `tsq_zoned_of_wall`](../../dates-and-times.md#the-functions-tsq_zoned_until-and-tsq_zoned_of_wall)). Two zoned dates and times in different zones make it fail, as in Temporal. It calls `tsq_zoned_of_wall`: create it after that one.

```sql
CREATE OR REPLACE FUNCTION tsq_zoned_until(one timestamptz, one_zone text, two timestamptz, two_zone text, largest_unit text, smallest_unit text, increment bigint, rounding_mode text, negation integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    -- An offset like '+05:30' is read by PostgreSQL as a POSIX zone, west of UTC: its sign inverted
    v_zone text := CASE WHEN one_zone ~ '^[+-]' THEN translate(one_zone, '+-', '-+') ELSE one_zone END;
    v_u1 timestamp;
    v_u2 timestamp;
    v_w1 timestamp;
    v_w2 timestamp;
    v_d1 date;
    v_t1 interval;
    v_sign integer;
    v_years bigint := 0;
    v_months bigint := 0;
    v_weeks bigint := 0;
    v_days bigint := 0;
    v_t numeric := 0;
    v_inter date;
    v_correction integer;
    v_found boolean := false;
    v_m bigint;
    v_r1 bigint;
    v_start timestamp;
    v_end timestamp;
    v_nudged timestamp;
    v_num numeric;
    v_den numeric;
    v_mode text;
    v_rounded numeric;
    v_step numeric;
    v_beyond numeric;
    v_q numeric;
    v_low numeric;
    v_up boolean;
    v_expanded boolean := false;
    v_unit integer;
    v_largest integer;
    v_ey bigint;
    v_em bigint;
    v_ew bigint;
    v_pass integer;
BEGIN
    IF one IS NULL OR one_zone IS NULL OR two IS NULL OR two_zone IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
    IF upper(one_zone) <> upper(two_zone) THEN
        RAISE EXCEPTION 'tsq_zoned_until: a difference in days or larger units needs both zoned dates and times in the same time zone';
    END IF;
    v_u1 := one AT TIME ZONE 'UTC';
    v_u2 := two AT TIME ZONE 'UTC';
    IF v_u1 = v_u2 THEN
        RETURN interval '0';
    END IF;
    v_w1 := (v_u1 AT TIME ZONE 'UTC') AT TIME ZONE v_zone;
    v_w2 := (v_u2 AT TIME ZONE 'UTC') AT TIME ZONE v_zone;
    v_d1 := v_w1::date;
    v_t1 := v_w1 - v_d1::timestamp;
    v_sign := CASE WHEN v_u2 < v_u1 THEN -1 ELSE 1 END;
    -- Temporal's DifferenceZonedDateTime: the days of the calendar to a day of the second at the time of the first that
    -- doesn't pass it, and the exact time from there
    IF v_w2::date = v_d1 THEN
        v_t := extract(epoch from v_u2 - v_u1) * 1000000000;
    ELSE
        v_correction := CASE WHEN sign(extract(epoch from (v_w2 - v_w2::date::timestamp) - v_t1)) = -v_sign THEN 1 ELSE 0 END;
        WHILE v_correction <= CASE WHEN v_sign = 1 THEN 2 ELSE 1 END AND NOT v_found LOOP
            v_inter := v_w2::date - v_correction * v_sign;
            v_t := extract(epoch from v_u2 - (tsq_zoned_of_wall(v_inter + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC')) * 1000000000;
            IF sign(v_t) <> -v_sign THEN v_found := true; END IF;
            v_correction := v_correction + 1;
        END LOOP;
        -- Temporal's CalendarDateUntil: the whole months from the first date that don't pass the other one (the day of the
        -- first not kept in the month), then the days
        IF largest_unit IN ('year', 'month') THEN
            v_m := (extract(year from v_inter) * 12 + extract(month from v_inter)) - (extract(year from v_d1) * 12 + extract(month from v_d1));
            IF v_sign > 0 AND extract(day from v_d1) > extract(day from v_inter) THEN v_m := v_m - 1; END IF;
            IF v_sign < 0 AND extract(day from v_d1) < extract(day from v_inter) THEN v_m := v_m + 1; END IF;
            IF largest_unit = 'year' THEN v_years := trunc(v_m / 12.0); END IF;
            v_months := v_m - v_years * 12;
        END IF;
        v_days := v_inter - (v_d1 + make_interval(months => (v_years * 12 + v_months)::integer))::date;
        IF largest_unit = 'week' THEN
            v_weeks := trunc(v_days / 7.0);
            v_days := v_days - v_weeks * 7;
        END IF;
    END IF;
    -- Temporal's RoundRelativeDuration
    IF smallest_unit <> 'nanosecond' OR increment <> 1 THEN
        v_mode := CASE rounding_mode
            WHEN 'ceil' THEN CASE WHEN v_sign < 0 THEN 'zero' ELSE 'infinity' END
            WHEN 'floor' THEN CASE WHEN v_sign < 0 THEN 'infinity' ELSE 'zero' END
            WHEN 'halfCeil' THEN CASE WHEN v_sign < 0 THEN 'halfZero' ELSE 'halfInfinity' END
            WHEN 'halfFloor' THEN CASE WHEN v_sign < 0 THEN 'halfInfinity' ELSE 'halfZero' END
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
        IF smallest_unit IN ('year', 'month', 'week', 'day') THEN
            -- NudgeToCalendarUnit: between the duration truncated to the unit and one increment more, by the instants
            IF smallest_unit = 'year' THEN
                v_r1 := trunc(v_years / increment::numeric) * increment;
                v_ey := v_r1; v_em := 0; v_ew := 0; v_m := 0;
            ELSIF smallest_unit = 'month' THEN
                v_r1 := trunc(v_months / increment::numeric) * increment;
                v_ey := v_years; v_em := v_r1; v_ew := 0; v_m := 0;
            ELSIF smallest_unit = 'week' THEN
                v_r1 := trunc((v_weeks + trunc(v_days / 7.0)) / increment::numeric) * increment;
                v_ey := v_years; v_em := v_months; v_ew := v_r1; v_m := 0;
            ELSE
                v_r1 := trunc(v_days / increment::numeric) * increment;
                v_ey := v_years; v_em := v_months; v_ew := v_weeks; v_m := v_r1;
            END IF;
            -- The start and the end: the first wall clock plus the duration truncated, and plus one increment more
            v_start := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_ey * 12 + v_em)::integer))::date + (v_ew * 7 + v_m)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            IF smallest_unit = 'year' THEN v_ey := v_ey + increment * v_sign;
            ELSIF smallest_unit = 'month' THEN v_em := v_em + increment * v_sign;
            ELSIF smallest_unit = 'week' THEN v_ew := v_ew + increment * v_sign;
            ELSE v_m := v_m + increment * v_sign;
            END IF;
            v_end := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_ey * 12 + v_em)::integer))::date + (v_ew * 7 + v_m)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            v_num := abs(extract(epoch from v_u2 - v_start));
            v_den := abs(extract(epoch from v_end - v_start));
            v_up := v_num <> 0 AND (v_num = v_den OR v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_num > v_den OR 2 * v_num = v_den AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND mod(abs(v_r1) / increment, 2) <> 0)));
            IF v_up THEN
                v_expanded := true;
                v_r1 := v_r1 + increment * v_sign;
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
            v_start := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_years * 12 + v_months)::integer))::date + (v_weeks * 7 + v_days)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            v_end := (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_years * 12 + v_months)::integer))::date + (v_weeks * 7 + v_days + v_sign)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC');
            v_pass := 0;
            v_beyond := v_t;
            -- The time rounded (Temporal's RoundNumberToIncrement), and again beyond the day when it reaches its end
            LOOP
                v_q := abs(v_beyond) / v_step;
                v_low := floor(v_q);
                v_mode := CASE rounding_mode
                    WHEN 'ceil' THEN CASE WHEN v_beyond < 0 THEN 'zero' ELSE 'infinity' END
                    WHEN 'floor' THEN CASE WHEN v_beyond < 0 THEN 'infinity' ELSE 'zero' END
                    WHEN 'halfCeil' THEN CASE WHEN v_beyond < 0 THEN 'halfZero' ELSE 'halfInfinity' END
                    WHEN 'halfFloor' THEN CASE WHEN v_beyond < 0 THEN 'halfInfinity' ELSE 'halfZero' END
                    WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
                    ELSE 'halfEven' END;
                v_up := v_q <> v_low AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * (v_q - v_low) > 1 OR 2 * (v_q - v_low) = 1 AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND mod(v_low, 2) <> 0)));
                v_rounded := sign(v_beyond) * (v_low + CASE WHEN v_up THEN 1 ELSE 0 END) * v_step;
                EXIT WHEN v_pass = 1;
                v_beyond := v_rounded - extract(epoch from v_end - v_start) * 1000000000;
                IF sign(v_beyond) = -v_sign THEN
                    v_nudged := v_start + make_interval(secs => v_rounded / 1000000000);
                    EXIT;
                END IF;
                v_expanded := true;
                v_days := v_days + v_sign;
                v_pass := 1;
            END LOOP;
            IF v_pass = 1 THEN
                v_nudged := v_end + make_interval(secs => v_rounded / 1000000000);
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
                    IF sign(extract(epoch from v_nudged - (tsq_zoned_of_wall((v_d1 + make_interval(months => (v_ey * 12 + v_em)::integer))::date + (v_ew * 7)::integer + v_t1, one_zone, 'compatible') AT TIME ZONE 'UTC'))) = -v_sign THEN
                        EXIT;
                    END IF;
                    v_years := v_ey; v_months := v_em; v_weeks := v_ew; v_days := 0; v_t := 0;
                END IF;
                v_unit := v_unit - 1;
            END LOOP;
        END IF;
    END IF;
    RETURN make_interval(years => (v_years * negation)::integer, months => (v_months * negation)::integer, weeks => (v_weeks * negation)::integer, days => (v_days * negation)::integer, secs => v_t * negation / 1000000000.0);
END $$;
```

## The functions of `minValueFunction` and `maxValueFunction`

`minValue` and `maxValue` give NULL when an operand is NULL, as their type says, with a `CASE` around `greatest` and `least`. With `minValueFunction` and `maxValueFunction`, a query calls a function of yours instead, which gives the same and writes each operand once (see [Propagating NULL through a function instead of a `CASE`](index.md#propagating-null-through-a-function-instead-of-a-case)). Without these settings, a query doesn't call them. The names are yours; these are the ones of that example. `minValue` returns the larger of the two values, so it takes the `greatest`-like function, and `maxValue` the `least`-like one.

Create the functions with `anycompatible` (PostgreSQL 14+) so they keep the operand's numeric type — `int` stays `int`, `double precision` stays `double precision`:

```sql
CREATE FUNCTION greatest_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE greatest(a, b) END $$;

CREATE FUNCTION least_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE least(a, b) END $$;
```
