# Dynamic queries

## Introduction

ts-sql-query offers many commodity methods with name ended with `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, ts-sql-query is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

When you realize an insert or update, you can:

- set a column value conditionally using the method `setIfValue`
- replace a previously set value during the construction of the query using  the method `setIfSet` or the method `setIfSetIfValue`
- set a value if it was not previously set during the construction of the query using the method `setIfNotSet` or the method `setIfNotSetIfValue`
- ignore a previously set value using the method `ignoreIfSet`
- don't worry if you end with an update or delete with no where, you will get an error instead of update or delete all rows. You can allow explicitly having an update or delete with no where if you create it using the method `updateAllowingNoWhere` or `deleteAllowingNoWhereFrom` respectively

When you realize a select, you can:

- specify in your order by clause that the order must be case insensitive when the column type is string (ignored otherwise). To do it, add `insensitive` at the end of the ordering criteria/mode
- add a dynamic `order by` provided by the user without risk of SQL injection and without exposing the internal structure of the database. To build a dynamic `order by` use the method `orderByFromString` with the usual order by syntax (and with the possibility to use the insensitive extension), but using as column's name the name of the property in the resulting object
- You can apply `order by`, `limit` and `offset` optionally calling `orderByFromStringIfValue`, `limitIfValue` and `offsetIfValue`

Additionally, you can:

- create a boolean expression that only applies if a certain condition is met, calling the `onlyWhen` method in the boolean expression. The `ignoreWhen` method does the opposite.
- create an expression that only applies if a certain condition is met; otherwise, the value will be null, calling the `onlyWhenOrNull` method in the expression. The `ignoreWhenAsNull` method does the opposite.
- create a dynamic boolean expression that you can use in a where (by example), calling the `dynamicBooleanExpresionUsing` method in the connection object.
- create a custom boolean condition from criteria object that you can use in a where (by example), calling the `dynamicConditionFor` method in the connection object. This functionality is useful when creating a complex search & filtering functionality in the user interface, where the user can apply a different combination of constraints.
- create a query where it is possible to pick the columns to be returned by the query.
- define an optional join in a select query. That join only must be included in the final query if the table involved in the join is used in the final query. For example, a column of the joined table was picked or used in a dynamic where.

## Easy dynamic queries

The methods ended with `IfValue` allows you to create dynamic queries in the easyest way; these methods works in the way when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour) return a special neutral boolean (ignoring the expression) that is ignored when it is used in `and`s, `or`s, `on`s or `where`s.

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

const searchedCustomers = connection.selectFrom(tCustomer)
    .where(
                tCustomer.firstName.containsIfValue(firstNameContains)
            .or(tCustomer.lastName.containsIfValue(lastNameContains))
        ).and(
            tCustomer.birthday.equalsIfValue(birthdayIs)
        )
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name || $1 || last_name as name, birthday as birthday 
from customer 
where first_name like ('%' || $2 || '%') 
order by lower(name), birthday asc nulls last
```

The parameters are: `[ ' ', 'ohn' ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```

## Ignorable boolean expression

You can create a boolean expression that only applies if a certain condition is met, calling the `onlyWhen` method at the end of the boolean expression; in case the condition is false it returns a special neutral boolean (ignoring the expression) that is ignored when it is used in `and`s, `or`s, `on`s or `where`s. You an use also the `ignoreWhen` method at the end of the boolean expression to do the opposite; in case the condition is true it returns a special neutral boolean that is ignored. The `onlyWhen` and `ignoreWhen` methods can be useful to apply restictions in the query, by example, when the user have some roles.

```ts
const userCompanyId = 16
const onlyCustomersOfUserCompany = true

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(userCompanyId).onlyWhen(onlyCustomersOfUserCompany))
    .select({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectMany()
```

The executed query is:
```sql
select first_name as firstName, last_name as lastName, birthday as birthday 
from customer 
where company_id = $1
```

The parameters are: `[ 16 ]`

The result type is:
```tsx
const customers: Promise<{
    firstName: string;
    lastName: string;
    birthday?: Date;
}[]>
```

But in the case of `onlyCustomersOfUserCompany` is false, the condition in the where is omitted:
```ts
const onlyCustomersOfUserCompany = false
```

The executed query is:
```sql
select first_name as firstName, last_name as lastName, birthday as birthday 
from customer
```

The parameters are: `[ ]`

## Ignorable expression as null

You can create an expression that only applies if a certain condition is met, calling the `onlyWhenOrNull` method at the end of the expression; in case the condition is false it returns a null constant (ignoring the expression). You an use also the `ignoreWhenAsNull` method at the end of the boolean expression to do the opposite; in case the condition is true it returns a null constant. The `onlyWhenOrNull` and `ignoreWhenAsNull` methods can be useful to apply restictions in the query, by example, when the user have some roles.

```ts
const customerId = 10
const diaplayNames = true

const customerWithIdWithRules = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName.onlyWhenOrNull(diaplayNames),
        lastName: tCustomer.lastName.onlyWhenOrNull(diaplayNames),
        birthday: tCustomer.birthday
    })
    .executeSelectOne()
```

The executed query is:
```sql
select id as id, first_name as "firstName", last_name as "lastName", birthday as birthday 
from customer 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customerWithIdWithRules: Promise<{
    id: number;
    firstName?: string;
    lastName?: string;
    birthday?: Date;
}>
```

But in the case of `diaplayNames` is false, the omitted expressions are replaced by null:
```ts
const diaplayNames = false
```

The executed query is:
```sql
select id as id, null::text as "firstName", null::text as "lastName", birthday as birthday 
from customer 
where id = $1
```

The parameters are: `[ 10 ]`

## Complex dynamic boolean expressions

When the methods ended with `IfValue` are not enough to create dynamic complex boolean expressions, you can call the `dynamicBooleanExpresionUsing` method to create your complex boolean expressions. The `dynamicBooleanExpresionUsing` method is in the connection object. It allows you to create a dynamic expression with the initial value of the special neutral boolean. This method receives by argument the tables you expect to use while constructing the complex boolean expression.

The previous example can be written in the following way:

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

let searchedCustomersWhere = connection.dynamicBooleanExpressionUsing(tCustomer)
if (firstNameContains) {
    searchedCustomersWhere = searchedCustomersWhere.and(tCustomer.firstName.contains(firstNameContains))
}
if (lastNameContains) {
    searchedCustomersWhere = searchedCustomersWhere.or(tCustomer.lastName.contains(lastNameContains))
}
if (birthdayIs) {
    searchedCustomersWhere = searchedCustomersWhere.and(tCustomer.birthday.equals(birthdayIs))
}

const searchedCustomers = connection.selectFrom(tCustomer)
    .where(searchedCustomersWhere)
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name || $1 || last_name as name, birthday as birthday 
from customer 
where first_name like ('%' || $2 || '%') 
order by lower(name), birthday asc nulls last
```

The parameters are: `[ ' ', 'ohn' ]`

The result type is:
```tsx
const searchedCustomers: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```

## Select using a dynamic filter

You can create a dynamic condition for use in a where (for example). In these dynamic conditions, the criteria are provided as an object. Another system, like the user interface, may fill the criteria object. The provided criteria object is translated to the corresponding SQL. To use this feature, you must call the method `dynamicConditionFor` from the connection; this method receives a map where the key is the name that the external system is going to use to refer to the field and the value is the corresponding value source to be used in the query. The `dynamicConditionFor` method returns an object that contains the method `withValues` that receives the criteria provided to the external system.

```ts
import { DynamicCondition } from "ts-sql-query/dynamicCondition"

type FilterType = DynamicCondition<{
    id: 'int',
    firstName: 'string',
    lastName: 'string',
    birthday: 'localDate',
    companyName: 'string'
}>

const filter: FilterType = {
    or: [
        { firstName: { startsWithInsensitive: 'John' } },
        { lastName: { startsWithInsensitiveIfValue: 'Smi', endsWith: 'th' } }
    ],
    companyName: {equals: 'ACME'}
}

const selectFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyName: tCompany.name
}

const dynamicWhere = connection.dynamicConditionFor(selectFields).withValues(filter)

const customersWithDynamicCondition = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCustomer.companyId.equals(tCompany.id))
    .where(dynamicWhere)
    .select(selectFields)
    .orderBy('firstName', 'insensitive')
    .orderBy('lastName', 'asc insensitive')
    .executeSelectMany()
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday, company.name as companyName 
from customer inner join company on customer.company_id = company.id 
where 
    (   
        customer.first_name ilike ($1 || '%') 
        or (
                    customer.last_name ilike ($2 || '%') 
                and customer.last_name like ('%' || $3)
            )
    ) and company.name = $4 
order by lower(firstName), lower(lastName) asc
```

The parameters are: `[ 'John', 'Smi', 'th', 'ACME' ]`

The result type is:
```tsx
const customersWithCompanyName: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    companyName: string;
    birthday?: Date;
}[]>
```

The utility type `DynamicCondition` and `TypeSafeDynamicCondition` (when the extended types are used with type-safe connections) from `ts-sql-query/dynamicCondition` allows you to create a type definition for the dynamic criteria.

See [Dynamic conditions](../supported-operations.md#dynamic-conditions) for more information.

## Select dynamically picking columns

**Important**: This feature offers you the most extreme form of modification over the queries but the hardest one to figure out the consequences because the columns can disappear. Try to use first [Ignorable expression as null](#ignorable-expression-as-null) instead of this feature where the structure of the columns is kept as is, and you will be able to reason over your queries more easily.

You can create a select where the caller can conditionally pick the columns that want to be returned (like in GraphQL)

```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query/dynamicCondition"

const availableFields = {
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday
}

// Alternative: const fieldsToPickList = ['firstName' as const, 'lastName' as const]
const fieldsToPick = {
    firstName: true,
    lastName: true
}

// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList)
const pickedFields = dynamicPick(availableFields, fieldsToPick)

const customersWithIdPeaking = connection.selectFrom(tCustomer)
    .select({
        ...pickedFields,
        id: tCustomer.id // always include the id field in the result
    })
    .executeSelectMany()
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName
from customer
```

The parameters are: `[]`

The result type is:
```tsx
const customersWithIdPeaking: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
}[]>
```

The `fieldsToPick` object defines all the properties that will be included, and the value is a boolean that tells if that property must be included or not. Alternatively, you can define `fieldsToPickList` array with the list of property names that will be included.

The utility function `dynamicPick` from `ts-sql-query/dynamicCondition` lets you pick the fields from an object. This function returns a copy of the object received as the first argument with the properties with the same name and value `true` in the object received as the second argument; if the property is an object constructed in a complex projection, the value can be an object representing the inner properties. Optionally, you can include a list of the properties path (or name) that will always be included as the third argument, but it is better if you include them directly in the select, as shown in the example.

The type `DynamicPick<Type, Mandatory>` from `ts-sql-query/dynamicCondition` allows you to define the type expected by the `dynamicPick` function (in the example, the variable `fieldsToPick`) where the first generic argument is the type to transform. Optionally you can provide a second generic argument with the path (or name) of the mandatories properties joined with `|`. Example: `DynamicPick<MyType, 'prop1' | 'prop2'>`.

The utility function `dynamicPickPaths` from `ts-sql-query/dynamicCondition` allows you to pick the fields from an object or inner object in complex projections. This function returns a copy of the object received as the first argument with the properties path in the array received as the second argument. Optionally, you can include a list of the properties path (or name) that will always be included as the third argument, but it is better if you include them directly in the select, as shown in the example.

The type `DynamicPickPaths<Type, Mandatory>` from `ts-sql-query/dynamicCondition` allows you to define the type expected by the `dynamicPickPaths` function (in the example, the variable `fieldsToPickList`) where the first generic argument is the type to transform. Optionally you can provide a second generic argument with the path (or name) of the mandatories properties joined with `|`. Example: `DynamicPickPaths<MyType, 'prop1' | 'prop2'>`.

The type `PickValuesPath<Type, Mandatory>` from `ts-sql-query/dynamicCondition` allows you to define a type of each element in the result when the query is executed picking fields, where the first generic argument is the type to transform. Additionally, you must provide a second generic argument with the path (or name) of the picked properties joined with `|`. Example: `DynamicPickPaths<MyType, 'prop1' | 'prop2'>`.

When you are dynamically picking columns, you will probably want to create a function that receives the list of columns in a generic way, allowing the output to be properly typed with the requested columns. To do this, you must rectify the query result type by calling the function `expandTypeFromDynamicPickPaths` from `ts-sql-query/dynamicCondition` to include the generic rules again in the projected output. The first argument corresponds to the available fields to pick, the second corresponds to the picked fields, and the third corresponds to the query execution result. Example:

**Creating definition based in your business types**:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from "ts-sql-query/dynamicCondition"

interface CustomerInformation {
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}

async function getCustomersInformation<FIELDS extends keyof CustomerInformation>(connection: DBConnection, fields: FIELDS[]): Promise<Pick<CustomerInformation, FIELDS | 'id'>[]> {
    const availableFields = {
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }
    
    // always include id field as required
    const pickedFields = dynamicPickPaths(availableFields, fields, ['id'])
    
    const customers = await connection.selectFrom(tCustomer)
        .select(pickedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers);
}
```

**Creating definition based in your database types**:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths, PickValuesPath } from "ts-sql-query/dynamicCondition"

const customerInformationFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
}

type CustomerInformationFields = DynamicPickPaths<typeof customerInformationFields>
type CustomerInformation<FIELDS extends CustomerInformationFields> = PickValuesPath<typeof customerInformationFields, FIELDS | 'id'>

async function getCustomersInformation<FIELDS extends CustomerInformationFields>(connection: DBConnection, fields: FIELDS[]): Promise<CustomerInformation<FIELDS>[]> {
    
    // always include id field as required
    const pickedFields = dynamicPickPaths(customerInformationFields, fields, ['id'])
    
    const customers = await connection.selectFrom(tCustomer)
        .select(pickedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(customerInformationFields, fields, customers, ['id'])
}
```

## Optional joins

You can write selects where the columns are picked dynamically, but maybe a join is required depending on the picked columns. ts-sql-query offer you the possibility to indicate that join only must be included in the final query if the table involved in the join is used in the final query (by example, a column of that table was picked, or a column was used in a dynamic where). 

To indicate the join can be optionally included in the query, you must create the join using one of the following methods:

- `optionalJoin`
- `optionalInnerJoin`
- `optionalLeftJoin`
- `optionalLeftOuterJoin`

```ts
const companyName = 'My company name'

const customers = connection.selectFrom(tCustomer)
    .optionalJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .where(tCompany.name.equalsIfValue(companyName))
    .select({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectMany()
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday 
from customer join company on company.id = customer.company_id 
where company.name = $1
```

The parameters are: `[ "My company name" ]`

The result type is:
```tsx
const customers: Promise<{
    firstName: string;
    lastName: string;
    birthday?: Date;
}[]>
```

But in the case of `companyName` is null or undefined, the condition in the where is omitted; in consequence, the company table is not used; thus the join is omitted:
```ts
const companyName = null
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday
from customer
```

The parameters are: `[ ]`

**Warning**: an omitted join can change the number of returned rows depending on your data structure. This behaviour doesn't happen when all rows of the initial table have one row in the joined table (or none if you use a left join), but not many rows.

**You can also use optional joins with ignorable expression as null**

```ts
const canSeeCompanyInfo = false

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        companyId: tCompany.id.onlyWhenOrNull(canSeeCompanyInfo),
        companyName: tCompany.name.onlyWhenOrNull(canSeeCompanyInfo)
    })
    .where(tCustomer.id.equals(12))
    .executeSelectMany()
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday, null::int4 as companyId, null::text as companyName
from customer 
where id = $1
```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
    companyName?: string;
    companyId?: number;
}[]>
```

But in the case of a column provided by the join is required, like when `canSeeCompanyInfo` is:
```ts
const canSeeCompanyInfo = true
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday, company.id as companyId, company.name as companyName 
from customer inner join company on company.id = customer.company_id 
where customer.id = $1
```

The parameters are: `[ 12 ]`

**Warning**: an omitted join can change the number of returned rows depending on your data structure. This behaviour doesn't happen when all rows of the initial table have one row in the joined table (or none if you use a left join), but not many rows.

**You can also use optional joins when you dynamically pick columns**

**Important**: This feature offers you the most extreme form of modification over the queries but the hardest one to figure out the consequences because the columns can disappear. Try to use first [Ignorable expression as null](#ignorable-expression-as-null) instead of this feature where the structure of the columns is kept as is, and you will be able to reason over your queries more easily.

```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query/dynamicCondition"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyId: tCompany.id,
    companyName: tCompany.name
}

// Alternative: const fieldsToPickList = ['firstName' as const, 'lastName' as const]
const fieldsToPick = {
    firstName: true,
    lastName: true
}

// always include id field as required
// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList, ['id'])
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
    .executeSelectMany()
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName
from customer
where customer.id = $1
```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
    companyId?: number;
    companyName?: string;
}[]>
```

But in the case of a column provided by the join is required, like when `fieldsToPick` is:
```ts
const fieldsToPick = {
    firstName: true,
    lastName: true,
    companyName: true
}
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, company.name as companyName
from customer inner join company on company.id = customer.company_id
where customer.id = $1
```

The parameters are: `[ 12 ]`

**Warning**: an omitted join can change the number of returned rows depending on your data structure. This behaviour doesn't happen when all rows of the initial table have one row in the joined table (or none if you use a left join), but not many rows.

## Restrict access to values

Sometimes you want to allow access to a value only under some circumstances, like when you want a column in a select picking column to be available only if the user has permissions. For this, you can call the function `allowWhen`, indicating as the first argument if it is allowed to use this value, and as the second argument, an error or text's error that will be thrown if the value is used in the generated query. Additionally, there is the `disallowWhen` that is analogous to `allowWhen`, but the boolean received as an argument indicates when the value is disallowed.

```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query/dynamicCondition"

const birthdayVisible = false

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday.allowWhen(birthdayVisible, "You don't have permission to see the birthday"),
}

// Alternative: const fieldsToPickList = ['firstName' as const, 'lastName' as const]
const fieldsToPick = {
    firstName: true,
    lastName: true
}

// always include id field as required
// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList, ['id'])
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
    .executeSelectMany()
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName
from customer
where customer.id = $1
```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
}[]>
```

But in the case of the `birthday` column is requested, when `fieldsToPick` is:
```ts
const fieldsToPick = {
    firstName: true,
    lastName: true,
    birthday: true
}
```

An error will be thrown with the message "_You don't have permission to see the birthday_" because `birthdayVisible` is `false`