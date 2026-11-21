---
search:
  boost: 0.5
---
# SQL Server functions

Some queries call a function that SQL Server doesn't have built in. This page has the code of each one, to create once in the database, with what it is for and when a query calls it. A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of two kinds:

- **The functions of the library**, whose names start with `tsq_`. The queries of durations call them (see [Dates and times](../../dates-and-times.md)). Create them with the code of this page, as it is.
- **Functions of your own**, which a setting of the connection names. The code of this page is an example of them.

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | it adds a duration of the database, reads its fields, its sign or its total, or negates it | — |
| [`tsq_duration_text`](#tsq_duration_text) | `until` or `since` computes a duration | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | `tsq_duration_text` |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | `tsq_duration_text` |
| [The functions of `minValueFunction` and `maxValueFunction`](#the-functions-of-minvaluefunction-and-maxvaluefunction) | `minValue` or `maxValue` is written, with those settings | — |

## The order to create them

Create `tsq_duration_text` before `tsq_duration_round` and `tsq_duration_add`, which call it; the others in any order. Scalar functions are called with their schema on SQL Server, so the code creates them in `dbo`.

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. SQL Server keeps a duration as that text, so a query calls it to add a duration the database holds, like a column, to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

```sql
CREATE OR ALTER FUNCTION dbo.tsq_duration_part(@d NVARCHAR(100), @part VARCHAR(10)) RETURNS BIGINT WITH SCHEMABINDING AS
BEGIN
    IF @d IS NULL RETURN NULL;
    DECLARE @s NVARCHAR(100) = UPPER(LTRIM(RTRIM(@d))), @i INT = 1, @n INT, @c NCHAR(1), @num NVARCHAR(40) = N'', @inTime BIT = 0, @sign INT = 1, @r BIGINT = 0, @nonzero BIT = 0, @largest INT = 10, @f BIGINT;
    SET @n = LEN(@s);
    IF LEFT(@s, 1) = N'-' BEGIN SET @sign = -1; SET @i = 2; END ELSE IF LEFT(@s, 1) = N'+' SET @i = 2;
    SET @i = @i + 1;
    WHILE @i <= @n
    BEGIN
        SET @c = SUBSTRING(@s, @i, 1);
        IF @c = N'T' SET @inTime = 1;
        ELSE IF @c LIKE N'[0-9]' OR @c = N'.' OR @c = N',' SET @num = @num + CASE WHEN @c = N',' THEN N'.' ELSE @c END;
        ELSE
        BEGIN
            IF REPLACE(REPLACE(@num, N'0', N''), N'.', N'') <> N''
            BEGIN
                SET @nonzero = 1;
                SET @f = CAST(LEFT(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN SUBSTRING(@num, CHARINDEX(N'.', @num) + 1, 40) ELSE N'' END + N'000000000', 9) AS BIGINT);
                SET @largest = (SELECT MIN(v) FROM (VALUES (@largest), (CASE WHEN @c = N'Y' THEN 0 WHEN @c = N'M' AND @inTime = 0 THEN 1 WHEN @c = N'W' THEN 2 WHEN @c = N'D' THEN 3 WHEN @c = N'H' THEN 4 WHEN @c = N'M' THEN 5
                    WHEN CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT) <> 0 THEN 6 WHEN @f >= 1000000 THEN 7 WHEN @f >= 1000 THEN 8 ELSE 9 END)) AS t(v));
            END
            IF @part = 'M' AND @inTime = 0 AND @c = N'Y' SET @r = @r + 12 * CAST(@num AS BIGINT);
            ELSE IF @part = 'M' AND @inTime = 0 AND @c = N'M' SET @r = @r + CAST(@num AS BIGINT);
            ELSE IF @part = 'D' AND @c = N'W' SET @r = @r + 7 * CAST(@num AS BIGINT);
            ELSE IF @part = 'D' AND @c = N'D' SET @r = @r + CAST(@num AS BIGINT);
            ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'H' SET @r = @r + 3600 * CAST(@num AS BIGINT);
            ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'M' SET @r = @r + 60 * CAST(@num AS BIGINT);
            ELSE IF @part = 'S' AND @c = N'S' SET @r = @r + CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT);
            ELSE IF @part = 'N' AND @c = N'S' AND CHARINDEX(N'.', @num) > 0 SET @r = CAST(LEFT(SUBSTRING(@num, CHARINDEX(N'.', @num) + 1, 40) + N'000000000', 9) AS BIGINT);
            ELSE IF @part = 'years' AND @inTime = 0 AND @c = N'Y' OR @part = 'months' AND @inTime = 0 AND @c = N'M' OR @part = 'weeks' AND @c = N'W' OR @part = 'days' AND @c = N'D' OR @part = 'hours' AND @inTime = 1 AND @c = N'H' OR @part = 'minutes' AND @inTime = 1 AND @c = N'M' OR @part = 'seconds' AND @c = N'S' SET @r = CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT);
            SET @num = N'';
        END
        SET @i = @i + 1;
    END
    IF @part = 'sign' RETURN CASE WHEN @nonzero = 1 THEN @sign ELSE 0 END;
    IF @part = 'largest' RETURN @largest;
    RETURN @sign * @r;
END
GO
```

## `tsq_duration_text`

`tsq_duration_text` writes the ISO 8601 text of a duration from its fields, the text of Temporal's `toString`. A query calls it to give the duration that `until` or `since` computes (see [The duration between two dates and times](../../dates-and-times.md#the-duration-between-two-dates-and-times)), and `tsq_duration_round` and `tsq_duration_add` call it to write their result: create it before them.

`tsq_duration_round` and `tsq_duration_add` are created `WITH SCHEMABINDING` on it, and SQL Server doesn't change `tsq_duration_text` while they exist. On a database that has them, drop them first with the code below, and create them again after `tsq_duration_text`.

```sql
DROP FUNCTION IF EXISTS dbo.tsq_duration_round;
DROP FUNCTION IF EXISTS dbo.tsq_duration_add;
GO
```

```sql
CREATE OR ALTER FUNCTION dbo.tsq_duration_text(@y BIGINT, @mo BIGINT, @w BIGINT, @d BIGINT, @ns DECIMAL(38, 0), @unit VARCHAR(6)) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    IF @y IS NULL OR @mo IS NULL OR @w IS NULL OR @d IS NULL OR @ns IS NULL RETURN NULL;
    IF @unit = 'year' BEGIN SET @y = @y + @mo / 12; SET @mo = @mo % 12; END
    IF @unit = 'week' OR @unit = 'day'
    BEGIN
        SET @d = @d + CAST(ROUND(@ns / 86400000000000, 0, 1) AS BIGINT);
        SET @ns = @ns % 86400000000000;
        IF @unit = 'week' BEGIN SET @w = @w + @d / 7; SET @d = @d % 7; END
        SET @unit = 'hour';
    END
    DECLARE @neg BIT = CASE WHEN @y < 0 OR @mo < 0 OR @w < 0 OR @d < 0 OR @ns < 0 THEN 1 ELSE 0 END, @r VARCHAR(100) = '', @t VARCHAR(100) = '';
    DECLARE @hour BIGINT = 3600000000000, @minute BIGINT = 60000000000, @second BIGINT = 1000000000, @f BIGINT, @frac VARCHAR(9);
    IF @y <> 0 SET @r = @r + CAST(ABS(@y) AS VARCHAR(20)) + 'Y';
    IF @mo <> 0 SET @r = @r + CAST(ABS(@mo) AS VARCHAR(20)) + 'M';
    IF @w <> 0 SET @r = @r + CAST(ABS(@w) AS VARCHAR(20)) + 'W';
    IF @d <> 0 SET @r = @r + CAST(ABS(@d) AS VARCHAR(20)) + 'D';
    SET @ns = ABS(@ns);
    IF @unit = 'hour' AND @ns >= @hour BEGIN SET @t = @t + CAST(FLOOR(@ns / @hour) AS VARCHAR(20)) + 'H'; SET @ns = @ns % @hour; END
    IF @unit <> 'second' AND @ns >= @minute BEGIN SET @t = @t + CAST(FLOOR(@ns / @minute) AS VARCHAR(20)) + 'M'; SET @ns = @ns % @minute; END
    IF @ns > 0
    BEGIN
        SET @f = @ns % @second;
        SET @t = @t + CAST(FLOOR(@ns / @second) AS VARCHAR(20));
        IF @f > 0
        BEGIN
            SET @frac = RIGHT('000000000' + CAST(@f AS VARCHAR(9)), 9);
            WHILE RIGHT(@frac, 1) = '0' SET @frac = LEFT(@frac, LEN(@frac) - 1);
            SET @t = @t + '.' + @frac;
        END
        SET @t = @t + 'S';
    END
    IF @r = '' AND @t = '' RETURN 'PT0S';
    RETURN CASE WHEN @neg = 1 THEN '-' ELSE '' END + 'P' + @r + CASE WHEN @t = '' THEN '' ELSE 'T' + @t END;
END
GO
```

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../dates-and-times.md#the-options-of-until-and-since)). It calls `tsq_duration_text`.

```sql
CREATE OR ALTER FUNCTION dbo.tsq_duration_round(@y1 INT, @m1 INT, @d1 INT, @ns1 BIGINT, @y2 INT, @m2 INT, @d2 INT, @ns2 BIGINT, @largest VARCHAR(5), @smallest VARCHAR(11), @increment BIGINT, @mode VARCHAR(10), @negation INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    IF @y1 IS NULL OR @m1 IS NULL OR @d1 IS NULL OR @ns1 IS NULL OR @y2 IS NULL OR @m2 IS NULL OR @d2 IS NULL OR @ns2 IS NULL OR @largest IS NULL OR @smallest IS NULL OR @increment IS NULL OR @mode IS NULL OR @negation IS NULL RETURN NULL;
    DECLARE @day BIGINT = 86400000000000, @one DATE = DATEFROMPARTS(@y1, @m1, @d1), @two DATE = DATEFROMPARTS(@y2, @m2, @d2);
    DECLARE @adjusted DATE = @two, @t BIGINT = @ns2 - @ns1, @k INT, @years BIGINT = 0, @months BIGINT = 0, @weeks BIGINT = 0, @days BIGINT;
    DECLARE @sign BIGINT, @um VARCHAR(12), @r1 BIGINT, @start DATE, @end DATE, @num DECIMAL(38), @den DECIMAL(38), @whole DECIMAL(38), @rest DECIMAL(38), @steps BIGINT, @step BIGINT, @toRound BIGINT, @rounded BIGINT;
    IF @t > 0 AND @two < @one BEGIN SET @adjusted = DATEADD(day, 1, @two); SET @t = @t - @day; END
    ELSE IF @t < 0 AND @two > @one BEGIN SET @adjusted = DATEADD(day, -1, @two); SET @t = @t + @day; END
    IF @largest = 'week'
    BEGIN
        SET @weeks = DATEDIFF(day, @one, @adjusted) / 7;
        SET @days = DATEDIFF(day, @one, @adjusted) - @weeks * 7;
    END
    ELSE
    BEGIN
        SET @k = ((YEAR(@adjusted) * 12 + MONTH(@adjusted)) * 32 + DAY(@adjusted) - (@y1 * 12 + @m1) * 32 - @d1) / 32;
        IF @largest = 'year' SET @years = @k / 12;
        SET @months = @k - @years * 12;
        SET @days = DATEDIFF(day, DATEADD(month, @k, @one), @adjusted);
    END
    SET @sign = CASE WHEN @two < @one OR @two = @one AND @ns2 < @ns1 THEN -1 ELSE 1 END;
    SET @um = CASE @mode
        WHEN 'ceil' THEN CASE WHEN @sign < 0 THEN 'zero' ELSE 'infinity' END
        WHEN 'floor' THEN CASE WHEN @sign < 0 THEN 'infinity' ELSE 'zero' END
        WHEN 'halfCeil' THEN CASE WHEN @sign < 0 THEN 'halfZero' ELSE 'halfInfinity' END
        WHEN 'halfFloor' THEN CASE WHEN @sign < 0 THEN 'halfInfinity' ELSE 'halfZero' END
        WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
        ELSE 'halfEven' END;
    IF @smallest IN ('year', 'month', 'week')
    BEGIN
        IF @smallest = 'year'
        BEGIN
            SET @r1 = @years / @increment * @increment;
            SET @start = DATEADD(month, @r1 * 12, @one);
            SET @end = DATEADD(month, (@r1 + @increment * @sign) * 12, @one);
        END
        ELSE IF @smallest = 'month'
        BEGIN
            SET @r1 = @months / @increment * @increment;
            SET @start = DATEADD(month, @years * 12 + @r1, @one);
            SET @end = DATEADD(month, @years * 12 + @r1 + @increment * @sign, @one);
        END
        ELSE
        BEGIN
            SET @r1 = CASE WHEN @largest = 'week' THEN @weeks ELSE @days / 7 END / @increment * @increment;
            SET @start = DATEADD(day, @r1 * 7, DATEADD(month, @years * 12 + @months, @one));
            SET @end = DATEADD(day, (@r1 + @increment * @sign) * 7, DATEADD(month, @years * 12 + @months, @one));
        END
        SET @num = ABS(CAST(DATEDIFF(day, @start, @two) AS DECIMAL(38)) * @day + @ns2 - @ns1);
        SET @den = ABS(CAST(DATEDIFF(day, @start, @end) AS DECIMAL(38)) * @day);
        SET @whole = ROUND(@num / @den, 0, 1);
        SET @rest = @num - @whole * @den;
        SET @steps = @whole + CASE WHEN @rest <> 0 AND (@um = 'infinity' OR @um LIKE 'half%' AND (2 * @rest > @den OR 2 * @rest = @den AND (@um = 'halfInfinity' OR @um = 'halfEven' AND (ABS(@r1) / @increment + @whole) % 2 <> 0))) THEN 1 ELSE 0 END;
        SET @days = 0;
        SET @t = 0;
        IF @smallest = 'year' BEGIN SET @years = @r1 + @increment * @sign * @steps; SET @months = 0; END
        ELSE IF @smallest = 'month'
        BEGIN
            SET @months = @r1 + @increment * @sign * @steps;
            IF @steps > 0 AND @largest = 'year' AND @sign * DATEDIFF(day, DATEADD(month, (@years + @sign) * 12, @one), DATEADD(month, @years * 12 + @months, @one)) >= 0 BEGIN SET @years = @years + @sign; SET @months = 0; END
        END
        ELSE SET @weeks = @r1 + @increment * @sign * @steps;
    END
    ELSE
    BEGIN
        SET @step = CASE @smallest WHEN 'day' THEN @day WHEN 'hour' THEN CAST(3600000000000 AS BIGINT) WHEN 'minute' THEN CAST(60000000000 AS BIGINT) WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * @increment;
        SET @toRound = @days * @day + @t;
        SET @rest = ABS(@toRound % @step);
        SET @rounded = @toRound - @toRound % @step;
        IF @rest <> 0 AND (@um = 'infinity' OR @um LIKE 'half%' AND (2 * @rest > @step OR 2 * @rest = @step AND (@um = 'halfInfinity' OR @um = 'halfEven' AND (@rounded / @step) % 2 <> 0))) SET @rounded = @rounded + @step * @sign;
        SET @days = @rounded / @day;
        SET @t = @rounded - @days * @day;
        IF @rounded / @day <> @toRound / @day
        BEGIN
            IF @largest = 'week'
            BEGIN
                IF @sign * (CAST(DATEDIFF(day, DATEADD(day, (@weeks + @sign) * 7, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0 BEGIN SET @weeks = @weeks + @sign; SET @days = 0; SET @t = 0; END
            END
            ELSE IF @sign * (CAST(DATEDIFF(day, DATEADD(month, @years * 12 + @months + @sign, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0
            BEGIN
                SET @days = 0;
                SET @t = 0;
                IF @largest = 'year' AND @sign * (CAST(DATEDIFF(day, DATEADD(month, (@years + @sign) * 12, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0 BEGIN SET @years = @years + @sign; SET @months = 0; END
                ELSE SET @months = @months + @sign;
            END
        END
    END
    RETURN dbo.tsq_duration_text(@years * @negation, @months * @negation, @weeks * @negation, @days * @negation, @t * @negation, 'hour');
END
GO
```

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../dates-and-times.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error converting a text to a number, because a function of SQL Server can't raise one.

```sql
CREATE OR ALTER FUNCTION dbo.tsq_duration_total(@months BIGINT, @weeks BIGINT, @days BIGINT, @seconds BIGINT, @nanoseconds BIGINT, @y INT, @m INT, @d INT, @unit VARCHAR(11)) RETURNS FLOAT WITH SCHEMABINDING AS
BEGIN
    IF @months IS NULL OR @weeks IS NULL OR @days IS NULL OR @seconds IS NULL OR @nanoseconds IS NULL OR @y IS NULL OR @m IS NULL OR @d IS NULL OR @unit IS NULL RETURN NULL;
    DECLARE @day DECIMAL(38, 0) = 86400000000000, @t DECIMAL(38, 0) = CAST(@seconds AS DECIMAL(38, 0)) * 1000000000 + @nanoseconds, @timeOfDay DECIMAL(38, 0);
    DECLARE @one DATE, @two DATE, @adjusted DATE, @sign INT, @k INT, @r1 INT, @start DATE, @end DATE;
    DECLARE @a DECIMAL(38, 0), @b DECIMAL(38, 0), @x DECIMAL(38, 0), @s INT = 0, @q DECIMAL(38, 0), @rest DECIMAL(38, 0);
    IF @m = 0
    BEGIN
        IF @months <> 0 OR @weeks <> 0 OR @unit IN ('year', 'month', 'week')
            RETURN CAST('tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference, unit ' + @unit AS INT);
        SET @a = @days * @day + @t;
    END
    ELSE
    BEGIN
        -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
        SET @timeOfDay = @t % @day;
        IF @timeOfDay < 0 SET @timeOfDay = @timeOfDay + @day;
        SET @one = DATEFROMPARTS(@y, @m, @d);
        SET @two = DATEADD(day, CAST(@weeks * 7 + @days + (@t - @timeOfDay) / @day AS INT), DATEADD(month, @months, @one));
        IF @unit IN ('year', 'month', 'week')
        BEGIN
            IF @two = @one AND @timeOfDay = 0 RETURN 0;
            -- The whole units to the end without passing it (as until), and the progress to the next one
            SET @adjusted = CASE WHEN @timeOfDay > 0 AND @two < @one THEN DATEADD(day, 1, @two) ELSE @two END;
            SET @sign = CASE WHEN DATEDIFF(day, @one, @two) * @day + @timeOfDay < 0 THEN -1 ELSE 1 END;
            IF @unit = 'week'
                SET @r1 = DATEDIFF(day, @one, @adjusted) / 7;
            ELSE
            BEGIN
                SET @k = ((YEAR(@adjusted) * 12 + MONTH(@adjusted)) * 32 + DAY(@adjusted) - (@y * 12 + @m) * 32 - @d) / 32;
                SET @r1 = CASE WHEN @unit = 'month' THEN @k ELSE @k / 12 END;
            END
            SET @start = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * @r1, @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 ELSE 12 * @r1 END, @one) END;
            SET @end = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * (@r1 + @sign), @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 + @sign ELSE 12 * (@r1 + @sign) END, @one) END;
            IF ABS(DATEDIFF(day, @start, @two) * @day + @timeOfDay) >= ABS(DATEDIFF(day, @start, @end) * @day)
            BEGIN
                -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                SET @r1 = @r1 + @sign;
                SET @start = @end;
                SET @end = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * (@r1 + @sign), @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 + @sign ELSE 12 * (@r1 + @sign) END, @one) END;
            END
            SET @b = ABS(DATEDIFF(day, @start, @end) * @day);
            SET @a = @r1 * @b + @sign * ABS(DATEDIFF(day, @start, @two) * @day + @timeOfDay);
        END
        ELSE
            SET @a = DATEDIFF(day, @one, @two) * @day + @timeOfDay;
    END
    IF @unit NOT IN ('year', 'month', 'week')
        SET @b = CASE @unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
    -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
    IF @a = 0 RETURN 0;
    SET @x = ABS(@a);
    WHILE @x >= @b * 9007199254740992 BEGIN SET @b = @b * 2; SET @s = @s - 1; END
    WHILE @x < @b * 4503599627370496 BEGIN SET @x = @x * 2; SET @s = @s + 1; END
    SET @rest = @x % @b;
    SET @q = (@x - @rest) / @b;
    IF 2 * @rest > @b OR 2 * @rest = @b AND @q % 2 = 1 SET @q = @q + 1;
    RETURN CASE WHEN @a < 0 THEN -1 ELSE 1 END * CAST(@q AS FLOAT) * POWER(CAST(2 AS FLOAT), -@s);
END
GO
```

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../dates-and-times.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`. It calls `tsq_duration_text`.

```sql
CREATE OR ALTER FUNCTION dbo.tsq_duration_add(@largest1 INT, @days1 BIGINT, @seconds1 BIGINT, @nanoseconds1 BIGINT, @largest2 INT, @days2 BIGINT, @seconds2 BIGINT, @nanoseconds2 BIGINT, @sign INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    IF @largest1 IS NULL OR @days1 IS NULL OR @seconds1 IS NULL OR @nanoseconds1 IS NULL OR @largest2 IS NULL OR @days2 IS NULL OR @seconds2 IS NULL OR @nanoseconds2 IS NULL OR @sign IS NULL RETURN NULL;
    DECLARE @day DECIMAL(38, 0) = 86400000000000, @largest INT = CASE WHEN @largest1 < @largest2 THEN @largest1 ELSE @largest2 END, @total DECIMAL(38, 0), @days DECIMAL(38, 0) = 0;
    IF @largest <= 2
        RETURN CAST(CAST('tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted, sign ' + CAST(@sign AS VARCHAR(2)) AS INT) AS VARCHAR(100));
    SET @total = CAST(@days1 + @sign * @days2 AS DECIMAL(38, 0)) * @day + CAST(@seconds1 + @sign * @seconds2 AS DECIMAL(38, 0)) * 1000000000 + @nanoseconds1 + @sign * @nanoseconds2;
    IF @largest = 3 SET @days = (@total - @total % @day) / @day;
    RETURN dbo.tsq_duration_text(0, 0, 0, @days, @total - @days * @day, CASE WHEN @largest <= 4 THEN 'hour' WHEN @largest = 5 THEN 'minute' ELSE 'second' END);
END
GO
```

## The functions of `minValueFunction` and `maxValueFunction`

`minValue` and `maxValue` give NULL when an operand is NULL, as their type says, with a `CASE` around `greatest` and `least`. With `minValueFunction` and `maxValueFunction`, a query calls a function of yours instead, which gives the same and writes each operand once (see [Propagating NULL through a function instead of a `CASE`](index.md#propagating-null-through-a-function-instead-of-a-case)). Without these settings, a query doesn't call them. The names are yours; these are the ones of that example. `minValue` returns the larger of the two values, so it takes the `greatest`-like function, and `maxValue` the `least`-like one.

A scalar function is not polymorphic on SQL Server, so `float` covers the numeric operands (`int` / `bigint` widen to it), and the `CASE` comparison works on every version (no dependency on the 2022+ `least` / `greatest`):

```sql
CREATE FUNCTION dbo.greatest_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a >= @b THEN @a ELSE @b END
END;
GO
CREATE FUNCTION dbo.least_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a <= @b THEN @a ELSE @b END
END;
```
