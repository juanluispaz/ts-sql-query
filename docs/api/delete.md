---
search:
  boost: 0.3
---
# Delete API

This API provides methods to construct and execute SQL `DELETE` statements using a fluent interface in `ts-sql-query`. It allows for conditional deletion, joining with other tables, and optionally returning deleted data.

```typescript
interface DeleteExpression {
    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this

    /** Extends the where or the on clause of a join using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where or the on clause of a join using an or */
    or(condition: BooleanValueSource): this

    /**
     * Executes the delete returning the number of deleted rows
     * 
     * @param min Minimum number of rows that must be deleted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be deleted. If it is exceeded, the promise is rejected
     */
    executeDelete(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods, not available on MySQL
    /** 
     * Specifies the returning clause.
     * The object keys define the names of the resulting properties, and the values specify the ValueSource to retrieve from.
     */
    returning(columns: DeleteReturningValues): this
    /** Returns the optional values as null instead of optional undefined values. It can only be used immediately after returning(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Executes the delete query and returns one or no result */
    executeDeleteNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the delete query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeDeleteOne(): Promise<RESULT>
    /** 
     * Executes the delete query that returns zero or many results from the database 
     * 
     * @param min Minimum number of rows that must be deleted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be deleted. If it is exceeded, the promise is rejected
     */
    executeDeleteMany(min?: number, max?: number): Promise<RESULT[]>

    /** Adds a using (like a from that doesn't delete) to the delete query. Not available on SQLite */
    using(table: Table | View): this

    // Joins right after deleteFrom, only available on MariaDB and MySQL. On the other databases they go after a using
    /** Adds a join to the delete query */
    join(table: Table | View): this
    /** Adds an inner join to the delete query */
    innerJoin(table: Table | View): this
    /** 
     * Adds a left join to the delete query. 
     * Note: You must call forUseInLeftJoin on a table or view before using it in a left join
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Adds a left outer join to the delete query. 
     * Note: You must call forUseInLeftJoin on a table or view before using it in a left join
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Creates the on clause of a join dynamically */
    dynamicOn(): this
    /** Specifies the on clause of a join */
    on(condition: BooleanValueSource): this

    customizeQuery(customization: {
        afterDeleteKeyword?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}
```

```typescript
/**
 * Returning projection of the values that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type DeleteReturningValues = { [columnName: string]: AnyValueSource }
```
