-- SQL Server: the functions of the library ts-sql-query, and the ones of its settings of functions, in the order to create them.
-- See https://ts-sql-query.readthedocs.io/en/latest/databases/sqlserver/functions/
-- Run it with: sqlcmd -d <database> -i tsq-functions.sql

-- The functions that take others with schema binding are dropped first, so the others can be created again
DROP FUNCTION IF EXISTS dbo.tsq_duration_sum;
DROP FUNCTION IF EXISTS dbo.tsq_duration_total_of;
DROP FUNCTION IF EXISTS dbo.tsq_duration_round_of;
DROP FUNCTION IF EXISTS dbo.tsq_instant_plus_duration;
DROP FUNCTION IF EXISTS dbo.tsq_datetime_plus_duration;
DROP FUNCTION IF EXISTS dbo.tsq_duration_negated;
DROP FUNCTION IF EXISTS dbo.tsq_datetime_round;
GO

-- ===== tsq_duration_part =====
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

-- ===== tsq_duration_text =====
DROP FUNCTION IF EXISTS dbo.tsq_duration_round;
DROP FUNCTION IF EXISTS dbo.tsq_duration_add;
GO

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

-- ===== tsq_duration_round =====
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

-- ===== tsq_duration_total =====
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

-- ===== tsq_duration_add =====
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

-- ===== tsq_round_to =====
CREATE OR ALTER FUNCTION dbo.tsq_round_to(@value DECIMAL(38, 0), @step DECIMAL(38, 0), @rounding_mode VARCHAR(10)) RETURNS DECIMAL(38, 0) WITH SCHEMABINDING AS
BEGIN
    IF @value IS NULL OR @step IS NULL OR @rounding_mode IS NULL RETURN NULL;
    DECLARE @q DECIMAL(38, 0) = ROUND(@value / @step, 0, 1);
    DECLARE @r DECIMAL(38, 0) = @value - @q * @step;
    IF @r = 0 RETURN @value;
    DECLARE @away DECIMAL(38, 0) = @q + SIGN(@value);
    RETURN @step * CASE
        WHEN @rounding_mode = 'trunc' THEN @q
        WHEN @rounding_mode = 'floor' THEN CASE WHEN @value < 0 THEN @away ELSE @q END
        WHEN @rounding_mode = 'ceil' THEN CASE WHEN @value > 0 THEN @away ELSE @q END
        WHEN @rounding_mode = 'expand' THEN @away
        WHEN 2 * ABS(@r) > @step THEN @away
        WHEN 2 * ABS(@r) < @step THEN @q
        WHEN @rounding_mode = 'halfExpand' THEN @away
        WHEN @rounding_mode = 'halfTrunc' THEN @q
        WHEN @rounding_mode = 'halfCeil' THEN CASE WHEN @value > 0 THEN @away ELSE @q END
        WHEN @rounding_mode = 'halfFloor' THEN CASE WHEN @value < 0 THEN @away ELSE @q END
        WHEN @q % 2 = 0 THEN @q
        ELSE @away
    END;
END
GO

-- ===== tsq_ticks_between =====
CREATE OR ALTER FUNCTION dbo.tsq_ticks_between(@one DATETIME2(7), @two DATETIME2(7)) RETURNS BIGINT WITH SCHEMABINDING AS
BEGIN
    RETURN DATEDIFF(DAY, CAST(@one AS DATE), CAST(@two AS DATE)) * CAST(864000000000 AS BIGINT) + DATEDIFF_BIG(NANOSECOND, CAST(@one AS TIME), CAST(@two AS TIME)) / 100;
END
GO

-- ===== tsq_time_of_ticks =====
CREATE OR ALTER FUNCTION dbo.tsq_time_of_ticks(@ticks BIGINT) RETURNS TIME(7) WITH SCHEMABINDING AS
BEGIN
    RETURN DATEADD(NANOSECOND, @ticks % 10000000 * 100, DATEADD(SECOND, @ticks / 10000000 % 86400, CAST('00:00' AS TIME(7))));
END
GO

-- ===== tsq_datetime_of_ticks =====
CREATE OR ALTER FUNCTION dbo.tsq_datetime_of_ticks(@date DATE, @ticks BIGINT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    RETURN DATEADD(NANOSECOND, @ticks % 10000000 * 100, DATEADD(SECOND, @ticks / 10000000, CAST(@date AS DATETIME2(7))));
END
GO

-- ===== tsq_duration_sum =====
CREATE OR ALTER FUNCTION dbo.tsq_duration_sum(@a NVARCHAR(100), @b NVARCHAR(100), @sign INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_duration_add(dbo.tsq_duration_part(@a, 'largest'), dbo.tsq_duration_part(@a, 'days'), dbo.tsq_duration_part(@a, 'S'), dbo.tsq_duration_part(@a, 'N'),
        dbo.tsq_duration_part(@b, 'largest'), dbo.tsq_duration_part(@b, 'days'), dbo.tsq_duration_part(@b, 'S'), dbo.tsq_duration_part(@b, 'N'), @sign);
END
GO

-- ===== tsq_duration_total_of =====
CREATE OR ALTER FUNCTION dbo.tsq_duration_total_of(@d NVARCHAR(100), @y INT, @m INT, @dd INT, @unit VARCHAR(11)) RETURNS FLOAT WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_duration_total(dbo.tsq_duration_part(@d, 'M'), dbo.tsq_duration_part(@d, 'weeks'), dbo.tsq_duration_part(@d, 'days'), dbo.tsq_duration_part(@d, 'S'), dbo.tsq_duration_part(@d, 'N'), @y, @m, @dd, @unit);
END
GO

-- ===== tsq_duration_round_of =====
CREATE OR ALTER FUNCTION dbo.tsq_duration_round_of(@one DATETIME2(7), @two DATETIME2(7), @largest VARCHAR(5), @smallest VARCHAR(11), @increment BIGINT, @mode VARCHAR(10), @negation INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_duration_round(YEAR(@one), MONTH(@one), DAY(@one), DATEDIFF_BIG(NANOSECOND, CAST('00:00' AS TIME), CAST(@one AS TIME)),
        YEAR(@two), MONTH(@two), DAY(@two), DATEDIFF_BIG(NANOSECOND, CAST('00:00' AS TIME), CAST(@two AS TIME)),
        @largest, @smallest, @increment, @mode, @negation);
END
GO

-- ===== tsq_datetime_plus_duration and tsq_instant_plus_duration =====
CREATE OR ALTER FUNCTION dbo.tsq_datetime_plus_duration(@value DATETIME2(7), @duration NVARCHAR(100), @sign INT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    RETURN DATEADD(NANOSECOND, @sign * dbo.tsq_duration_part(@duration, 'N'), CAST(DATEADD(SECOND, @sign * dbo.tsq_duration_part(@duration, 'S') % 86400, DATEADD(DAY, (@sign * dbo.tsq_duration_part(@duration, 'D') + @sign * dbo.tsq_duration_part(@duration, 'S') / 86400), DATEADD(MONTH, @sign * dbo.tsq_duration_part(@duration, 'M'), @value))) AS DATETIME2(7)));
END
GO

CREATE OR ALTER FUNCTION dbo.tsq_instant_plus_duration(@value DATETIME2(7), @duration NVARCHAR(100), @sign INT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    -- A duration with days, weeks, months or years makes the query fail: the day 29 of February 2001, which it hasn't
    RETURN DATEADD(DAY, DAY(DATEFROMPARTS(2001, 2, CASE WHEN dbo.tsq_duration_part(@duration, 'M') <> 0 OR dbo.tsq_duration_part(@duration, 'D') <> 0 THEN 29 ELSE 28 END)) - 28, dbo.tsq_datetime_plus_duration(@value, @duration, @sign));
END
GO

-- ===== tsq_duration_negated =====
CREATE OR ALTER FUNCTION dbo.tsq_duration_negated(@d NVARCHAR(100)) RETURNS NVARCHAR(100) WITH SCHEMABINDING AS
BEGIN
    RETURN CASE WHEN SUBSTRING(@d, 1, 1) = N'-' THEN SUBSTRING(@d, 2, 100) WHEN dbo.tsq_duration_part(@d, 'sign') = 0 THEN @d WHEN SUBSTRING(@d, 1, 1) = N'+' THEN N'-' + SUBSTRING(@d, 2, 100) ELSE N'-' + @d END;
END
GO

-- ===== tsq_day_in_month_or_error =====
CREATE OR ALTER FUNCTION dbo.tsq_day_in_month_or_error(@value DATETIME2(7), @months INT) RETURNS INT WITH SCHEMABINDING AS
BEGIN
    DECLARE @index INT = YEAR(@value) * 12 + MONTH(@value) - 1 + @months;
    RETURN DAY(DATEFROMPARTS(@index / 12, @index % 12 + 1, DAY(@value))) - DAY(@value);
END
GO

-- ===== tsq_utc_of_epoch =====
CREATE OR ALTER FUNCTION dbo.tsq_utc_of_epoch(@value DECIMAL(38, 0), @unit_nanoseconds BIGINT) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    DECLARE @total DECIMAL(38, 0) = @value * @unit_nanoseconds;
    DECLARE @rest DECIMAL(38, 0) = (@total % 86400000000000 + 86400000000000) % 86400000000000;
    RETURN DATEADD(NANOSECOND, @rest % 1000000000, DATEADD(SECOND, FLOOR(@rest / 1000000000), CAST(DATEADD(DAY, (@total - @rest) / 86400000000000, CAST('1970-01-01' AS DATE)) AS DATETIME2(7))));
END
GO

-- ===== tsq_date_with =====
CREATE OR ALTER FUNCTION dbo.tsq_date_with(@value DATE, @year INT, @month INT, @day INT, @reject INT) RETURNS DATE WITH SCHEMABINDING AS
BEGIN
    IF @value IS NULL RETURN NULL;
    DECLARE @y INT = ISNULL(@year, YEAR(@value)), @m INT = ISNULL(@month, MONTH(@value)), @d INT = ISNULL(@day, DAY(@value));
    DECLARE @last INT = DAY(EOMONTH(DATEFROMPARTS(@y, @m, 1)));
    IF @d > @last AND @reject = 0 SET @d = @last;
    RETURN DATEFROMPARTS(@y, @m, @d);
END
GO

-- ===== tsq_datetime_round =====
CREATE OR ALTER FUNCTION dbo.tsq_datetime_round(@value DATETIME2(7), @step BIGINT, @rounding_mode VARCHAR(10)) RETURNS DATETIME2(7) WITH SCHEMABINDING AS
BEGIN
    RETURN dbo.tsq_datetime_of_ticks(CAST(@value AS DATE), dbo.tsq_round_to(DATEDIFF_BIG(NANOSECOND, CAST('00:00' AS TIME), CAST(@value AS TIME)) / 100, @step, @rounding_mode));
END
GO

-- ===== tsq_greatest_strict and tsq_least_strict =====
CREATE OR ALTER FUNCTION dbo.tsq_greatest_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a >= @b THEN @a ELSE @b END
END;
GO
CREATE OR ALTER FUNCTION dbo.tsq_least_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a <= @b THEN @a ELSE @b END
END;
GO
