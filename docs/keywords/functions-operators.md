---
search:
  boost: 5
---
# Function and Operator Keywords

Look for an SQL function or operator to find the method that writes it. In the tables, `value` is a column or any other expression, and `connection` is your connection. Several SQL forms in a row are the same method: the library writes the one of your database.

Comparison and text methods have an `IfValue` form, like `.equalsIfValue(x)`, which [adds the condition only when x has a value](../dynamic/building-blocks.md#a-condition-that-may-not-apply).

## Comparing values

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| value = x | value `.equals(x)` | Equality. | [Value expressions API](../api/value-expressions.md) |
| value <> x, value != x | value `.notEquals(x)` | Inequality. | [Value expressions API](../api/value-expressions.md) |
| value < x | value `.lessThan(x)` | Strictly less than. | [Value expressions API](../api/value-expressions.md) |
| value > x | value `.greaterThan(x)` | Strictly greater than. | [Value expressions API](../api/value-expressions.md) |
| value <= x | value `.lessOrEqual(x)` | Less than or equal. | [Value expressions API](../api/value-expressions.md) |
| value >= x | value `.greaterOrEqual(x)` | Greater than or equal. | [Value expressions API](../api/value-expressions.md) |
| value BETWEEN a AND b | value `.between(a, b)` | Inclusive range. | [Value expressions API](../api/value-expressions.md) |
| value NOT BETWEEN a AND b | value `.notBetween(a, b)` | Outside the range. | [Value expressions API](../api/value-expressions.md) |
| value IS x, value IS NOT DISTINCT FROM x, value <=> x, DECODE | value `.is(x)` | Equality where two nulls are equal. `<=>` on MySQL and MariaDB, `IS` on SQLite, `DECODE` on Oracle. | [Value expressions API](../api/value-expressions.md) |
| value IS NOT x, value IS DISTINCT FROM x | value `.isNot(x)` | Inequality where two nulls are equal. | [Value expressions API](../api/value-expressions.md) |
| value IS NULL | value `.isNull()` | The value is null. | [Value expressions API](../api/value-expressions.md) |
| value IS NOT NULL | value `.isNotNull()` | The value isn't null. | [Value expressions API](../api/value-expressions.md) |
| value IN (...) | value `.in([...])` | In a list. | [Value expressions API](../api/value-expressions.md) |
| value NOT IN (...) | value `.notIn([...])` | Not in a list. | [Value expressions API](../api/value-expressions.md) |
| value IN (...) (variadic) | value `.inN(...)` | `in`, with the values as arguments. | [Value expressions API](../api/value-expressions.md) |
| value NOT IN (...) (variadic) | value `.notInN(...)` | `notIn`, with the values as arguments. | [Value expressions API](../api/value-expressions.md) |
| value IN (SELECT ...) | value `.in(select)` | In the result of a subquery. | [Subquery in a condition](../queries/cte-subqueries.md#subquery-in-a-condition) |
| value NOT IN (SELECT ...) | value `.notIn(select)` | Not in the result of a subquery. | [Subquery in a condition](../queries/cte-subqueries.md#subquery-in-a-condition) |
| EXISTS(x) | connection `.exists(x)` | The subquery returns a row. | [Subquery checking that rows exist](../queries/cte-subqueries.md#subquery-checking-that-rows-exist) |
| NOT EXISTS(x) | connection `.notExists(x)` | The subquery returns no row. | [Subquery checking that rows exist](../queries/cte-subqueries.md#subquery-checking-that-rows-exist) |
| value AND x | value `.and(x)` | Logical and. | [Value expressions API](../api/value-expressions.md) |
| value OR x | value `.or(x)` | Logical or. | [Value expressions API](../api/value-expressions.md) |
| NOT value | value `.negate()` | Logical negation. | [Value expressions API](../api/value-expressions.md) |
| CASE ... WHEN ... THEN ... ELSE ... END | No method. Use a custom SQL fragment. | Conditional expression. | [SQL fragments](../queries/sql-fragments.md) |

## Handling null

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| COALESCE(value, x), IFNULL(value, x), NVL(value, x), ISNULL(value, x) | value `.valueWhenNull(x)` | The first value that isn't null. `IFNULL` on MySQL, MariaDB and SQLite, `NVL` on Oracle, `COALESCE` on the others; `ISNULL` of SQL Server isn't used. | [Value expressions API](../api/value-expressions.md) |
| NULLIF(value, x) | value `.nullIfValue(x)` | Null if the value equals x. | [Value expressions API](../api/value-expressions.md) |

## Searching in text

Only `like` and its forms receive a pattern; the others receive the text to look for. The `Insensitive` forms ignore the case; to order ignoring the case, see the [order modes](../queries/select.md#the-order-modes).

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| value LIKE x | value `.like(x)` | Matches a pattern. | [Value expressions API](../api/value-expressions.md) |
| value NOT LIKE x | value `.notLike(x)` | Doesn't match a pattern. | [Value expressions API](../api/value-expressions.md) |
| value LIKE x, value ILIKE x (ignoring the case) | value `.likeInsensitive(x)` | Matches a pattern, ignoring the case. `ILIKE` on PostgreSQL, `LOWER` or `COLLATE` on the others. | [Value expressions API](../api/value-expressions.md) |
| value NOT LIKE x, value NOT ILIKE x (ignoring the case) | value `.notLikeInsensitive(x)` | Doesn't match a pattern, ignoring the case. | [Value expressions API](../api/value-expressions.md) |
| value LIKE 'x%' | value `.startsWith(x)` | Starts with. Also `.notStartsWith(x)`, `.startsWithInsensitive(x)`, `.notStartsWithInsensitive(x)`. | [Value expressions API](../api/value-expressions.md) |
| value LIKE '%x' | value `.endsWith(x)` | Ends with. Also `.notEndsWith(x)`, `.endsWithInsensitive(x)`, `.notEndsWithInsensitive(x)`. | [Value expressions API](../api/value-expressions.md) |
| value LIKE '%x%' | value `.contains(x)` | Contains. Also `.notContains(x)`, `.containsInsensitive(x)`, `.notContainsInsensitive(x)`. | [Value expressions API](../api/value-expressions.md) |
| LOWER(value) = LOWER(x) | value `.equalsInsensitive(x)` | Equality ignoring the case. | [Value expressions API](../api/value-expressions.md) |
| LOWER(value) <> LOWER(x) | value `.notEqualsInsensitive(x)` | Inequality ignoring the case. | [Value expressions API](../api/value-expressions.md) |
| value COLLATE name | value `.collate(name)` | Applies a collation to the text. | [Value expressions API](../api/value-expressions.md) |

## Changing text

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| value \|\| x, value + x (SQL Server), CONCAT(value, x) | value `.concat(x)` | Concatenation; a null makes the result null. `CONCAT` on MySQL and MariaDB. | [Value expressions API](../api/value-expressions.md) |
| CONCAT_WS('', value, x), CONCAT(value, x) (SQL Server), COALESCE(value, '') \|\| COALESCE(x, '') | value `.concatIgnoringNull(x)` | Concatenation reading a null as the empty string. | [Value expressions API](../api/value-expressions.md) |
| LENGTH(value), LEN(value), CHAR_LENGTH(value) | value `.length()` | Length of the text. `LEN` on SQL Server, `CHAR_LENGTH` on MySQL and MariaDB. | [Value expressions API](../api/value-expressions.md) |
| LOWER(value) | value `.toLowerCase()` | To lowercase. | [Value expressions API](../api/value-expressions.md) |
| UPPER(value) | value `.toUpperCase()` | To uppercase. | [Value expressions API](../api/value-expressions.md) |
| TRIM(value) | value `.trim()` | Removes the spaces at both ends. | [Value expressions API](../api/value-expressions.md) |
| LTRIM(value) | value `.trimLeft()` | Removes the leading spaces. | [Value expressions API](../api/value-expressions.md) |
| RTRIM(value) | value `.trimRight()` | Removes the trailing spaces. | [Value expressions API](../api/value-expressions.md) |
| REPLACE(value, x, y) | value `.replaceAll(x, y)` | Replaces every match. | [Value expressions API](../api/value-expressions.md) |
| REGEXP_REPLACE(value, x, y), REPLACE ... COLLATE | value `.replaceAllInsensitive(x, y)` | Replaces every match, ignoring the case. | [Value expressions API](../api/value-expressions.md) |
| REVERSE(value) | value `.reverse()` | Reverses the text. | [Value expressions API](../api/value-expressions.md) |
| SUBSTR(value, start, length), LEFT, RIGHT | value `.substr(start, length)` | By start and length, as JavaScript's `substr`. | [Value expressions API](../api/value-expressions.md) |
| SUBSTR(value, start), RIGHT | value `.substrToEnd(start)` | From the start to the end. | [Value expressions API](../api/value-expressions.md) |
| SUBSTRING(value, start, length) | value `.substring(start, end)` | By start and end, as JavaScript's `substring`. | [Value expressions API](../api/value-expressions.md) |
| SUBSTRING(value, start) | value `.substringToEnd(start)` | From the start to the end. | [Value expressions API](../api/value-expressions.md) |

## Changing the type

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| CAST(value AS float), CAST(value AS double), CAST(value AS real), value::float | value `.asDouble()` | As a floating-point number. | [Value expressions API](../api/value-expressions.md) |
| CAST(ROUND(value) AS integer) | value `.asInt()` | As an integer, rounded first. | [Value expressions API](../api/value-expressions.md) |
| CAST(ROUND(value) AS bigint) | value `.asBigint()` | As a bigint, rounded first. | [Value expressions API](../api/value-expressions.md) |
| CAST(value AS text), value::text | value `.asString()` | As text. | [Value expressions API](../api/value-expressions.md) |

## Numbers

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| value + x | value `.add(x)` | Addition. | [Value expressions API](../api/value-expressions.md) |
| value - x | value `.subtract(x)` | Subtraction. | [Value expressions API](../api/value-expressions.md) |
| value * x | value `.multiply(x)` | Multiplication. | [Value expressions API](../api/value-expressions.md) |
| value / x | value `.divide(x)` | Division. | [Value expressions API](../api/value-expressions.md) |
| value % x, MOD(value, x) | value `.modulo(x)` | Remainder. | [Value expressions API](../api/value-expressions.md) |
| ABS(value) | value `.abs()` | Absolute value. | [Value expressions API](../api/value-expressions.md) |
| ACOS(value) | value `.acos()` | Arc cosine. | [Value expressions API](../api/value-expressions.md) |
| ASIN(value) | value `.asin()` | Arc sine. | [Value expressions API](../api/value-expressions.md) |
| ATAN(value) | value `.atan()` | Arc tangent. | [Value expressions API](../api/value-expressions.md) |
| ATAN2(y, x), ATN2(y, x) | value `.atan2(x)` | Arc tangent of y/x. `ATN2` on SQL Server. | [Value expressions API](../api/value-expressions.md) |
| CBRT(value) | value `.cbrt()` | Cube root. | [Value expressions API](../api/value-expressions.md) |
| CEIL(value), CEILING(value) | value `.ceil()` | Rounds up. | [Value expressions API](../api/value-expressions.md) |
| COS(value) | value `.cos()` | Cosine. | [Value expressions API](../api/value-expressions.md) |
| COT(value) | value `.cot()` | Cotangent. | [Value expressions API](../api/value-expressions.md) |
| EXP(value) | value `.exp()` | Exponential (e^x). | [Value expressions API](../api/value-expressions.md) |
| FLOOR(value) | value `.floor()` | Rounds down. | [Value expressions API](../api/value-expressions.md) |
| GREATEST(value, x), MAX(value, x) (SQLite) | value `.minValue(x)` | The value, but at least x: returns the greater of the two. | [Value expressions API](../api/value-expressions.md) |
| LEAST(value, x), MIN(value, x) (SQLite) | value `.maxValue(x)` | The value, but at most x: returns the smaller of the two. | [Value expressions API](../api/value-expressions.md) |
| LN(value), LOG(value) (SQL Server) | value `.ln()` | Natural logarithm. | [Value expressions API](../api/value-expressions.md) |
| LOG10(value), LOG(10, value) | value `.log10()` | Base-10 logarithm. | [Value expressions API](../api/value-expressions.md) |
| LOG(base, value) | value `.logn(x)` | Logarithm in another base. | [Value expressions API](../api/value-expressions.md) |
| PI() | connection `.pi()` | The constant π. | [Connection API](../api/connection.md) |
| POWER(value, x) | value `.power(x)` | Exponentiation. | [Value expressions API](../api/value-expressions.md) |
| RAND(), RANDOM() | connection `.random()` | Random number. | [Connection API](../api/connection.md) |
| ROUND(value) | value `.round()` | Rounds to the nearest. | [Value expressions API](../api/value-expressions.md) |
| ROUND(value, x) | value `.roundn(x)` | Rounds with precision. | [Value expressions API](../api/value-expressions.md) |
| SIGN(value) | value `.sign()` | Sign of the value. | [Value expressions API](../api/value-expressions.md) |
| SIN(value) | value `.sin()` | Sine. | [Value expressions API](../api/value-expressions.md) |
| SQRT(value) | value `.sqrt()` | Square root. | [Value expressions API](../api/value-expressions.md) |
| TAN(value) | value `.tan()` | Tangent. | [Value expressions API](../api/value-expressions.md) |

## Dates and times

The results follow the methods of the JavaScript `Date`. The SQL is the one of each database: `EXTRACT` on PostgreSQL and Oracle, `DATEPART` on SQL Server, `STRFTIME` on SQLite, and `YEAR`, `MONTH`... on MySQL and MariaDB.

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| CURRENT_DATE | connection `.currentDate()` | Current date. | [Connection API](../api/connection.md) |
| CURRENT_TIME | connection `.currentTime()` | Current time. | [Connection API](../api/connection.md) |
| CURRENT_TIMESTAMP, GETDATE() | connection `.currentDateTime()` | Current date and time. | [Connection API](../api/connection.md) |
| CURRENT_TIMESTAMP, GETDATE() | connection `.currentTimestamp()` | Same as `.currentDateTime()`. | [Connection API](../api/connection.md) |
| EXTRACT(YEAR FROM value), YEAR(value), DATEPART(year, value), STRFTIME('%Y', value) | value `.getFullYear()` | The year. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(MONTH FROM value), MONTH(value), DATEPART(month, value), STRFTIME('%m', value) | value `.getMonth()` | The month, from 0, as JavaScript. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(DAY FROM value), DAYOFMONTH(value), DATEPART(day, value), STRFTIME('%d', value) | value `.getDate()` | The day of the month. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(DOW FROM value), DAYOFWEEK(value), DATEPART(weekday, value), STRFTIME('%w', value) | value `.getDay()` | The day of the week, with Sunday as 0, as JavaScript. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(HOUR FROM value), HOUR(value), DATEPART(hour, value), STRFTIME('%H', value) | value `.getHours()` | The hour. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(MINUTE FROM value), MINUTE(value), DATEPART(minute, value), STRFTIME('%M', value) | value `.getMinutes()` | The minute. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(SECOND FROM value), SECOND(value), DATEPART(second, value), STRFTIME('%S', value) | value `.getSeconds()` | The second. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(MILLISECOND FROM value), MICROSECOND(value), DATEPART(millisecond, value), STRFTIME('%f', value) | value `.getMilliseconds()` | The milliseconds. | [Value expressions API](../api/value-expressions.md) |
| EXTRACT(EPOCH FROM value), UNIXEPOCH(value), DATEDIFF_BIG(millisecond, ...) | value `.getTime()` | The milliseconds since 1970, as JavaScript. | [Value expressions API](../api/value-expressions.md) |

## Aggregate functions

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| AVG(x) | connection `.average(x)` | Average. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| AVG(DISTINCT x) | connection `.averageDistinct(x)` | Average of the distinct values. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| ANY_VALUE(x) | connection `.anyValue(x)` | Any value of the group (not on MariaDB and SQL Server). | [Any value of the group](../queries/aggregate-and-group-by.md#any-value-of-the-group), [Connection API](../api/connection.md) |
| COUNT(*) | connection `.countAll()` | Counts all the rows. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| COUNT(x) | connection `.count(x)` | Counts the rows where x isn't null. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| COUNT(DISTINCT x) | connection `.countDistinct(x)` | Counts the distinct values. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| MAX(x) | connection `.max(x)` | Maximum value. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| MIN(x) | connection `.min(x)` | Minimum value. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| SUM(x) | connection `.sum(x)` | Sum of the values. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| SUM(DISTINCT x) | connection `.sumDistinct(x)` | Sum of the distinct values. | [Aggregate functions](../queries/aggregate-and-group-by.md#aggregate-functions), [Connection API](../api/connection.md) |
| STRING_AGG(x, separator), GROUP_CONCAT(x, separator), LISTAGG(x, separator) | connection `.stringConcat(x, separator)` | Concatenates text with a separator. | [Concatenating text](../queries/aggregate-and-group-by.md#concatenating-text), [Connection API](../api/connection.md) |
| STRING_AGG(DISTINCT x, separator), GROUP_CONCAT(DISTINCT x, separator), LISTAGG(DISTINCT x, separator) | connection `.stringConcatDistinct(x, separator)` | Concatenates the distinct values with a separator. | [Concatenating text](../queries/aggregate-and-group-by.md#concatenating-text), [Connection API](../api/connection.md) |
| JSON_AGG, JSON_ARRAYAGG, JSON_GROUP_ARRAY, STRING_AGG (SQL Server) | connection `.aggregateAsArray({...})`, `.aggregateAsArrayOfOneColumn(x)` | Aggregates rows as an array in the result. | [Aggregate as an array of objects](../queries/aggregate-as-object-array.md) |

## Constants and sequences

A sequence is defined in your connection with `this.sequence(name, type)`, and only on MariaDB, Oracle, PostgreSQL and SQL Server. `mySequence` below is the property you assign it to.

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| TRUE | connection `.true()` | The constant true. | [Connection API](../api/connection.md) |
| FALSE | connection `.false()` | The constant false. | [Connection API](../api/connection.md) |
| DEFAULT | connection `.default()` | The default value of a column (not on SQLite). | [Connection API](../api/connection.md) |
| NEXTVAL('name'), name.NEXTVAL, NEXT VALUE FOR name | connection `.mySequence.nextValue()` | The next value of a sequence. | [Connection API](../api/connection.md) |
| CURRVAL('name'), name.CURRVAL, LASTVAL(name) | connection `.mySequence.currentValue()` | The current value of a sequence. | [Connection API](../api/connection.md) |
