---
search:
  boost: 0.91
---
# Extreme dynamic queries

This page presents the most advanced patterns for building dynamic SQL queries with `ts-sql-query`. It explores techniques such as dynamically selecting columns, constructing complex filters from external input, controlling joins conditionally, and shaping the output type accordingly. These features provide maximum flexibility when building highly dynamic APIs or business logic layers, but they also require careful reasoning about query structure and behavior.

## Introduction

This section covers more advanced patterns for dynamic query construction. These techniques are powerful, but should be used **only when necessary**.

In most applications, simple constructs like `.equalsIfValue()` or `.containsIfValue()` are sufficient for building flexible conditions. However, in more complex scenarios — such as dynamically selecting which columns to return, or building filters from condition objects — additional mechanisms are available.

!!! warning "These patterns are rarely needed"

    These patterns exist to handle *rare but real* edge cases. They offer great flexibility, but at the cost of increased complexity and reduced readability.

    Prefer the simpler declarative patterns unless your use case clearly requires this level of dynamic control.

!!! warning "About utility types used in this page"

    The examples in this section use advanced utility types to preserve proper TypeScript inference when selecting columns dynamically.

    For a full reference of the utility functions and types used to define and infer types for dynamic picks, see [Utility for dynamic picks](../advanced/utility-dynamic-picks.md).

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        birthday as birthday 
    from customer 
    where first_name like concat('%', ?, '%') 
    order by 
        lower(name), 
        birthday is null, 
        birthday asc
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        birthday as birthday 
    from customer 
    where first_name like concat('%', ?, '%') 
    order by 
        lower(`name`), 
        birthday is null, 
        birthday asc
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        birthday as "birthday" 
    from customer 
    where first_name like ('%' || :1 || '%') escape '\\' 
    order by 
        lower("name"), 
        "birthday" asc nulls last
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        birthday as birthday 
    from customer 
    where first_name like ('%' || $2 || '%') 
    order by 
        lower(name), 
        birthday asc nulls last
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ? || last_name as name, 
        birthday as birthday 
    from customer 
    where first_name like ('%' || ? || '%') escape '\\' 
    order by 
        lower(name), 
        birthday asc nulls last
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        birthday as birthday 
    from customer 
    where first_name like ('%' + @1 + '%') 
    order by 
        lower(name), 
        iif(birthday is null, 1, 0), 
        birthday asc
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

const selectFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyName: tCompany.name
}

/*
 * You can define as well using the fields object
 * type FilterType = DynamicCondition<typeof selectFields>
 */
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

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like concat(lower(?), '%') 
            or (
                    lower(customer.last_name) like concat(lower(?), '%') 
                and customer.last_name like concat('%', ?)
            )
        ) and company.name = ? 
    order by 
        lower(firstName), 
        lower(lastName) asc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.`name` as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like concat(lower(?), '%') 
            or (
                    lower(customer.last_name) like concat(lower(?), '%') 
                and customer.last_name like concat('%', ?)
            )
        ) and company.`name` = ? 
    order by 
        lower(firstName), 
        lower(lastName) asc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as "birthday", 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(:0 || '%') escape '\\' 
            or (
                    lower(customer.last_name) like lower(:1 || '%') escape '\\' 
                and customer.last_name like ('%' || :2) escape '\\'
            )
        ) and company.name = :3 
    order by 
        lower("firstName"), 
        lower("lastName") asc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as birthday, 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               customer.first_name ilike ($1 || '%') 
            or (
                    customer.last_name ilike ($2 || '%') 
                and customer.last_name like ('%' || $3)
            )
        ) and company.name = $4 
    order by 
        lower("firstName"), 
        lower("lastName") asc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(? || '%') escape '\\' 
            or (
                    lower(customer.last_name) like lower(? || '%') escape '\\' 
                and customer.last_name like ('%' || ?) escape '\\'
            )
        ) and company.name = ? 
    order by 
        lower(firstName), 
        lower(lastName) asc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(@0 + '%') 
            or (
                    lower(customer.last_name) like lower(@1 + '%') 
                and customer.last_name like ('%' + @2)
            )
        ) and company.name = @3 
    order by 
        lower(firstName), 
        lower(lastName) asc
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

The utility type `DynamicCondition` from `ts-sql-query/dynamicCondition` allows you to create a type definition for the dynamic criteria using type description or the object with the available fields.

See [Dynamic conditions](../api/dynamic-conditions.md) for more information.

Sometimes you need to extend the available rules used in dynamic conditions to provide more functionality to your dynamic conditions.; to do this you will need to construct an object (it can contain inner objects), where the key is the name of the rule, and the value is a function that receives as an argument the configuration of the rule, and it must return a boolean value source. When you create the dynamic condition, you must provide the extension as the second argument. See [Full dynamic select](#full-dynamic-select) for a complete example.

## Select dynamically picking columns

!!! tip

    This feature offers you the most extreme form of modification over the queries but the hardest one to figure out the consequences because the columns can disappear. Try to use first [Ignorable expression as null](dynamic-queries.md#ignorable-expression-as-null) instead of this feature where the structure of the columns is kept as is, and you will be able to reason over your queries more easily.

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

const customersWithIdPicking = connection.selectFrom(tCustomer)
    .select({
        ...pickedFields,
        id: tCustomer.id // always include the id field in the result
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName, 
        id as id 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName, 
        id as id 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        id as "id" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        id as id 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName, 
        id as id 
    from customer
    ```

The parameters are: `[]`

The result type is:
```tsx
const customersWithIdPicking: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
}[]>
```

The `fieldsToPick` object defines all the properties that will be included, and the value is a boolean that tells if that property must be included or not. Alternatively, you can define `fieldsToPickList` array with the list of property names that will be included.

## Optional joins dynamically picking columns

!!! tip

    This feature offers you the most extreme form of modification over the queries but the hardest one to figure out the consequences because the columns can disappear. Try to use first [Ignorable expression as null](../queries/dynamic-queries.md#ignorable-expression-as-null) instead of this feature where the structure of the columns is kept as is, and you will be able to reason over your queries more easily.

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = @0
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

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        company.`name` as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        company.name as "companyName" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        company.name as "companyName" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = @0
    ```

The parameters are: `[ 12 ]`

!!! warning

    An omitted join can change the number of returned rows depending on your data structure. This behaviour doesn't happen when all rows of the initial table have one row in the joined table (or none if you use a left join), but not many rows.

## Restrict access to values

Sometimes you want to allow access to a value only under some circumstances, such as when you want a column in a dynamic select to be available only if the user has permissions. For this, you can call the function `allowWhen`, indicating as the first argument if it is allowed to use this value, and as the second argument, an error or text's error that will be thrown if the value is used in the generated query. Additionally, there is the `disallowWhen` that is analogous to `allowWhen`, but the boolean received as an argument indicates when the value is disallowed.

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = @0
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

## Select using a dynamic filter with complex projections

```ts
import { DynamicCondition } from "ts-sql-query/dynamicCondition"

type QueryFilterType = DynamicCondition<{
    id: 'int',
    name: {
        firstName: 'string',
        lastName: 'string',
    },
    birthday: 'localDate',
    company: {
        id: 'int',
        name: 'string'
    }
}>;

const queryFilter: QueryFilterType = {
    company: { name: {equals: 'ACME'} },
    name: {
        or: [
            { firstName: { containsInsensitive: 'John' } },
            { lastName: { containsInsensitive: 'Smi' } }
        ]
    }
};

const queryOrderBy = 'company.name asc insensitive, birthday desc';

const querySelectFields = {
    id: tCustomer.id,
    name: {
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
    },
    birthday: tCustomer.birthday,
    company: {
        id: tCompany.id,
        name: tCompany.name
    }
};

const queryDynamicWhere = connection.dynamicConditionFor(querySelectFields).withValues(queryFilter);

const customerWithCompanyObject = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(querySelectFields)
    .where(queryDynamicWhere)
    .orderByFromString(queryOrderBy)
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        customer.birthday as birthday, 
        company.id as `company.id`, 
        company.name as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = ? 
        and (
               lower(customer.first_name) like concat('%', lower(?), '%') 
            or lower(customer.last_name) like concat('%', lower(?), '%')
        ) 
    order by 
        lower(`company.name`) asc, 
        birthday desc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        customer.birthday as birthday, 
        company.id as `company.id`, 
        company.`name` as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.`name` = ? 
        and (
               lower(customer.first_name) like concat('%', lower(?), '%') 
            or lower(customer.last_name) like concat('%', lower(?), '%')
        ) 
    order by 
        lower(`company.name`) asc, 
        birthday desc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as "birthday", 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = :0 
        and (
               lower(customer.first_name) like lower('%' || :1 || '%') escape '\\' 
            or lower(customer.last_name) like lower('%' || :2 || '%') escape '\\'
        ) 
    order by 
        lower("company.name") asc, 
        "birthday" desc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as birthday, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = $1 
        and (
               customer.first_name ilike ('%' || $2 || '%') 
            or customer.last_name ilike ('%' || $3 || '%')
        ) 
    order by 
        lower("company.name") asc, 
        birthday desc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as birthday, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = ? 
        and (
               lower(customer.first_name) like lower('%' || ? || '%') escape '\\' 
            or lower(customer.last_name) like lower('%' || ? || '%') escape '\\'
        ) 
    order by 
        lower("company.name") asc, 
        birthday desc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as [name.firstName], 
        customer.last_name as [name.lastName], 
        customer.birthday as birthday, 
        company.id as [company.id], 
        company.name as [company.name] 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = @0 
        and (
               lower(customer.first_name) like lower('%' + @1 + '%') 
            or lower(customer.last_name) like lower('%' + @2 + '%')
        ) 
    order by 
        lower([company.name]) asc, 
        birthday desc
    ```

The parameters are: `[ "ACME", "John", "Smi" ]`

The result type is:
```tsx
const customerWithCompanyObject: Promise<{
    id: number;
    name: {
        firstName: string;
        lastName: string;
    };
    company: {
        id: number;
        name: string;
    };
    birthday?: Date;
}>
```

See [Select using a dynamic filter](#select-using-a-dynamic-filter) and [Dynamic conditions](../api/dynamic-conditions.md) for more information.

## Select dynamically picking columns with complex projections

```ts
import { dynamicPick } from "ts-sql-query/dynamicCondition"

const availableFields = {
    id: tCustomer.id,
    name: {
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
    },
    birthday: tCustomer.birthday,
    company: {
        id: tCompany.id,
        name: tCompany.name
    }
};

const fieldsToPick = {
    name: {
        firstName: true,
        lastName: true
    }
};

// include allways id field as required
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id']);

const customerWithOptionalCompany = await connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as `name.firstName`, 
        last_name as `name.lastName` 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as `name.firstName`, 
        last_name as `name.lastName` 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "name.firstName", 
        last_name as "name.lastName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "name.firstName", 
        last_name as "name.lastName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as "name.firstName", 
        last_name as "name.lastName" 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as [name.firstName], 
        last_name as [name.lastName] 
    from customer 
    where id = @0
    ```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customersOfCompany: Promise<{
    id: number;
    name?: {
        firstName?: string;
        lastName?: string;
    };
    birthday?: Date;
    company?: {
        id?: number;
        name?: string;
    };
}[]>
```

But in case of a column provided by the join is required, like when `fieldsToPick` is:
```ts
const fieldsToPick = {
    name: {
        firstName: true,
        lastName: true,
    },
    company: {
        name: true
    }
}
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        company.name as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        company.`name` as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as [name.firstName], 
        customer.last_name as [name.lastName], 
        company.name as [company.name] 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = @0
    ```

The parameters are: `[ 12 ]`

See [Select dynamically picking columns](#select-dynamically-picking-columns), [Optional joins](dynamic-queries.md#optional-joins) and [Optional joins dynamically picking columns](#optional-joins-dynamically-picking-columns) for more information.

## Full dynamic select

In this example, several functionalities are used together using dynamic conditions, optional joins and select-picking columns.

Having this code:

```ts
function buildComanyAvailableFields<CUSTOMER extends TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>>(_connection: DBConnection, favouriteCustomerRef: CUSTOMER) {
    const favouriteCustomer = fromRef(tCustomer, favouriteCustomerRef);

    return {
        id: tCompany.id,
        name: tCompany.name,
        favouriteCustomer: {
            id: favouriteCustomer.id,
            name: favouriteCustomer.firstName.concat(' ').concat(favouriteCustomer.lastName)
        }
    }
}

interface CustomerRules {
    anyCustomerNameContains?: string
    anyCustomerWithBirthdayOn?: Date
}

function buildCompanyConditionExtention<CUSTOMER extends TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>>(connection: DBConnection, favouriteCustomerRef: CUSTOMER) {
    const favouriteCustomer = fromRef(tCustomer, favouriteCustomerRef);

    return {
        customers: (rules: CustomerRules) => {
            let result = connection.dynamicBooleanExpressionUsing(tCompany)

            if (rules.anyCustomerNameContains) {
                const query = connection.subSelectUsing(tCompany)
                    .from(tCustomer)
                    .where(tCustomer.firstName.concat(' ').concat(tCustomer.lastName).containsInsensitive(rules.anyCustomerNameContains))
                    .selectOneColumn(tCustomer.id)
                
                result = result.and(connection.exists(query))
            }

            if (rules.anyCustomerWithBirthdayOn) {
                const query = connection.subSelectUsing(tCompany)
                    .from(tCustomer)
                    .where(tCustomer.birthday.equals(rules.anyCustomerWithBirthdayOn))
                    .selectOneColumn(tCustomer.id)
                
                result = result.and(connection.exists(query))
            }

            return result
        },
        favouriteCustomer: {
            isInAnotherCompanyWithName: (name: string) => {
                const query = connection.selectFrom(tCompany)
                    .where(tCompany.name.containsInsensitive(name))
                    .selectOneColumn(tCompany.favouriteCustomerId)

                return favouriteCustomer.id.in(query)
            }
        }
    }
}

type CompanyFields = DynamicPickPaths<ReturnType<typeof buildComanyAvailableFields>, 'id'>
type CompanyDynamicCondition = DynamicCondition<ReturnType<typeof buildComanyAvailableFields>, ReturnType<typeof buildCompanyConditionExtention>>
type CompanyInformation<FIELDS extends CompanyFields> = PickValuesPath<ReturnType<typeof buildComanyAvailableFields>, FIELDS | 'id'>

async function getSubcompanies<FIELDS extends CompanyFields>(connection: DBConnection, parentCompanyId: number, fields: FIELDS[], condition: CompanyDynamicCondition): Promise<CompanyInformation<FIELDS>[]> {
    const favouriteCustomer = tCustomer.forUseInLeftJoinAs('favouriteCustomer')

    const avaliableFields = buildComanyAvailableFields(connection, favouriteCustomer)
    const conditionExtention = buildCompanyConditionExtention(connection, favouriteCustomer)

    const dynamicCondition = connection.dynamicConditionFor(avaliableFields, conditionExtention).withValues(condition)
    const selectedFields = dynamicPickPaths(avaliableFields, fields, ['id'])
    
    const companies = await connection
        .selectFrom(tCompany)
        .optionalLeftOuterJoin(favouriteCustomer).on(tCompany.favouriteCustomerId.equals(favouriteCustomer.id))
        .where(dynamicCondition)
        .and(tCompany.parentId.equals(parentCompanyId))
        .select(selectedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(avaliableFields, fields, companies, ['id'])
}
```

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = getSubcompanies(connection, companyId, ['name'], {
    name: { containsInsensitive: 'ACME' }
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    where 
            lower(name) like concat('%', lower(?), '%') 
        and parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where 
            lower(`name`) like concat('%', lower(?), '%') 
        and parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where 
            lower(name) like lower('%' || :0 || '%') escape '\\' 
        and parent_id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where 
            name ilike ('%' || $1 || '%') 
        and parent_id = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where 
            lower(name) like lower('%' || ? || '%') escape '\\' 
        and parent_id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where 
            lower(name) like lower('%' + @0 + '%') 
        and parent_id = @1
    ```

The parameters are: `[ "ACME", 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
}[]>
```

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = await getSubcompanies(connection, companyId, ['name', 'favouriteCustomer.name'], { 
    customers: { anyCustomerNameContains: 'smith'} 
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        concat(favouriteCustomer.first_name, ?, favouriteCustomer.last_name) as `favouriteCustomer.name` 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name`, 
        concat(favouriteCustomer.first_name, ?, favouriteCustomer.last_name) as `favouriteCustomer.name` 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        favouriteCustomer.first_name || :0 || favouriteCustomer.last_name as "favouriteCustomer.name" 
    from company 
    left outer join customer favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        (exists(
            select id as "result" 
            from customer 
            where lower(first_name || :1 || last_name) like lower('%' || :2 || '%') escape '\\'
        ) = 1) and company.parent_id = :3
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name || $1 || favouriteCustomer.last_name as "favouriteCustomer.name" 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where (first_name || $2 || last_name) ilike ('%' || $3 || '%')
        ) and company.parent_id = $4
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name || ? || favouriteCustomer.last_name as "favouriteCustomer.name" 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where lower(first_name || ? || last_name) like lower('%' || ? || '%') escape '\\'
        ) and company.parent_id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name + @0 + favouriteCustomer.last_name as [favouriteCustomer.name] 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        (exists(
            select id as [result] 
            from customer 
            where lower(first_name + @1 + last_name) like lower('%' + @2 + '%')
        ) = 1) and company.parent_id = @3
    ```

The parameters are: `[ " ", " ", "smith", 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
    favouriteCustomer?: {
        name: string;
    };
}[]>
```

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = getSubcompanies(connection, companyId, ['name'], { 
    favouriteCustomer: { isInAnotherCompanyWithName: 'ACME Inc.' } 
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where lower(name) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name` 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where lower(`name`) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name" 
    from company 
    left outer join customer favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as "result" 
            from company 
            where lower(name) like lower('%' || :0 || '%') escape '\\'
        ) and company.parent_id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where name ilike ('%' || $1 || '%')
        ) and company.parent_id = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where lower(name) like lower('%' || ? || '%') escape '\\'
        ) and company.parent_id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as [result] 
            from company 
            where lower(name) like lower('%' + @0 + '%')
        ) and company.parent_id = @1
    ```

The parameters are: `[ "ACME Inc.", 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
}[]>
```

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = getSubcompanies(connection, companyId, ['name'], { 
        or: [ 
            { customers: { anyCustomerNameContains: 'John' }}, 
            { customers: { anyCustomerWithBirthdayOn: new Date('2000-03-01')} } 
        ] 
    })
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
            ) or exists(
                select id as result 
                from customer 
                where birthday = ?
            )
        ) and parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
            ) or exists(
                select id as result 
                from customer 
                where birthday = ?
            )
        ) and parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where 
        (
            (exists(
                select id as "result" 
                from customer 
                where lower(first_name || :0 || last_name) like lower('%' || :1 || '%') escape '\\'
            ) = 1) or (exists(
                select id as "result" 
                from customer 
                where birthday = :2
            ) = 1)
        ) and parent_id = :3
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where (first_name || $1 || last_name) ilike ('%' || $2 || '%')
            ) or exists(
                select id as result 
                from customer 
                where birthday = $3
            )
        ) and parent_id = $4
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where lower(first_name || ? || last_name) like lower('%' || ? || '%') escape '\\'
            ) or exists(
                select id as result 
                from customer 
                where birthday = ?
            )
        ) and parent_id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            (exists(
                select id as [result] 
                from customer 
                where lower(first_name + @0 + last_name) like lower('%' + @1 + '%')
            ) = 1) or (exists(
                select id as [result] 
                from customer 
                where birthday = @2
            ) = 1)
        ) and parent_id = @3
    ```

The parameters are: `[ " ", "John", 2000-03-01T00:00:00.000Z, 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
}[]>
```

## Summary and when to use these patterns

The techniques in this page should be considered advanced and used with care. They are useful in scenarios where the structure of the query — both in terms of selected columns and applied filters — must be determined at runtime.

If you find yourself using these patterns often, consider whether a change in your API design might make your system easier to reason about. Simpler alternatives such as optional projections, or multiple well-defined query shapes, may offer better maintainability.