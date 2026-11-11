---
search:
  boost: 1
---
# Functions that return a dynamic select

This example puts everything together in one function: `getSubcompanies` returns the subcompanies of a company. The caller chooses the columns and passes a filter and an order, and the type of the result has only the columns they asked for. The query joins the favourite customer only when it's needed.

Consider this when a single function serves many callers, like the layer behind a list in a user interface or an API. For a few fixed cases, a few separate queries are easier to read.

The same function can be typed in two ways:

- **[From the database](#from-the-database):** the types come from the available columns, with `DynamicPickPaths`, `PickValuesPath` and `DynamicCondition` over the map. See [Typing dynamic queries from the database types](from-database-types.md).
- **[From the model](#from-the-model):** the signature uses an interface you write, with `DynamicConditionForModel`, `DeepPickPaths`, `DeepPick` and `expandTypeFromDynamicPickPaths`, so no type of a column appears in it. See [Typing dynamic queries from a business model](from-business-model.md) and [Deep utilities](../../advanced/deep-utilities.md).

Both receive the order as an array of clauses typed with [`OrderByForModel`](../helper-types/order-by.md), applied with `orderByFromStringArrayIfValue`, so each clause must be a valid field and mode. `orderByFromString` takes a plain `string`, so this typing is optional.

### From the database

Having this code, which is explained below:

<!-- doc-code-snippet-template: mariadb, mysql, oracle, postgresql, sqlite, sqlserver -->
```typescript
function buildCompanyAvailableFields<CUSTOMER extends TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>>(_connection: DBConnection, favouriteCustomerRef: CUSTOMER) {
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

function buildCompanyConditionExtension<CUSTOMER extends TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>>(connection: DBConnection, favouriteCustomerRef: CUSTOMER) {
    const favouriteCustomer = fromRef(tCustomer, favouriteCustomerRef);

    return {
        customers: (rules: CustomerRules) => {
            let result = connection.dynamicBooleanExpressionUsing(tCompany)

            if (rules.anyCustomerNameContains) {
                const query = connection.subSelectUsing(tCompany)
                    .from(tCustomer)
                    .where(tCustomer.companyId.equals(tCompany.id))
                    .and(tCustomer.firstName.concat(' ').concat(tCustomer.lastName).containsInsensitive(rules.anyCustomerNameContains))
                    .selectOneColumn(tCustomer.id)
                
                result = result.and(connection.exists(query))
            }

            if (rules.anyCustomerWithBirthdayOn) {
                const query = connection.subSelectUsing(tCompany)
                    .from(tCustomer)
                    .where(tCustomer.companyId.equals(tCompany.id))
                    .and(tCustomer.birthday.equals(rules.anyCustomerWithBirthdayOn))
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

type CompanyFields = DynamicPickPaths<ReturnType<typeof buildCompanyAvailableFields>, 'id'>
type CompanyDynamicCondition = DynamicCondition<ReturnType<typeof buildCompanyAvailableFields>, ReturnType<typeof buildCompanyConditionExtension>>
type CompanyInformation<FIELDS extends CompanyFields> = PickValuesPath<ReturnType<typeof buildCompanyAvailableFields>, FIELDS | 'id'>

async function getSubcompanies<FIELDS extends CompanyFields>(connection: DBConnection, parentCompanyId: number, fields: FIELDS[], condition: CompanyDynamicCondition, orderBy?: OrderByForModel<CompanyInformation<CompanyFields>>[]): Promise<CompanyInformation<FIELDS>[]> {
    const favouriteCustomer = tCustomer.forUseInLeftJoinAs('favouriteCustomer')

    const availableFields = buildCompanyAvailableFields(connection, favouriteCustomer)
    const conditionExtension = buildCompanyConditionExtension(connection, favouriteCustomer)

    const dynamicCondition = connection.dynamicConditionFor(availableFields, conditionExtension).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])
    
    const companies = await connection
        .selectFrom(tCompany)
        .optionalLeftOuterJoin(favouriteCustomer).on(tCompany.favouriteCustomerId.equals(favouriteCustomer.id))
        .where(dynamicCondition)
        .and(tCompany.parentId.equals(parentCompanyId))
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, companies, ['id'])
}
```

The pieces of this code are:

| Piece | What it does |
|---|---|
| `buildCompanyAvailableFields` | Returns the map of columns the caller can pick and filter by. Being a function, its type is available to the types below, even though the alias of the left join is created inside `getSubcompanies` |
| `favouriteCustomerRef` | The table as a parameter. `TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>` is the type for `tCustomer.forUseInLeftJoinAs('favouriteCustomer')`, and `fromRef` gives back its columns. See [Passing tables and views as parameter](../../advanced/tables-views-as-parameter.md) |
| `buildCompanyConditionExtension` | The rules of the filter that aren't a column: `customers` and `favouriteCustomer.isInAnotherCompanyWithName`. The first one builds its condition with `if`s, using [`dynamicBooleanExpressionUsing`](../going-further/building-conditions.md#a-condition-in-a-variable) |
| `CompanyFields` | The names the caller can pick, without `id`, which is always returned |
| `CompanyDynamicCondition` | The type of the filter: the columns of the map and the rules |
| `CompanyInformation<FIELDS>` | The type of a row with only the columns in `FIELDS`, plus `id` |
| `expandTypeFromDynamicPickPaths` | Gives the rows that type, and returns them as they are. See [Expanding result types](../helper-types/picks.md#expanding-result-types-from-dynamic-picks) |

The order is an array of clauses that name properties of the select: as in any [pick](../caller-decides/picks.md), naming one that wasn't picked throws `ORDER_BY_COLUMN_NOT_IN_SELECT`.

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
        name as name 
    from company 
    where 
            lower(name) like concat('%', lower(?), '%') 
        and parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where 
            lower(name) like lower('%' || :0 || '%') escape '\' 
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
            lower(name) like lower('%' || ?1 || '%') escape '\' 
        and parent_id = ?2
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
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where 
                    company_id = company.id 
                and lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.name as name, 
        concat(favouriteCustomer.first_name, ?, favouriteCustomer.last_name) as `favouriteCustomer.name` 
    from company 
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where 
                    company_id = company.id 
                and lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        case when favouriteCustomer.first_name is null or favouriteCustomer.last_name is null then null else favouriteCustomer.first_name || :0 || favouriteCustomer.last_name end as "favouriteCustomer.name" 
    from company 
    left outer join customer favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        exists(
            select id as "result" 
            from customer 
            where 
                    company_id = company.id 
                and lower(first_name || :1 || last_name) like lower('%' || :2 || '%') escape '\'
        ) and company.parent_id = :3
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name || $1 || favouriteCustomer.last_name as "favouriteCustomer.name" 
    from company 
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where 
                    company_id = company.id 
                and (first_name || $2 || last_name) ilike ('%' || $3 || '%')
        ) and company.parent_id = $4
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name || ?1 || favouriteCustomer.last_name as "favouriteCustomer.name" 
    from company 
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where 
                    company_id = company.id 
                and lower(first_name || ?2 || last_name) like lower('%' || ?3 || '%') escape '\'
        ) and company.parent_id = ?4
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name + @0 + favouriteCustomer.last_name as [favouriteCustomer.name] 
    from company 
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where 
                    company_id = company.id 
                and lower(first_name + @1 + last_name) like lower('%' + @2 + '%')
        ) and company.parent_id = @3
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
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select favourite_customer_id as result 
            from company 
            where lower(name) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select favourite_customer_id as result 
            from company 
            where lower(name) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name" 
    from company 
    left outer join customer favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select favourite_customer_id as "result" 
            from company 
            where lower(name) like lower('%' || :0 || '%') escape '\'
        ) and company.parent_id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select favourite_customer_id as result 
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
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select favourite_customer_id as result 
            from company 
            where lower(name) like lower('%' || ?1 || '%') escape '\'
        ) and company.parent_id = ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.favourite_customer_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select favourite_customer_id as result 
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
                where 
                        company_id = company.id 
                    and lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
            ) or exists(
                select id as result 
                from customer 
                where 
                        company_id = company.id 
                    and birthday = ?
            )
        ) and parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where 
                        company_id = company.id 
                    and lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
            ) or exists(
                select id as result 
                from customer 
                where 
                        company_id = company.id 
                    and birthday = ?
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
            exists(
                select id as "result" 
                from customer 
                where 
                        company_id = company.id 
                    and lower(first_name || :0 || last_name) like lower('%' || :1 || '%') escape '\'
            ) or exists(
                select id as "result" 
                from customer 
                where 
                        company_id = company.id 
                    and birthday = :2
            )
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
                where 
                        company_id = company.id 
                    and (first_name || $1 || last_name) ilike ('%' || $2 || '%')
            ) or exists(
                select id as result 
                from customer 
                where 
                        company_id = company.id 
                    and birthday = $3
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
                where 
                        company_id = company.id 
                    and lower(first_name || ?1 || last_name) like lower('%' || ?2 || '%') escape '\'
            ) or exists(
                select id as result 
                from customer 
                where 
                        company_id = company.id 
                    and birthday = ?3
            )
        ) and parent_id = ?4
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where 
                        company_id = company.id 
                    and lower(first_name + @0 + last_name) like lower('%' + @1 + '%')
            ) or exists(
                select id as result 
                from customer 
                where 
                        company_id = company.id 
                    and birthday = @2
            )
        ) and parent_id = @3
    ```

The parameters are: `[ " ", "John", 2000-03-01T00:00:00.000Z, 23 ]` (on SQLite: `[ " ", "John", "2000-03-01", 23 ]`)

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
}[]>
```

### From the model

The same query, typed from an interface you write instead of from the columns. The body still builds the map of columns, which it needs for the SQL, but the signature uses only `CompanyInformationModel`: `DynamicConditionForModel` types the filter, `DeepPickPaths` and `DeepPick` type the pick, and `OrderByForModel` types the order. Each one is explained in [Typing dynamic queries from a business model](from-business-model.md) and [Deep utilities](../../advanced/deep-utilities.md).

<!-- doc-code-snippet-template: mariadb, mysql, oracle, postgresql, sqlite, sqlserver -->
```typescript
interface CompanyInformationModel {
    id: number
    name: string
    favouriteCustomer?: {
        id: number
        name: string
    }
}

async function getSubcompaniesFromModel<FIELDS extends DeepPickPaths<CompanyInformationModel>>(connection: DBConnection, parentCompanyId: number, fields: FIELDS[], condition: DynamicConditionForModel<CompanyInformationModel>, orderBy?: OrderByForModel<CompanyInformationModel>[]): Promise<DeepPick<CompanyInformationModel, FIELDS | 'id'>[]> {
    const favouriteCustomer = tCustomer.forUseInLeftJoinAs('favouriteCustomer')

    const availableFields = {
        id: tCompany.id,
        name: tCompany.name,
        favouriteCustomer: {
            id: favouriteCustomer.id,
            name: favouriteCustomer.firstName.concat(' ').concat(favouriteCustomer.lastName)
        }
    }

    const dynamicCondition = connection.dynamicConditionFor(availableFields).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const companies = await connection
        .selectFrom(tCompany)
        .optionalLeftOuterJoin(favouriteCustomer).on(tCompany.favouriteCustomerId.equals(favouriteCustomer.id))
        .where(dynamicCondition)
        .and(tCompany.parentId.equals(parentCompanyId))
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, companies, ['id'])
}
```

You call it the same way, but every type the caller sees comes from `CompanyInformationModel`, including the order, which is checked against it:

```ts
const result = await getSubcompaniesFromModel(connection, 23, ['name', 'favouriteCustomer.name'],
    { name: { containsInsensitive: 'ACME' } },
    ['favouriteCustomer.name asc nulls last', 'name desc'])
```

!!! note "The rules of the filter still come from the database"

    `DynamicConditionForModel` turns the fields of the model into the usual operators. A rule of your own, like `customers` or `isInAnotherCompanyWithName` in the previous version, is written against the tables. To keep it, build the extension in the same way, and pass it as the second argument of both `DynamicConditionForModel<Model, Extension>` and `dynamicConditionFor(availableFields, extension)`.
