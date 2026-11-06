---
search:
  boost: 0.3
---
# Update API

This API provides methods to build and execute SQL `UPDATE` statements using a fluent interface in `ts-sql-query`. It allows you to conditionally set columns, control update behavior dynamically, use joins, and optionally return affected data.

```typescript
interface UpdateExpression {
    /**
     * Used to define the shape of the values to update. This shape allows you to map
     * each property in the values to update with the columns in the table, in that
     * way, the property in the value doesn't need to have the same name.
     * The only values to be updated are the ones included in the shape.
     */
    shapedAs(shape: UpdateShape): this
    /** 
     * Extends the previously set shape.
     * The values set after extending the shape will allow you to include the new properties in the extended shape.
     */
    extendShape(shape: UpdateShape): this
    
    /** Sets the values for update. An undefined value writes a null */
    set(columns: UpdateSets): this
    /**
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setIfValue(columns: OptionalUpdateSets): this
    /** Sets a value only if the column was previously set */
    setIfSet(columns: UpdateSets): this
    /**
     * Sets a value only if the column was previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     */
    setIfSetIfValue(columns: OptionalUpdateSets): this
    /** Sets a value only if the column was not previously set */
    setIfNotSet(columns: UpdateSets): this
    /** 
     * Sets a value only if the column was not previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
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
     * Throws an error, when it is called, if the indicated properties are set
     */
    disallowIfSet(errorMessage: string, ...columns: string[]): this
    disallowIfSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties are not set
     */
    disallowIfNotSet(errorMessage: string, ...columns: string[]): this
    disallowIfNotSet(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties were set with a value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties were not set or have no value.
     * It is considered the column has value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfNoValue(errorMessage: string, ...columns: string[]): this
    disallowIfNoValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if any column other than the listed ones is set.
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this

    //
    // When variants, that only apply if the first param is true
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

    /** Sets the values dynamically */
    dynamicSet(): this
    dynamicSet(columns: UpdateSets): this

    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this

    /** Extends the where or the on clause of a join using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where or the on clause of a join using an or */
    or(condition: BooleanValueSource): this

    /**
     * Executes the update returning the number of updated rows
     * 
     * @param min Minimum number of rows that must be updated. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be updated. If it is exceeded, the promise is rejected
     */
    executeUpdate(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods, not available on MySQL
    /** 
     * Specifies the returning clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    returning(columns: UpdateReturningValues): this
    /** 
     * Returns the optional values as null instead of optional undefined values.
     * It can only be used immediately after returning(...) 
     */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Executes the update query that returns one or no result from the database */
    executeUpdateNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the update query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeUpdateOne(): Promise<RESULT>
    /** 
     * Executes the update query that returns zero or many results from the database 
     * 
     * @param min Minimum number of rows that must be updated. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be updated. If it is exceeded, the promise is rejected
     */
    executeUpdateMany(min?: number, max?: number): Promise<RESULT[]>

    /** Adds a from to the update query */
    from(table: Table | View): this

    // Joins right after the update, only available on MariaDB and MySQL. On the other databases they go after a from
    /** Adds a join to the update query */
    join(table: Table | View): this
    /** Adds an inner join to the update query */
    innerJoin(table: Table | View): this
    /** 
     * Adds a left join to the update query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Adds a left outer join to the update query. 
     * Note: to use a table or view here you must first call forUseInLeftJoin on it
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Creates the on clause of a join dynamically */
    dynamicOn(): this
    /** Specifies the on clause of a join */
    on(condition: BooleanValueSource): this

    customizeQuery(customization: {
        afterUpdateKeyword?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}
```

```typescript
/** Columns required by the update */
type UpdateSets = { [columnName: string]: any }
/** Columns required by the update, but marked as optional */
type OptionalUpdateSets = { [columnName: string]: any }
/**
 * Returning projection of the value that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type UpdateReturningValues = { [columnName: string]: AnyValueSource }
/** Shape of the values to set */
type UpdateShape = { [propertyNameInValues: string]: string /* column name in the update table */ | AnyValueSource }
```
