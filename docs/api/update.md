---
search:
  boost: 0.3
---
# Update API

This API provides methods to build and execute SQL `UPDATE` statements using a fluent interface in `ts-sql-query`. It allows you to conditionally set columns, control update behavior dynamically, use joins, and optionally return affected data.

```ts
interface UpdateExpression {
    /**
     * Used to define the shape of the values to update. This shape allows you to map
     * each property in the values to update with the columns in the table, in that
     * way, the property in the value doesn't need to have the same name.
     * The only values to be updated are the ones included in the shape.
     */
    shapedAs(shape: UpdateShape): this
    /** 
     * Allows you to extend the previously set shape.
     * The values set after extending the shape will allow you to include the new properties in the extended shape.
     */
    extendShape(shape: UpdateShape): this
    
    /** Set the values for update */
    set(columns: UpdateSets): this
    /** Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setIfValue(columns: OptionalUpdateSets): this
    /** Set a previous set value only */
    setIfSet(columns: UpdateSets): this
    /** Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     */
    setIfSetIfValue(columns: OptionalUpdateSets): this
    /** Set a unset value (only if the value was not previously set) */
    setIfNotSet(columns: UpdateSets): this
    /** 
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set) 
     */
    setIfNotSetIfValue(columns: OptionalUpdateSets): this
    /** Unsets the previously set columns listed. */
    ignoreIfSet(...columns: string[]): this
    /** Keeps only the previously set columns listed. */
    keepOnly(...columns: string[]): this

    /** 
     * Sets a value for the specified columns that were previously assigned a value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasValue(columns: UpdateSets): this
    /** 
     * Sets a value for the specified columns that were previously assigned a value
     *  only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasValueIfValue(columns: OptionalUpdateSets): this
    /** 
     * Sets a value for the specified columns that have no value to set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasNoValue(columns: UpdateSets): this
    /** 
     * Sets a value for the specified columns that have no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setIfHasNoValueIfValue(columns: OptionalUpdateSets): this
    /** 
     * Unsets the listed columns if they have a value set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unsets the listed columns if they have no value set.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unsets all columns that were set with no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    ignoreAnySetWithNoValue(): this

    /**
     * Throws an error if the indicated properties are set
     */
    disallowIfSet(errorMessage: string, ...columns: string[]): this
    disallowIfSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error if the indicated properties are not set
     */
    disallowIfNotSet(errorMessage: string, ...columns: string[]): this
    disallowIfNotSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error if the indicated properties were set with a value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error if the indicated properties were not set or have no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfNoValue(errorMessage: string, ...columns: string[]): this
    disallowIfNoValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error if any column other than the listed ones is set.
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this

    //
    // When variants, that are only executed if the first param is true
    //

    setWhen(when: boolean, columns: UpdateSets): this
    setIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    setIfSetWhen(when: boolean, columns: UpdateSets): this
    setIfSetIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    setIfNotSetWhen(when: boolean, columns: UpdateSets): this
    setIfNotSetIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    ignoreIfSetWhen(when: boolean, ...columns: string[]): this
    keepOnlyWhen(when: boolean, ...columns: string[]): this
    setIfHasValueWhen(when: boolean, columns: UpdateSets): this
    setIfHasValueIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    setIfHasNoValueWhen(when: boolean, columns: UpdateSets): this
    setIfHasNoValueIfValueWhen(when: boolean, columns: OptionalUpdateSets): this
    ignoreIfHasValueWhen(when: boolean, ...columns: string[]): this
    ignoreIfHasNoValueWhen(when: boolean, ...columns: string[]): this
    ignoreAnySetWithNoValueWhen(when: boolean): this
    disallowIfSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfSetWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfNotSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfNotSetWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfValueWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfValueWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowIfNoValueWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowIfNoValueWhen(when: boolean, error: Error, ...columns: string[]): this
    disallowAnyOtherSetWhen(when: boolean, errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSetWhen(when: boolean, error: Error, ...columns: string[]): this

    /** Allows to set the values dynamically */
    dynamicSet(): this
    dynamicSet(columns: UpdateSets): this

    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this

    /** Allows to extends the where or the on clause of a join using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where or the on clause of a join using an or */
    or(condition: BooleanValueSource): this

    /**
     * Execute the update returning the number of updated rows
     * 
     * @param min Indicate the minimum of rows that must be updated, 
     *           if the minimum is not reached an exception will be thrown
     * @param max Indicate the maximum of rows that must be updated, 
     *           if the maximum is exceeded an exception will be thrown
     */
    executeUpdate(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods
    /** 
     * Allows to specify the returning clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    returning(columns: UpdateReturningValues): this
    /** 
     * Returns the optional values as null instead of optional undefined values, can only used 
     * immediately after returning(...) 
     * */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Allows to specify the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Execute the update query that returns one o no result from the database */
    executeUpdateNoneOrOne(): Promise<RESULT | null>
    /** 
     * Execute the update query that returns one result from the database.
     * If no result is returned by the database an exception will be thrown.
     */
    executeUpdateOne(): Promise<RESULT>
    /** 
     * Execute the update query that returns zero or many results from the database 
     * 
     * @param min Indicate the minimum of rows that must be deleted, 
     *           if the minimum is not reached an exception will be thrown
     * @param max Indicate the maximum of rows that must be deleted, 
     *           if the maximum is exceeded an exception will be thrown
     */
    executeUpdateMany(min?: number, max?: number): Promise<RESULT[]>

    /** Allows to add a from to the update query */
    from(table: Table | View): this

    /** Allows to add a join to the update query */
    join(table: Table | View): this
    /** Allows to add a inner join to the update query */
    innerJoin(table: Table | View): this
    /** 
     * Allows to add a left join to the update query. 
     * Note: to use a table or view here you must call first forUseInLeftJoin methods on it
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Allows to add a left outer join to the update query. 
     * Note: to use a table or view here you must call first forUseInLeftJoin methods on it
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Allows to create the on clause of a join dynamically */
    dynamicOn(): this
    /** Allows to specify the on clause of a join */
    on(condition: BooleanValueSource): this

    customizeQuery(customization: {
        afterUpdateKeyword?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}
```

```ts
/** Columns required by the update */
type UpdateSets = { [columnName: string]: any }
/** Columns required by the update, but marked as optional */
type OptionalUpdateSets = { [columnName: string]: any }
/**
 * Returning projection of the value that vill be retreived from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type UpdateReturningValues = { [columnName: string]: AnyValueSource }
/** Shape of the values to set */
type UpdateShape = { [propertyNameInValues: string]: string /* column name in the update table */ | AnyValueSource }
```
