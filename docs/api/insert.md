---
search:
  boost: 0.3
---
# Insert API

This API provides methods to construct and execute SQL `INSERT` statements using a fluent interface in `ts-sql-query`. It supports inserting single or multiple rows, inserting from a SELECT statement, handling conflict resolution (e.g., upserts), and optionally returning inserted data.

```typescript
interface InsertExpression {
    /**
     * Sets the shape of the values to insert. This shape allows you to map
     * each property in the values to insert with the column's name in the table, in that
     * way, the property in the value doesn't need to have the same name.
     * The only values to be inserted are the ones included in the shape.
     */
    shapedAs(shape: InsertShape): this
    /** 
     * Extends the previously set shape.
     * The values set after extending the shape will allow you to include the new properties in the extended shape.
     */
    extendShape(shape: InsertShape): this

    /** Alias to set method: sets the values for insert */
    values(columns: InsertSets): this
    /** Inserts multiple rows in the database */
    values(columns: InsertSets[]): this
    /** 
     * Sets the values for insert. An undefined value writes a null.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    set(columns: InsertSets): this
    /** 
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfValue(columns: OptionalInsertSets): this
    /** 
     * Sets a value only if the column was previously set.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfSet(columns: InsertSets): this
    /** 
     * Sets a value only if the column was previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Sets a value only if the column was not previously set.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Sets a value only if the column was not previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this
    /** 
     * Unsets the listed columns previously set.
     * It can be used in an insert of multiple values.
     */
    ignoreIfSet(...columns: string[]): this
    /** 
     * Keeps only the listed columns previously set.
     * It can be used in an insert of multiple values.
     */
    keepOnly(...columns: string[]): this

    /** 
     * Sets a value for the specified columns that were previously given a value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasValue(columns: InsertSets): this
    /** 
     * Sets a value for the specified columns that were previously given a value, 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * Sets a value for the specified columns that have no value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * This doesn't apply when you are setting the values for insert in an insert of multiple values.
     */
    setIfHasNoValue(columns: InsertSets): this
    /** 
     * Sets a value for the specified columns that have no value to set 
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
     * Unsets the listed columns if they have a value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreIfHasValue(...columns: string[]): this
    /** 
     * Unsets the listed columns if they have no value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreIfHasNoValue(...columns: string[]): this
    /** 
     * Unsets all columns that were set with no value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array.
     * It can be used in an insert of multiple values.
     */
    ignoreAnySetWithNoValue(): this

    /** 
     * This only applies in an insert of multiple values.
     * Sets the values for insert 
     */
    setForAll(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfValue(columns: OptionalInsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was previously set 
     */
    setForAllIfSet(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfSetIfValue(columns: OptionalInsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was not previously set 
     */
    setForAllIfNotSet(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value only if the column was not previously set and the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    setForAllIfNotSetIfValue(columns: OptionalInsertSets): this

    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that were previously given a value.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValue(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that were previously given a value, 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasValueIfValue(columns: OptionalInsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that have no value to set.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValue(columns: InsertSets): this
    /** 
     * This only applies in an insert of multiple values.
     * Sets a value for the specified columns that have no value to set 
     * only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array.
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    setForAllIfHasNoValueIfValue(columns: OptionalInsertSets): this

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
     * It is considered that the column has a value if it was set with a value that is not null, 
     * undefined, empty string (only when the allowEmptyString flag in the connection is not 
     * set to true, that is the default behaviour) or an empty array 
     */
    disallowIfValue(errorMessage: string, ...columns: string[]): this
    disallowIfValue(error: Error, ...columns: string[]): this
    /**
     * Throws an error, when it is called, if the indicated properties were not set or have no value.
     * It is considered that the column has a value if it was set with a value that is not null, 
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

    /** Sets the values dynamically */
    dynamicSet(): this
    dynamicSet(columns: OptionalInsertSets): this

    /** Alias to dynamicSet method: sets the values dynamically */
    dynamicValues(columns: OptionalInsertSets): this
    /** Inserts multiple rows in the database dynamically */
    dynamicValues(columns: OptionalInsertSets[]): this

    /** Inserts the default values in the table. Only available when the table has no required column without a default */
    defaultValues(): this

    /** Insert from a select */
    from(select: Subquery): this

    /** 
     * Indicates that the query must return the last inserted id. Only available when the table has an autogenerated primary key.
     * Note: inserting multiple rows, or with an on conflict clause, it is not available on MySQL.
     * Inserting from a select, it is not available on MySQL and Oracle.
     */
    returningLastInsertedId(): this

    // Methods to specify the on conflict clause, only available on MariaDB, MySQL, PostgreSQL and SQLite
    /** Specifies the "on conflict do nothing" clause */
    onConflictDoNothing(): this
    // Without indicating the conflict, only available on MariaDB, MySQL and SQLite
    /** Specifies the "on conflict do update" clause and next specify the sets */
    onConflictDoUpdateDynamicSet(): this
    onConflictDoUpdateDynamicSet(columns: UpdateSets): this
    /** Specifies the "on conflict do update set" clause, setting the columns provided as argument */
    onConflictDoUpdateSet(columns: UpdateSets): this
    /** 
     * Specifies the "on conflict do update set" clause, setting the columns provided as argument.
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    onConflictDoUpdateSetIfValue(columns: OptionalUpdateSets): this
    /** Specifies the "on conflict" clause indicating the index columns expected by this clause. Only available on PostgreSQL and SQLite */
    onConflictOn(column: AnyValueSource, ...columns: AnyValueSource[]): this
    /** Specifies the "on conflict on constraint" clause indicating the constraint expected by this clause. Only available on PostgreSQL */
    onConflictOnConstraint(constraint: RawFragment): this

    // Methods available when previously is called onConflictOn or onConflictOnConstraint
    /** Specifies the "do nothing" clause */
    doNothing(): this
    /** Specifies the "do update" clause and next specify the sets */
    doUpdateDynamicSet(): this
    doUpdateDynamicSet(columns: UpdateSets): this
    /** Specifies the "do update set" clause, setting the columns provided as argument */
    doUpdateSet(columns: UpdateSets): this
    /** 
     * Specifies the "do update set" clause, setting the columns provided as argument.
     * Sets a value only if the provided value is not null, undefined, empty string 
     * (only when the allowEmptyString flag in the connection is not set to true, 
     * that is the default behaviour) or an empty array 
     */
    doUpdateSetIfValue(columns: OptionalUpdateSets): this

    // Methods to specify a where clause immediately after onConflictOn or any do update method
    // (after a do update method the condition can use the values to insert, see valuesForInsert).
    // Only available on PostgreSQL and SQLite
    /** Creates the where dynamically */
    dynamicWhere(): this
    /** Specifies the where */
    where(condition: BooleanValueSource): this
    /** Extends the where using an and */
    and(condition: BooleanValueSource): this
    /** Extends the where using an or */
    or(condition: BooleanValueSource): this

    /**
     * Executes the insert. By default it returns the number of inserted rows
     * 
     * @param min Minimum number of rows that must be inserted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be inserted. If it is exceeded, the promise is rejected
     */
    executeInsert(min?: number, max?: number): Promise<RESULT>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]

    // Returning methods, not available on MySQL. Inserting from a select, not available on Oracle either
    /** 
     * Specifies the returning clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    returning(columns: InsertReturningValues): this
    /** Returns the optional values as null instead of optional undefined values. It can only be used immediately after returning(...) */
    projectingOptionalValuesAsNullable(): this
    /** 
     * Specifies the returning clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    returningOneColumn(column: AnyValueSource): this
    /** Executes the insert query that returns one or no result from the database */
    executeInsertNoneOrOne(): Promise<RESULT | null>
    /** 
     * Executes the insert query that returns one result from the database.
     * If the database returns no result, the promise is rejected.
     */
    executeInsertOne(): Promise<RESULT>
    /** 
     * Executes the insert query that returns zero or many results from the database 
     * 
     * @param min Minimum number of rows that must be inserted. If it isn't reached, the promise is rejected
     * @param max Maximum number of rows that can be inserted. If it is exceeded, the promise is rejected
     */
    executeInsertMany(min?: number, max?: number): Promise<RESULT[]>

    customizeQuery(customization: {
        afterInsertKeyword?: RawFragment
        beforeQuery?: RawFragment
        afterQuery?: RawFragment
        queryExecutionName?: string
        queryExecutionMetadata?: any
    }): this
}
```

```typescript
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
