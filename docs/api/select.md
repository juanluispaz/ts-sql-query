---
search:
  boost: 0.3
---
# Select API

This API defines how to construct SQL `SELECT` statements using a fluent interface in `ts-sql-query`. It supports filtering, ordering, pagination, grouping, and joining tables. It also provides support for compound and recursive queries, as well as integration with advanced features like [Oracle](../configuration/supported-databases/oracle.md)'s `CONNECT BY` or database-specific query customizations.

To learn how to write a select, see [Select](../queries/select.md), and for its parts, [Compound select](../queries/compound-select.md), [Aggregate functions, group by and having](../queries/aggregate-and-group-by.md), [Select page](../queries/select-page.md), [Recursive select](../queries/recursive-select.md), [Complex projections](../queries/complex-projections.md) and [Dynamic queries](../queries/dynamic-queries.md).

The select query definition must follow the logical order or the alternative order:

- **Logical order**: from, join, **WHERE**, **group by**, **having**, **select**, order by, limit, offset, customizeQuery
- **Alternative logical order 1**: from, join, **group by**, **having**, **WHERE**, **select**, order by, limit, offset, customizeQuery
- **Alternative logical order 2**: from, join, **group by**, **having**, **select**, **WHERE**, order by, limit, offset, customizeQuery
- **Alternative logical order 3**: from, join, **group by**, **having**, **select**, order by, **WHERE**, limit, offset, customizeQuery
- **Alternative logical order 4**: from, join, **group by**, **having**, **select**, order by, limit, offset, **WHERE**, customizeQuery
- **Alternative logical order 5**: from, join, **group by**, **having**, **select**, order by, limit, offset, customizeQuery, **WHERE**
- **Alternative order 1**: from, join, **select**, **WHERE**, **group by**, **having**, order by, limit, offset, customizeQuery
- **Alternative order 2**: from, join, **select**, **group by**, **having**, **WHERE**, order by, limit, offset, customizeQuery
- **Alternative order 3**: from, join, **select**, **group by**, **having**, order by, **WHERE**, limit, offset, customizeQuery
- **Alternative order 4**: from, join, **select**, **group by**, **having**, order by, limit, offset, **WHERE**, customizeQuery
- **Alternative order 5**: from, join, **select**, **group by**, **having**, order by, limit, offset, customizeQuery, **WHERE**

```typescript
interface SelectExpression {
    /** Adds a from to the select query */
    from(table: Table | View): this

    /** Adds a join to the select query */
    join(table: Table | View): this
    /** Adds an inner join to the select query */
    innerJoin(table: Table | View): this
    /** 
     * Adds a left join to the select query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Adds a left outer join to the select query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftOuterJoin(source: OuterJoinSource): this

    // Optional variants of the joins: the join is left out of the query when no column of it is used
    optionalJoin(table: Table | View): this
    optionalInnerJoin(table: Table | View): this
    optionalLeftJoin(source: OuterJoinSource): this
    optionalLeftOuterJoin(source: OuterJoinSource): this

    /** Creates the on clause of a join dynamically */
    dynamicOn(): this
    /** Specifies the on clause of a join */
    on(condition: BooleanValueSource): this

    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this
    
    /** Specifies the group by of the select query */
    groupBy(...columns: AnyValueSource[]): this
    /** 
     * Specifies the group by of the select query.
     * 
     * If you already defined the select clause, you can use the name of
     * the properties returned by the select instead of its definition: the
     * group by refers to that column of the select.
     * 
     * Note: this overload is only available if you define the select clause first.
     */
    groupBy(...columns: string[]): this
    /**
     * Groups by every column of the select that is not an aggregate and refers
     * to a table or view (constants are left out), each one referred to as a
     * column of the select, like groupBy('<column name>').
     * 
     * Note: only available if you define the select clause first.
     */
    groupByNonAggregatedColumns(): this
    /** Creates the having clause of the group by dynamically */
    dynamicHaving(): this
    /** Specifies the having clause of the group by */
    having(condition: BooleanValueSource): this
    /**
     * Creates the having clause using the columns of the select: the
     * function receives them (with the same shape as the select) and each one is
     * written as the same expression the select list computes, with the same
     * parameters (by its alias on MySQL and MariaDB).
     * 
     * Note: this overload is only available if you define the select clause first.
     */
    having(condition: (columns: SelectValues) => BooleanValueSource): this

    /** 
     * Specifies the select clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    select(columns: SelectValues): this
    /** Returns the optional values as null instead of optional undefined values. It can only be used immediately after select(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the select clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    selectOneColumn(column: AnyValueSource): this
    /** 
     * Specifies the select clause of a query that returns only one column with count(*).
     */
    selectCountAll(): this

    /** 
     * Specifies an order by. It receives the name of a column returned by the query
     * (if you select one column, its name is 'result'), a value source or a raw fragment.
     */
    orderBy(column: string, mode?: OrderByMode): this
    orderBy(column: AnyValueSource, mode?: OrderByMode): this
    orderBy(column: RawFragment, mode?: OrderByMode): this
    /** Specifies an order by dynamically, parsed from the provided string */
    orderByFromString(orderBy: string): this
    orderByFromStringIfValue(orderBy: string | null | undefined): this
    /** Specifies an order by dynamically, parsed from the provided array of clauses (each element is one order by clause) */

    /** Specifies the maximum number of rows returned by the query */
    limit(limit: number): this
    limitIfValue(limit: number | null | undefined): this
    /** Specifies the number of first rows ignored by the query */
    offset(offset: number): this
    offsetIfValue(offset: number | null | undefined): this

    // Oracle's connect by syntax, only available on Oracle
    startWith(condition: BooleanValueSource): this
    connectBy(condition: (prior: (column: AnyValueSource) => AnyValueSource) => BooleanValueSource): this
    connectByNoCycle(condition: (prior: (column: AnyValueSource) => AnyValueSource) => BooleanValueSource): this
    orderingSiblingsOnly(): this

    /** Extends the where, the on clause of a join, or the having clause using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where, the on clause of a join, or the having clause using an or */
    or(condition: BooleanValueSource): this

    // Query compound operators. intersectAll, exceptAll and minusAll are not available on SQLite and SQL Server
    union(select: CompoundableSubquery): this
    unionAll(select: CompoundableSubquery): this
    intersect(select: CompoundableSubquery): this
    intersectAll(select: CompoundableSubquery): this
    except(select: CompoundableSubquery): this
    exceptAll(select: CompoundableSubquery): this
    minus(select: CompoundableSubquery): this // alias to except
    minusAll(select: CompoundableSubquery): this // alias to exceptAll

    // Recursive queries
    recursiveUnion(fn: (view: View) => CompoundableSubquery): this
    recursiveUnionAll(fn: (view: View) => CompoundableSubquery): this
    recursiveUnionOn(fn: (view: View) => BooleanValueSource): this
    recursiveUnionAllOn(fn: (view: View) => BooleanValueSource): this

    /** Executes the select query that returns one or no result from the database */
    executeSelectNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the select query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeSelectOne(): Promise<RESULT>
    /** Executes the select query that returns zero or many results from the database */
    executeSelectMany(): Promise<RESULT[]>
    /** 
     * Executes the select query that returns zero or many results from the database.
     * It sends two queries: one to get the data from the database, 
     * and another one to get the count of all data without the limit and the offset. 
     */
    executeSelectPage(): Promise<{ data: RESULT[], count: number }>
    /** 
     * Executes the select query as a select page, including extra properties in the resulting object.
     * If the object provided by argument includes the property count, the query that counts the data is omitted and
     * this value is used. If the object provided by argument includes the property data, the query that extracts 
     * the data is omitted and this value is used.
     */
    executeSelectPage<EXTRAS extends {}>(extras: EXTRAS): Promise<{ data: RESULT[], count: number } & EXTRAS>
    
    /**
     * Uses a select query as a view in another select. 
     * This select is included as a with clause in the final sql.
     * 
     * @param as name of the with clause in the final query (must be unique per final query)
     */
    forUseInQueryAs(as: string): View

    /**
     * Uses a select query as an inline query value in another select. 
     */
    forUseAsInlineQueryValue(): AnyValueSource

    /**
     * Uses a select query as an inline object array value in another select. 
     */
    forUseAsInlineAggregatedArrayValue(): AggregatedArrayValueSource<this>
    
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    /** After a compound operator it only accepts beforeQuery, afterQuery, beforeWithQuery, afterWithQuery, queryExecutionName and queryExecutionMetadata */
    customizeQuery(customization: {
        afterSelectKeyword?: RawFragment
        beforeColumns?: RawFragment
        customWindow?: RawFragment
        beforeOrderByItems?: RawFragment
        afterOrderByItems?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        beforeWithQuery?: RawFragment
        afterWithQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}
```

```typescript
/**
 * Modes of sorting in an order by.
 * If the database doesn't support one of them, it is emulated.
 */
type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
                   'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
                   'desc nulls first insensitive' | 'desc nulls last insensitive'
```

```typescript
/**
 * Select projection of the value that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type SelectValues = { [columnName: string]: AnyValueSource }
```

What a select can compute comes from the [connection](connection.md), which has the aggregate functions (`count`, `sum`, `stringConcat`, `aggregateAsArray`...), the aggregate fragments (`aggregateFragmentWithType`, `buildAggregateFragmentWithArgs`, `buildAggregateFragmentWithArgsIfValue`, `buildAggregateFragmentWithMaybeOptionalArgs`) and the arguments of the reusable fragments (`arg`, `valueArg`).
