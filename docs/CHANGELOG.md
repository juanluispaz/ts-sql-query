---
search:
  exclude: true
---
# Change Log

## v2.0.0-beta.2 (Unreleased)

**New features**:

- Unused CTEs (`with` clauses) are no longer included in the generated SQL: a common table expression that the final query doesn't actually use — for example one referenced only by an optional join that ends up pruned — is now dropped instead of being emitted for nothing.
- **Aggregate functions are now type-checked against the clause where you use them.** An aggregate (`count`, `sum`, `average`, `min`, `max`, `stringConcat`, `aggregateAsArray`, their `Distinct` variants, or any expression built from one) no longer compiles inside `where` / `and` / `or`, `groupBy` or a join `on` — only in `having`, `select` and `orderBy`, as SQL requires. Misplacing an aggregate is now a TypeScript error instead of a database error at runtime. Compile-time-only breaking change; the generated SQL is unchanged.
- **Custom aggregates as SQL fragments.** New `aggregateFragmentWithType` / `buildAggregateFragmentWithArgs` / `buildAggregateFragmentWithArgsIfValue` / `buildAggregateFragmentWithMaybeOptionalArgs` let you mark a fragment that wraps a database-specific aggregate as an aggregate, so it gets the same clause checking. See [SQL fragments → Aggregate fragments](queries/sql-fragments.md).
- **`exactOptionalPropertyTypes` is now honored: an optional result property is typed `k?: T` instead of `k?: T | undefined`.** A projected value with no value is *omitted* from the result object — ts-sql-query never assigns `undefined` to the key — so the extra `| undefined` arm described a state the library cannot produce. It is now gone: every optional property of a query result is `k?: T`, matching the shapes shown throughout the documentation. Previously the arm appeared only on objects with **no** required property (`select({ totalPriority: connection.sum(t.priority) })` gave `totalPriority?: number | undefined`, while the same optional leaf beside a required sibling already gave `k?: T`), so the shape was also inconsistent between otherwise-equivalent projections. If you have `exactOptionalPropertyTypes` enabled and were relying on assigning an explicit `undefined` to such a property, that assignment no longer compiles — omit the key instead. With `exactOptionalPropertyTypes` disabled (TypeScript's default) `k?: T` and `k?: T | undefined` are the same type, so nothing changes for you.

- **Oracle: `concatFunction` makes concatenation propagate NULL like the other databases.** Oracle reads NULL as the empty string when concatenating (`'x' || null` is `'x'`), which shows up twice: `concat` returns a present string where its declared type says the result is optional, and — the reason this is worth an option — an affix predicate (`startsWith` / `endsWith` / `contains` and their `Insensitive` variants) builds its LIKE pattern by concatenation, so a NULL search term makes the pattern `'%'` and **the filter matches every row instead of none**. The default is unchanged: `||` is emitted, nothing is paid, and an Oracle developer gets the semantics they expect. Setting `concatFunction` to the name of a null-propagating function you created routes **both** halves through it — they always move together, since a `startsWith` that propagates NULL while `concat` does not would only move the inconsistency. See [Oracle → Concatenation and NULL](configuration/supported-databases/oracle.md#concatenation-and-null) for the package to create (it must be a package: Oracle cannot overload standalone functions, and the overloads are what keep a `CLOB` from being silently truncated).

**Fixes**:

- **SQL Server: string operations on a `uuid` value no longer fail with an arithmetic-overflow error.** Applying a string operation to a uuid — `concat`, `trim`, `substr` / `substring`, `valueWhenNull`, `stringConcat`, or interpolating it into a typed / raw fragment, including the `.asString()` automatically applied when a dynamic condition filters a uuid column through a `StringFilter` — emitted `convert(nvarchar, …)` with no length. SQL Server defaults that to `nvarchar(30)` and **raises** when converting a 36-character `uniqueidentifier` (it does not truncate), so these queries failed at runtime. They now emit `convert(nvarchar(36), …)`.
- **SQL Server: `aggregateAsArray` on older `compatibilityVersion` settings no longer overflows on uuid columns or truncates long string columns.** When the configured compatibility version predates native `FOR JSON` support, ts-sql-query assembles the JSON array by hand with `string_agg` + `convert(nvarchar, …)`. Those converts had no length (so `nvarchar(30)`): a uuid column raised an arithmetic-overflow error, and a string value longer than 30 characters was silently truncated in the aggregated JSON. Uuid columns now convert with `nvarchar(36)` and string columns with `nvarchar(max)`. Newer compatibility versions use native `FOR JSON` and were unaffected.
- **`.or(...)` on a multi-table `DELETE` / `UPDATE` join `on` clause now emits `OR` instead of `AND`.** On the engines where a join on `deleteFrom`/`update` is supported (MariaDB, MySQL), extending a join predicate with `.or(...)` — for example `.innerJoin(t).dynamicOn().or(a).or(b)` — wrongly combined the conditions with `AND`, changing which rows the statement matched (often matching none). The corresponding `.and(...)` form, and `.or(...)` on `SELECT` joins, were already correct.
- **Oracle: a multi-row `INSERT` now returns the number of inserted rows instead of `0`.** `insertInto(table).values([row1, row2, …]).executeInsert()` (without `returningLastInsertedId()` / `returning(...)`) returned `0` on Oracle even though the rows were inserted, because Oracle emits the multi-row insert as an anonymous PL/SQL block and Oracle drivers don't report an affected-row count for PL/SQL blocks. It now returns the actual count (the number of provided rows), matching every other database. This also makes the `min` / `max` bounds of `executeInsert(min, max)` enforce correctly for multi-row inserts on Oracle.
- **`extractProvidedIdColumnNamesFrom` now has the correct return type.** The helper in `ts-sql-query/extras/utils` returns the names of the *provided* (non-autogenerated) primary-key columns at runtime, but its declared return type wrongly named the *autogenerated* primary-key keys (a copy/paste slip from `extractAutogeneratedIdColumnNamesFrom`). On a table with a provided primary key, consumers got column-name string literals that didn't match the actual result; the type now resolves to the provided primary-key keys, matching the runtime value and the sibling `extractProvidedIdColumnsFrom`.
- **Oracle, SQL Server: binding a `localTime` value as a query parameter now works.** Using a `localTime` value as a parameter — in a `WHERE` comparison, an `INSERT … VALUES`, or an `UPDATE … SET` — failed at runtime: Oracle raised `ORA-01843: an invalid month was specified` and SQL Server raised `Invalid time`, because the value was sent as a bare `'HH:MI:SS'` string that neither driver accepts for its time/timestamp parameter type. The time is now bound as a date-anchored value both drivers accept, matching how `localDate` and `localDateTime` already bind. Reading a `localTime` column, and `localTime` parameters on the other databases, were unaffected.
- **SQL Server, Oracle: a non-column boolean value used as a condition no longer double-wraps its bit-to-predicate coercion.** A boolean value that isn't already a predicate — a `const(..., 'boolean')` / `valueArg('boolean')`, a boolean one-column inline subquery, etc. — used where a condition is expected (interpolated into a fragment, OR'd / AND'd into a `where`, …) emitted `((@0 = 1) = 1)` instead of `(@0 = 1)`. On SQL Server this failed at runtime with `Incorrect syntax near '='` (a predicate compared to an integer); Oracle emitted the same `((:0 = 1) = 1)` but tolerated it. Both now emit the single `(@0 = 1)` form, matching the already-correct direct-value path (`.or(true)`) and a boolean column in the same position. Databases with a native boolean type were unaffected.
- **Optional nested objects in a projection are no longer typed as `| null`.** When a projection nests an object whose presence is optional — the default optionals-as-`undefined` mode, e.g. `select({ group: { column: aNullableColumn } })` — the inner object's type wrongly included `| null` (so `group?: { … } | null` instead of just `group?: { … }`), a regression introduced when complex projections were reworked for v2. At runtime the object is omitted when absent and never set to `null`, so the `| null` arm could never occur; the type now matches v1 and the documented result shape. The opt-in `projectingOptionalValuesAsNullable()` mode, where an absent nested object is genuinely `null` and the property is not optional, was correct and is unchanged.
- **The properties of an optional nested object in a projection are now typed as optional keys, matching the runtime.** When a projection nests an object whose presence is optional — every leaf optional (rule 4), all leaves from the same left join (rule 2), or an `asRequiredInOptionalObject` gate (rule 1) — that object's own non-required properties were typed as **present** keys carrying `| undefined` (`proj?: { id: number; name: string; archivedAt: Date | undefined }`) instead of optional keys (`proj?: { …; archivedAt?: Date }`), a regression introduced when complex projections were reworked for v2. At runtime such a leaf is omitted from the object when it has no value and never set to `undefined`, so the type contradicted the result it described: `'archivedAt' in row.proj` is `false` while the type declared the key must exist — and with `exactOptionalPropertyTypes` enabled the object was not even assignable to its own declared type. The same applied to a nested *inner object* key (`inner: { … } | undefined` instead of `inner?: { … }`). Only objects the rules mark optional were affected — a required nested object (rule 3) and the first-level object, which is never optional, were already correct — and the fix restores the v1 shape and the shapes shown in the documentation. The opt-in `projectingOptionalValuesAsNullable()` mode, where an absent leaf is genuinely present as `null`, was correct and is unchanged.
- **A nested object whose only member is an optional inner object is now typed optional, matching the runtime.** When a projection nests a container object whose *sole* member is itself an optional inner object — every leaf optional/left-join, e.g. `select({ wrapper: { inner: { body: aNullableColumn, assigneeId: aNullableColumn } } })` — the container was wrongly typed as required (`wrapper: { … }`) even though, with no other member to keep it present, it is dropped (default optionals-as-`undefined` mode) or set to `null` (`projectingOptionalValuesAsNullable()`) at runtime when that inner object collapses. Reading `row.wrapper.inner` was therefore unsound (a runtime `undefined`/`null` access). The container now recursively inherits its sole optional member's optionality — `wrapper?: { … }` by default and `wrapper: { … } | null` under `projectingOptionalValuesAsNullable()` — so the type matches the already-correct runtime. Containers that carry a required leaf or a required inner object (so they are always present) are unchanged.
- **SQL Server, Oracle: substituting a predicate into a dynamic boolean expression no longer double-wraps it as `(... = 1)`.** Using an already-boolean source as the fallback of `valueWhenNoValue(...)` — for example `dynamicBooleanExpressionUsing(table).valueWhenNoValue(table.priority.greaterThan(1))`, or the value reached after `onlyWhen(false)` / `ignoreWhen(true)` — emitted `where (priority > @0 = 1)` (SQL Server) / `where (priority > :0 = 1)` (Oracle) instead of `where priority > @0`. SQL Server rejected it as a syntax error and Oracle with `ORA-03048`. Both now emit the predicate directly, matching the other databases and the direct boolean-value-as-condition path fixed above. Databases with a native boolean type were unaffected.
- **MySQL, Oracle: a `customUuid` typed SQL fragment now reads the uuid back correctly.** `fragmentWithType('customUuid', name, …)` (and the `buildFragmentWithArgs` family over `customUuid` arguments) interpolating a uuid column emitted the column raw instead of wrapping it in the dialect's uuid read conversion (`bin_to_uuid` / `raw_to_uuid`) the way the built-in `uuid` arm and a plain `customUuid` column already do. On the databases that store uuids in binary (MySQL `BINARY(16)`, Oracle `RAW(16)`) the driver then returned raw bytes and the value failed to parse with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. A `customUuid` fragment now carries its underlying uuid type, so it gets the same conversion as a `customUuid` column. Databases that store uuids as text were unaffected.
- **Filtering a `uuid` column with `notEqualsInsensitive` in a dynamic condition no longer produces invalid SQL.** When a `dynamicConditionFor(...)` filter applied `notEqualsInsensitive` to a `uuid` column, the case-insensitive `lower(...)` was applied straight to the uuid (`lower(external_ref)`) instead of to its text form (`lower(external_ref::text)`) the way every other insensitive operation — including the sibling `equalsInsensitive` and `notEqualsInsensitiveIfValue` — already does, so the database rejected the query (e.g. PostgreSQL `function lower(uuid) does not exist`). It now casts the uuid to text first, matching the other insensitive operations. In addition, the `notEqualsInsensitive` rule was missing from the filter type for `customUuid` columns (`DynamicCondition<{ col: ['customUuid', …] }>`), so it couldn't be expressed there even though its `…IfValue` form and the runtime both supported it; the type now accepts it.
- **`between` / `notBetween` and the `substr` / `substring` / `replaceAll` string operations now reflect the optionality of *both* operands.** When the value is built from two value sources — e.g. `col.between(lowerColumn, upperColumn)` or `text.replaceAll(findColumn, replaceColumn)` — the result's optional/required type was computed from only one operand at runtime, while the declared TypeScript type already merged both. If the *other* operand was the sole nullable one, the runtime treated the result as required even though its type was optional, so a projected value could be mishandled when that operand was `NULL`. The runtime now merges both operands, matching the declared type. The generated SQL is unchanged.
- **A `CustomBooleanTypeAdapter` subclass that defines `transformPlaceholder` no longer loses it when the column is re-projected through a `with` view or inline subquery.** When a column carrying a custom-boolean adapter is re-projected — building the columns of a CTE, inline query or one-column subquery — ts-sql-query wraps the adapter in an internal proxy so the outer reference is not re-treated as a custom boolean (the inner select already remapped the stored `'Y'`/`'N'` value to a real boolean). That proxy forwarded the value transforms but not the optional `transformPlaceholder` hook, so a custom placeholder — for example an explicit `::type` cast added by an adapter subclass — was dropped on the outer reference and the default placeholder was emitted instead. The proxy now forwards `transformPlaceholder` as well.
- **MariaDB, MySQL: a shaped `INSERT … ON DUPLICATE KEY UPDATE` no longer drops its update clause.** When the insert was shaped with `shapedAs({ ... })` (mapping object keys to real column names) and an on-conflict update reused one of those renamed keys — for example `.onConflictDoUpdateDynamicSet().set({ projectName: 'Renamed' })` where `projectName` maps to the `name` column — the renamed key failed to resolve to a column, so the entire `ON DUPLICATE KEY UPDATE` clause was omitted. The statement became a plain `INSERT`, which then raised a duplicate-key error at runtime whenever the conflicting row already existed. The shaped key now resolves to its real column and the update clause is emitted as `… on duplicate key update name = ?`. PostgreSQL and SQLite (via `onConflictOn(col).doUpdate*`) already handled the shape correctly.
- **MySQL: an `INSERT … SELECT … ON DUPLICATE KEY UPDATE` no longer emits an invalid row alias.** On MySQL 8.0.19+, an upsert whose rows come from a `SELECT` source — `insertInto(table).from(select).onConflictDoUpdateSet({ ... })` — wrongly appended the `AS _new_` row alias after the select (`… from … where … as _new_ on duplicate key update …`). That alias is valid only after a `VALUES (…)` tuple, never after a `SELECT`, so MySQL rejected the whole statement at parse time. The from-select form now omits the alias and references the target columns unqualified (`… on duplicate key update name = ?`), matching MariaDB; the `VALUES`-based upsert — where the alias is required to reference the would-be-inserted row in the update clause — is unchanged.
- **PostgreSQL, SQL Server: `.modulo(...)` involving a `double` / `customDouble` value source now emits valid SQL.** Applying `modulo` where either operand is a floating-point value source — a `double` / `customDouble` receiver such as `worklog.billedAmount.modulo(3)` or `table.intColumn.asDouble().modulo(3)`, **or** an `int` receiver modulo'd by a `double` operand such as `table.intColumn.modulo(table.doubleColumn)` (where the overloaded-number dispatcher promotes the result to `double`) — emitted a bare `%` over a floating-point operand, which PostgreSQL (`operator does not exist: double precision %`, or `integer % double precision` when only the right operand is double) and SQL Server (`The data types float and int are incompatible in the modulo operator`) both reject at runtime. PostgreSQL now emits `mod((…)::numeric, (…)::numeric)` and SQL Server casts both operands to `numeric`, so the operator resolves regardless of which side is the double. Pure `int` / `bigint` / `customInt` modulo (plain `%`), MySQL / MariaDB (which accept floating-point `%`) and Oracle (which already used `MOD(…)`) are unchanged. SQLite is also unchanged, but note its `%` operator converts both operands to integers first, so fractional modulo truncates there rather than producing a fractional remainder.
- **A table/view customization (`createTableOrViewCustomization`) is no longer dropped when the customized wrapper is re-aliased or made left-joinable.** Applying `.as(...)`, `.forUseInLeftJoin()` or `.forUseInLeftJoinAs(...)` to a customized table/view — for example a SQL-hint wrapper `connection.withSqlHint(t).as('o')` or `connection.withSqlHint(t).forUseInLeftJoin()` — returned a clone that silently lost the customization template, so the customization (e.g. the `/*+ hint */` comment) disappeared from the emitted SQL even though the call type-checked and produced otherwise-valid SQL. The customization now follows the clone and re-binds to the clone's alias, so `selectFrom(withSqlHint(t).as('o'))` emits `from /*+ hint */ organization as "o"` and `leftJoin(withSqlHint(t).forUseInLeftJoin())` keeps the hint on the joined side. The same fix applies to customized views and `values(...)` tables. Customizations applied to an already-aliased table (`withSqlHint(t.as('o'))`) were already correct and are unchanged.
- **`projectingOptionalValuesAsNullable()` can now be applied to a compound query (`UNION` / `UNION ALL` / `INTERSECT` / `EXCEPT` / `MINUS`).** After combining selects — for example `a.select({ … }).union(b).projectingOptionalValuesAsNullable()` — the modifier is now part of the compound's type surface, so optional leaves of the merged result surface as `T | null` / `{ … } | null` (present-null) instead of being dropped, matching the documented projecting-optionals-as-nullable behavior and the already-correct runtime. Previously the method was missing from `CompoundedExecutableSelectExpression`, so the call did not type-check on a compound, and applying it on the arms *before* the compound operator type-checked but was silently ignored at runtime — leaving no type-safe way to request nullable projection on a compound. Both are now addressed: the method is part of the compound's type surface, and a call on the arms before the operator is honored at runtime too (the compound inherits the arms' nullable-projection flag), so the before- and after-operator forms behave identically — including when the compound is then inlined with `forUseAsInlineAggregatedArrayValue()`.
- **`projectingOptionalValuesAsNullable()` now retypes the elements of an inline aggregated array (`forUseAsInlineAggregatedArrayValue()`).** Calling `subSelectUsing(...).from(t).select({ … }).projectingOptionalValuesAsNullable().forUseAsInlineAggregatedArrayValue()` — inlining a correlated subquery as a JSON-array column — kept declaring each optional leaf of the array element as an absent optional property (e.g. `body?: string`) even though the runtime honours the flag and produces it present-as-null (`body: string | null`). Reading such a leaf was unsound: the type said the key might be absent while the runtime always emitted it present as `null`. Under the flag the element type now surfaces optional leaves as present-null (`body: string | null`, and `{ … } | null` for nested optional objects), matching the runtime and the documented behavior ("treat optional values as required properties that allow `null`, calling `projectingOptionalValuesAsNullable()` immediately after `select(...)`"). This includes a `requiredInOptionalObject` gate or a left-join leaf at the element top: the inline array is *non-dropping* — it keeps the element and writes that leaf as `null` (`ref: string | null`, `name: string | null`), whereas `connection.aggregateAsArray(...)` would drop the whole element on the same miss, so the two are typed differently there. The generated SQL is unchanged, and the default no-flag projection — optional leaves dropped, `body?: string` — is unaffected.
- **A `Values` view self-joined to its own `.as(alias)` / `forUseInLeftJoinAs(alias)` clone now hoists its `WITH` clause once instead of twice.** Using the same `connection.Values`-based constant-values view as both the `FROM` source and a joined side through a clone — for example `selectFrom(v).innerJoin(v.as('anc')).on(anc.id.equals(v.parentId))` — emitted the view's `with name(cols) as (values …)` CTE **twice** under the same name (with its parameters duplicated), which every engine rejects (PostgreSQL `WITH query name specified more than once`, SQLite `duplicate WITH table name`). The clone now reuses the single hoisted CTE and contributes only its aliased *reference* in the `FROM` / `JOIN`, so the `WITH` clause is emitted once — matching how a regular `with(...)` view already deduplicates its hoist across multiple references. A `Values` view referenced a single time was unaffected.
- **`connection.aggregateAsArray(...).projectingOptionalValuesAsNullable()` now keeps its element's null leaves present through a compound query (`UNION` / `UNION ALL` / `INTERSECT` / `EXCEPT` / `MINUS`).** When an arm of a compound query projected such an aggregate column — a JSON-array column whose element carries an optional leaf, e.g. `select({ orgId, projects: connection.aggregateAsArray({ id, name, archivedAt }).projectingOptionalValuesAsNullable() })` — the merged result silently *dropped* each null leaf of the array element (the key absent) instead of keeping it present as `null`, even though the type declares it present (`archivedAt: Date | null`) and a standalone such aggregate keeps it present-null. Reading the leaf was therefore unsound: the type promised a present `Date | null` while the runtime omitted the key. This is a distinct path from the compound-level `projectingOptionalValuesAsNullable()` fix above — the flag here lives on the aggregate *column* itself and was lost when the compound rebuilt its merged columns (the same column-rebuild also backs a `with` view / inline subquery). The compound now carries the aggregate column's own nullable-projection flag onto the merged columns, so the element's optional leaves stay present-null through the compound, matching the type, the documented behavior, and the standalone aggregate. The generated SQL is unchanged, and the default no-flag projection — null leaves dropped — is unaffected.
- **`projectingOptionalValuesAsNullable()` now keeps its element's null leaves present when an array-shape modifier or an `allowWhen` / `disallowWhen` gate is chained after it.** Chaining `useEmptyArrayForNoValue()`, `asOptionalNonEmptyArray()`, `asRequiredInOptionalObject()`, or `allowWhen(...)` / `disallowWhen(...)` *after* `projectingOptionalValuesAsNullable()` — on both `connection.aggregateAsArray(...)` and an inline aggregated array (`select(...).forUseAsInlineAggregatedArrayValue()`) — silently *dropped* each null leaf of the array element (the key absent) instead of keeping it present as `null`, even though the type declares it present (e.g. `body: string | null`). Reading the leaf was therefore unsound: the type promised a present `T | null` while the runtime omitted the key. Because `projectingOptionalValuesAsNullable()` returns a value source that no longer exposes the projection but still offers these modifiers, projecting-then-modifier was the *only* reachable order — so there was no type-safe way to combine the two. The modifier (and the `allowWhen` / `disallowWhen` gate) now carries the aggregate's nullable-projection flag onto the rebuilt value source, so the element's optional leaves stay present-null, matching the type, the documented behavior, and the un-modified aggregate. The same flag is also preserved when an aggregated-array column re-projected through a `with` view is re-modified. The generated SQL is unchanged, and the default no-flag projection — null leaves dropped — is unaffected.
- **`projectingOptionalValuesAsNullable()` now keeps its element's null leaves present when a one-column aggregate is inlined with `forUseAsInlineQueryValue()`.** Building a correlated one-column subquery whose single column is a projecting aggregate and inlining it as a scalar column — `subSelectUsing(t).from(u).selectOneColumn(connection.aggregateAsArray({ … }).projectingOptionalValuesAsNullable()).forUseAsInlineQueryValue()` — silently *dropped* each null leaf of the array element (the key absent) instead of keeping it present as `null`, even though the type declares it present (e.g. `body: string | null`). Reading the leaf was therefore unsound: the type promised a present `T | null` while the runtime omitted the key. `forUseAsInlineQueryValue()` now carries the aggregate column's nullable-projection flag onto the inline value, so the element's optional leaves stay present-null, matching the type, the documented behavior, and the aggregated-array sibling `forUseAsInlineAggregatedArrayValue()`. The same is true when an `allowWhen(...)` / `disallowWhen(...)` gate is chained after `forUseAsInlineQueryValue()`: the gate previously also lost the aggregated-array handling of the inline value entirely (the query then threw `INVALID_VALUE_RECEIVED_FROM_DATABASE` on read), and now preserves it. The generated SQL is unchanged, and the default no-flag projection — null leaves dropped — is unaffected.
- **Ordering a compound query (`UNION` / `INTERSECT` / `EXCEPT`) by a value-source expression now emits valid SQL.** `compound.orderBy(valueSource)` — the no-table value-source overload, e.g. a constant secondary sort key after `orderBy('label')` — emitted the expression as a bare term inside the compound's `ORDER BY`, which the strict engines reject because a compound `ORDER BY` may reference only result columns / ordinal positions (PostgreSQL `invalid UNION/INTERSECT/EXCEPT ORDER BY clause`; SQLite `ORDER BY term does not match any column in the result set`). PostgreSQL, SQLite and Oracle now wrap the compound in `select * from (<compound>) …` and apply the ordering on the wrapper — the same wrapping already used for case-insensitive ordering — so the expression is legal; MySQL / MariaDB, which accept expressions in a compound `ORDER BY`, keep emitting it inline. (SQL Server reads a bare bind parameter in any `ORDER BY` as an ordinal column position and rejects it, so ordering by a constant value source is not supported there — wrap the value in an expression if you need it.)
- **SQL Server: ordering a compound query (`UNION` / `INTERSECT` / `EXCEPT`) with `nulls last` / `nulls first` now emits valid SQL.** `compound.orderBy('col', 'asc nulls last')` / `'desc nulls first'` (and their `insensitive` variants) rely on SQL Server's `iif(col is null, …)` NULLS-ordering emulation. That `iif(...)` is an expression, illegal inside a compound `ORDER BY` — SQL Server rejected the statement with `Msg 104 … ORDER BY items must appear in the select list if the statement contains a UNION, INTERSECT or EXCEPT operator` — and the null-checked column also rendered malformed (`.[col]`, a leading dot with an empty table qualifier). The compound is now wrapped in `select * from (<compound>) …` — the same wrapping already used for case-insensitive and value-source ordering — and the emulation is applied on the plain wrapper referencing the output column, so it emits `select * from (…) as o order by iif([col] is null, 1, 0), [col] asc`. Non-compound selects were already correct, and every other database (native NULLS ordering on PostgreSQL / Oracle / SQLite, expression-based emulation on MySQL / MariaDB, which accept it inline) was unaffected.
- **A shaped UPDATE's conditional `*When` set methods now accept the renamed shape keys.** When an update was shaped with `shapedAs({ ... })` (mapping object keys to real column names), the conditional set family — `setWhen`, `setIfValueWhen`, `setIfSetWhen`, `setIfNotSetWhen`, `setIfHasValueWhen` / `setIfHasNoValueWhen` and their `…IfValue` variants, plus `keepOnlyWhen` / `ignoreIfSetWhen` / `ignoreIfHasValueWhen` / `ignoreIfHasNoValueWhen` — was typed against the *real* column names instead of the renamed shape keys, the opposite of its non-`When` siblings (`set`, `setIfValue`, `keepOnly`, …). So it rejected the renamed key it actually maps at runtime (`setWhen(true, { projectName })` did not compile) and accepted the real key the runtime then silently drops (`setWhen(true, { name })` compiled but applied nothing), making the shaped `*When` family unusable. The `*When` arms now take the renamed shape keys, matching the non-`When` shaped set. Shaped updates that don't use the `*When` arms, and all unshaped updates, were unaffected. Same shaped-key-remap class as the MariaDB/MySQL `ON DUPLICATE KEY UPDATE` fix above.
- **A shaped `INSERT … ON CONFLICT DO UPDATE`'s one-shot set now keeps the shape on the calls chained after it.** The static one-shot — `onConflictDoUpdateSet({ ... })` / `onConflictDoUpdateSetIfValue({ ... })` and the `onConflictOn(col).doUpdateSet({ ... })` / `doUpdateSetIfValue({ ... })` targeted forms — accepted the renamed shape keys in its own call but returned an *unshaped* node, so a `.set({ renamedKey })` chained after it (which the runtime remaps correctly) was type-rejected, and the conditional `*When` methods were absent from the shaped node entirely. The one-shot now returns the shaped node — matching the already-correct dynamic-set form (`onConflictDoUpdateDynamicSet()`) — so chained `set` / `setIfValue` / `*When` calls keep accepting the renamed shape keys.
- **A shaped UPDATE's `disallow*` guards now take the renamed shape keys.** When an update was shaped with `shapedAs({ ... })` (mapping object keys to real column names), the guard family — `disallowIfSet`, `disallowIfNotSet`, `disallowIfValue`, `disallowIfNoValue`, `disallowAnyOtherSet` and their `*When` variants — was typed against the *real* column names instead of the renamed shape keys, the opposite of the shaped set / `ignoreIfSet` / `keepOnly` family it guards. Because the runtime keys the staged sets by the renamed shape key, passing the type-required real column never matched a staged column: the positive-match guards (`disallowIfSet` / `disallowIfValue` / …) were silently bypassed and never threw, while `disallowAnyOtherSet` compared its real-column allow-list against the renamed staged keys and threw on a perfectly valid update. The guards now take the renamed shape keys, matching the rest of the shaped set surface and the already-correct shaped `INSERT` guards. Unshaped updates were unaffected. Same shaped-key-remap class as the conditional `*When` fix above.
- **A single-row INSERT's `keepOnlyWhen(true, …)` no longer wrongly types a still-incomplete insert as executable.** On an insert opened with `dynamicSet()` (every required column still missing), the conditional `keepOnlyWhen(when, …)` — which dispatches to `keepOnly(…)` at runtime when `when` is `true` — declared a different result type than `keepOnly`: it removed the named columns from the still-missing-required-keys set, so naming a required column that had not yet been given a value cleared its missing-key obligation and let `executeInsert()` compile even though the column was never set. Its result type now matches `keepOnly`'s, where naming a column never clears an outstanding missing-key obligation, so the insert stays non-executable until every required column is actually set. The shaped single-row twin (`shapedAs({ ... }).dynamicSet().keepOnlyWhen(…)`) had the same divergence and is fixed too; the multi-row and already-executable insert forms were correct. The generated SQL and runtime behavior are unchanged.
- **A shaped INSERT's `setIfValue` now accepts `null` / `undefined` for a defaulted, non-nullable column, skipping it like the unshaped form.** When an insert was shaped with `shapedAs({ ... })` (mapping object keys to real column names), `setIfValue({ ... })` typed its values against the same non-nullable type as `set(...)`, so passing `null` (or `undefined`) for a renamed key that maps to an insert-optional column — one that is optional only because it has a database `DEFAULT` and is **non-nullable** — was a compile error, defeating `setIfValue`'s null-skip purpose for exactly the column it should apply to. (A renamed key mapping to a *nullable* column was unaffected: its value type already carries `undefined`, which masked the gap.) The shaped `setIfValue` now takes the same optional value type its unshaped sibling (`insertInto(t).setIfValue({ ... })`) already uses, so a `null` / `undefined` value skips the column and lets it take its database default. This is sound — a skipped column stays unset (its missing-key obligation is unchanged), so no incomplete insert becomes executable. The generated SQL is unchanged; a skipped column is simply omitted from the column list. Same shaped-INSERT surface class as the `ON CONFLICT` one-shot and `keepOnlyWhen` fixes above.
- **`customizeQuery(...)` on a recursive `SELECT` now applies its hooks to the whole recursive query instead of dropping or mislanding them.** When `customizeQuery({ ... })` was combined with `recursiveUnion` / `recursiveUnionAll` / `recursiveUnionOn` / `recursiveUnionAllOn` — in either order — its fragments landed on the anchor member of the generated CTE rather than on the overall `with recursive … select …` statement: `beforeQuery` / `afterQuery` wrapped only the anchor select inside the CTE body (so `beforeQuery` was no longer "before any other SQL"), and `beforeWithQuery` / `afterWithQuery` were silently dropped. They now apply to the whole recursive query — `beforeQuery` / `afterQuery` bracket the entire statement and `beforeWithQuery` / `afterWithQuery` wrap the recursive CTE body — matching how a plain `.customizeQuery({ beforeWithQuery, afterWithQuery }).forUseInQueryAs(...)` CTE already renders. `queryExecutionName` / `queryExecutionMetadata` continue to apply to the executed query.
- **A recursive `SELECT` consumed as a CTE via `forUseInQueryAs(...)` no longer drops its `customizeQuery` `beforeQuery` / `afterQuery` hooks.** When a recursive query (`recursiveUnion` / `recursiveUnionAll` / `recursiveUnionOn` / `recursiveUnionAllOn`) carrying `customizeQuery({ beforeQuery, afterQuery, … })` was materialised as a common table expression with `.forUseInQueryAs(...)` and referenced from an outer query, the `beforeQuery` / `afterQuery` fragments were silently discarded — only `beforeWithQuery` / `afterWithQuery` (which wrap the CTE parentheses) survived. They now render inside the recursive CTE body, around the `anchor UNION recursive` union, matching how a non-recursive `.customizeQuery({ ... }).forUseInQueryAs(...)` CTE already renders. Executing the recursive query directly (`executeSelectMany()` / …), where `beforeQuery` / `afterQuery` bracket the whole statement, was already correct and is unchanged.
- **A one-column recursive `SELECT` used as an inline value no longer throws `INTERNAL`.** `selectFrom(t).selectOneColumn(col).recursiveUnion*(...)` fed to a scalar subquery through `forUseAsInlineQueryValue()` threw `INTERNAL: Unexpected inline select` instead of emitting SQL, because the generated outer select of the recursive query lost the "one column" marker. It now emits a valid scalar subquery over the recursive CTE (`… (select col from recursive_select_1) …`). The aggregated-array sibling `forUseAsInlineAggregatedArrayValue()` on a one-column recursive select is corrected at the same time: it previously aggregated each row as a `{ result: … }` object, and now produces a scalar array (`json_agg(col)` / `json_arrayagg(col)` / `json_group_array(col)`), matching the non-recursive one-column aggregated-array shape. As part of the fix, the recursive member's view now exposes the one-column select's `result` column, so the recursive `…On(child => …)` join condition can reference `child.result` (a one-column recursive view previously had no referenceable column). Multi-column recursive selects were unaffected.
- **`orderBy` / `limit` / `offset` on a recursive `SELECT` result now order and page the final result instead of the CTE anchor member.** Chaining ordering or paging after `recursiveUnion` / `recursiveUnionAll` / `recursiveUnionOn` / `recursiveUnionAllOn` — for example `selectFrom(t).select({ ... }).recursiveUnionAll(fn).orderBy('id').limit(2).offset(1)` — rendered the `order by` / `limit` / `offset` *inside the anchor member* of the generated CTE (`with recursive r as ((select … order by … limit …) union all …) select … from r`), so it ordered and paged the recursion seed rather than the overall result. They now apply to the outer `select … from r`, matching the promised result-level ordering/paging. This also corrects `executeSelectPage()` on a recursive result: its total-count query previously wrapped the already-limited CTE and returned the page size, and now wraps the full recursion and returns the true total. Non-recursive selects and compound (`UNION` / …) queries were unaffected.
- **Ordering a recursive `SELECT` result by a table-bound value-source or raw-fragment expression is now a compile-time error instead of invalid SQL.** After `recursiveUnion` / `recursiveUnionAll` / `recursiveUnionOn` / `recursiveUnionAllOn`, the result is a `select … from <cte>` whose `ORDER BY` runs against the CTE output columns, so the anchor tables are out of scope there — exactly as in a compound (`UNION` / …) query. The `orderBy(valueSource)` / `orderBy(rawFragment)` overloads accept table-bound expressions, so `…recursiveUnionAll(fn).orderBy(tIssue.id, 'desc')` type-checked yet emitted `order by issue.id` against a table absent from the outer `FROM`, which every engine rejects at runtime (PostgreSQL `missing FROM-clause entry for table "issue"`). On a recursive result those two overloads now accept only no-table expressions, matching the restriction a compound query's `ORDER BY` already carries; order the recursive result by the projected column name (`orderBy('id', 'desc')`) or with `orderByFromString` / `orderByFromStringArray` instead — those resolve to the output alias and were always correct. Compile-time-only change; non-recursive selects, which can still order by any table-bound expression, are unaffected.
- **Ordering a compound query (`UNION` / `INTERSECT` / `EXCEPT`) by a table-bound raw-fragment expression is now a compile-time error instead of invalid SQL.** On a compound result the `ORDER BY` runs against the set-operation output, so a branch's base tables are out of scope there. The value-source `orderBy(valueSource)` overload already restricted to no-table expressions, but its raw-fragment sibling `orderBy(rawFragment)` still accepted a table-bound raw fragment — ordering a compound by a raw fragment that interpolated a branch's base-table column type-checked yet emitted an unwrapped `… union … order by project.id desc`, which every engine rejects (a set-operation `ORDER BY` may reference only output columns / ordinals). The raw-fragment overload now accepts only no-table expressions, matching the value-source sibling and the recursive-result restriction above; order a compound by the projected column name (`orderBy('label')`), a no-table raw fragment, or `orderByFromString`. Compile-time-only change; a no-table raw fragment and non-compound selects are unaffected.
- **A recursive `SELECT` result's `orderBy` / `limit` / `offset` and `ORDER BY` customize hooks are no longer lost or mislanded when the result is consumed as a CTE via `forUseInQueryAs(...)`.** When ordering / paging set on a recursive result — `…recursiveUnionAll(fn).orderBy('id').limit(5).offset(1).forUseInQueryAs('tree')` — was materialised as a common table expression and referenced from an outer query, the `order by` / `limit` / `offset` were silently dropped from the emitted SQL; and `customizeQuery`'s `beforeOrderByItems` / `afterOrderByItems` hooks were folded *into* the recursive CTE term (`… union all … order by …`), which every engine rejects (PostgreSQL `ORDER BY in a recursive query is not implemented`). The recursive result's ordering / paging is now preserved on a wrapping CTE — `with recursive <member> as (…), tree as (select … from <member> order by … limit … offset …) select … from tree` — engine-valid on every database. Executing the recursive result directly (`executeSelectMany()` / …), where the ordering already applied to the outer select, and a recursive result consumed as a CTE *without* ordering / paging, were correct and are unchanged.
- **A shaped UPDATE's `extendShape(...)` no longer drops the set openers on the where-required path.** On an update opened with `.shapedAs({ ... })` and then widened with `.extendShape({ ... })`, the result type transitioned to the post-set node — which exposes no `dynamicSet` / `set` / `setIfValue` — so `update(t).shapedAs({ ... }).extendShape({ ... }).dynamicSet({ ... })` failed to compile even though `extendShape` is a shape *widener* (it returns `this` at runtime, keeping every opener callable). The where-required `extendShape` now stays in the shaped-set opener family, matching its `updateAllowingNoWhere` twin and the INSERT `extendShape`, so `dynamicSet` / `set` / `setIfValue` (and a further `extendShape`) remain available after widening the shape. Only the type surface changed; the emitted SQL is unchanged.
- **PostgreSQL (compatibility version below 18): an `UPDATE … FROM` / `… JOIN` that reads pre-update values via `oldValues()` and projects a joined-in column through a *nested* object in `RETURNING` now emits valid SQL.** Before PostgreSQL 18 — which added the native `OLD` / `NEW` qualifiers — ts-sql-query captures pre-update values by wrapping the target in a synthetic `from (select _old_.* … ) as _old_` subquery, pre-projecting each joined-table column the `RETURNING` clause needs into that subquery as `<table>__<column>`. When such a column was folded into a *nested* projection object — for example `.returning({ id: t.id, audit: { old: t.oldValues().name, org: organization.name } })` — it was not pre-projected, so `RETURNING` referenced `organization.name` directly even though `organization` exists only inside the subquery, and PostgreSQL rejected the statement with `missing FROM-clause entry for table "organization"` (`42P01`). The nested column is now pre-projected into the `_old_` subquery and referenced as `_old_.organization__name`, matching the already-correct behavior for a top-level (non-nested) projection of the same column. PostgreSQL 18+ (native `OLD`), and every other database — which keep the joined table in the outer `FROM`, where the bare reference is already valid — were unaffected.
- **`executeSelectPage()` now keeps the `customizeQuery(...)` hooks on the auto-generated count query of a plain `SELECT`.** A statement-level hook — e.g. a connection-pooler routing comment `customizeQuery({ beforeQuery: connection.rawFragment\`/* route=analytics-replica */ \` })` — rode on the page's data query but was silently dropped from the count query on a plain (non-`distinct`, non-grouped) select, so a statement the library sends to the database went out undecorated. The plain count query now wraps the customized query in a `result_for_count` CTE (`with result_for_count as (/* … */ select … /* … */) select count(*) from result_for_count`), so the `beforeQuery` / `afterQuery` hook rides on the count query too — matching how the `distinct` / grouped / compound page paths already behaved. Every hook rides along except `beforeOrderByItems` / `afterOrderByItems`, which are content for an `ORDER BY` the count doesn't carry (see the count-ordering entry below). The count value and every count query without a `customizeQuery` are unchanged.
- **`subSelectUsing(...)` / `subSelectDistinctUsing(...)` now accept five genuinely-distinct correlated tables.** The five-table overload mistyped its fifth parameter as the fourth table's type, so a correlated subquery over five different outer tables — `connection.subSelectUsing(tOrganization, tProject, tIssue, tAppUser, tIssueWorklog)` — failed to compile with `TS2345` even though the runtime handled it correctly; the fifth argument had to coincidentally match the fourth's type to be accepted. Both methods now infer each table position independently, so five distinct correlated tables type-check (and the correlated-source scope in the return type is exactly those five tables). Arities 1–4 were already correct and are unchanged.
- **A `buildFragmentWithMaybeOptionalArgs` fragment now reports an optional result when an *optional value-source* argument sits immediately after a plain-value argument.** For a maybe-optional fragment of arity 3–5, an argument arrangement where a value source follows a plain value — for example `coalesce(requiredSource, 'literal', optionalSource)` (the `[…, plainValue, valueSource, …]` positions) — dropped that value source's optionality from the merged result, so the projected column was typed as required (`r: string`) even though the fragment could return `null` when the optional argument was `null`. Reading the column was therefore unsound (a possible runtime `null`/`undefined` through a non-null type). The result now becomes optional (`r?: string | undefined`) whenever any argument — plain value *or* value source, in any position — is optional, matching the `MaybeOptional` contract. Fragments whose optional argument was a plain value, or was a value source not preceded by a plain value, were already correct. Compile-time-only change; the generated SQL is unchanged.
- **An empty-batch `INSERT` (`values([])`) with a `RETURNING` clause no longer sends an empty query to the database.** `insertInto(table).values([]).returning({ ... }).executeInsertMany()` — and the `executeInsertOne()` / `executeInsertNoneOrOne()` shapes — dispatched an empty SQL string to the driver (every driver rejects it) instead of short-circuiting, because only the non-`RETURNING` `executeInsert()` guarded the empty batch. The `RETURNING` execute-shapes now short-circuit the same way: `executeInsertMany()` resolves `[]` (still honoring the `min` / `max` bounds against the count of 0), `executeInsertNoneOrOne()` resolves `null`, and `executeInsertOne()` rejects with a `NO_RESULT` error (it requires exactly one row, and an empty batch has none) — all without touching the database. The non-`RETURNING` `executeInsert()` and every non-empty batch were already correct and are unchanged.
- **`UpdatableOnInsertConflictRowShapedAs` now accepts value sources, matching the non-shaped `UpdatableOnInsertConflictRow` and its documented purpose.** The shaped on-conflict *Row* utility type (`ts-sql-query/extras/types`) was defined as the literal-only *Values* form — identical to `UpdatableOnInsertConflictValuesShapedAs` — so, under a rename shape, it rejected a value source assigned to a shaped key: `const x: UpdatableOnInsertConflictRowShapedAs<typeof t, typeof shape> = { renamedKey: t.column }` was a compile error. A copy/paste slip from the *Values* sibling: every other `*RowShapedAs` type and the non-shaped `UpdatableOnInsertConflictRow` already accept value sources — the whole point of the *Row* variant, which the docs describe as admitting "valid SQL objects that you can use in the `onConflictDoUpdateSet` sentence, where `UpdatableOnInsertConflictValues` does not". The shaped *Row* type now delegates to the value-source-accepting sets-content form, so a value source under a renamed shape key type-checks. The literal-only `UpdatableOnInsertConflictValuesShapedAs` was correct and is unchanged.
- **A nested projection object kept present by a no-table `const` is no longer dropped at runtime when its only table-bound member combines two different left joins.** When a nested object mixed an always-present `connection.const(...)` leaf with a single value that merges columns of two different left-joined tables through an operator — e.g. `select({ id, obj: { combined: leftA.id.add(leftB.id), tag: connection.const('rel', 'string') } })` — the const anchors the object's presence at the type level (`obj: { combined?: number; tag: string }`, a required key), but at runtime the object was wrongly dropped whenever either join missed, so `row.obj` — typed always-present — was `undefined` (or `null` under `projectingOptionalValuesAsNullable()`). The runtime treated the two-table merged value as if all the object's members came from a single left join (rule 2) and dropped the object on a join miss even though the const should keep it. It now recognizes that a value spanning two joins does not come from one single left join, so the object survives carrying the const — the merged value absent, or `null` under `projectingOptionalValuesAsNullable()` — matching the type and the already-correct behavior when the two joins are projected as separate leaves. Objects whose members all come from the same single left join (genuine rule 2) are unchanged.
- **The `min` / `max` bounds of `executeInsert` / `executeUpdate` / `executeUpdateMany` are now enforced consistently on an empty operation.** An empty mutation — an `INSERT` of `values([])`, or an `UPDATE` whose `dynamicSet(...)` leaves no column set — short-circuits without touching the database, but only `executeInsertMany()` ran its `min` / `max` guard against the resulting count of 0; `executeInsert()`, `executeUpdate()` and `executeUpdateMany()` returned early and skipped it. So `insertInto(t).values([]).executeInsert(1)` (and the `update(t).dynamicSet()…executeUpdate(1)` / `executeUpdateMany(1)` shapes) silently resolved `0` / `[]` even though at least one row was required, while the equivalent `executeInsertMany(1)` threw. All four shapes now run the guard the same way, so an empty operation with `min > 0` rejects with `MINIMUM_ROWS_NOT_REACHED` everywhere (and `max` is likewise enforced). Empty operations called without `min` / `max` still resolve `0` / `[]` as before, and `DELETE` (which has no empty short-circuit) was already correct.
- **A single-row `returningLastInsertedId().executeInsert()` now throws instead of resolving `null` when the database returns no id.** A plain insert with `returningLastInsertedId()` (no `onConflictDoNothing()`) is typed to return the non-nullable autogenerated id, so a driver that reports no id must reject with `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`. A dead guard — it tested the always-truthy method reference `this.onConflictDoNothing` instead of the `this.__onConflictDoNothing` flag — was never entered, so the single-row path resolved `null` where the type promised a value, handing the consumer an unsound `null`. It now throws as the type contract requires. The `onConflictDoNothing().returningLastInsertedId()` form — whose result type is `number | null` because a suppressed insert legitimately returns no id — still resolves `null` and is unchanged; the multi-row and `INSERT … SELECT` returning paths already threw (per row) and are unaffected.
- **`Values.create(...)` now type-checks each row against the view's columns again.** The row objects passed to a `Values` view — `Values.create(VProjectPatch, 'projectPatch', [{ id: 1, name: 'one' }])` — were not validated at all: the row parameter resolved to `{}`, so a row missing a required column, giving a value of the wrong type, or carrying an undeclared key all compiled (even a non-object like `'x'` was accepted). Only the view-name argument was enforced. This was a regression introduced during the v2 cycle: the refactor that consolidated the internal column markers to make the types TypeScript displays simpler re-applied the marker to table columns but dropped it from `Values` columns, so a `Values` view exposed its columns as plain value sources rather than writable columns and the same row-shape enforcement that already covered `insertInto(table).values({ ... })` collapsed to nothing for it. Real `Values` columns now carry the column marker again (like a table column does), so `Values.create` requires every required column, matches each value against its column's declared scalar type, and rejects undeclared keys — while columns declared with `virtualColumnFromFragment(...)` / `optionalVirtualColumnFromFragment(...)`, which are computed and never part of the `VALUES` tuple, are correctly excluded from the row shape. A `Values` view is now consistently modelled as writable (it *is* — you supply its columns' values in the rows passed to `Values.create`; only the mechanism, constant rows, differs from a table INSERT), so the `extras/utils` writable-column extractors — `extractWritableColumnsFrom` / `extractWritableColumnNamesFrom` / `extractWritableShapeFrom` — now return a `Values` view's real columns instead of the empty result they previously yielded (a View's read-only columns are still excluded, as are computed/virtual columns of any source). The generated query SQL is unchanged.
- **Oracle: reading a `boolean` value the driver hands back as a numeric string no longer throws `INVALID_VALUE_RECEIVED_FROM_DATABASE`.** Engines without a native boolean type store it as `0` / `1`, and some drivers (notably oracledb) can return that value as a string rather than a number — for example a `const(true, 'boolean')` echoed through a `select … from dual`, or a boolean read where the driver widens `NUMBER` to a string to preserve precision. The value-read marshaller accepted a `boolean`, `number` or `bigint` for a `boolean` type but not a string, so it rejected the string `'1'` / `'0'` at runtime even though the sibling `int` / `bigint` read path already accepted a numeric string for exactly this driver behavior. A numeric string is now coerced to a boolean the same way a number is (`!!value`), matching the `int` read path; a value that is none of boolean / number / bigint / numeric string still throws. Databases whose drivers already return a boolean or a number were unaffected.
- **A dynamic condition error raised inside a nested projection now reports a correctly dot-separated `errorReason.path`.** When `dynamicConditionFor(...)` filtered a projection with nested (non-value-source) objects — e.g. `{ project: { assignee: { … } } }` — and the filter was malformed (an unknown column / operation, an invalid filter value, or an extension callback returning the wrong type), the `path` on the thrown `TsSqlError` ran the nested keys together and, at nesting depth ≥2, inserted a stray space: a filter on `project.assignee.name` reported `"project .assigneename"` instead of `"project.assignee.name"`. Each level is now joined by a single dot down to the offending column, matching the separator already used for column-level extension rules. Top-level (unnested) filters, which were always correct, and the emitted SQL are unchanged.
- **A `DYNAMIC_CONDITION_INVALID_FILTER` raised because a column's filter value is not an object now reports the offending column and value in its `errorReason`, matching its message.** When a `dynamicConditionFor(...)` filter gave a column a non-object, non-`Date` value — e.g. `{ id: 5 }` (the column expects a filter object like `{ equals: 5 }`) — the thrown `TsSqlError` carried `errorReason.path` pointing at the *enclosing scope* (`''` at the top level, `'project'` for `{ project: { id: 5 } }`) and `errorReason.value` carrying the *enclosing filter object* rather than the offending value, even though the error's message already named the full column (`"id"` / `"project.id"`) and reported the received value. The `path` now runs down to the offending column and `value` now holds the specific non-object value received, consistent with the message, with the sibling `DYNAMIC_CONDITION_UNKNOWN_COLUMN` reason, and with the column-value + path already reported for the extension-return-type errors. This completes the dot-separated-path fix above (its message was corrected but the `path` / `value` fields were not). Error-metadata only; the reason code, which filters are rejected, and the generated SQL are all unchanged.
- **SQL Server, Oracle: `startsWith` / `endsWith` / `contains` whose search text contains a literal `_` (or, on Oracle, `%`) now match.** These affix predicates (and their `not` / `Insensitive` / `IfValue` variants) escape the LIKE wildcards in the search text so they match literally. On SQL Server an underscore was escaped to the empty character class `[]` — which matches no character — instead of `[_]`, so a needle containing a literal `_`, e.g. `tUser.email.startsWith('a_b')`, matched no rows. On Oracle the escaping emitted SQL Server-style bracket text (`[_]` / `[%]`) even though Oracle `LIKE` has no `[...]` character classes and the predicate already declares an `escape '\'` clause, so a literal `_` or `%` was mismatched there too; Oracle now escapes those wildcards with the backslash its `escape` clause declares. Because a mock query runner never executes the `LIKE`, this only affected real databases. The other databases were unaffected.
- **MySQL, MariaDB: `startsWith` / `endsWith` / `contains` whose search text contains a literal backslash (`\`) now match.** These affix predicates (and their `not` / `Insensitive` / `IfValue` variants) escape the LIKE wildcards in the search text so it matches literally. MySQL and MariaDB over-escaped a literal backslash — doubling the base `\` → `\\` a second time to four backslashes on the bound-parameter path (a string needle), and to four runtime backslashes in the `replace(...)` escape chain on the column-operand path. Under the default `\` LIKE escape character the engine then read those four backslashes as *two* escaped backslashes, so a needle with a single literal backslash — e.g. `tUser.email.contains('\\')` — matched rows containing two backslashes and missed a single-backslash row. The backslash is now doubled just once (`\` → `\\`), matching exactly one literal backslash. Because a mock query runner never executes the `LIKE`, this only affected real databases; the other databases, and the `%` / `_` wildcard escaping on MySQL / MariaDB, were unaffected.
- **A projected optional object combining a left-join leaf with an always-present `const` leaf is now dropped on a join miss, matching its type.** When a nested projection object drew all its table leaves from the same left join plus a `connection.const(...)` (no-table) leaf — e.g. `select({ proj: { name: leftJoined.name, tag: connection.const('rel', 'string') } })` — it was typed optional with the left-join leaf required-when-present (`proj?: { name: string; tag: string }`), but at runtime the always-present const kept the object alive when the join missed, surfacing `proj: { tag: 'rel' }` with the required `name` absent (or `null` under `projectingOptionalValuesAsNullable()`) — a value that violated the declared type. The no-table const leaf is now ignored when deciding whether to drop the object, matching the type: the whole object is omitted on a miss (or surfaces as `null` under `projectingOptionalValuesAsNullable()`), the same as the equivalent object with no const leaf. The generated SQL is unchanged; the join-hit case, and objects that also carry a non-left-join required leaf (which keeps them present), are unaffected.
- **An `INSERT … ON CONFLICT DO UPDATE` whose update set resolves to no columns no longer drops the whole conflict clause.** When every staged assignment of an on-conflict update was pruned before emission — `ignoreAnySetWithNoValue()` sweeping the only set column, or `doUpdateSetIfValue({ ... })` / `doUpdateDynamicSet({ ... })` whose values all failed the value gate (`undefined`, `null`, …) — ts-sql-query emitted a bare `insert … values …` with **no `ON CONFLICT` clause at all**. The upsert silently became a plain insert, so a conflicting row raised a unique-violation at runtime (PostgreSQL `23505`) instead of the never-throw-on-conflict behavior the composition asked for. An empty update set now degrades to the conflict-ignoring no-op that preserves the requested conflict target: PostgreSQL and SQLite emit `on conflict (…) do nothing`, and MariaDB / MySQL — which have no empty `on duplicate key update` — emit `insert ignore …` (the same no-op reached by `onConflictDoNothing()`). An on-conflict update that keeps at least one column is unchanged.
- **Ordering a compound query (`UNION` / `INTERSECT` / `EXCEPT`) by a raw fragment that embeds a no-table value source now emits valid SQL.** `compound.orderBy(connection.rawFragment\`${connection.const(1, 'int')}\`)` — a raw fragment interpolating a no-table value source, which renders as a bound parameter — was emitted as a bare term inside the compound's `ORDER BY` (`… union … order by $1`), which the strict engines reject because a compound `ORDER BY` may reference only result columns / ordinal positions (PostgreSQL `0A000`, `ORDER BY on a UNION/INTERSECT/EXCEPT result must be on one of the result columns`). The `isValueSource` check that already wrapped a bare `orderBy(valueSource)` didn't see the value source hidden inside the fragment, so the fragment slipped through un-wrapped. PostgreSQL, SQLite and Oracle now wrap the compound in `select * from (<compound>) …` and apply the ordering on the plain wrapper — the same wrapping already used for a bare value-source ordering — whenever a raw-fragment ordering term embeds a value source; MySQL / MariaDB, which accept expressions in a compound `ORDER BY`, keep emitting it inline. A raw fragment with no interpolated value source (a bare ordinal `rawFragment\`1\``, an output-column name) stays inline untouched. As with the value-source overload, SQL Server reads a bare bind parameter in any `ORDER BY` as an ordinal column position and rejects it, so ordering a compound by such a fragment is not supported there.
- **A recursive select consumed as a CTE via `forUseInQueryAs(...)` with `orderBy` / paging no longer drops its `afterSelectKeyword` / `beforeColumns` / `customWindow` customize hooks.** When a recursive query carried both ordering/paging *and* `customizeQuery({ afterSelectKeyword, beforeColumns, customWindow, … })` and was materialised as a CTE with `.forUseInQueryAs('tree')`, the ordering can't fold into the recursive term, so the result is exposed through a wrapping `tree as (select … from <recursive-member> order by …)`. That wrapping select is a plain SELECT that keeps the projection, but the three projection-only hooks were dropped from it (no `/* hint */`, no `window …`) — even though the same hooks render when the recursive select is executed directly, and the non-recursive CTE form already rendered all of them. They now render on the wrapping select, each at its own site. The no-ordering form — where the recursive union *is* the CTE and there is no separate SELECT clause to carry them — correctly still drops them (they apply only when the query is executed directly). `beforeQuery` / `afterQuery` continue to bracket the recursive union inside the CTE body.
- **A multi-row `INSERT` with a bare `onConflictDoNothing()` no longer exposes `executeInsertOne()` on its `RETURNING` path.** An `ON CONFLICT DO NOTHING` can suppress every row, so a `returning(...)` after it may resolve zero rows — yet on the multi-row batch form, `insertInto(t).values([rowA, rowB]).onConflictDoNothing().returning({ ... })` still offered `executeInsertOne()`, which demands exactly one row and rejects with `NO_RESULT` when none comes back, letting the type promise a value the query can't guarantee. The single-row form (`.values({ ... })`), the targeted `.onConflictOn(col).doNothing()` form, and the `INSERT … SELECT` form already dropped `executeInsertOne()` from this path — exposing only `executeInsertNoneOrOne()` / `executeInsertMany()` — and the multi-row bare `onConflictDoNothing()` was the sole outlier; it now matches them. `returningLastInsertedId()` on the same path, and a plain `.returning(...)` without `onConflictDoNothing()` (which still offers `executeInsertOne()`), are unchanged. Compile-time-only change; the runtime behavior and generated SQL are unaffected.

- **`divide(...)` now always divides in floating point, on every dialect.** `divide` mirrors JavaScript's `/`, which has no integer division — but the emitted SQL left the choice to the engine whenever both operands were exact. On MySQL / MariaDB the division was emitted bare, so `1 / 3` was computed in DECIMAL and **truncated to the 4 decimals of `div_precision_increment`** (`0.3333` instead of `0.3333333333333333`); PostgreSQL and SQL Server were already cast, but the base implementation was not, and there `1 / 3` is an integer division yielding `0`. The dividend is now cast to a floating point type whenever neither operand is already one — and, conversely, **the cast is no longer emitted when it isn't needed**: dividing a `double` column by anything now emits the bare `/` it always should have, so this also removes casts from the SQL of every dialect. Only the numeric result changes on MySQL / MariaDB, and only where the quotient needed more than 4 decimals.
- **`asDouble()` now really produces a double on MySQL / MariaDB.** It emitted `<value> * 1.0`, and `1.0` is an *exact* (DECIMAL) literal in MySQL's grammar, so the result stayed DECIMAL: `asDouble()` was a no-op, and any later fractional operation was truncated (`priority.asDouble().divide(3)` → `0.66667`). It now emits `cast(<value> as double)`, or `<value> * 1.0e0` when `compatibilityVersion` predates the DOUBLE cast target (MySQL 8.0.17, MariaDB 10.4.0).
- **`asInt()` / `asBigint()` on a double no longer compute in floating point.** Both rounded the value and declared the result an integer to TypeScript, but the emitted SQL stayed floating point — no cast. Downstream integer arithmetic was therefore computed in floating point: `priority.asDouble().asBigint().add(9007199254740993n)` returned a **clean but wrong `bigint`** (`9007199254740994n` instead of `9007199254740995n`) on SQL Server and SQLite, since the result is integral and marshals without complaint. On SQL Server `.modulo(...)` was rejected outright (*"The data types float and bigint are incompatible in the modulo operator"*). The rounded expression is now cast to the dialect's 64 bits integer type, so the SQL carries the type the value was declared with.
- **`cbrt()` no longer loses ~11 significant digits on MySQL and SQL Server.** The cube root is emulated as `sign(x) * power(abs(x), 1.0 / 3.0)`, and `1.0 / 3.0` is an *exact* literal division on both engines: MySQL truncated it to `0.33333` and SQL Server to `0.333333`, so `cbrt(8)` returned `1.999986137104434` and `1.9999986137061192` instead of `2`. The exponent is now spelled `1.0e0 / 3.0e0`, which every engine reads as floating point. MariaDB, Oracle and SQLite already computed it correctly and are unaffected; PostgreSQL uses the native `cbrt`.
- **`average()` no longer truncates on MySQL / MariaDB.** Averaging an exact column made the engine answer in an exact type: `avg(<int>)` returned DECIMAL cut at 4 decimals (`1.6667` instead of `1.6666666666666667`). An exact operand is now cast to a floating point type before averaging — the same correction SQL Server already applied for its own, more visible version of this (T-SQL's `AVG` over an integer truncates to the integer itself).
- **`.round()` keeps breaking ties away from zero on MySQL / MariaDB.** Both engines round an exact operand away from zero but defer an approximate one to the C library, which rounds half to even on the usual platforms (`round(0.5)` → `0`, `round(2.5)` → `2`). With `divide` / `asDouble` now correctly producing a DOUBLE, `.round()` would have silently switched tie-breaking rules depending on what came before it in the chain, so the operand is cast back to an exact type — the same treatment PostgreSQL already applied. The new `usePlatformDependentRound` property on `MySqlConnection` / `MariaDBConnection` opts out, with the same meaning it has on `PostgreSqlConnection`; see the *Rounding behavior* section of each connection's documentation page.

- **`getSeconds()` no longer reports a 60th second on PostgreSQL, and `getMilliseconds()` no longer wraps to 0.** Both mirror JavaScript's `Date` accessors, so they are typed `number` and are meant to answer 0–59 and 0–999 — but `extract(second from …)` returns a numeric that *includes* the sub-second fraction, and the `::integer` cast the dialect applied **rounds** it: `12:30:59.999` reported second **60**, `12:30:45.500` reported 46, and `12:30:45.9996` reported millisecond **0** instead of 999. The fraction is now truncated before the cast, as every other dialect's spelling already did. Reachable with ordinary millisecond timestamps — the kind a `Date` carries — and with the microsecond ones a `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` column stores.
- **`getMilliseconds()` no longer returns 1000 on MySQL / MariaDB.** The emission was `round(microsecond(x) / 1000)`, and since `microsecond()` is an integer the division is exact, so `round` broke the tie away from zero: `999600 µs` reported **1000** — a value the accessor cannot return — and `123500 µs` reported 124 instead of 123. The sub-millisecond part is now truncated. Only reachable on a column holding microseconds (`DATETIME(6)`), since a JavaScript `Date` has millisecond precision.
- **`getDay()` no longer depends on the session's `SET DATEFIRST` on SQL Server.** It mirrors JavaScript's `Date.getDay()`, where 0 is always Sunday — but the emission was `datepart(weekday, x) - 1`, and T-SQL's `DATEPART(weekday, …)` counts from whatever day `SET DATEFIRST` declares the week starts on. That is only 7 (Sunday) under the `us_english` default: `SET LANGUAGE` changes it implicitly, and most European languages set it to 1, which **shifted every day of the week** — a Sunday reported 6, a Monday 0. The day is now rebased on `@@DATEFIRST`, so it answers 0 for Sunday whatever the session says. SQL Server was the only dialect whose day-of-week was session-dependent; PostgreSQL (`extract(dow …)`), MySQL / MariaDB (`dayofweek(…) - 1`), Oracle and SQLite (`strftime('%w', …)`) were already absolute.
- **`executeSelectPage()`'s count query no longer carries the page's `ORDER BY`.** The count runs the same query without pagination, and `LIMIT` / `OFFSET` were already dropped from it — but the ordering was not, even though no ordering can change how many rows match. It was pure cost, and it was paid: Oracle planned the sort at **15× the count's own cost** (402 vs 26 on a 50 000-row table) and spilled 1.8 MB to temp, and SQL Server sorted every row too. The count now drops the ordering along with the paging, so `select count(*) from customer where …` stays plain and the wrapped forms (`distinct` / grouped / compound / customized) emit their `result_for_count` without an `order by`. The `beforeOrderByItems` / `afterOrderByItems` customization hooks go with it — they are content for an `ORDER BY` clause the count doesn't have — while `beforeQuery` / `afterQuery` and every other hook keep riding on the count, as they should. The count value is unchanged.
- **An `ORDER BY` in a subquery is now honoured on Oracle instead of being ignored — or rejected.** Oracle needs a row-limiting clause for a subquery's `ORDER BY` to mean anything, and ts-sql-query only supplied the noop `offset 0 rows` inside the wrapper it builds for an aggregated-array value. Everywhere else the ordering was emitted bare, with two consequences: a one-column select consumed via `.forUseAsInlineQueryValue()` and carrying `orderBy` was **rejected outright** (`ORA-00907: missing right parenthesis`), and a `WITH` body or derived table carrying `orderBy` was accepted but its **ordering silently discarded**, so the rows came back in whatever order the plan produced. The offset is now emitted for any non-root select that carries an ordering and no limit of its own — the same rule, and the same predicate, SQL Server already used for its identical restriction. A select that already carries a `limit` / `offset` is unchanged.
- **Converting a date to unix-time milliseconds no longer loses a millisecond on SQLite below 3.42.** Under `compatibilityVersion < 3_042_000` — where the `'subsec'` modifier isn't available and the value goes through `julianday()` arithmetic — the result was cast to an integer, and the arithmetic lands a hair below the whole millisecond about half the time, so the cast truncated it away: **29 818 of the 60 000 (second, millisecond) pairs came out one millisecond early**. It is now rounded to the millisecond before casting, which is what `getTime()` already did with the same expression. Unaffected on 3.42+, which uses the native `unixepoch(…, 'subsec')`.
- **SQLite's native unix-time support is now used to read a `'Unix time milliseconds as integer'` column.** From `compatibilityVersion >= 3_042_000` the stored value is handed to the engine as `x / 1000.0, 'unixepoch', 'subsec'`, so SQLite performs the conversion — sub-second part included — instead of the library flooring the value to whole seconds first. Older versions keep the explicit floor, which is what they can accept. Same results either way; the modern path just asks the engine to do the work it now knows how to do.
- **Date components of a pre-1970 instant stored as unix-time milliseconds are no longer off by one on SQLite.** The `'Unix time milliseconds as integer'` date format extracts each component by dividing the stored integer, and SQLite's integer division truncates **toward zero** rather than flooring — the same thing for any instant at or after 1970, and one second off before it. `1969-12-31T23:59:58.500Z` reported second **59** instead of 58, and its `getMilliseconds()` returned **-500** — a negative millisecond, which the accessor cannot return, because `%` keeps the dividend's sign. Both now floor properly. Instants at or after 1970, and the other date formats, are unaffected.
- **`getMilliseconds()` is no longer off by one for 372 of every 60 000 timestamps on SQLite.** `strftime('%f', x)` yields the *string* `'01.001'`, which coerced to an approximate number: `× 1000` gave `1000.9999999999999`, and SQLite's `%` truncates its operands to integer, so the milliseconds of `12:30:01.001` wrapped to **0**. The value is now rounded back to its exact integer before the modulo. The affected values were all at powers of two in the seconds field — an artifact of where the binade falls — so an exhaustive sweep of the 60 000 (second, millisecond) pairs went from 372 wrong to 0.

- **MySQL, MariaDB: `.length()` now counts characters instead of bytes.** `.length()` mirrors JavaScript's `String.length`, and the [functions and operators](keywords/functions-oprators.md) reference already maps it to `CHAR_LENGTH(value)` — but the emitted SQL was `LENGTH(value)`, which counts **bytes** on these two engines. So `'café'.length()` answered `5` instead of `4`, and `'日本'.length()` answered `6` instead of `2`, silently and only for non-ASCII data. It now emits `char_length(value)`, matching JavaScript, the documentation, and the value every other database already returned. Pure-ASCII text is unaffected — there the two counts coincide.
- **SQL Server: `.length()` no longer drops trailing spaces.** T-SQL's `LEN()` excludes trailing blanks, so `.length()` on `'Draft  '` answered `5` instead of the `7` JavaScript's `String.length` gives — and that same length fed the pre-2025 `substrToEnd` / `substringToEnd` emulation, which therefore *amputated* the trailing spaces from the sliced value as well. `.length()` now emits a form that counts them, and the slicing emulation no longer derives its length from `LEN()` at all (see the next entry). Strings without trailing blanks are unaffected.
- **SQL Server: `substrToEnd` / `substringToEnd` now return the same value on every `compatibilityVersion`, and no longer fail when the start index runs past the end.** Below `compatibilityVersion` 17_000_000 the emulation emitted `substring(x, start + 1, len(x) - start)`, which had two consequences the >= 17_000_000 form does not: trailing spaces were cut from the result (`LEN()` excludes them), so the *same call returned different values on either side of the gate*; and once `start` exceeded the string's length the computed length went negative, which SQL Server rejects outright (`Msg 536, Invalid length parameter passed to the LEFT or SUBSTRING function`) where JavaScript and every other database simply return `''`. The emulation now spells "to the end of the string" with a max-int length, so both branches agree on the value and the out-of-range call returns `''`. As documented, a compatibility branch only switches between valid forms of the *same* emitted SQL — this one no longer breaks that rule.
- **MySQL, MariaDB, Oracle: `getTime()` is now correct outside the 1970-2038 window.** On MySQL and MariaDB, `getTime()` was emitted with `UNIX_TIMESTAMP()`, whose documented argument range starts at 1970-01-01: outside it the function returns `0` (MySQL) or `NULL` (MariaDB) — a **warning-free wrong answer**, and the two engines disagreed with each other. So `1969-12-30 12:00` reported `0` instead of `-129600000`, and a year-3002 instant clamped to `0` as well. On Oracle, the formula added a *signed* day count to an *always-positive* time-of-day, so pre-1970 instants came out exactly one day off and, within the last day before the epoch, with the **sign flipped** (`1969-12-31 12:00` reported `+43200000` instead of `-43200000`). All three now emit range-free forms and agree with JavaScript's `Date.prototype.getTime()` across the full range a `Date` can hold, sub-second precision included. Instants inside the 1970-2038 window are unaffected. Note this is a **date-range** fix: as a side effect the new forms no longer resolve their argument against the session time zone, but that does *not* make `getTime()` timezone-safe — see the new [Time zones](configuration/time-zones.md) chapter for the host-vs-engine mismatch that affects every database equally.
- **A negative `substr` / `substring` index now follows the JavaScript definition, and `substrToEnd` and `substringToEnd` are no longer the same method.** All four slicing methods converted the 0-based JavaScript index to SQL's 1-based one by adding 1. That is right for a non-negative index and **wrong for a negative one**, because JavaScript and SQL already agree there — `'abcdef'.substr(-2)` and `SUBSTR('abcdef', -2)` are both `'ef'`, so the `+ 1` shifted the answer to `'f'`. Three consequences are fixed:
    - `substrToEnd(-n)` / `substr(-n, count)` now count from the end as JavaScript does, on every database, including the out-of-range clamp (`'abcdef'.substr(-10)` is `'abcdef'`, not `''`). Each dialect emits its own native idiom for it.
    - `substringToEnd(-n)` / `substring(-n, end)` now clamp the index to 0, as JavaScript's `substring` does — it never counts from the end. **This is the one thing that distinguishes `substr` from `substring` in JavaScript, and it was not implemented**: the two `…ToEnd` methods emitted byte-for-byte identical SQL, so `substringToEnd` was an alias of `substrToEnd`. They now differ exactly where JavaScript says they do.
    - `substring(start, end)` now swaps its arguments when `start > end`, as JavaScript does (`'abcdef'.substring(2, 0)` is `'ab'`). Previously it emitted a negative length, which **PostgreSQL rejects at runtime** (`negative substring length not allowed`) — a crash on a legal call — and which MySQL silently answered `''` for.

  Each case is resolved while the query is built, so the emitted SQL stays as simple as before and a non-negative index emits exactly what it always did. This needs the sign to be known at build time: with a **value-source** index the `+ 1` conversion is kept and a negative runtime value remains outside the contract.
- **MySQL, MariaDB: `orderBy` no longer drops the case-insensitivity of `asc nulls last insensitive` and `desc nulls first insensitive`.** Two of the four insensitive ordering modes emitted their sort term without the `lower(...)` fold — `order by title is null, title asc` instead of `order by title is null, lower(title) asc` — so the ordering was case-**sensitive** despite being asked for insensitively. The other two modes, the equivalent ordering inside `aggregateAsArray`, and every other database were already correct. Only visible on a case-sensitive collation: under the MySQL default (`utf8mb4_0900_ai_ci`) the fold is redundant, so the ordering already looked right.

**Internal changes**:

- **The affix predicates now build their LIKE pattern through a per-dialect seam.** `startsWith` / `endsWith` / `contains` and their `Insensitive` variants used to re-spell the whole predicate in each dialect that concatenates differently — 12 overrides on MySQL / MariaDB and 12 on SQL Server, identical to the base except for `concat(...)` or `+` in place of `||`. They now declare three pattern methods instead, and inherit the predicates themselves; the six non-`Insensitive` overrides are gone from both. The generated SQL is unchanged for every database, byte for byte — the `Insensitive` overrides that remain are the ones that genuinely differ (SQL Server's uuid receiver arm, MySQL's case-folding of the term rather than the pattern). This only affects you if you reach the builder through the `__UNSUPPORTED__/*` escape hatch.

- **The base `SqlBuilder`'s date-part family no longer contradicts every dialect and the documentation, and is now the PostgreSQL implementation.** `AbstractSqlBuilder._getMonth` emitted `extract(month from …)` with **no `- 1`**, so it was 1-based while all six dialects and the [functions and operators](keywords/functions-oprators.md) reference document `.getMonth()` as 0-based like JavaScript's; and `_getDay` emitted `extract(dow from …)`, a field only PostgreSQL has. Both were unreachable (every dialect overrode the whole family), which is how the round that fixed base `_getTime` / `_getSeconds` / `_getMilliseconds` walked past them in the same block. The family is now PostgreSQL's implementation — the `- 1`, the const-cast receiver and the `::integer` casts — the redundant `PostgreSqlSqlBuilder` overrides are removed so PostgreSQL exercises the base, and `_getMonth` / `_getMilliseconds` are registered as needing parenthesis in the base constructor (their emission ends in an operator; the dialects whose override is a self-contained call switch that back off). The generated SQL is unchanged for every database, PostgreSQL included — its overrides were byte-identical to the base they now inherit. This only affects you if you reach the builder through the `__UNSUPPORTED__/*` escape hatch.
- **The base `SqlBuilder`'s `stringConcat` emission no longer names a function that does not exist, and is now the SQLite implementation.** `AbstractSqlBuilder._stringConcat` / `_stringConcatDistinct` emitted `string_concat(…)` — no supported engine has such a function; the real names are `string_agg` (PostgreSQL, SQL Server), `group_concat` (MySQL, MariaDB, SQLite) and `listagg` (Oracle). Every database overrode both methods, so no connection reached the broken base and it went unnoticed, the same way the `as double presition` typo did. Both now emit `group_concat(…)` and the redundant `SqliteSqlBuilder` overrides are removed, so SQLite uses the base directly. The generated SQL is unchanged for every database, SQLite included (its overrides were byte-identical to the corrected base).
- **The base `SqlBuilder`'s `getTime` / `getSeconds` / `getMilliseconds` emission no longer contradicts what every dialect implements.** `_getTime` emitted `extract(epoch from …)`, which answers in **seconds**, while every override answers in milliseconds — a 1000× divergence; `_getSeconds` emitted a fractional `45.123` for a method typed as an integer; and `_getMilliseconds` emitted `45123` (seconds × 1000 + milliseconds) rather than the 0–999 component. All three are unreachable today (every dialect overrides them), so no generated SQL changes; they are corrected because a base dialect no dialect reaches is not dead code, it is untested code.
- **Each dialect now declares in one place how a value becomes a floating point number or a 64 bits integer, and every operation needing either composes from it.** The cast was previously re-spelled by hand in each operation: `divide` was literally `asDouble(x) / asDouble(y)` written out a second time in three dialects, which is how MySQL came to be wrong in both places independently, and how SQL Server's `cbrt` kept a copy of the defective `1.0 / 3.0` exponent that the bug report had only ever attributed to MySQL. The `_divide` / `_asDouble` overrides of PostgreSQL, SQL Server and MySQL / MariaDB, SQL Server's `_cbrt`, and its private average-operand cast are all removed in favour of the shared seam. Oracle keeps its own `_divide`: it divides in NUMBER, which is exact to 38 significant digits, so casting the operands to float there would *lose* precision — the one legitimate divergence, now documented as such. This only affects you if you reach the builder through the `__UNSUPPORTED__/*` escape hatch.
- **The base `SqlBuilder`'s `asDouble` / `divide` emission no longer produces invalid SQL, and is now the SQLite implementation.** `AbstractSqlBuilder._asDouble` emitted `cast(<value>as double presition)` — the operand glued to `as`, and `precision` misspelled — and `_divide` repeated the same misspelling. Every database overrode both methods, so no connection reached the broken base and it went unnoticed. Both now emit `cast(… as real)` and the redundant `SqliteSqlBuilder` overrides are removed, so SQLite uses the base directly: the base dialect is exercised by a real dialect instead of being unreachable. The generated SQL is unchanged for every database, SQLite included (its overrides were byte-identical to the corrected base). Each dialect keeps its own spelling of the cast, now declared in the single place described above. This only affects you if you reach the builder through the `__UNSUPPORTED__/*` escape hatch and inherit these methods.
- **A custom-`int` operation against another value source now tracks both operands' source tables in its type.** `add` / `subtract` / `modulo` / `minValue` / `maxValue` and the null-handling `valueWhenNull` / `nullIfValue` on a `customInt` value source, when the argument was another value source, dropped that argument's table from the result's phantom source type — unlike `multiply` and every other numeric / custom value source, which already tracked both. They now all behave the same. This only tightens the compile-time check that verifies a value belongs to a table in scope; the generated SQL and the runtime values are unchanged.

## v2.0.0-beta.1 (14 Jun 2026)

This is the first **beta** of ts-sql-query 2.0: the 2.0 line is now feature-complete and entering stabilization ahead of the final release. v2 is the biggest step the library has taken since v1 — a modernized foundation, a new portable error model, broader and more uniform database support, more runtimes, and sharper types. The headline advances since v1:

- **Typed, portable error handling** — every execution and processing failure is now a typed error carrying a single dialect-independent reason (unique / foreign-key / not-null / check violations, deadlocks, lock timeouts, serialization failures, connection errors, …), so you branch on a portable category instead of pattern-matching raw driver messages per database.
- **One `compatibilityVersion` knob and modern SQL emission** across all six engines, defaulting to the latest dialect, plus a large jump in cross-database feature parity (e.g. `Values` sources, set operations, sequences, `oldValues`) so the same query works the same way on more databases.
- **More runtimes and drivers** — first-class Bun support (including its native SQL/SQLite drivers), Node's built-in `node:sqlite`, the in-process `pglite`, and transaction support on the postgres.js runner.
- **Sharper types** — complex projections reworked to drop recursive types (clearer TypeScript errors), and dynamic queries (conditions, picks, order by) that can now be typed directly from your business model.
- **A modernized foundation** — ESM-only, Node 22+, an explicit `exports` map that locks down the public surface, and the removal of every long-deprecated API, driver and connection type.
- **A rebuilt documentation site** (Material for MkDocs) and a large batch of cross-dialect correctness fixes.

This entry only summarizes the journey. For the complete, itemized list — every new feature, behavior change, breaking change and migration step — read the four **v2.0.0-alpha** entries this beta consolidates:

- v2.0.0-alpha.4 (14 Jun 2026)
- v2.0.0-alpha.3 (14 Jun 2025)
- v2.0.0-alpha.2 (2 Mar 2024)
- v2.0.0-alpha.1 (2 Mar 2024)

## v2.0.0-alpha.4 (14 Jun 2026)

**New features**:

- **New error-management system**: every database/driver execution failure and every library-side processing failure is now surfaced as a typed error (`TsSqlQueryExecutionError` / `TsSqlProcessingError`, both extending `TsSqlError`) carrying a structured, dialect-independent `errorReason`, so application code can branch on a single portable category (unique / foreign-key / not-null / check-constraint violations, deadlocks, lock timeouts, serialization failures, connection/pool errors, and more) instead of pattern-matching raw driver messages per database. When available, the reason also carries `databaseErrorCode`, `databaseErrorNumber` and `databaseErrorMessage`. Per-database mappers cover every supported engine and driver. See the new [Error management](api/error-management/overview.md) documentation.
- New **aggregated root entry** (`import 'ts-sql-query'`) that re-exports the cross-database public surface as a convenience; existing per-subpath imports keep working unchanged. Database-specific symbols (per-database connections, query runners, `IDEncrypter`) stay on their subpath so the import line remains database-aware.
- MariaDB: `.oldValues()` is now usable on MariaDB tables (previously PostgreSQL, SQL Server and noop only); on `compatibilityVersion >= 13_000_001` it uses MariaDB 13.0.1's native `OLD_VALUE(col)` inside `UPDATE ... RETURNING`.
- MariaDB: `sequence(...)` and `autogeneratedPrimaryKeyBySequence(...)` are now available, using MariaDB's native `SEQUENCE` syntax (`NEXTVAL`/`LASTVAL`); requires MariaDB 10.3+.
- MariaDB / MySQL: the `Values` constant-values view is now usable as a select/join source and to drive multi-table `UPDATE`/`DELETE` (requires MariaDB 10.3.3+ / MySQL 8.0.19+).
- MySQL: the set-operation operators `.intersect(...)`, `.except(...)`, `.intersectAll(...)`, `.exceptAll(...)`, `.minus(...)` / `.minusAll(...)` are now typed on `MySqlConnection` (previously `never`); requires MySQL 8.0.31+.
- Oracle: `.intersectAll(...)`, `.exceptAll(...)` and `.minusAll(...)` are now typed on `OracleConnection` (previously `never`); requires Oracle Database 23ai.
- Oracle: the `Values` feature is now supported (previously PostgreSQL, SQL Server, SQLite only); on `compatibilityVersion >= 23_004_000` it uses the native 23ai table constructor, otherwise a portable `SELECT ... FROM dual UNION ALL` fallback that works on 19c/21c/23ai.
- Oracle: `deleteFrom(table).using(otherTable)` and `update(table).from(otherTable)` are now exposed (require Oracle Database 23ai). Combining either with a `Values` view for bulk update/delete remains unsupported on Oracle.
- SQL Server and Oracle: `insertInto(table).defaultValues().returningLastInsertedId()` now type-checks (previously `never`), matching the already-supported `.returning(...)` / `.returningOneColumn(...)`.
- The `setForAll*`, `ignoreIf*`, `keepOnly`, `disallowIf*`, `disallow*Set` families and their `*When` variants are now exposed on the builder returned by `insertInto(table).values([...])` (they already worked at runtime but failed to typecheck).
- New Oracle `uuidStrategy: 'built-in'` (now the default), targeting Oracle Database 23.9+ whose `UUID_TO_RAW` / `RAW_TO_UUID` functions are built into the engine (no user-defined functions). The previous `'custom-functions'` strategy stays available and emits identical SQL.
- New `usePlatformDependentRound` property on `PostgreSqlConnection` (default `false`) to opt back into PostgreSQL's native `round(double precision)` round-to-even semantics.
- New importable `sync` helper for synchronous query runners (`import { sync } from 'ts-sql-query'` or `ts-sql-query/extras/sync`) — the implementation the docs previously asked you to copy into your own codebase.
- `MockQueryRunner` exposes a public `reset(): void` to restart its query counter between test cases, plus a new `isSqlError` config option to let a thrown sentinel value bubble up unwrapped instead of being wrapped in `TsSqlQueryExecutionError`.
- New `ts-sql-query/extras/deepUtilities` module (also re-exported from the root): the `DeepPick`, `DeepPickPaths`, `DeepOmit` types and the runtime `deepPick` / `deepOmit` — the deep (dotted-path) analogues of `Pick` / `Omit` / `keyof`, so a generic dynamic-pick helper can return a value typed against your nested business model without a cast.
- New `DynamicConditionForModel<Model, Extension?>` and `DynamicDefinitionForModel<Model>` types (`ts-sql-query`, or `ts-sql-query/dynamic/condition`) to derive a dynamic-condition filter type from a plain business model instead of from the value-source map.
- New `OrderByForModel<Model>` and `OrderByMode` types (`ts-sql-query`, or `ts-sql-query/dynamic/orderBy`) to type an order-by value against a model's orderable fields and the valid ordering modes.
- New `orderByFromStringArray(orderBy)` / `orderByFromStringArrayIfValue(orderBy)` methods on the select builder — the array-shaped counterparts of `orderByFromString` / `orderByFromStringIfValue`, joining each clause for you.
- `expandTypeFromDynamicPickPaths` / `expandTypeProjectedAsNullableFromDynamicPickPaths` now infer a result assignable to a hand-written `Pick<Model, FIELDS | 'id'>` (flat picks) and `DeepPick<Model, …>` (nested picks), so a model-typed API boundary no longer needs an `as` cast.
- `DynamicCondition<Definition, Extension>` now models object-valued (nested) extension rules and types the extension as available under any column, matching the runtime — so nested-rule extensions typecheck without an `as any` cast.

**New query runners**:

- `PgLiteQueryRunner` for the [pglite](https://www.npmjs.com/package/@electric-sql/pglite) in-process PostgreSQL driver ([docs](configuration/query-runners/recommended/pglite.md)).
- `NodeSqliteQueryRunner` for Node.js' built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) `DatabaseSync` (Node 22+), with no extra driver dependency ([docs](configuration/query-runners/recommended/node_sqlite.md)).
- `BunSqliteQueryRunner` for Bun's built-in [`bun:sqlite`](https://bun.com/docs/runtime/sqlite) driver ([docs](configuration/query-runners/recommended/bun_sqlite.md)).
- `BunSqlPostgresQueryRunner` for the [Bun SQL](https://bun.com/docs/runtime/sql) driver against PostgreSQL ([docs](configuration/query-runners/recommended/bun_sql_postgres.md)).
- `BunSqlMySqlQueryRunner` (against MySQL/MariaDB) and `BunSqlSqliteQueryRunner` for the Bun SQL driver — both **experimental**, due to several outstanding bugs in Bun ([MySQL docs](configuration/query-runners/recommended/bun_sql_mysql.md), [SQLite docs](configuration/query-runners/recommended/bun_sql_sqlite.md)).
- The [postgres.js](https://github.com/porsager/postgres) query runner (`PostgresQueryRunner`) now supports low-level transaction management (`beginTransaction()` / `commit()` / `rollback()`, including isolation level and access mode), matching the other PostgreSQL runners.

**Changes**:

- The generated SQL now uses modern dialect features when `compatibilityVersion` allows it (default `Infinity` opts into all of them; the output is functionally identical, just shorter and clearer):
    - SQLite: `unixepoch(...)` for Unix-seconds (3.38+) and the `'subsec'` modifier for Unix-milliseconds (3.42+).
    - MariaDB: `VALUE(col)` instead of `VALUES(col)` inside `ON DUPLICATE KEY UPDATE` (10.3.3+).
    - MySQL: the `INSERT ... AS _new_ ON DUPLICATE KEY UPDATE col = _new_.col` row-alias syntax instead of the deprecated `VALUES(col)` (8.0.19+).
    - PostgreSQL: the native `OLD` qualifier in `UPDATE ... RETURNING` instead of the `FROM (SELECT … FOR NO KEY UPDATE) AS _old_` wrapper (PostgreSQL 18+).
    - SQL Server: native `LEAST`/`GREATEST` for `minValue`/`maxValue` (2022+), `JSON_ARRAYAGG`/`JSON_OBJECT` for `aggregateAsArray*` (2025+, except the `*Distinct` variants), and a shorter `substringToEnd` (2025+).
- MariaDB / MySQL: `INSERT ... SELECT` referencing a CTE now emits the CTE inside the `SELECT` (`INSERT INTO target (cols) WITH cte AS (...) SELECT ... FROM cte`) — the only form both engines accept; the previous leading-`WITH` form was rejected at parse time. MySQL with `compatibilityVersion < 8_000_000` keeps the derived-table form for 5.7.
- SQL Server: `currentDate()` now emits SQL returning a `date` value (`CURRENT_DATE` on 2025+, `cast(getdate() as date)` earlier) instead of `getdate()`; the returned JavaScript value is unchanged.
- SQLite: `.in([])` / `.notIn([])` now short-circuit to `where 0` / `where 1` (matching every other dialect) instead of the non-portable `in ()` / `not in ()`.
- PostgreSQL: `.round()` now breaks ties away from zero on every operand type (matching every other dialect), instead of depending on whether the chain produced `numeric` or `double precision`. Opt back into the native behavior with `usePlatformDependentRound`.
- `connection.random()` on SQLite now returns a `double` in `[0, 1)` (matching every other dialect and the public API) instead of SQLite's native 64-bit integer, which overflowed `Number.MAX_SAFE_INTEGER`.
- `BetterSqlite3QueryRunner` no longer forces `safeIntegers(true)`, so integers come back as `number` by default (matching the other SQLite runners). Enable `safeIntegers` in the better-sqlite3 configuration to read out-of-range integers as `bigint` as before.
- `BunSqlPostgresQueryRunner` now serialises `Date` parameters to an ISO 8601 string as a best-effort workaround for an upstream Bun.SQL bug; opinionated runner behaviour that **may change** once the upstream bug is fixed.
- `Sqlite3QueryRunner` (the deprecated `sqlite3` driver) now binds `bigint` parameters best-effort by coercing to `number` (the driver cannot bind a `BigInt` and silently bound `NULL`); precision is lost above `Number.MAX_SAFE_INTEGER` — use another SQLite runner for full int64 fidelity.
- `Sqlite3QueryRunner` is now annotated `@deprecated` (the `sqlite3` driver was deprecated by its maintainers); its documentation page moved to *Additional query runners*. Recommended replacements: `BetterSqlite3QueryRunner`, `NodeSqliteQueryRunner`, `BunSqliteQueryRunner`, `Sqlite3WasmOO1QueryRunner`.
- **Compile-time guards** — these always-invalid-at-runtime calls are now TypeScript errors that point to the portable alternative:
    - `recursiveUnion` / `recursiveUnionOn` resolve to `never` on `OracleConnection` and `SqlServerConnection` (use `recursiveUnionAll*`).
    - `.onConflictDoUpdateSet(...)` / `.onConflictDoUpdateSetIfValue(...)` / `.onConflictDoUpdateDynamicSet()` (bare-target upsert) resolve to `never` on `PostgreSqlConnection` (use `.onConflictOn(col).doUpdateSet(...)`); `.onConflictDoNothing()` still allows the bare form.
    - `aggregateAsArrayDistinct` / `aggregateAsArrayOfOneColumnDistinct` are exposed only where the engine accepts `DISTINCT` natively (PostgreSQL, MariaDB, SQLite, noop).
    - `stringConcatDistinct(...)` is not exposed on `SqlServerConnection`; its two-argument (separator) overload is not exposed on `SqliteConnection`.
    - `connection.default()` is not exposed on `SqliteConnection` (omit the column to apply the DDL default).

**Documentation changes**:

- New top-level **Dynamic** documentation section gathering everything about building dynamic queries: [Dynamic query building blocks](dynamic/building-blocks.md), [Booleans and three-valued logic](dynamic/three-valued-booleans.md), [Typing dynamic queries from a business model](dynamic/from-business-model.md), [Typing dynamic queries from the database types](dynamic/from-database-types.md), and a Utilities group covering [Dynamic conditions](dynamic/utilities/conditions.md), [Dynamic picks](dynamic/utilities/picks.md) and [Dynamic order by](dynamic/utilities/order-by.md).
- The `aggregateAsArray` / `aggregateAsArrayOfOneColumn` example on the [Aggregate as object array](queries/aggregate-as-object-array.md) page now lists every non-aggregated selected column in `.groupBy(...)` so it works portably on strict-ANSI engines (SQL Server, Oracle).
- Added per-database guidance for **UUID v7** (RFC 9562) and updated the SQLite UUID snippets (better-sqlite3, node:sqlite) to register `uuid_str` / `uuid_blob` using the `uuid` package's `parse` / `stringify`, replacing the unmaintained `binary-uuid` package.
- The deferred-hook note on [transaction.md](queries/transaction.md#deferring-logic-during-a-transaction) now describes the actual runtime behavior (`executeBeforeNextCommit` / `executeAfterNextCommit` / `executeAfterNextRollback` throw `NOT_IN_TRANSACTION` on a real connection; the mock query runner silently accepts the registration).
- Renamed `docs/about/limimitations.md` to `docs/about/limitations.md` (typo fix); the published Read the Docs URL changes accordingly.

**Breaking changes**:

- ts-sql-query is now an **ESM-only** package; the CommonJS build is gone. CommonJS consumers must migrate to ESM or load it via dynamic `import()`.
- Minimum supported Node.js version is now **22**.
- TypeScript consumers must use `moduleResolution: "node16"`, `"nodenext"` or `"bundler"` to resolve the subpath exports.
- The per-database SQL-dialect compatibility flags are consolidated into a single `compatibilityVersion` number on every connection (encoded as `major * 1_000_000 + minor * 1_000 + patch`, e.g. `8_000_019` for MySQL 8.0.19). The default is `Number.POSITIVE_INFINITY` (latest), emitting every supported feature; defaults now target the most modern dialect, reversing the previous conservative SQLite/MariaDB defaults. Migration:
    - `MySqlConnection.compatibilityMode = true` → `compatibilityVersion = 5_007_000` (any value `< 8_000_000`).
    - `MariaDBConnection.alwaysUseReturningClauseWhenInsert` → removed; modern behavior (`INSERT ... RETURNING` to read the last inserted id) is now the default. Pin `compatibilityVersion = 10_004_000` for the previous behavior.
    - `SqliteConnection.compatibilityMode` → removed; native `NULLS FIRST`/`NULLS LAST` and `INSERT ... RETURNING` are now the default. Pin `compatibilityVersion = 3_029_000` (or `3_030_000` for SQLite 3.30–3.34) for the previous behavior.
- The set of importable subpaths is now enforced by an explicit `exports` map in `package.json`: every public file is listed by name, and everything else (abstract base classes, error mappers, and the `internal/`, `expressions/`, `queryBuilders/`, `sqlBuilders/`, `utils/`, `complexProjections/` internals) fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Internals remain reachable as an escape hatch via `ts-sql-query/__UNSUPPORTED__/<original/path>`, with **no stability guarantees**.
- `MockQueryRunner` now mirrors real-driver transaction semantics: it tracks transaction depth internally, so every transaction-lifecycle guard now fires exactly as on a real driver (`commit`/`rollback`, deferred-hook registration or `getTransactionMetadata()` outside a transaction throw `NOT_IN_TRANSACTION`; a nested transaction on a runner that doesn't support it throws `NESTED_TRANSACTION_NOT_SUPPORTED`). Test code relying on the previous lenient mock must wrap those calls in a transaction. The `'isTransactionActive'` member of the `MockQueryExecutor` union is removed; `isMocked()` still returns `true` as a diagnostic.
- `.onConflictOnConstraint(...)` now accepts **only** a `RawFragment`; the `string` and `IStringValueSource` overloads are removed (a constraint name is a SQL identifier, not a bindable parameter). Migration: `.onConflictOnConstraint('my_constraint')` → ``.onConflictOnConstraint(connection.rawFragment`my_constraint`)``.
- `connection.average(...)` / `connection.averageDistinct(...)` now always return `NumberValueSource` (TypeScript `number`, runtime `double`) regardless of the input type, matching the conceptually-fractional semantics of `AVG`; the four int/bigint/customInt/customDouble overloads collapsed into one. Most callsites need no change; those that explicitly annotated the result as `BigintValueSource` / `CustomIntValueSource` must drop the annotation.

**Bug fixes**:

- `cbrt()` on MariaDB, MySQL, Oracle, SQL Server and SQLite computed the cube (`power(x, 3)`) instead of the cube root; now emits the portable `sign(x) * power(abs(x), 1.0/3.0)`, preserving the sign. PostgreSQL keeps its native `cbrt`. On SQL Server it also casts to `float` to avoid integer truncation.
- `log10()` on Oracle emitted `log(x, 10)` (log base x of 10); now `log(10, x)`.
- `logn(n)` on PostgreSQL, Oracle and SQLite emitted the arguments reversed (`log(value, n)`); now `log(n, value)`. SQL Server keeps its own argument order.
- `.logn(n)` on PostgreSQL failed at runtime (`log(unknown, double precision) does not exist`); now casts both arguments to `numeric`.
- `ln()` on SQLite emitted `log(x)` (the base-10 logarithm on most builds); now the unambiguous `ln(x)`.
- `.roundn(n)` on PostgreSQL failed at runtime on a `double precision` operand; now casts the operand to `numeric`.
- `value.modulo(n)` on Oracle emitted `value % n` (ORA-00911); now the built-in `MOD(value, n)`.
- `pi()` on Oracle emitted `pi()` (ORA-00904); now `acos(-1)`.
- `.cot()` on Oracle emitted `cot(x)` (no such function); now `1 / tan(x)`.
- `.ceil()` on SQL Server emitted `ceil(x)`; now `ceiling(x)`.
- `.round()` on SQL Server emitted `round(x)` (which requires 2–3 arguments); now `round(x, 0)`.
- `connection.random()` on MariaDB and MySQL emitted `random()` (no such function); now the native `rand()`.
- `connection.currentTime()` on Oracle emitted `current_time` (ORA-00904); now `localtimestamp`.
- `value.asDouble()` on SQLite and SQL Server emitted `cast(<expr>as real/float)` (missing space, syntax error); now correctly spaced.
- `value.notEndsWith(s)` on MariaDB and MySQL emitted `like` instead of `not like`, matching rows that ended with the suffix instead of excluding them.
- `value.stringConcat(...)` / `value.stringConcatDistinct(...)` on Oracle emitted `order by<expr>` (missing space, ORA-00924); now correctly spaced.
- `value.stringConcat(value, separator)` / `stringConcatDistinct(value, separator)` on SQL Server bound the separator as a parameter (rejected by `STRING_AGG`); now inlined as an escaped SQL literal.
- `stringConcatDistinct(value, '')` on MariaDB / MySQL dropped the `distinct` keyword in the empty-separator branch; now preserved.
- `connection.subSelectDistinctUsing(...)` emitted no `distinct` keyword (the builder hard-coded `false`); now emits `select distinct …`.
- `compoundSelect.minus(...)` / `.minusAll(...)` on Oracle emitted `except` (ORA-00928); now the native `minus`.
- `.minus(...)` / `.minusAll(...)` on MariaDB emitted the `MINUS` keyword (a parse error outside `SQL_MODE=ORACLE`); now the portable `except` / `except all`.
- `connection.exists(...)` / `connection.notExists(...)` on SQL Server and Oracle emitted a redundant `(expr = 1)` wrapper inside `where`/`and`/`or` (rejected by SQL Server); now `where exists(...)`.
- Oracle multi-row `INSERT` without `returningLastInsertedId()` emitted a broken `INSERT ALL` (malformed SQL, and duplicate IDENTITY ids across multiple `INTO` clauses); now a PL/SQL block, matching the `returningLastInsertedId()` path.
- Stored-procedure calls on SQL Server with two or more bound parameters emitted `exec procName @0 @1` (missing comma); now `exec procName @0, @1`.
- `connection.default()` on columns using a `CustomBooleanTypeAdapter` wrapped the `DEFAULT` keyword in the boolean remap (rejected at execution); now short-circuits to the bare `default`.
- `insertInto(...).executeInsert(min, max)` for plain inserts compared against an inverted internal flag, so the row-count guard checked the wrong value; now compares against the engine's reported row count.
- `createTableOrViewCustomization` `${alias}` slot on Oracle emitted `... as "o"` (ORA-03048); now the bare alias.
- `aggregateAsArrayDistinct({...})` on PostgreSQL emitted `json_agg(distinct json_build_object(...))` (no equality operator for `json`); now uses `jsonb_build_object` so `DISTINCT` can deduplicate.
- `localTime` placeholder casts on PostgreSQL emitted `::timestamp::time` (rejected); now `::time` directly.
- `.orderBy(col, 'insensitive')` and variants on PostgreSQL failed with a non-all-lowercase `insensitiveCollation` (the collation was not quoted); now quoted, matching the rest of the `*Insensitive` family.
- Case-insensitive `order by` on a compound query (`union`/`intersect`/`except`) emitted SQL rejected by PostgreSQL, SQL Server, Oracle and modern SQLite; now wraps the compound in `select * from (...) order by …`.
- Case-insensitive `order by` of a select-list alias on PostgreSQL and SQL Server emitted `lower(<alias>)`, rejected because those engines resolve the name against input columns; now wraps the alias' underlying source expression.
- A one-column boolean SELECT wrapped with `forUseAsInlineQueryValue()` used directly as a condition emitted `((<select>) = 1) = 1` on SQL Server (rejected); now coerced to a condition exactly once.
- `.doUpdateDynamicSet(columns)` / `.onConflictDoUpdateDynamicSet(columns)` threw `'Illegal state'` when given the documented initial-columns argument; now returns correctly.
- `insertInto(...).ignoreIfHasNoValueWhen(true, ...cols)` / `update(...).ignoreIfHasNoValueWhen(true, ...cols)` dispatched to the opposite-polarity `ignoreIfHasValue`; now correctly delegate to `ignoreIfHasNoValue`.
- A stray `console.log('b')` printed to stdout during multi-row `insertInto(...).values([...]).disallowAnyOtherSet(...)`; removed.
- `Values.as(alias)` / `Values.forUseInLeftJoinAs(alias)` emitted empty-identifier column qualifiers (rejected by every engine) because the alias copied column names from the wrong source; now emits qualified references like `pp.id`.
- `dynamicPickPaths(...)` silently dropped any picked path nested three or more levels deep; now included at any depth.
- `dynamicConditionFor(fields, extension).withValues(filter)` silently ignored a column-scoped extension whose value is an object of nested rules; now forwarded at any depth.
- `connection.isolationLevel('read only')` / `connection.isolationLevel('read write')` (single-argument) silently dropped the access mode; now preserved and propagated to the emitted `BEGIN`/`SET TRANSACTION`.
- `BEGIN TRANSACTION READ ONLY` / `SET TRANSACTION READ ONLY` inserted a spurious comma when no isolation level accompanied the access mode (rejected by every dialect); now emitted without the comma.
- MySQL / MariaDB: `transaction(fn, isolationLevel(...))` / `beginTransaction(isolationLevel(...))` failed with `ER_CANT_CHANGE_TX_CHARACTERISTICS`; the `SET TRANSACTION` statement is now issued before `BEGIN`.
- `connection.rollback()` on the mysql2 query runner mistakenly called the driver's `beginTransaction(...)` instead of `rollback(...)`, silently opening a fresh transaction instead of discarding the pending changes.
- `isValidEncryptedID(encryptedID, prefix)` (`ts-sql-query/extras/IDEncrypter`) rejected the prefixed output of `IDEncrypter.encrypt(id, prefix)`; it now strips the prefix before re-checksumming, mirroring `decrypt`.
- `virtualColumnFromFragment(...)` / `optionalVirtualColumnFromFragment(...)` on `Table`, `View` and `Values` rejected a fragment with no `${…}` interpolation (`TS2769`); now accepted.
- `extractWritableColumnsFrom` / `extractWritableColumnNamesFrom` / `extractWritableShapeFrom` (`ts-sql-query/extras/utils`) silently dropped required, no-default columns created with the bare `this.column(...)` factory, and their output depended on test ordering; both fixed.
- Oracle: fixed two bugs producing malformed `raw_to_uuid(...)` calls inside `json_arrayagg` when projecting a single UUID column via `aggregateAsArrayOfOneColumn`.
- Oracle: a multi-row `Values.create(...)` mixing a value and `null`/`undefined` across rows of a nullable numeric or date/timestamp column failed with ORA-01790; the `null` cell is now cast to its column type.
- `fromRef` (`ts-sql-query`, or `ts-sql-query/extras/types`) failed to compile in the documented "passing tables and views as a parameter" pattern (a v2 source-tag rewrite regression, fixed before v2 ships); it now infers the source at the call site.

**Internal changes**:

- Enable the TypeScript `noImplicitOverride` flag (documentation snippets that subclass a `Connection` were updated to add the `override` modifier).
- Enable the TypeScript `exactOptionalPropertyTypes` flag; the library now type-checks cleanly when consumers enable it too. Optional projected-result fields are emitted as `prop?: T` (the absent-field form); the public `TsSqlErrorReason` and `QueryLogger` optional fields spell `| undefined` explicitly so callers can assign `undefined`.
- Update to TypeScript 6 and Prisma 7.
- The pipeline now requires Node 22 or newer and is tested against Node 22, 24 and 26.
- The build uses a dedicated `tsconfig.build.json` that excludes `src/examples`, so the published package no longer contains example sources.
- Removed the obsolete `.npmignore`; the published file set is now controlled by the `files` field in `package.json`.

**Removals**:

- As part of removing v1 legacy/obsolete API, several public symbols whose v1 names carried a spelling mistake are corrected and the misspelled names no longer exist. Migration is a mechanical rename in consumer code, with no change to the generated SQL or runtime behavior:

    | Removed misspelled name | Corrected name          |
    | ----------------------- | ----------------------- |
    | `greaterOrEquals`       | `greaterOrEqual`        |
    | `lessOrEquals`          | `lessOrEqual`           |
    | `substract`             | `subtract`              |
    | `insesitiveCollation`   | `insensitiveCollation`  |

**v1 changes**:

The following releases in v1 are included:

- v1.68.0 (14 Jun 2026)

## v2.0.0-alpha.3 (14 Jun 2025)

**Changes**:

- The generated SQL in a `beforeOrderByItems` or `afterOrderByItems` query customization will always include the table name to avoid conflicts with column aliases.
- Refactor how complex projections are managed to avoid the usage of recursive types:
    - This improves TypeScript error messages.
    - Allows the use of recent TypeScript versions stricter with recursive types.
    - Only 5 nesting levels are supported (previously, nesting levels had several limitations, but without a clear, easily identifiable limit).

**TypeScript error messages**:

- Refactor how the source of data (table, view, etc.) identity is represented, simplifying it and improving the understandability of TypeScript's error messages.
- Improve TypeScript error messages managing boolean value sources.
- Restructure how columns are represented to simplify the types displayed by TypeScript.

**New features**:

- Add support for transaction isolation level and access mode.
- Query metadata available on begin transaction, commit, and rollback.
- Allow returning all columns of a table by providing the table as the object to select.
- Add support for complex projections in queries marked as `forUseInQueryAs` (queries to be used as `with`).

**New documentation page**:

- Migrated to use Material for MkDocs.
- Restructured the content distribution in the menu.
- Split dynamic queries documentation to extract the "extreme dynamic queries."
- Add a SQL keyword mapping section.
- Split several pages to avoid excessively long content.
- Add a page explaining the philosophy principles.
- Improve search capabilities.
- All pages have been reviewed and improved.
- Plenty of additional explanations added.
- Several pages have been restructured to improve readability.
- A dedicated "Utility for dynamic picks" page was created to make the "Extreme dynamic queries" page more readable, with more detailed information.
- Include the generated SQL for every supported database.

**Documentation changes**:

- Add references to the query customization options `queryExecutionName` and `queryExecutionMetadata` in the supported operations documentation page.

**Breaking changes**:

- Values mapped as double are now sent to SQL Server as `float` (instead of `real`) to better match JS precision with the database.
- Simplify the `connection.transaction` function signature, removing the array overload due to the removal of short-running transaction support for Prisma.
- Remove short-running (sequential operations) transaction support in Prisma (regular transactions continue to be supported).
- Nested transactions on PostgreSQL are disabled by default; you can re-enable them when creating a query runner with Pg. Other connectors do not support this feature.

**Internal changes**:

- Update database connector dependencies.
- Update to TypeScript 5.
- Update to Prisma 6.
- Update pipeline to remove End-of-Life Node versions; ts-sql-query is no longer tested on Node 14 and Node 16.
- Align internal object names that represent `localDate`, `localTime`, and `localDateTime` to match these names.
- Simplify internal type names after the removal of the connections with extended types.
- Simplify internal type names after the removal of the deprecated composing and splitting results functionality.
- Clean up the query runners: the type `QueryType` is defined only once and the `PromiseProvider` is not in an internal file; both are now defined at `ts-sql-query/queryRunners/QueryRunner`.
- Removed unnecessary abstract class `AbstractMySqlMariaDBConnection`.
- Simplify promise management in query runners.
- Implement GitHub actions for releasing.

**Removals**:

- Remove deprecated [sqlite](https://www.npmjs.com/package/sqlite) support and query runner.
- Remove deprecated [mysql](https://www.npmjs.com/package/mysql) support and query runner.

**v1 changes**:

The following releases in v1 are included:

- v1.66.0 (14 Jun 2025)
- v1.65.0 (24 Aug 2024)
- v1.64.0 (18 Apr 2024)
- v1.63.0 (20 Mar 2024)
- v1.62.0 (10 Mar 2024)

## v2.0.0-alpha.2 (2 Mar 2024)

**Removals**:

- Remove deprecated `mergeType` additional utility type. Use `connection.dynamicBooleanExpressionUsing` instead.
- Remove deprecated composing and splitting results functionality long warned to be removed in `ts-sql-query`. Use complex projections or aggregate as an object array instead.

**v1 changes**:

The folowing releases in the v1 are included:

- v1.61.0 (2 Mar 2024)

## v2.0.0-alpha.1 (2 Mar 2024)

**Removals**:

- Remove deprecated [any-db](https://www.npmjs.com/package/any-db) support and query runner.
- Remove deprecated [LoopBack](https://loopback.io/) support and query runner.
- Remove deprecated [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) support and query runner.
- Remove deprecated [tedious](https://www.npmjs.com/package/tedious) support and query runner. Tedious still available using [mssql](https://www.npmjs.com/package/mssql).
 - Remove deprecated [Prisma](https://www.prisma.io)'s short-running transactions support. Prisma's long-running transactions remain supported.
- Remove deprecated connections with extended types: `TypeSafeMariaDBConnection`, `TypeSafeMySqlConnection`, `TypeSafeNoopDBConnection`, `TypeSafeOracleConnection`, `TypeSafePostgreSqlConnection`, `TypeSafeSqliteConnection`, `TypeSafeSqlServerConnection`.
- Remove `ts-extended-types` dependency.
- Remove deprecated `stringInt` and `stringDouble` column types in favour of `customInt` and `customDouble`.
- Remove long-deprecated functions:
  
    | Removed deprecated name    | Current name       |
    | -------------------------- | ------------------ |
    | `smaller`                  | `lessThan`         |
    | `smallAs`                  | `lessOrEquals`     |
    | `larger`                   | `greaterThan`      |
    | `largeAs`                  | `greaterOrEquals`  |
    | `mod`                      | `modulo`           |
    | `lower`                    | `toLowerCase`      |
    | `upper`                    | `toUpperCase`      |
    | `ltrim`                    | `trimLeft`         |
    | `rtrim`                    | `trimRight`        |
    | `replace`                  | `replaceAll`       |
    | `replaceIfValue`           | `replaceAllIfValue`|

- Remove long-deprecated overload of functions in columns that allowed to send to the database null values in TypeScript when the type were optional.

**Base point**: v1.60.0 (25 Feb 2024)

## v1.68.0 (14 Jun 2026)

**Changes**:

- Deprecate `greaterOrEquals`, `greaterOrEqualsIfValue`, `lessOrEquals` and `lessOrEqualsIfValue` due to a typo in their names; use `greaterOrEqual`, `greaterOrEqualIfValue`, `lessOrEqual` and `lessOrEqualIfValue` instead.
- Deprecate `substract` due to a typo in its name; use `subtract` instead.
- Deprecate `insesitiveCollation` due to a typo in its name; use `insensitiveCollation` instead.
- Deprecate providing the constraint name as a string or an expression in insert on conflict on constraint because it was not working; provide a raw fragment with the constraint name instead.

## v1.67.0 (18 Jun 2025)

**Changes**:

- Allow manipulating the values to update in all update cases.

## v1.66.0 (14 Jun 2025)

**Changes**:

- Deprecate `SqliteQueryRunner` due [sqlite](https://www.npmjs.com/package/sqlite) project is dead.
- Deprecate `MySqlQueryRunner` & `MySqlPoolQueryRunner` due [mysql](https://www.npmjs.com/package/mysql) project is dead.

**Documentation changes**:

- The upcoming version 2 of ts-sql-query is cooking! A completely new documentation portal is already available for preview: [Take a look](https://ts-sql-query.readthedocs.io/en/latest/).

## v1.65.0 (24 Aug 2024)

**Changes**:

- Add support for transaction metadata that allows sharing of information across the application within a transaction.

## v1.64.0 (18 Apr 2024)

**Changes**:

- Add support for `aggregateAsArrayDistinct` and `aggregateAsArrayOfOneColumnDistinct` to allow aggregate as array distinct values.
- LoggingQueryRunner: Use performance.now() in non-Node environments.

## v1.63.0 (20 Mar 2024)

**Bug fixes**:

- Fix insert multiple no-inserting records when `setForAllIfHasNoValue` is called and the records to insert contain a single record.

## v1.62.0 (10 Mar 2024)

**Changes**:

- Add support for custom reusable SQL fragments that the returning value can be optional or required depending on the provided arguments.

## v1.61.0 (2 Mar 2024)

**Changes**:

- Deprecate composing and splitting results functionality long warned to be removed in `ts-sql-query`. Use complex projections or aggregate as an object array instead.
- Deprecate `mergeType` additional utility type. Use `connection.dynamicBooleanExpressionUsing` instead.

## v1.60.0 (25 Feb 2024)

**Changes**:

 - Allow using `notEqualsInsensitive` in dynamic filters previously not included in the white list of allowed functions.
- Deprecate Tedious and MsNode query runners in favour of mssql. 
- Deprecate Prisma's short-running transactions support.
- Deprecate `stringInt` and `stringDouble` in favour of `customInt` and `customDouble`.
- Deprecated database connections with extended types: `TypeSafeMariaDBConnection`, `TypeSafeMySqlConnection`, `TypeSafeOracleConnection`, `TypeSafePostgreSqlConnection`, `TypeSafeSqliteConnection`, `TypeSafeSqlServerConnection`.

## v1.59.0 (18 Feb 2024)

**Changes**:

- Add support for more custom types: `customInt`, `customDouble`, `customUuid`, `customLocalDate`, `customLocalTime`, `customLocalDateTime`.
- Add the possibility to get some metadata regarding the query execution in a query runner: The query execution stack, information about the function that initiated the query execution, whether the query is a count query in a paginated select, and the ability to specify both an execution name and additional execution metadata.

**Documentation changes**:

- Improve documentation, making the simplified type definition more explicit.

## v1.58.0 (28 Jan 2024)

**Changes**:

- Add support for complex projections in compound select (`union`, `intersect`, etc.)

**Bug fixes**:

- Fix missing `with` in compound select queries (`union`, `intersect`, etc.)

## v1.57.0 (5 Jan 2024)

**Changes**:

 - Allow deferring the execution of a logic till just before the transaction's commit.
 - Add support for executing the queries using an [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md) in Web Assembly.

## v1.56.0 (28 Aug 2023)

**Bug fixes**:

- Fix `inIfValue` and `notInIfValue` forcing include the optional join when it is not required.
- Fix subquery used as boolean value in a sql fragment when it is not on SqlServer or Oracle databases.

## v1.55.0 (27 Aug 2023)

**Changes**:

 - Add support for projecting optional values in an object as nullable in the output of select, insert, update, delete and aggregate array. This makes the optional property required, but nullable, in the projected value.

**Documentation changes**:

- Reorganize documentation to put select related documentation next to each other.
- Updating mkdocs, code highlight.
- Including Google search functionality complementary to the build-in search.
- Change log excluded from the search output.
- Improve build-in search.
- Move "Composing recursive query as an array of objects in two requests" documentation to the "Composing and splitting results (legacy)" page.

**Bug fixes**:

- Fix the error indicating there is no transaction active when `executeConnectionConfiguration` is executed before any other query immediately after opening a transaction.

## v1.54.0 (27 Jun 2023)

**Changes**:

- Deprecate AnyDB, LoopBack and tedious-connection-pool query runners due their respective projects are dead.
- Implement `executeConnectionConfiguration` in the query runner, allowing you to execute raw queries that modify the connection configuration.
- MariaDB and MySql don't support nested transactions, but instead of throwing an error, it silently finishes the previous one; when this circumstance is detected, an error with be thrown to avoid dangerous situations.
- Add support for `beforeQuery` custom SQL fragment when queries are customized.

**Documentation changes**:

- Update tedious query runner documentation to don't use tedious-connection-pool and add a note requesting information to the users to explain how to use it with a proper pool.
- Mark compose and split functionality as legacy with the intention to be deprecated in the future. Documentation of this functionality moved to a single place.

## v1.53.0 (11 Apr 2023)

**Changes**:

- Allow extend the rules in a dynamic condition to provide own rules not included by `ts-sql-query`
- Ensure tall types returned by `dynamicCondition` are readable

**Bug fixes**:

- Fix missing rules for comparison in the type created using `DynamicCondition` when the database types are used
- Fix invalid cast using `fromRef` not reported by the typescript (now you will get a compilation error)
- Fix `dynamicPickPaths` not picking the inner properties
- Fix left join property marked as optional when it is used in a complex projection and with dynamic picking columns

## v1.52.0 (10 Apr 2023)

**Changes**:

- Add support `dynamicPickPaths` to work with a list of fields to pick, and implement `expandTypeFromDynamicPickPaths` utility function to rectify the query output when the list of fields to pick is a generic type (Previously experimental)
- Implement insert/update shape that allows controlling the structure of the object to use to set the value (Previously experimental in update)
- Add support for update multiple tables in a single update in MariaDB and MySql (Previously experimental)
- Add support for Oracle recursive queries using `connect by` syntax
- Extend utility types and functions to filter by the id columns
- Add `PickValuesPath` utility function that allows getting the result of a select query given the fields to pick picked paths
- Extend the `DynamicCondition`, allowing to use fields of the dynamic condition as an argument
- Add `PickValuesPathWitAllProperties` utility type that allows getting the type of each element returned by a select picking columns
- Extend `SelectedValues` and `SelectedRow`, allowing to use of complex projections
- Implement `selectCountAll()` as a shortcut to `selectOneColumn(connection.countAll())` that doesn't return an optional value when the query is used as an inline value (removing in this way the current limitation)
- Add support for order by a column not returned by the select (removing in this way the current limitation)
- Allow `ignoreIfSet` over a required property in an insert
- Add `keepOnly` method that allows filtering the columns to be set in an insert or update
- Allow the dynamic set to receive as an argument the initial values to set
- Add support for dynamic set on an insert with multiple rows (removing in this way the current limitation)
- Add support for throw an error if some columns are set or have value in an insert or update. New methods in insert and update: `disallowIfSet`, `disallowIfNotSet`, `disallowIfValue`, `disallowIfNotValue`, `disallowAnyOtherSet`
 - Add support for conditional data manipulation in insert and update operations
- Allow the insert do `dynamicSet` or `dynamicValues` using an object where a required property is optional

**Documentation changes**:

- Document how to define select picking functions in base on the business types or in base on the database types
- Add documentation regarding data manipulation in insert/update. Before, it was not clear this functionality existed because it was only mentioned in the supported operations

**Bug fixes**:

- Fix `expandTypeFromDynamicPickPaths` (Previously experimental) to work with all kinds of output produced when a query is executed
- Make dynamic pick columns work with complex projections in case a property with a group with several columns is not picked

## v1.51.0 (23 Mar 2023)

**Bug fixes**:

- Fix infinite loop by discovering the optional joins used in the query
- Fix infinite recursive function call in `ChainedQueryRunner` for the `execute` method

**Internal changes**:

- Add support for run all the tests natively in Apple M1 except for loopback and oracle
- Add support for run oracle tests in an x86 emulated docker and using node running under rosetta

## v1.50.0 (6 Mar 2023)

**Bug fixes**:

- Fix `valueWhenNull` in SqlServer
- Major rework on custom booleans to fix several bugs

## v1.49.0 (19 Feb 2023)

**Changes**:

- Add utility types `UpdatableOnInsertConflictRow` and `UpdatableOnInsertConflictValues` to represent updatable values in case of conflict on insert

**Experimental changes**:

- Implement `dynamicPickPaths` to work with a list of fields to pick, and implement `expandTypeFromDynamicPickPaths` utility function to rectify the query output when the list of fields to pick is a generic type
- Implement update's `shapeAs` that allow controlling the structure of the object to use to set the value
- Implement update multiple tables in a single update in MariaDB and MySql

**Bug fixes**:

- Fix boolean value binding for Oracle
- Fix worng count in a select page query when the distinct modifier is used

## v1.48.0 (16 Jan 2023)

**Bug fixes**:

- Fix typo in generated sql when the `sqrt` function is used
- Fix internal error when an empty array is provided in a `in` or `notIn` methods in Sqlite, MariaDB and MySql

**Documentation changes**:

- Fix typo (confict → conflict)
- Mention term "upsert" for easier discoverability

## v1.47.0 (15 Dec 2022)

**Bug fixes**:

- Fix wrong count on `executeSelectPage` when a `groupBy` is used

## v1.46.0 (15 Dec 2022)

**Changes**:

- Add `onlyWhenOrNull` and `ignoreWhenAsNull` methods that allows to create an expression that only applies if a certain condition is met; otherwise, the value will be null

**Bug fixes**:

- Fix error in type definition introduced in `ts-sql-query` 1.42.0 that make optional properties appears as required in the query result due an over relaxed validation

## v1.45.0 (14 Dec 2022)

**Changes**:

- Allow to use `dynamicPick` over tables and views past as parameter to a function
- Improve `dynamicPick` to work with columns coming from other `dynamicPick` and to work with complex projections
- Improve `extractColumnsFrom` and `extractWritableColumnsFrom` to receive a second optional argument with the properties to exclude
- Add utilities functions `extractColumnNamesFrom` and `extractWritableColumnNamesFrom` that allows to get the column names from a table or view

**Documentation changes**:

- Add to the FAQs ts-sql-codegen that allows to generate the tables/views models from the database

**Internal changes**:

- Improve Github CI to remove some deprecated warning and include Node 18.x in the tests

## v1.44.0 (13 Dec 2022)

**Changes**:

- Add `beforeWithQuery` and `afterWithQuery` select query customizations
- Add utility types to allow pass tables and views as parameter

**Documentation changes**:

- Add FAQs & limitations section to the documentation 
- Document select queries that references outer tables

## v1.43.0 (6 Dec 2022)

**Changes**:

- Add support for [porsager/postgres](https://github.com/porsager/postgres) (aka postgres.js)

## v1.42.0 (5 Dec 2022)

**Changes**:

- Relax utility types to allow use in partial objects. This allows using `Omit` or `Pick` in combination with the utility types. Example: `type PickValues<COLUMNS, KEYS extends keyof COLUMNS> = SelectedValues<Pick<COLUMNS, KEYS>>;`

## v1.41.0 (27 Nov 2022)

**Changes**:

- Implement `nullIfValue` function that returns null when the provided value is the same otherwise return the initial value
- Add support for values construction that allows to create a "view" for use in the query with a list of constant provided values
- Add support for param placeholder customisation, allowing to include type cast in the generated sql query for the param

**Documentation changes**:

- Fix DBConnection typo in examples and documentation

**Bug fixes**:

- Fix internal error when optional joins are used in a select page query
- Fix internal error when `join(...).on(...).and/or` pattern is used
- Fix wrong month number sent to the database when a text representation of the date is used in Sqlite
- Fix `getMonth` method returning wrong value (The returning value must follow JS's Date definition) in PostgreSQL, Sqlite, MariaDB, MySQL, Oracle and SqlServer
- Fix `getSeconds`, `getMilliseconds` over a date/time in Oracle
- Fix `getDay`, `getSeconds`, `getMilliseconds` and `getTime` over a date/time in Oracle

## v1.40.0 (30 Oct 2022)

**Bug fixes**:

- Fix missing parenthesis in a subtraction of a subtraction

## v1.39.0 (21 Oct 2022)

**Changes**:

- Add support for the `returning` clause in MariaDB in `insert` and `delete` (`update` not supported yet by MariaDB)
- Add support for Prisma 4

## v1.38.0 (29 Sep 2022)

**Bug fixes**:

- Fix select page count when a group by is used

## v1.37.0 (23 Sep 2022)

**Changes**:

- Implement `allowWhen` and `disallowWhen` that throws an error if the expression is used in the final query

**Documentation changes**:

- Fix copy&paste on update documentation refering delete

**Bug fixes**:

- Fix `minValue` and `maxValue` returning wrong value
- Fix missing `with` query when a query in a `with` clause depends on another `with` query

## v1.36.0 (31 Aug 2022)

**Bug fixes**:

- Fix invalid uuid type in a reusable fragment

## v1.35.0 (29 Aug 2022)

**Bug fixes**:

- Fix wrong return type of `min` and `max` functions in the connection

## v1.34.0 (17 Aug 2022)

**Changes**:

- Add `valueWhenNoValue` function that allows to return a value when null or undefined were provided to the *IfValue function

## v1.33.0 (16 Aug 2022)

**Bug fixes**:

- Fix "Invalid double value received from the db" when the database send a number as string with trailing 0

## v1.32.0 (15 Aug 2022)

**Changes**:

- Implement `onlyWhen` and `ignoreWhen` function that allows ignoring a boolean expression under a condition
- Add support for virtual columns on tables and views
- Implement the types `InsertableValues`, `UpdatableValues` and `SelectedValues` that allows to get the types for an insert, update and select with the proper types defined in the table without the other sql objects

## v1.31.0 (8 Aug 2022)

**Bug fixes**:

- Fix misspelling in `left outer join`

## v1.30.0 (21 Jul 2022)

**Bug fixes**:

- Fix optional join not omitted when an `IfValue` is used and there is no value

## v1.29.0 (28 Jun 2022)

**Changes**:

- Export helper types in extras to retrieve row types when insert, update and select
- Include timestamps in `LoggingQueryRunner` callbacks
- Make the `ConsoleLogQueryRunner` more configurable so that it can output results, timestamps and durations as well

**Bug fixes**:

- Fix insert default values on TypeScript 3.5 or higher
- Unable to compile `ts-sql-query` with TypeScript 4.7

## v1.28.0 (23 May 2022)

**Changes**:

- Add compatibility mode to MySql to avoid use the with clause not supported by MySql 5
- Add support for reference current value and value to insert in an insert on conflict do update

## v1.27.0 (11 Apr 2022)

**Documentation changes**:

- Add the insert on conflict methods to the supported operation documentation page

**Bug fixes**:

- Fix TS4029 error when you need to emit the type definition (for use in a library) of the files that contains the database, tables and views
- Avoid database connection leaks due a forbidden concurrent usage of a pooled query runner

## v1.26.0 (20 Mar 2022)

**Changes**:

- Add support for "insert on conflict do nothing" and "insert on conflict do update" on PostgreSql, Sqlite, MariaDB and MySql
 - Add support for specifying raw SQL fragments in the ORDER BY clause, allowing complex ordering in select queries
- Allow insert, update and delete in raw sql fragments

**Documentation changes**:

- Add a demo video to the documentation

**Bug fixes**:

- Fix infinite instantiation in newer versions of TypeScript

## v1.25.0 (9 Jan 2022)

**Changes**:

- Implements `forUseAsInlineAggregatedArrayValue` function, that allows to transform a query in create an array value of a single column (if it is single-column query), or an object where the rows are represented as an object
- Implements `aggregateAsArray` aggregation function, that allows to create an value that contains, per each row, an array of a single column, or an array with several columns represented as an object
- Add support for the `uuid` type
- Add support for `orderByFromStringIfValue`, `limitIfValue` and `offsetIfValue`
- Add support for subqueries that contains with clause with external/contextual dependencies
- Add support for compose over optional properties
- Add support for `withOptionalMany` composing rule that allows to use undefined instead of an empty array when no value
- Detect invalid queries in SqlServer, Oracle and MariaDB when an outer reference is used to create a query that is not supported by the database because no outer references are allowed in inner with, or, in MariaDB, no outer references are allowed in inner from
- Combine multiple concat expressions in a single concat function call in MySql and MariaDB

**Documentation changes**:

- Add a note in the `mergeType` function documentation warning about the reader evaluate the preferred alternatives first

**Bug fixes**:

- Fix invalid query when a table alias is specified in Oracle
- Fix invalid recursive query in Sql Server
- Fix invalid recursive query in Oracle
- Fix invalid query when `contains` method of a string value source is called in MySql/MariaDB
- Fix `substrToEnd`, `substringToEnd`, `substr` and `substring`: now the index is according to JavaScript definition (the count start in 0) and the parameters have the correct type
- Fix invalid type when a mathematical function is used and the provided value is not the same type that the column

## v1.24.0 (21 Dec 2021)

**Changes**:

- Manage complex projections in compound operations (union, intercept, etc.)
- Ensure the dynamic conditions cannot create conditions when null/undefined values are provided to functions that doesn't expect it
- Detect when null/undefined values are provided to an operation with a value coming from a left join where a not null/undefined value must be provided
 - Deprecate all value source methods overload that can produce unexpected falsy/null values because the provided value in JavaScript is null or undefined. Now all value source methods doesn't admit null or undefined values (except the `*IfValue`, `is`, `isNot` methods). In the odd case you need to use a nullable value from JavaScript, and you want to maintain the falsy/null output use an optional constant with the JavaScript value
 - Add support for the methods `trueWhenNoValue` and `falseWhenNoValue` to allow specifying a boolean value when the `*IfValue` function produces no value. This can help to manage optional values coming from JavaScript in complex logic without need to use the deprecated methods that can produce unexpected falsy/null values
 - Allows negating the result of a `*IfValue` function
- Improve boolean expression reduction when the negate method is used
- Detect invalid columns to be returned in a select (non-string key)

**Preview of upcoming changes**:

- Implements `aggregateAsArray` aggregation function, that allows to create an value that contains, per each row, an array of a single column, or an array with several columns represented as an object
- Add support for subqueries that contains with clause with external/contextual dependencies

**Documentation changes**:

- Clean up `sync` helper function to handle synchronous promises in BetterSqlite3 with a stricter typing and better readability

**Bug fixes**:

- Ensure any boolean operation apply over a boolean created using `dynamicBooleanExpressionUsing` is asignable to the initial type
- Fix invalid result type of calling `asOptional` or `asRequiredInOptionalObject` when the type is different to `int`
- Fix BetterSqlite3 implementation that returns a real promise instead of a synchronous promise when there is no columns to set

## v1.23.0 (8 Dec 2021)

**Changes**:

- Add support for complex projections, that allows to create inner objects in the result of a query
- Detect invalid query when a table in the from of an update appears in the returning clause in sqlite. Now it verify the restriction 7 of the returning clause in Sqlite
- Add support for Prisma 3
- Add support for the interactive transactions in Prisma

**Documentation changes**:

- Add test strategy information

**Bug fixes**:

- Fix MariaDB/MySql `stringConcat` when an empty separator is used

## v1.22.0 (24 Oct 2021)

**Changes**:

- Deprecate `replace` method in favour of `replaceAll` in the string value source to align with JavaScript
- Add the `substr` and `substrToEnd` to the string value source to align with JavaScript and respect the real available implementation in the databases
- Add support for create complex dynamic boolean expression using the `dynamicBooleanExpresionUsing` method in the connection object. It allows to create programmatically dynamically complex boolean expressions instead of declarative dynamically conditions using the `IfValue` functions. It is recommend to use the `IfValue` functions when it is possible
- Add `mergeType` utility function to deal with advanced dynamic queries when a variable ended with type a union of several types of value source. This function allows to resolve the union type in a single value source type

**Documentation changes**:

- Combine all topics related to dynamic queries in a single page to avoid confusion
- Improve documentation style

**Bug fixes**:

- Fix broken `substring` implementation in the string value source

## v1.21.0 (22 Oct 2021)

**Changes**:

- Added a new general query runner: InterceptorQueryRunner

**Bug fixes**:

- Fix error lost that was throw by a logger in a LogginQueryRunner

## v1.20.0 (14 Oct 2021)

**Changes**:

- Add support for scalar queries, that is an inline select query as value for another query
- Add support for insert returning on databases that support it (PostgreSql, SqlServer, Oracle, modern Sqlite)
- Add support for update returning on databases that support it (PostgreSql, SqlServer, Oracle, modern Sqlite)
- Add support for update returning old values on databases that support it (SqlServer)
- Add support for update returning old values on databases where it can be emulated in a single query (PostgreSql)
- Add support for delete returning on databases that support it (PostgreSql, SqlServer, Oracle, modern Sqlite)
- Add support for use more tables or views in an update (from clause) 
- Add support for use more tables or views in a delete (using clause)
- Add support for use more tables or views in an update returning old values on databases that support it (SqlServer)
- Add support for use more tables or views in an update returning old values on databases where it can be emulated in a single query (PostgreSql)
- Improve error detection to identify misuse of values that have different columns types with same TypeScript type (like date and time)
- Improve min and max limit verification on insert

**Bug fixes**:

- Fix `selectOneColum` result type on complex objects (like Date)

## v1.19.0 (7 Oct 2021)

**Changes**:

- Add support for numeric date/time in Sqlite that is expressed as bigint in JavaScript by the database connector (By example, using `defaultSafeIntegers` option in BetterSqlite3)

**Bug fixes**:

- Fix typo in Sqlite `treatUnexpectedStringDateTimeAsUTC` connection option (wrongly named: `treatUxepectedStringDateTimeAsUTC`)
- Fix typo in Sqlite `unexpectedUnixDateTimeAreMilliseconds` connection option (wrongly named: `uxepectedUnixDateTimeAreMilliseconds`)

## v1.18.0 (6 Oct 2021)

**Changes**:

- Manage the errors coming from the deferred execution logic till the end of a transaction, after commit or rollback. Now all deferred logic will be executed even if one of them throw an error. All errors thrown by the deferred logic will be collected and combined in one single error that will be thrown after the commit or rollback is executed
- Manage the errors coming from the deferred execution logic till the end of a transaction, after commit or rollback. Now all deferred logic will be executed even if one of them throws an error. All errors thrown by the deferred logic will be collected and combined in one single error that will be thrown after the commit or rollback is executed

**Bug fixes**:

- Fix invalid high level transaction management when the commit fails. The transaction was not rolled back when the commit fails
- Fix connection released too early due when the commit fails in a pooled query runner
- Don't fire the deferred functions when rollback when the commit fails; when this happens the transaction is still ongoing

## v1.17.0 (5 Oct 2021)

**Changes**:

- Implements `Unix time milliseconds as integer` date/time strategy for sqlite that allows to store dates & times in UNIX time as milliseconds
- MockQueryRunner create the output param for oracle in the same way this database expect it
- Add support for deferring execution logic using async functions till the end of a transaction, after commit or rollback

**New examples**:

- Add a running mocked version of the examples in the documentation per each supported database

**Internal changes**:

- Add code coverage report

**Bug fixes**:

- Fix deferring logic execution till the end of transaction in case of multiple nested transaction with multiple deferred logic but not in the middle of the nesting transaction

## v1.16.0 (4 Oct 2021)

**Changes**:

- Add support for deferring execution logic till the end of a transaction, after commit or rollback

**Internal changes**:

- Introduce ts-node to run the examples

**Bug fixes**:

- Fix sqlite compatibility mode by default (regression introduced in the previous release)
- Fix oracle example due oracle instant client not loading and throwing error when the oracle driver is initialized

## v1.15.0 (3 Oct 2021)

**Changes**:

 - Allows you to use previously created properties in split/compose
- Add support for Date and Time management in sqlite using different strategies to represent the value (sqlite doesn't have dedicate types to represent dates and time). The implemented strategies are aligned with the date time support in sqlite allowing to store the information as text (in the local timezone or UTC), as integer (in unix time seconds) or as a real value (in Julian days)
- Align method names with convention, where `ts-sql-query` tries to use well known method names, giving preferences to already existing names in JavaScript, o well known function names in SQL, avoiding abbreviations. Methods with new names (Previous names are still available as deprecated methods):

    | Previous name              | New name           |
    | -------------------------- | ------------------ |
    | `smaller`                  | `lessThan`         |
    | `smallAs`                  | `lessOrEquals`     |
    | `larger`                   | `greaterThan`      |
    | `largeAs`                  | `greaterOrEquals`  |
    | `mod`                      | `modulo`           |
    | `lower`                    | `toLowerCase`      |
    | `upper`                    | `toUpperCase`      |
    | `ltrim`                    | `trimLeft`         |
    | `rtrim`                    | `trimRight`        |

- Change some internal type names to improve the readability of the type name in the IDE and in error messages
- Implement the compatibility mode on sqlite (enabled by default). When is disabled allows to take advantages of the newer syntax in sqlite. Right now only prisma and better sqlite includes an sqlite compatible
- Now is possible create an insert from a select o with multiples values that returns the last inserted id if a compatible sqlite with the returning clause is used
- Now is possible create an insert from a select that returns the last inserted id if a compatible sqlite with the returning clause is used
- Ensure the MockQueryRunner returns a number when the mock function return no value when an insert, update or delete is executed
- Detect invalid results from the mock function returned to the MockQueryRunner
- Add support for mock the call to the method `isTransactionActive`

**Documentation changes**:

- Add example of MockQueryRunner usage to the documentation
- Document how to run the examples

**Internal changes**:

- Changes to make happy TypeScript 4.4 and avoid error messages
- Set up GitHub CI

**Bug fixes**:

- Fix type returned by a table or view customization when the original table or view has alias

## v1.14.0 (23 Aug 2021)

**Changes**:

- Add utility functions that allow to create a prefix map for a guided split taking as reference another object with columns, marking as required the same keys that have a required column in the reference object

**Bug fixes**:

- Fix invisible characters included in the prefixed property names in the prefix utility functions

## v1.13.0 (22 Aug 2021)

**Changes**:

- Add more options to organize the select clauses, making in this way easier to create functions that return queries partially constructed. The where clause can be postponed until the end of the query, before the query execution
- Add support for queries that use orderBy, limit, offset inside of a compound operator (like union, intersect). With this change now it is possible to use a limit in the inner query, not only in the outer one with the compound operator
- Implement insert default values query customization on MySql/MariaDB
- Increase the flexibility of a select from no table, allowing all the clauses supported by a select (outside the from definition)
- Add utility function that allows extracting all columns from an object (like table or view) that enables to write a select all columns
- Add utility functions that allow to deal with situations when a prefixed copy of a list of columns is required to use multiple columns with the same name in a select; complementary functions to help split back in a select the prefixed columns are also included

**Bug fixes**:

- Fix invalid order by of a compound query in Oracle. When a compound operator (union, intersect, ...) is used, Oracle requires to use the positional notation instead of the name of the columns
- Fix invalid subquery in SqlServer that contains an order by. In SqlServer subqueries with an order by must always include an offset

## v1.12.0 (19 Aug 2021)

**Changes**:

- Add support for undefined elements in the and/or array of a dynamic condition

**Bug fixes**:

- Fix undefined not treated as absence of value in `IfValue` conditions

## v1.11.0 (16 Aug 2021)

**Documentation changes**:

- Fix missing parent definition in the "Splitting the result of a left join query" example of the documentation

**Bug fixes**:

- Fix error when composition or splitting are use in a select with `executeSelectNoneOrOne` and the result is null

## v1.10.0 (30 Jul 2021)

**Changes**:

- Implement guided splitting to help handle the splitting situation originated by a left join when the optionality of the moved properties are not correct due to known null rules that are not able to be extracted by `ts-sql-query` from the query

**Documentation changes**:

- Documented error for method `executeSelectNoneOrOne`

**Bug fixes**:

- Fix constraint violation when a left join return null on a column that originally was marked as required

## v1.9.0 (28 Jul 2021)

**Changes**:

- Add utilities methods to insert and update operations that helps to deal with columns that were prepared to set with no value (null, undefined, empty string, empty array): `setIfHasValue`, `setIfHasValueIfValue`, `setIfHasNoValue`, `setIfHasNoValueIfValue`, `ignoreIfHasValue`, `ignoreIfHasNoValue`, `ignoreAnySetWithNoValue`

**Bug fixes**:

- Fix wrong result of `isTransactionActive` in connections that potentially can nest transaction levels

## v1.8.0 (26 Jul 2021)

**Documentation changes**:

- Make more clear and visible the warning about sharing the connection between HTTP requests.

**Bug fixes**:

- Fix invalid query when an insert or update contains additional properties not precent in the table (that must be ignored)

## v1.7.0 (23 Jul 2021)

**Changes**:

- Implement `isTransactionActive` method at the connection object that allows to know if there is an active open transaction in `ts-sql-query`
 - Allows you to use objects with the values in an insert or update that contain additional properties not present in the table that will be ignored. This change makes the behavior coherent with the TypeScript compiler.

**Bug fixes**:

- Fix transaction management when a ts-sql-connection connection from a pool is reused, started a transaction, but no query is executed.
- Fix select result on non-strict mode, making the best approximation to have an usable result (but loosing the optional property information)

## v1.6.0 (12 Jun 2021)

**Changes**:

- Allows to use complex names in different places like the column alias (name of the property in the result object of a select)
- Allow a dynamic select picking the columns
- Handle splitting with select picking columns
- The `split` method automatically determines if the created property is required or optional
- Added `splitRequired` splitting method
- Add support for optional joins in a select picking columns
- Add support for table "from" customization, allowing to include raw sql to use features not supported yet by `ts-sql-query`
- Add support for select query customizations
- Add support for update query customizations
- Add support for delete query customizations
- Add support for insert query customizations

**Documentation changes**:

- Document about how to deal with splitting result and dynamic queries
- Add column types section in the documentation

**Bug fixes**:

- Ensure insert multiple can generate the with clause
- Add support for with clause on insert queries on databases that doesn't support a global with on insert (oracle, mysql, mariadb)
- Fix invalid insert default values query on oracle

## v1.5.0 (3 Jun 2021)

**Changes**:

- Add support for custom array types
- Add support for globally encrypted id
- Big refactor to simplify the query runners implementation
- Dropped support for very old better-sqlite3 versions (6 or before)
 - Allow using returning clause on sqlite and mariadb in a sql text query executed directly with the query runner

**Documentation changes**:

- Implements new documentation website using mkdocs and readthedocs.io, available at: [https://ts-sql-query.readthedocs.io/](https://ts-sql-query.readthedocs.io/)
- Add transaction documentation
- Document security constraint regarding update and delete with no where
- Add select with left join example to the documentation

**Distribution changes**:

 - Source maps are no longer included

**Bug fixes**:

- Fix insert from select returning last inserted id
- Fix invalid in queries when the in function didn't receives an array of values

## v1.4.0 (23 May 2021)

**Changes**:

- Add support for create dynamic conditions where the criteria is defined at runtime. This allows to have a select with a where provided by an external system.
- Implements compound operator (`union`, `intersect`, `except`) on select expressions.
- Allows `executeSelectPage` on select with `group by`
- Allows insert from select returning last inserted id in PostgreSql and Sql Server
- Extends the possibility of a select query to change the shape of the projected object allowing move some property to an internal object (split) or combine the result with a second query string the value as a property of the first one (compose)
- Add support for recursive select queries

**Bug fixes**:

- Fix `startsWith` and `endsWith` misspelling

## v1.3.0 (9 May 2021)

**Changes**:

- Add the transaction method to the connection to make easier deal with transactions at high level
- Add Prisma support

**New examples**:

- Add MariaDB example using prisma for the connection
- Add MySql example using prisma for the connection
- Add PostgreSql example using prisma for the connection
- Add Sqlite example using prisma for the connection
- Add SqlServer example using prisma for the connection

## v1.2.0 (3 May 2021)

**Changes**:

- Implements LoggingQueryRunner

**Documentation changes**:

- README improvements
- Include optionalConst connection method in the documentation

## v1.1.0 (9 Mar 2021) 

**Changes:**

- Implements SQL with clause that allows using a select as a view in another select query.
- Rework insensitive comparison to allow use collations instead of the lower function; allowing in that way make comparison case insensitive and accent insensitive.
- Implements insensitive order by extension.
- Rework boolean management to support databases that don't have boolean data type (Sql Server and Oracle).
- Add support for custom boolean columns.
- Add support for execute better-sqlite3 queries synchronously.
- Add support for computed columns on tables.
- Add ID encrypter utility.

**Documentation changes:**

- Add documentation about how encrypt the IDs. 
- Add warning to the readme about sharing the connection between HTTP requests.
- Add warning about non-public files.
 - Add warning about table and views constructor arguments

**New examples:**

- Add Sqlite example using better-sqlite3 for the connection and synchronous queries.
- Add PostgreSql example using pg for the connection and encrypted primary/foreign keys.

**Bug fixes:**

- Fix mismatching column name when an uppercase character is used as column's alias on PostgreSQL. PostgreSQL lowercase the column's alias when it is not escaped; in consequence, an error was thrown because the column was not found.
- Fix some 'not' ignored during text comparison: notContainsInsensitive (on MySQL, MariaDB, Oracle, PostgreSQL, Sqlite, SqlServer), notEndWith (on Oracle, Sqlite, SqlServer)
- Fix some posible invalid order by in MySql, MariaDB, SqlServer and Sqlite.
- Fix invalid queries involving boolean operations in Sql Server and Oracle.
- Fix missing bigint cast for a value coming from the database when it is a number.

## v1.0.0 (30 Jan 2021)

First stable release!

See [1.0.0-beta.1 release notes](#v100-beta1-29-dec-2020)

**Bug fixes:**

- `setIfValue`, `setIfSetIfValue`, `setIfNotSetIfValue` when insert or update now have the same behaviour that any `*IfValue` function, respecting the configuration about treating an empty string as null value

## v1.0.0-beta.1 (29 Dec 2020)

**Changes:**

- Implements reusable fragments as functions using the `buildFragmentWithArgs` function with the `arg` and `valueArg` functions (all defined in the connection)
- Implements reusable fragments as functions that allow creating `*IfValue` functions using the `buildFragmentWithArgsIfValue` function with the `arg` and `valueArg` functions (all defined in the connection)
- Add support for the newest Better Sqlite 3 returning bingint
- Update all dependencies, and apply all required changes
 - Implements the method `execute` in the query runners to allow direct access to the database using the raw objects used to establish the connection
- Refactor how const values are handled. Now value source included two new methods:
    - `isConstValue(): boolean` that allows verify if it contains a const value
    - `getConstValue(): TYPE` that allows getting the value of a const value source (throw an error if it is not a const value source)
- Update the readme to include explanations about dynamic queries
- Add support for `bigint` column type
- Add examples section to the readme

**Braking changes:**

- Don't inline true or false values when they are defined with the const function. If you want a true or false value inlined use the `true()` and `false()` methods defined in the connection
- Rename `QueryRunner.getNativeConnection` as `getNativeRunner` to avoid confusion because this method doesn't return the connection in all the implementation (could be the pool)
- Big refactor to reduce the pressure on TypeScript type validations. **Breaking changes**:
    - Connections classes now only receive one generic argument with a unique name.
        - **Before**: `DBConnection extends PostgreSqlConnection<DBConnection, 'DBConnection'> { }`
        - **After**: `DBConnection extends PostgreSqlConnection<'DBConnection'> { }`
    - Tables and views now receive a second generic argument with a unique name.
        - **Before**: `class TCompany extends Table<DBConnection> { ... }`
        - **After**: `class TCompany extends Table<DBConnection, 'TCompany'> { ... }`
        - **Before**: `class VCustomerAndCompany extends View<DBConnection> { ... }`
        - **After**: `class VCustomerAndCompany extends View<DBConnection, 'VCustomerAndCompany'> { ... }`
- The value argument and the return type in the type adapters (including the default implementation in the connection) have now type `unknown`
- Trak if a value source is optional and validates if the result of executing a query return a value when it is expected. **Braking changes**:
    - A const with an optional value must be created using the new `optionalConst` function in the connection, previously was used the `const` function in the connection
    - The`is` function that allows comparing two values now returns a not optional boolean, previously it returned an optional value
- Dropped the method `NumberValueSource.asStringNumber`, use instead the new methods:
    - `NumberValueSource.asInt(): number`
    - `NumberValueSource.asDouble(): number`
    - `NumberValueSource.asStringInt(): number|string`
    - `NumberValueSource.asStringDouble(): number|string`
    - `StringNumberValueSource.asStringInt(): number|string`
    - `StringNumberValueSource.asStringDouble(): number|string`

**Internal changes:**

- Big refactor without change the public interface:
    - Use symbols for type marks instead of protected  fields
    - Use interfaces instead of abstract classes (allowed by the previous change)
    - Use import type when it is possible
    - Join all databases files in one file
    - Drop alternative implementations code not in use

**Bug fixes:**

- Fix invalid query when no value is provided to the function `concatIfValue`
- Fix invalid usage of `*IfValue` functions result, now typescript report an error when it happens
- Handle when the update has nothing to set, in that case, no update will be performed, and it returns 0 rows updated

## v0.17.0 (20 Apr 2020)

**Changes**:

- Implements LoopBack support for sqlite3, postgresql, mysql/mariadb, sql server and oracle
- Attach error information to beginTransaction, commit and rollback methods
- Add an option to run all examples
- Use the param placeholder defined in the query runner instead of redefined it in the sql builders
- Always use positional parameters in sqlite
- Refactor how is ensured that you are using a compatible query runner in a connection

## v0.16.0 (27 Mar 2020)

**Changes**:

- Implements insert from a select
- Implements custom comparable types
- Custom column type now includes in and not in operations

## v0.15.0 (6 Feb 2020)

**Changes**:

- Implements executeDatabaseSchemaModification in the query runner for all supported databases
- Make params optional in the query runners
- Add fake order by to allow have limit without order by in Sql Server like in other databases
- Change the way how a function is executed in Oracle. Now a select is executed
- Add warning of AnyDB for Sqlite is not working properly due a bug of any-db-sqlite3
- Add warning of AnyDB for Sql Server is not working properly due a bug of any-db-mssql
- Add warning: tedious-connection-pool is not working due a bug of tedious-connection-pool
- Update readme

**New examples**:

- Add PostgreSql example using pg for the connection
- Add SqlServer example using tedious for the connection
- Add SqlServer example using mssql with tedious for the connection
- Add PostgreSql example using AnyDB with pg for the connection
- Add SqlServer example using AnyDB (any-db-mssql) with tedious for the connection
- Add Oracle example using oracledb for the connection
- Add MySql example using mysql for the connection
- Add MySql example using mysql2 for the connection
- Add MariaDB example using mariadb for the connection
- Add MySql example using AnyDB with mysql for the connection
- Add Sqlite example using sqlite for the connection
- Add Sqlite example using sqlite3 for the connection
- Add Sqlite example using AnyDB with sqlite3 for the connection
- Add Sqlite example using better-sqlite3 for the connection

**Bug fixes**:

- Add missing executeInsertReturningMultipleLastInsertedId implementation
- Fix missing result when a executeSelectOneRow is executed with PgQueryRunner
- Fix select current value of a sequence in Sql Server
- Fix limit in Sql Server when offset is not provided
- Fix procedure and function call in Sql Server
- Fix missing result when an executeSelectOneRow is executed with AnyDBQueryRunner
- Fix executeInsertReturningLastInsertedId and executeInsertReturningMultipleLastInsertedId implementations for AnyDB
- Fix column alias in Oracle, the alias must be quoted in order to preserve the case. Unquoted alias are returned as uppercase.
- Fix missing result when a executeSelectOneRow is executed in Oracle
- Fix wrong result order when a insert multiple returning last inserted id is executed in Oracle
- Fix unhandled safe integer object used by better-sqlite3 when an executeFunction or executeSelectOneColumnOneRow query is executed


## v0.14.0 (31 Jan 2020)

**Changes**:

- Implements insert multiple values and allows to return the last inserted id for each one (this last one only for PostgreSql, SqlServer and Oracle)
- Add table of content to the readme

**Bug fixes**:

- Fix get output values in oracle
- Fix source stack (where the query was executed) added twice to the error stack
- Fix readme

## v0.13.0 (19 Jan 2020)

**Changes**:

- Add the possibility to disable the treatment of an empty string as null
- Escape reserved words when it is used as identifier
- When a select query references to two o more tables or view, the table or view name is used as the prefix of the column when no alias is provided. It avoid the query ambiguity when two columns from different sources have the same name (used in the query or not)

**Bug fixes**:

- Fix double cast when the value is coming from the database
- Allow NaN, Infinity and -Infinity in stringDouble when it is represented as string
- Fix localTime type name
- Fix localDate type name
- Fix int cast when the value is coming from the database
- Fix invalid sql in SqlServer
- Fix type information used by the query runners in sql server

## v0.12.0 (4 Oct 2019)

**Changes:**

 - Allows executing a selectOne over an optional column
- Don't allow to call "returningLastInsertedId" when an insert query is constructed for a table without autogenerated primary key

**Bug fixes:**

- Fix MySqlPoolQueryRunner name
- Make PoolQueryRunner not abstract
- Fix invalid result on MySql when a query that must returns one row is executed

## v0.11.0 (3 Oct 2019)

**Changes:**

- Implements more query runners that handles the connection pool directly
- Implements insert default values with a primary key generated by a sequence

**Bug fixes:**

- Fix wrong inference type caused because typescript drops the type of private fields
- Fix "Type instantiation is excessively deep and possibly infinite.ts(2589)" when the connection is TypeSafe

## v0.10.0 (19 Aug 2019)

Initial public release after a long time of internal development