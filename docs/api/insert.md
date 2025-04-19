---
search:
  boost: 0.3
---
# Insert API

This API provides methods to construct and execute SQL `INSERT` statements using a fluent interface in `ts-sql-query`. It supports inserting single or multiple rows, inserting from a SELECT statement, handling conflict resolution (e.g., upserts), and optionally returning inserted data.

```ts
interface InsertExpression {
    /**
     * Allow setting the shape of the values to insert. This shape allows you to map
     * each property in the values to insert with the column's name in the table, in that
     * way, the property in the value doesn't need to have the same name.
     * The only values to be insert are the ones included in the shape.
     */
    shapedAs(shape: InsertShape): this
    /** 
     * Allow you to extend the previous set shape.
     * The values set after extending the shape will allow you to include the new properties in the extended shape.
     */
    extendShape(shape: InsertShape): this

    /** Alias to set method: Set the values for insert */
    values(columns: InsertSets): this
    /** Allow to insert multiple registers in the database */
    values(columns: InsertSets[]): this
    /** 
     * Set the values for insert.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    set(columns: InsertSets): this
    /** 
     * Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a previous set value only.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfSet(columns: InsertSets): this
    /** 
     * Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a unset value (only if the value was not previously set).
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set).
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Unset the listed columns previous set.
     * It can be used in an insert of multiple values.
     * */
    ignoreIfSet(...columns: string[]): this
    /** 
     * Keep only the listed columns previous set.
     * It can be used in an insert of multiple values.
     */
    keepOnly(...columns: string[]): this

    /** 
     * Set a value for the specified columns that was previously indicated a value for set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasValue(columns: InsertSets): this
    /** 
     * Set a value for the specified columns that was previously indicated a value for 
     * set only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * Set a value for the specified columns that has not value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasNoValue(columns: InsertSets): this
    /** 
     * Set a value for the specified columns that has no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasNoValueIfValue(columns: OptionalInsertSets): this
    /** 
     * Unset the listed columns if them has value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unset the listed columns if them has no value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unset all columns that was set with no value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreAnySetWithNoValue(): this

    /** 
     * This only apply in an insert of multiple values.
     * Set the values for insert 
     */
    setForAll(columns: InsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfValue(columns: OptionalInsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a previous set value only 
     */
    setForAllIfSet(columns: InsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a previous set value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a unset value (only if the value was not previously set) 
     */
    setForAllIfNotSet(columns: InsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a unset value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array
     * (only if the value was not previously set) 
     */
    setForAllIfNotSetIfValue(columns: OptionalInsertSets): this

    /** 
     * This only apply in an insert of multiple values.
     * Set a value for the specified columns that was previously indicated a value for set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValue(columns: InsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a value for the specified columns that was previously indicated a value for 
     * set only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a value for the specified columns that has not value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValue(columns: InsertSets): this
    /** 
     * This only apply in an insert of multiple values.
     * Set a value for the specified columns that has no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValueIfValue(columns: OptionalInsertSets): this

    /**
     * Throw an error if the indicated properties are set
     */
    disallowIfSet(errorMessage: string, ...columns: string[]): this
    disallowIfSet(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties are not set
     */
    disallowIfNotSet(errorMessage: string, ...columns: string[]): this
    disallowIfNotSet(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties was set with a value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the indicated properties was set not set or has no value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfNoValue(errorMessage: string, ...columns: string[]): this
    disallowIfNoValue(error: Error, ...columns: string[]): this
    /**
     * Throw an error if the any other set except the provided column list
     */
    disallowAnyOtherSet(errorMessage: string, ...columns: string[]): this
    disallowAnyOtherSet(error: Error, ...columns: string[]): this

    //
    // When variants, that are only executed if the first param is true
    //

    setWhen(when: boolean, columns: InsertSets): this
    setIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setIfSetWhen(when: boolean, columns: InsertSets): this
    setIfSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setIfNotSetWhen(when: boolean, columns: InsertSets): this
    setIfNotSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    ignoreIfSetWhen(when: boolean, ...columns: string[]): this
    keepOnlyWhen(when: boolean, ...columns: string[]): this
    setIfHasValueWhen(when: boolean, columns: InsertSets): this
    setIfHasValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setIfHasNoValueWhen(when: boolean, columns: InsertSets): this
    setIfHasNoValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    ignoreIfHasValueWhen(when: boolean, ...columns: string[]): this
    ignoreIfHasNoValueWhen(when: boolean, ...columns: string[]): this
    ignoreAnySetWithNoValueWhen(when: boolean): this
    setForAllWhen(when: boolean, columns: InsertSets): this
    setForAllIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfSetWhen(when: boolean, columns: InsertSets): this
    setForAllIfSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfNotSetWhen(when: boolean, columns: InsertSets): this
    setForAllIfNotSetIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfHasValueWhen(when: boolean, columns: InsertSets): this
    setForAllIfHasValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
    setForAllIfHasNoValueWhen(when: boolean, columns: InsertSets): this
    setForAllIfHasNoValueIfValueWhen(when: boolean, columns: OptionalInsertSets): this
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
    dynamicSet(columns: OptionalInsertSets): this

    /** Alias to dynamicSet method: Allows to set the values dynamically */
    dynamicValues(columns: OptionalInsertSets): this
    /** Allow to insert multiple registers in the database dynamically */
    dynamicValues(columns: OptionalInsertSets[]): this

    /** Insert the default values in the table */
    defaultValues(): this

    /** Insert from a select */
    from(select: Subquery): this

    /** 
     * Indicate that the query must return the last inserted id 
     * Note: If you are inserting multiple rows, only PostgreSql, SqlServer and Oracle support it
     */
    returningLastInsertedId(): this

    // Methos to specify the on conflict clause
    /** Allows to specify the "on conflict do nothing" clause */
    onConflictDoNothing(): this
    /** Allows to specify the "on conflict do update" clause and next specify the sets */
    onConflictDoUpdateDynamicSet(): this
    onConflictDoUpdateDynamicSet(columns: UpdateSets): this
    /** Allows to specify the "on conflict do update set" clause, setting the columns provided as argument */
    onConflictDoUpdateSet(columns: UpdateSets): this
    /** 
     * Allows to specify the "on conflict do update set" clause, setting the columns provided as argument.
     * Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    onConflictDoUpdateSetIfValue(columns: UpdateSets): this
    /**Allow to specify the "on conflict" clasue indicating the index column expected by this clause */
    onConflictOn(column: AnyValueSource, ...columns: AnyValueSource[]): this
    /**Allow to specify the "on conflict on constraint" clasue indicating the index name expected by this clause */
    onConflictOnConstraint(constraint: string): this
    /**Allow to specify the "on conflict on constraint" clasue indicating the index name expected by this clause */
    onConflictOnConstraint(constraint: StringValueSource): this
    /**Allow to specify the "on conflict on constraint" clasue indicating the index name expected by this clause */
    onConflictOnConstraint(constraint: RawFragment): this

    // Methods available when previously is called onConflictOn or onConflictOnConstraint
    /** Allows to specify the "do nothing" clause */
    doNothing(): this
    /** Allows to specify the "do update" clause and next specify the sets */
    doUpdateDynamicSet(): this
    doUpdateDynamicSet(columns: UpdateSets): this
    /** Allows to specify the do update set" clause, setting the columns provided as argument */
    doUpdateSet(columns: UpdateSets): this
    /** 
     * Allows to specify the "do update set" clause, setting the columns provided as argument.
     * Set a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    doUpdateSetIfValue(columns: UpdateSets): this

    // Methods available to specify a where clause inmediatelly after call onConflictOn or any do update method
    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this
    /** Allows to extends the where using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where using an or */
    or(condition: BooleanValueSource): this

    /**
     * Execute the insert, by default returns the number of inserted rows
     * 
     * @param min Indicate the minimum of rows that must be updated, 
     *           if the minimum is not reached an exception will be thrown
     * @param max Indicate the maximum of rows that must be updated, 
     *           if the maximum is exceeded an exception will be thrown
     */
    executeInsert(min?: number, max?: number): Promise<RESULT>
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
    returning(columns: InsertReturningValues): this
    /** Returns the optional values as null instead of optional undefined values, can only used immediately after returning(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Allows to specify the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Execute the insert query that returns one o no result from the database */
    executeInsertNoneOrOne(): Promise<RESULT | null>
    /** 
     * Execute the insert query that returns one result from the database.
     * If no result is returned by the database an exception will be thrown.
     */
    executeInsertOne(): Promise<RESULT>
    /** 
     * Execute the insert query that returns zero or many results from the database 
     * 
     * @param min Indicate the minimum of rows that must be deleted, 
     *           if the minimum is not reached an exception will be thrown
     * @param max Indicate the maximum of rows that must be deleted, 
     *           if the maximum is exceeded an exception will be thrown
     */
    executeInsertMany(min?: number, max?: number): Promise<RESULT[]>

    customizeQuery(customization: {
        afterInsertKeyword?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}
```

```ts
/** Columns required by the insert */
type InsertSets = { [columnName: string]: any }
/** Columns required by the insert, but marked as optionals */
type OptionalInsertSets = { [columnName: string]: any }
/**
 * Returning projection of the value that will be retrieved from the database.
 * 
 * It must be an object where the name of the property is the name of the resulting property
 * and the value is the ValueSource where the value will be obtained.
 */
type InsertReturningValues = { [columnName: string]: AnyValueSource }
/** Shape of the values to set */
type InsertShape = { [propertyNameInValues: string]: string /* column name in the insert table */ }
```
