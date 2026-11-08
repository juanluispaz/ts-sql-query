---
search:
  boost: 1.5
---
# Optional joins

An optional join is a join that the library writes in the SQL only if the query uses the joined table. It's meant for a query whose columns or conditions are decided while it runs: if the query doesn't need the table, the database doesn't have to read it.

Each normal join has an optional variant, and it's written in the SQL in the same way as that join when it's needed:

| Optional join | The same as |
|---|---|
| `optionalJoin(table)` | `join(table)` |
| `optionalInnerJoin(table)` | `innerJoin(table)` |
| `optionalLeftJoin(table.forUseInLeftJoin())` | `leftJoin(table.forUseInLeftJoin())` |
| `optionalLeftOuterJoin(table.forUseInLeftJoin())` | `leftOuterJoin(table.forUseInLeftJoin())` |

They're available in a select, and the type of the columns is the same as with the normal join. In this example, the join is only needed if `companyName` has a value:

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

=== "MariaDB"
    ```mariadb
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.`name` = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as "birthday" 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = @0
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

But when `companyName` is null or undefined, the condition in the where is left out. The company table isn't used anymore, so the join is left out too:
```ts
const companyName = null // CHANGED

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

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```

The parameters are: `[ ]`

## When a join is kept and when it's left out

The library looks at what will be written in the query. A join is kept if its table is used in any of these places:

| The table is used in | Example | The join is |
|---|---|---|
| A selected value | `companyName: tCompany.name` | Kept |
| A condition of the `where` or `having` that has a value | `tCompany.name.equalsIfValue('Acme')` | Kept |
| A condition without a value | `tCompany.name.equalsIfValue(null)`, even with `.trueWhenNoValue()` | Left out |
| A condition that doesn't apply | `tCompany.name.equals('Acme').onlyWhen(false)` | Left out |
| A value replaced by null | `tCompany.name.onlyWhenOrNull(false)` | Left out |
| The `group by` | `.groupBy(tCompany.name)` | Kept |
| An `orderBy` with an expression | `.orderBy(tCompany.name)` | Kept |
| The `on` of a normal join | `.join(tOther).on(tOther.id.equals(tCompany.parentId))` | Kept |
| The `on` of another optional join that is kept | The same with `optionalJoin(tOther)`, if `tOther` is used | Kept |
| A subquery written in the query | `connection.subSelectUsing(tCompany)...` | Kept |
| A fragment in [`customizeQuery`](../../queries/sql-fragments.md#customizing-a-select) | A `rawFragment` that uses `tCompany.name` | Kept |

If an optional join uses another one in its `on`, using the last one keeps both, and using only the first one keeps only the first one.

## It can change the number of rows

!!! warning

    The rows of the result can depend on whether the join is written, so check what the join does with your data.

A join doesn't only add columns: it can also remove and repeat rows. When an optional join is left out, that effect isn't there:

| Rows of the joined table for each row of the initial table | `optionalJoin`, `optionalInnerJoin` | `optionalLeftJoin`, `optionalLeftOuterJoin` |
|---|---|---|
| Exactly one | Same rows with and without the join | Same rows with and without the join |
| Sometimes none | The rows without a match are only there without the join | Same rows with and without the join |
| Sometimes more than one | The rows with several matches are repeated with the join, and once without it | The rows with several matches are repeated with the join, and once without it |

So the typical optional join goes to the row that a foreign key points to, like the company of a customer: a required foreign key gives exactly one row, and a left join covers one that can be null. An optional join to the customers of a company returns a different number of rows depending on whether it's written.

## Optional joins with a value replaced by null

Optional joins go well with [`onlyWhenOrNull`](../../queries/dynamic-queries.md#ignorable-values-onlywhenornull): the properties of the result are always the same, and the join is written only if they are going to have a value.

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

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday", 
        null as "companyId", 
        null as "companyName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday, 
        $1::int4 as "companyId", 
        $2::text as "companyName" 
    from customer 
    where id = $3
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = @0
    ```

The parameters are: `[ 12 ]`; on PostgreSQL, `[ null, null, 12 ]`, because there a null of a known type is sent as a parameter that carries its type.

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

But when a column provided by the join is required, because `canSeeCompanyInfo` is true:
```ts
const canSeeCompanyInfo = true // CHANGED

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

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.id as companyId, 
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
        customer.birthday as birthday, 
        company.id as companyId, 
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
        customer.birthday as "birthday", 
        company.id as "companyId", 
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
        customer.birthday as birthday, 
        company.id as "companyId", 
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
        customer.birthday as birthday, 
        company.id as companyId, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.id as companyId, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = @0
    ```

The parameters are: `[ 12 ]`

With a left join, the columns of the joined table are optional in the result type, as in any left join:

```ts
const canSeeCompanyInfo = true;
const tCompanyForLeftJoin = tCompany.forUseInLeftJoin();

const customerWithOptionalCompany = await connection.selectFrom(tCustomer)
    .optionalLeftJoin(tCompanyForLeftJoin).on(tCompanyForLeftJoin.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        companyName: tCompanyForLeftJoin.name.onlyWhenOrNull(canSeeCompanyInfo)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as companyName 
    from customer 
    left join company on company.id = customer.company_id
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.`name` as companyName 
    from customer 
    left join company on company.id = customer.company_id
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        company.name as "companyName" 
    from customer 
    left join company on company.id = customer.company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        company.name as "companyName" 
    from customer 
    left join company on company.id = customer.company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as companyName 
    from customer 
    left join company on company.id = customer.company_id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as companyName 
    from customer 
    left join company on company.id = customer.company_id
    ```

The parameters are: `[]`

The result type is:
```tsx
const customerWithOptionalCompany: {
    id: number;
    firstName: string;
    companyName?: string;
}[]
```

When the columns are chosen by the caller, the join can depend on them too: see [The joins follow what is picked](../caller-decides/picks.md#the-joins-follow-what-is-picked).
