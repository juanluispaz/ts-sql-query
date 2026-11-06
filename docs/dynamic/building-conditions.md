---
search:
  boost: 1.5
---
# Building a condition step by step

!!! warning "This is not the usual way of writing a dynamic query"

    Prefer a [declarative query](../queries/dynamic-queries.md#declarative-dynamic-queries): the `*IfValue` methods and `onlyWhen`, in the place where each condition goes. If you are used to assembling queries with `if`s, this page can look like the easier path, and it isn't. With `if`s, the condition is no longer in the text of the query: to know what runs, the reader has to follow your code, and every `if` makes that harder.

    This is for the cases that really need to go further, when what to add depends on logic that those methods can't express.

When what to add depends on the logic of your code, and not just on whether a value is present, you build the condition with your own `if`s.

| You need to | Use |
|---|---|
| Add conditions to the `where` of a query while you build it | [`dynamicWhere`](#adding-conditions-to-the-query) |
| Keep a condition in a variable, to build it in a function or use it in a `where`, an `on` or a `having` | [`dynamicBooleanExpressionUsing`](#a-condition-in-a-variable) |
| Share a condition between queries | [A function that receives the table](#bringing-a-condition-from-outside-the-query) |
| Add conditions to the `on` of a join or to the `having` | [`dynamicOn`, `dynamicHaving`](#dynamic-join-conditions-and-having) |

They can all receive `*IfValue` conditions too, and when nothing is added the result is [an empty condition](../queries/dynamic-queries.md#a-condition-that-ends-up-empty).

## Adding conditions to the query

`dynamicWhere()` starts the `where` with no condition. Then `and(...)` and `or(...)` add conditions to the query, and there's no need to reassign the variable:

```ts
const companyId: number | undefined = 16;
const onlyWithBirthday = true;

const query = connection.selectFrom(tCustomer)
    .dynamicWhere();
if (companyId !== undefined) {
    query.and(tCustomer.companyId.equals(companyId));
}
if (onlyWithBirthday) {
    query.and(tCustomer.birthday.isNotNull());
}

const customers = await query
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = ? 
        and birthday is not null
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = ? 
        and birthday is not null
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where 
            company_id = :0 
        and birthday is not null
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    where 
            company_id = $1 
        and birthday is not null
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = ?1 
        and birthday is not null
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 
            company_id = @0 
        and birthday is not null
    ```

The parameters are: `[ 16 ]`

## Dynamic join conditions and having

Like `dynamicWhere()`, `dynamicOn()` starts the condition of a join and `dynamicHaving()` the having, with no condition; then `and(...)` and `or(...)` add the conditions while the query is built:

```ts
const onlyCustomersWithBirthday = true;
const minimumCustomers: number | undefined = 2;

const query = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).dynamicOn()
    .and(tCustomer.companyId.equals(tCompany.id));
if (onlyCustomersWithBirthday) {
    query.and(tCustomer.birthday.isNotNull());
}

const grouped = query.groupBy(tCompany.id, tCompany.name).dynamicHaving();
if (minimumCustomers !== undefined) {
    grouped.and(connection.count(tCustomer.id).greaterOrEqual(minimumCustomers));
}

const companies = await grouped
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id,
        company.`name` as `name`,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.`name`
    having count(customer.id) >= ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id",
        company.name as "name",
        count(customer.id) as "customerCount"
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as "customerCount"
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= $1
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= @0
    ```

The parameters are: `[ 2 ]`

The result type is:
```tsx
const companies: Promise<{
    id: number;
    name: string;
    customerCount: number;
}[]>
```

## A condition in a variable

`connection.dynamicBooleanExpressionUsing(...)` creates a [neutral boolean](../queries/dynamic-queries.md#the-neutral-boolean) in a variable that you can reassign. It receives the tables or views that the conditions are going to use, up to five. Each `and` and `or` returns a new condition, so assign it to the variable. Unlike `dynamicWhere`, the result isn't tied to a query: you can build it in a function, and use it in a `where`, an `on` or a `having`.

```ts
const firstNameContains: string | null = 'ohn';
const companyName: string | null = 'Acme';

let condition = connection.dynamicBooleanExpressionUsing(tCustomer, tCompany);
if (firstNameContains) {
    condition = condition.and(tCustomer.firstName.contains(firstNameContains));
}
if (companyName) {
    condition = condition.or(tCompany.name.equals(companyName));
}

const customers = await connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .where(condition)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
           customer.first_name like concat('%', ?, '%') 
        or company.name = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
           customer.first_name like concat('%', ?, '%') 
        or company.`name` = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
           customer.first_name like ('%' || :0 || '%') escape '\' 
        or company.name = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
           customer.first_name like ('%' || $1 || '%') 
        or company.name = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
           customer.first_name like ('%' || ?1 || '%') escape '\' 
        or company.name = ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
           customer.first_name like ('%' + @0 + '%') 
        or company.name = @1
    ```

The parameters are: `[ 'ohn', 'Acme' ]`

This is the query of [Optional conditions: the IfValue methods](../queries/dynamic-queries.md#optional-conditions-the-ifvalue-methods), written with `if`s:

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
        lower(concat(first_name, ?, last_name)), 
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
        lower(concat(first_name, ?, last_name)), 
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
    where first_name like ('%' || :1 || '%') escape '\' 
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
        lower(first_name || $1 || last_name), 
        birthday asc nulls last
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name, 
        birthday as birthday 
    from customer 
    where first_name like ('%' || ?2 || '%') escape '\' 
    order by 
        lower(first_name || ?1 || last_name), 
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
        lower(first_name + @0 + last_name), 
        iif(customer.birthday is null, 1, 0), 
        birthday asc
    ```

The parameters are: `[ ' ', 'ohn' ]` (on [MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) the case-insensitive `order by` writes the concatenated expression again, with its separator bound again, giving `[ ' ', 'ohn', ' ' ]`: inside an `order by` expression these databases would take a column of the table with the same name as the alias before the alias, and they can't repeat a parameter)

The result type is:
```tsx
const searchedCustomers: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```

If no `if` adds anything, the condition stays neutral and the query has no `where`. Each `.and` or `.or` applies to everything written before it, as the code reads: `.and(a).or(b).and(c)` is `(a or b) and c`.

## Bringing a condition from outside the query

A condition is a value, so a function can build it and any query can use it. When the query uses an alias of the table, the function has to receive that alias: `TableOrViewOf` is the type of the parameter, and `fromRef` gives back the columns of the table, as [Passing tables and views as parameter](../advanced/tables-views-as-parameter.md) explains.

```ts
import { fromRef, type TableOrViewOf } from 'ts-sql-query' // or 'ts-sql-query/extras/types'

function nameContains<CUSTOMER extends TableOrViewOf<typeof tCustomer, 'customer'>>(customerRef: CUSTOMER, text: string | null | undefined) {
    const customer = fromRef(tCustomer, customerRef);

    return customer.firstName.containsInsensitiveIfValue(text)
        .or(customer.lastName.containsInsensitiveIfValue(text));
}

const customer = tCustomer.as('customer');

const customers = await connection.selectFrom(customer)
    .where(nameContains(customer, 'smi'))
    .select({
        id: customer.id,
        firstName: customer.firstName
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer as customer 
    where 
           lower(customer.first_name) like concat('%', lower(?), '%') 
        or lower(customer.last_name) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer as customer 
    where 
           lower(customer.first_name) like concat('%', lower(?), '%') 
        or lower(customer.last_name) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName" 
    from customer customer 
    where 
           lower(customer.first_name) like lower('%' || :0 || '%') escape '\' 
        or lower(customer.last_name) like lower('%' || :1 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName" 
    from customer as customer 
    where 
           customer.first_name ilike ('%' || $1 || '%') 
        or customer.last_name ilike ('%' || $2 || '%')
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer as customer 
    where 
           lower(customer.first_name) like lower('%' || ?1 || '%') escape '\' 
        or lower(customer.last_name) like lower('%' || ?2 || '%') escape '\'
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName 
    from customer as customer 
    where 
           lower(customer.first_name) like lower('%' + @0 + '%') 
        or lower(customer.last_name) like lower('%' + @1 + '%')
    ```

The parameters are: `[ 'smi', 'smi' ]`

A table used in a left join is received with `TableOrViewLeftJoinOf`, as in [a function that returns a dynamic select](dynamic-select-functions.md), which builds its columns and the rules of its filter in the same way.
