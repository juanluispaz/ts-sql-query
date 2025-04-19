---
search:
  boost: 0.3
---
# Delete API

This API provides methods to construct and execute SQL `DELETE` statements using a fluent interface in `ts-sql-query`. It allows for conditional deletion, joining with other tables, and optionally returning deleted data.

```ts
interface DeleteExpression {
    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this

    /** Allows extending the WHERE or ON clause of a join using AND */
    and(condition: BooleanValueSource): this
    /** Allows extending the WHERE or ON clause of a join using OR */
    or(condition: BooleanValueSource): this

    /**
    * Execute the delete returning the number of deleted rows
    * 
    * @param min Minimum number of rows that must be deleted. An exception is thrown if not reached
    * @param max Maximum number of rows that can be deleted. An exception is thrown if exceeded
    */
    executeDelete(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods
    /** 
     * Allows to specify the returning clause.
     * The object keys define the names of the resulting properties, and the values specify the ValueSource to retrieve from.
     */
    returning(columns: DeleteReturningValues): this
    /** Returns the optional values as null instead of optional undefined values, can only used immediately after returning(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Allows to specify the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Executes the delete query and returns one or no result */
    executeDeleteNoneOrOne(): Promise<RESULT | null>
    /** 
     * Execute the delete query that returns one result from the database.
     * If no result is returned by the database an exception will be thrown.
     */
    executeDeleteOne(min?: number, max?: number): Promise<RESULT>
    /** 
     * Execute the delete query that returns zero or many results from the database 
     * 
     * @param min Indicate the minimum of rows that must be deleted, 
     *           if the minimum is not reached an exception will be thrown
     * @param max Indicate the maximum of rows that must be deleted, 
     *           if the maximum is exceeded an exception will be thrown
     */
    executeDeleteMany(): Promise<RESULT[]>

    /** Allows to add a using (like a from that doesn't delete) to the delete query */
    using(table: Table | View): this

    /** Allows to add a join to the delete query */
    join(table: Table | View): this
    /** Allows to add a inner join to the delete query */
    innerJoin(table: Table | View): this
    /** 
     * Allows to add a left join to the delete query. 
     * Note: You must call forUseInLeftJoin on a table or view before using it in a left join
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Allows to add a left outer join to the delete query. 
     * Note: You must call forUseInLeftJoin on a table or view before using it in a left join
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Allows to create the on clause of a join dynamically */
    dynamicOn(): this
    /** Allows to specify the on clause of a join */
    on(condition: BooleanValueSource): this

    customizeQuery(customization: {
        afterDeleteKeyword?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}
```

```ts
/**
 * Returning projection of the values that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type DeleteReturningValues = { [columnName: string]: AnyValueSource }
```
