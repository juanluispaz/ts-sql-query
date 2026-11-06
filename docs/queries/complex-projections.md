---
search:
  boost: 2
---
# Complex projections

A complex projection gives each row of the result the shape of a nested object, instead of a flat list of columns. It's the way to answer things like "each customer with their name grouped in an object", or "each company with its parent company in a `parent` property, when it has one".

Don't confuse it with an [array in a column](aggregate-as-object-array.md): here each row of the database is one object of the result, so a nested object holds data of one row. To have several related rows inside one object, for example each company with the list of its customers, you need an array.

The question to keep in mind is what happens with the nested object when its columns have no value. The [rules](#rules-for-nested-object-projections) decide whether the object is required or optional, and when it's absent.

## Nested object projections

The result of a query doesn't need to be a flat object: a property of the object you pass to `select` can be another object. Multiple levels of nesting are supported.

!!! warning "Limitation"

    - Only 5 nesting levels are supported; the object passed to `select` is the first level.

```ts
const companyId = 24;

const customersOfCompany = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(companyId))
    .select({
        id: tCustomer.id,
        name: {
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName,
        },
        birthday: tCustomer.birthday
    })
    .orderBy('name.firstName')
    .orderBy('name.lastName')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as `name.firstName`, 
        last_name as `name.lastName`, 
        birthday as birthday 
    from customer 
    where company_id = ? 
    order by 
        `name.firstName`, 
        `name.lastName`
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as `name.firstName`, 
        last_name as `name.lastName`, 
        birthday as birthday 
    from customer 
    where company_id = ? 
    order by 
        `name.firstName`, 
        `name.lastName`
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "name.firstName", 
        last_name as "name.lastName", 
        birthday as "birthday" 
    from customer 
    where company_id = :0 
    order by 
        "name.firstName", 
        "name.lastName"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "name.firstName", 
        last_name as "name.lastName", 
        birthday as birthday 
    from customer 
    where company_id = $1 
    order by 
        "name.firstName", 
        "name.lastName"
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as "name.firstName", 
        last_name as "name.lastName", 
        birthday as birthday 
    from customer 
    where company_id = ?1 
    order by 
        "name.firstName", 
        "name.lastName"
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as [name.firstName], 
        last_name as [name.lastName], 
        birthday as birthday 
    from customer 
    where company_id = @0 
    order by 
        [name.firstName], 
        [name.lastName]
    ```

The parameters are: `[ 24 ]`

The result type is:
```tsx
const customersOfCompany: Promise<{
    id: number;
    name: {
        firstName: string;
        lastName: string;
    };
    birthday?: Date;
}[]>
```

### How the nesting is built

The rows that a database returns are always flat: a list of columns with a name. There is no nesting in SQL, so the library writes the path of each property as the alias of its column, like `name.firstName`, and builds the object when the row arrives. These are the steps for one row:

| Column of the row | Value | Goes to |
|---|---|---|
| `id` | `1` | `id` |
| `name.firstName` | `'Ada'` | `name.firstName` |
| `name.lastName` | `'Lovelace'` | `name.lastName` |
| `birthday` | `null` | Nothing: `birthday` isn't set |

And the result is `{ id: 1, name: { firstName: 'Ada', lastName: 'Lovelace' } }`.

So the nesting costs nothing in the database: the query is the same as with a flat select, and only the aliases change. The path is also the way to name the property in `orderBy`, as in `orderBy('name.firstName')`.

Nested objects work in the same way in the `returning` of an [insert](insert.md#insert-returning), an update or a delete, and they are kept in a [compound select](compound-select.md) and in a [select used as a view](cte-subqueries.md#the-columns-of-the-view).

!!! tip

    You can also [group the columns in the definition of the table](../configuration/mapping.md#grouping-columns), like `ubication: { latitude, longitude }`, and read and write them with that shape. When you select a group, it follows the [rules](#rules-for-nested-object-projections) of this page in the same way.

## Rules for nested object projections

When a nested object is projected, the library has to decide what to do when some of its columns have no value (they arrive as `null`). The same rules decide the type of the result and the object you get at runtime. A property with no value is absent: it isn't set in the object.

**Rules (in priority order)**:

1. In the case there are properties defined as `asRequiredInOptionalObject`: all other non-required properties will be marked as optional; the properties defined as `asRequiredInOptionalObject` will be considered required; the object will be considered optional. If any property defined as `asRequiredInOptionalObject` has no value, the whole object will be ignored, independently if there are other properties with value.
2. In the case that all properties are coming from the same outer (left) join and the original table has required properties, those properties will be treated automatically as `asRequiredInOptionalObject`.
3. In the case there are required properties or required inner objects: all other non-required properties or non-required inner objects properties will be marked as optional; the object will be considered required.
4. In any other case: all properties and inner objects will be marked as optional, the object will be considered optional.

The first rule that matches is the one applied, and it's applied to each nested object on its own. In short:

| Rule | What the object has | The object is | It's absent when |
|---|---|---|---|
| 1 | A value marked with `asRequiredInOptionalObject` | Optional | Any of the marked values has no value |
| 2 | Only columns of the same left join, and at least one is required in its table | Optional | Any of those required columns has no value, which means the join found no row |
| 3 | A required value, or a required inner object | Required | Never |
| 4 | Anything else | Optional | None of its properties has a value |

The object passed to `select` is the first level, and it's always there: the rules only apply to the objects inside it. In the first level, a value marked with `asRequiredInOptionalObject` or a column of a left join is just an optional property. The exception is [`aggregateAsArray`](aggregate-as-object-array.md#optional-values-in-the-elements), where each element of the array follows the rules.

??? note "Detailed rules"

    The following is a more detailed version of the rules explained above (in priority order):

    1. There are `asRequiredInOptionalObject` fields:
        - the resulting object is marked as optional
        - `asRequiredInOptionalObject` fields are marked as required
        - required objects remain as required but must not exist if the `asRequiredInOptionalObject` fields have no value (ignoring the inner objects)
        - inner objects remain as in their definition but must not exist if the `asRequiredInOptionalObject` fields have no value (ignoring the inner objects)
        - required fields coming from a left join & optional fields are marked as optional
    2. All fields (minimum one, ignoring inner objects) have the same identical outer (left) join dependency
        - the fields that were required because the value is required in the original table used for the outer join will be treated as
        `asRequiredInOptionalObject` in the same way described in the previous point.
    3. There are required fields or inner objects:
        - the resulting object is marked as required
        - required fields are marked as required
        - optional fields are marked as optional
        - inner objects remain as in their definition
    4. There are no required fields or inner objects:
        - the resulting object is marked as optional
        - optional fields are marked as optional
        - inner objects remain as in their definition

### What a left join does

A left join keeps the row of the main table when the joined table has no matching row, and then all the columns of the joined table arrive as `null`, even the ones that can't be null in that table. That's why, when you indicate that a table will be used in a left join (`forUseInLeftJoin` or `forUseInLeftJoinAs`), all its required columns are treated as optional; the rule number 2 is the only one that can revert it implicitly.

Rule 2 uses what this means: if a column that can't be null in its table arrives as `null`, the join found no row, and there is no object to build.

### Rule 1: a value marked as required in the optional object

You mark the values without which the object makes no sense. A company has a location only if it has both coordinates:

```ts
const companiesWithUbication = connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        ubication: {
            latitude: tCompany.ubicationLatitude.asRequiredInOptionalObject(),
            longitude: tCompany.ubicationLongitude.asRequiredInOptionalObject(),
            comment: tCompany.ubicationComment
        }
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        ubication_latitude as [ubication.latitude], 
        ubication_longitude as [ubication.longitude], 
        ubication_comment as [ubication.comment] 
    from company
    ```

The parameters are: `[]`

The result type is:
```tsx
const companiesWithUbication: Promise<{
    id: number;
    ubication?: {
        latitude: string;
        longitude: string;
        comment?: string;
    };
}[]>
```

| `ubication.latitude` | `ubication.longitude` | `ubication.comment` | `ubication` in the result |
|---|---|---|---|
| `'40.4'` | `'-3.7'` | `'Main office'` | `{ latitude: '40.4', longitude: '-3.7', comment: 'Main office' }` |
| `'40.4'` | `'-3.7'` | `null` | `{ latitude: '40.4', longitude: '-3.7' }` |
| `'40.4'` | `null` | `'Main office'` | Absent, because `longitude` is marked and has no value |
| `null` | `null` | `null` | Absent |

The mark can also be used in a left join, on a column of the joined table, and then the marked values are the ones that decide: the other columns of the join are optional in the object, even if they are required in their table.

### Rule 2: all the columns from the same left join

The columns of the object come from one left join and at least one is required in its table. You don't need to mark anything:

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const companiesWithParent = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        id: tCompany.id,
        parent: {
            id: parent.id,
            name: parent.name,
            parentId: parent.parentId
        }
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        parent.id as `parent.id`, 
        parent.name as `parent.name`, 
        parent.parent_id as `parent.parentId` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        parent.id as `parent.id`, 
        parent.`name` as `parent.name`, 
        parent.parent_id as `parent.parentId` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parent.parent_id as "parent.parentId" 
    from company 
    left join company parent on company.parent_id = parent.id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parent.parent_id as "parent.parentId" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parent.parent_id as "parent.parentId" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        parent.id as [parent.id], 
        parent.name as [parent.name], 
        parent.parent_id as [parent.parentId] 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```

The parameters are: `[]`

The result type is:
```tsx
const companiesWithParent: Promise<{
    id: number;
    parent?: {
        id: number;
        name: string;
        parentId?: number;
    };
}[]>
```

| `parent.id` | `parent.name` | `parent.parentId` | `parent` in the result |
|---|---|---|---|
| `2` | `'ACME Spain'` | `1` | `{ id: 2, name: 'ACME Spain', parentId: 1 }` |
| `1` | `'ACME'` | `null` | `{ id: 1, name: 'ACME' }`: the join found a row, and only an optional column has no value |
| `null` | `null` | `null` | Absent: the join found no row |

The object can have values with no table too, like a [constant](basic-query-structure.md#constant-values), and the rule still applies: they don't keep the object when the join found no row. The rule doesn't apply when the object has an expression that mixes columns of two left joins. Inner objects aren't taken into account here.

Instead of listing the columns, you can use the left-joined table itself as the nested object. It's an object with all the columns of the table, and it follows the same rule:

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const companiesWithWholeParent = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        id: tCompany.id,
        parent: parent
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        parent.id as `parent.id`, 
        parent.name as `parent.name`, 
        parent.parent_id as `parent.parentId`, 
        parent.favourite_customer_id as `parent.favouriteCustomerId`, 
        parent.ubication_latitude as `parent.ubicationLatitude`, 
        parent.ubication_longitude as `parent.ubicationLongitude`, 
        parent.ubication_comment as `parent.ubicationComment` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        parent.id as `parent.id`, 
        parent.`name` as `parent.name`, 
        parent.parent_id as `parent.parentId`, 
        parent.favourite_customer_id as `parent.favouriteCustomerId`, 
        parent.ubication_latitude as `parent.ubicationLatitude`, 
        parent.ubication_longitude as `parent.ubicationLongitude`, 
        parent.ubication_comment as `parent.ubicationComment` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parent.parent_id as "parent.parentId", 
        parent.favourite_customer_id as "parent.favouriteCustomerId", 
        parent.ubication_latitude as "parent.ubicationLatitude", 
        parent.ubication_longitude as "parent.ubicationLongitude", 
        parent.ubication_comment as "parent.ubicationComment" 
    from company 
    left join company parent on company.parent_id = parent.id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parent.parent_id as "parent.parentId", 
        parent.favourite_customer_id as "parent.favouriteCustomerId", 
        parent.ubication_latitude as "parent.ubicationLatitude", 
        parent.ubication_longitude as "parent.ubicationLongitude", 
        parent.ubication_comment as "parent.ubicationComment" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parent.parent_id as "parent.parentId", 
        parent.favourite_customer_id as "parent.favouriteCustomerId", 
        parent.ubication_latitude as "parent.ubicationLatitude", 
        parent.ubication_longitude as "parent.ubicationLongitude", 
        parent.ubication_comment as "parent.ubicationComment" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        parent.id as [parent.id], 
        parent.name as [parent.name], 
        parent.parent_id as [parent.parentId], 
        parent.favourite_customer_id as [parent.favouriteCustomerId], 
        parent.ubication_latitude as [parent.ubicationLatitude], 
        parent.ubication_longitude as [parent.ubicationLongitude], 
        parent.ubication_comment as [parent.ubicationComment] 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```

The parameters are: `[]`

To select only some columns of a table in this way, see [`extractColumnsFrom`](../advanced/columns-from-object.md).

### Rule 3: a required value

The object has a value that always exists, so the object always exists too. The rest of its properties are optional, including the columns of a left join, even the ones required in their table:

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const companiesWithInfo = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        id: tCompany.id,
        info: {
            name: tCompany.name,
            parentId: tCompany.parentId,
            parentName: parent.name
        }
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as `info.name`, 
        company.parent_id as `info.parentId`, 
        parent.name as `info.parentName` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `info.name`, 
        company.parent_id as `info.parentId`, 
        parent.`name` as `info.parentName` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "info.name", 
        company.parent_id as "info.parentId", 
        parent.name as "info.parentName" 
    from company 
    left join company parent on company.parent_id = parent.id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as "info.name", 
        company.parent_id as "info.parentId", 
        parent.name as "info.parentName" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as "info.name", 
        company.parent_id as "info.parentId", 
        parent.name as "info.parentName" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as [info.name], 
        company.parent_id as [info.parentId], 
        parent.name as [info.parentName] 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```

The parameters are: `[]`

The result type is:
```tsx
const companiesWithInfo: Promise<{
    id: number;
    info: {
        name: string;
        parentId?: number;
        parentName?: string;
    };
}[]>
```

| `info.name` | `info.parentId` | `info.parentName` | `info` in the result |
|---|---|---|---|
| `'ACME Spain'` | `1` | `'ACME'` | `{ name: 'ACME Spain', parentId: 1, parentName: 'ACME' }` |
| `'ACME'` | `null` | `null` | `{ name: 'ACME' }` |

An inner object that comes out required counts as a required value, so its container is required too. A required value that arrives as `null`, because the definition of the table doesn't match the database for instance, is an error: [`MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`](../api/error-management/library-raised-errors.md).

### Rule 4: only optional values

These are the same columns as in rule 1, without the mark. Nothing says that a value can't be missing, so each one is independent, and the object exists when any of them has a value:

```ts
const companiesWithAnyUbication = connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        ubication: {
            latitude: tCompany.ubicationLatitude,
            longitude: tCompany.ubicationLongitude,
            comment: tCompany.ubicationComment
        }
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        ubication_latitude as [ubication.latitude], 
        ubication_longitude as [ubication.longitude], 
        ubication_comment as [ubication.comment] 
    from company
    ```

The parameters are: `[]`

The result type is:
```tsx
const companiesWithAnyUbication: Promise<{
    id: number;
    ubication?: {
        latitude?: string;
        longitude?: string;
        comment?: string;
    };
}[]>
```

| `ubication.latitude` | `ubication.longitude` | `ubication.comment` | `ubication` in the result |
|---|---|---|---|
| `'40.4'` | `'-3.7'` | `null` | `{ latitude: '40.4', longitude: '-3.7' }` |
| `'40.4'` | `null` | `'Main office'` | `{ latitude: '40.4', comment: 'Main office' }` |
| `null` | `null` | `null` | Absent |

Two cases of left join end up here as well, because rule 2 doesn't match them:

- **All the columns are optional in their table.** A row found with `null` in all of them and no row found give the same result: the object is absent.
- **The columns come from two different left joins.** The object is absent only when no column has a value, and each column is optional.

`asOptional()` makes a required value count as optional for these rules, so it can take an object out of rule 2 or rule 3.

### Objects inside objects

Each object follows the rules on its own, and these are the relations between an object and the ones inside it:

- An inner object makes its container required only when it's required itself (rule 3). An optional inner object doesn't change the rule of its container.
- When a container is absent because of rule 1 or rule 2, its inner objects are absent too, even if they have values.
- A container in which nothing has a value is absent.

[Nested objects with left joins](#nested-objects-with-left-joins) has an example. When the properties are chosen at runtime, the type can't know everything about an object: see [dynamic picks](../dynamic/utilities/picks.md#expanding-result-types-from-dynamic-picks).

## Optional nested objects with required fields

You can take advantage of the optional type of an inner object to mark the inner properties as required. That means the inner properties are optional, but we know they will be required together if they have value; in the case they have no value, the whole object must not exist. To do this, we must call the `asRequiredInOptionalObject` method on the properties that must exist (this is [rule 1](#rule-1-a-value-marked-as-required-in-the-optional-object)). This helps model business rules where a group of fields should either all be present or all be absent, and avoids having to manually check each field for null or undefined. It can be called on any value of the select, not only on a column.

```ts
const companies = connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId,
        ubication: {
            latitude: tCompany.ubicationLatitude.asRequiredInOptionalObject(),
            longitude: tCompany.ubicationLongitude.asRequiredInOptionalObject(),
            comment: tCompany.ubicationComment
        }
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        parent_id as parentId, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        parent_id as parentId, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        parent_id as "parentId", 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        parent_id as "parentId", 
        ubication_latitude as "ubication.latitude",
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        parent_id as parentId, 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        parent_id as parentId, 
        ubication_latitude as [ubication.latitude], 
        ubication_longitude as [ubication.longitude], 
        ubication_comment as [ubication.comment] 
    from company
    ```

The parameters are: `[ ]`

The result type is:
```tsx
const companies: Promise<{
    id: number;
    name: string;
    parentId?: number;
    ubication?: {
        latitude: string;
        longitude: string;
        comment?: string;
    };
}[]>
```

!!! note "Business rule"

    Ubication is optional. If present, both `ubicationLatitude` and `ubicationLongitude` must contain a value. The `ubicationComment` field is optional and may contain a value only if the two coordinates are present.

If these columns go together in all your queries, you can [group them in the definition of the table](../configuration/mapping.md#grouping-columns), with the mark there, instead of writing the object in each select.

## Nested objects with inner joins

An inner join only returns the rows with a match, so the columns of the joined table keep being required, and the object follows [rule 3](#rule-3-a-required-value): it's always there.

```ts
const customerWithCompanyInOneQuery = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        company: {
            id: tCompany.id,
            name: tCompany.name
        }
    }).where(
        tCustomer.id .equals(12)
    ).executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.id as `company.id`, 
        company.name as `company.name` 
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
        company.id as `company.id`, 
        company.`name` as `company.name` 
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
        company.id as "company.id", 
        company.name as "company.name" 
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
        company.id as "company.id", 
        company.name as "company.name" 
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
        company.id as "company.id", 
        company.name as "company.name" 
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
        company.id as [company.id], 
        company.name as [company.name] 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = @0
    ```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithCompanyInOneQuery: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    company: {
        id: number;
        name: string;
    };
    birthday?: Date;
}>
```

## Nested objects with left joins

When all inner object's properties come from the same left join, the inner object is transformed in optional, and the inner properties reflect optionality in the original table ([rule 2](#rule-2-all-the-columns-from-the-same-left-join)). All nested inner objects will only exist if their immediate parent object has values and any its properties (coming from a left join) has value (not null).

!!! note

    Even if a field is required in the original table, a left join makes it optional in the result unless additional conditions apply (see [rule 2](#rule-2-all-the-columns-from-the-same-left-join)). If the object mixes those columns with a required value of another table, the object is required and they are optional ([rule 3](#rule-3-a-required-value)).

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');
const parentParent = tCompany.forUseInLeftJoinAs('parentParent');

const companyMultiParent = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .leftJoin(parentParent).on(parent.parentId.equals(parentParent.id))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parent: {
            id: parent.id,
            name: parent.name,
            parent: {
                id: parentParent.id,
                name: parentParent.name,
                parentId: parentParent.parentId,
            }
        }
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        parent.id as `parent.id`, 
        parent.name as `parent.name`, 
        parentParent.id as `parent.parent.id`, 
        parentParent.name as `parent.parent.name`, 
        parentParent.parent_id as `parent.parent.parentId` 
    from company 
    left join company as parent on company.parent_id = parent.id 
    left join company as parentParent on parent.parent_id = parentParent.id
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name`, 
        parent.id as `parent.id`, 
        parent.`name` as `parent.name`, 
        parentParent.id as `parent.parent.id`, 
        parentParent.`name` as `parent.parent.name`, 
        parentParent.parent_id as `parent.parent.parentId` 
    from company 
    left join company as parent on company.parent_id = parent.id 
    left join company as parentParent on parent.parent_id = parentParent.id
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parentParent.id as "parent.parent.id", 
        parentParent.name as "parent.parent.name", 
        parentParent.parent_id as "parent.parent.parentId" 
    from company 
    left join company parent on company.parent_id = parent.id 
    left join company parentParent on parent.parent_id = parentParent.id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parentParent.id as "parent.parent.id", 
        parentParent.name as "parent.parent.name", 
        parentParent.parent_id as "parent.parent.parentId" 
    from company 
    left join company as parent on company.parent_id = parent.id 
    left join company as parentParent on parent.parent_id = parentParent.id
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        parent.id as "parent.id", 
        parent.name as "parent.name", 
        parentParent.id as "parent.parent.id", 
        parentParent.name as "parent.parent.name", 
        parentParent.parent_id as "parent.parent.parentId" 
    from company 
    left join company as parent on company.parent_id = parent.id 
    left join company as parentParent on parent.parent_id = parentParent.id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        parent.id as [parent.id], 
        parent.name as [parent.name], 
        parentParent.id as [parent.parent.id], 
        parentParent.name as [parent.parent.name], 
        parentParent.parent_id as [parent.parent.parentId] 
    from company 
    left join company as parent on company.parent_id = parent.id 
    left join company as parentParent on parent.parent_id = parentParent.id
    ```

The parameters are: `[ ]`

The result type is:
```tsx
const companyMultiParent: Promise<{
    id: number;
    name: string;
    parent?: {
        id: number;
        name: string;
        parent?: {
            id: number;
            name: string;
            parentId?: number;
        };
    };
}[]>
```

Each level is decided on its own. A company has a `parent` only if the first join found a row, and that `parent` has its own `parent` only if the second join found one too:

| `parent.id` | `parent.parent.id` | `parent.parent.parentId` | `parent` in the result (names left out) |
|---|---|---|---|
| `null` | `null` | `null` | Absent |
| `2` | `null` | `null` | `{ id: 2 }` |
| `2` | `1` | `null` | `{ id: 2, parent: { id: 1 } }` |
| `3` | `2` | `1` | `{ id: 3, parent: { id: 2, parentId: 1 } }` |

## Optional values as null

By default, a property with no value isn't set in the object, and an optional object with no value isn't either. Calling `projectingOptionalValuesAsNullable()` right after `select(...)` changes it: all the properties are always there, and the ones with no value are `null`.

```ts
const companiesWithNulls = connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        parentId: tCompany.parentId,
        ubication: {
            latitude: tCompany.ubicationLatitude.asRequiredInOptionalObject(),
            longitude: tCompany.ubicationLongitude.asRequiredInOptionalObject(),
            comment: tCompany.ubicationComment
        }
    })
    .projectingOptionalValuesAsNullable()
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        parent_id as parentId, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        parent_id as parentId, 
        ubication_latitude as `ubication.latitude`, 
        ubication_longitude as `ubication.longitude`, 
        ubication_comment as `ubication.comment` 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        parent_id as "parentId", 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        parent_id as "parentId", 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        parent_id as parentId, 
        ubication_latitude as "ubication.latitude", 
        ubication_longitude as "ubication.longitude", 
        ubication_comment as "ubication.comment" 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        parent_id as parentId, 
        ubication_latitude as [ubication.latitude], 
        ubication_longitude as [ubication.longitude], 
        ubication_comment as [ubication.comment] 
    from company
    ```

The parameters are: `[]`

The result type is:
```tsx
const companiesWithNulls: Promise<{
    id: number;
    parentId: number | null;
    ubication: {
        latitude: string;
        longitude: string;
        comment: string | null;
    } | null;
}[]>
```

| The row has | By default | With `projectingOptionalValuesAsNullable()` |
|---|---|---|
| Both coordinates, no comment and no parent | `{ id: 1, ubication: { latitude: '40.4', longitude: '-3.7' } }` | `{ id: 1, parentId: null, ubication: { latitude: '40.4', longitude: '-3.7', comment: null } }` |
| Only one coordinate, and no parent | `{ id: 2 }` | `{ id: 2, parentId: null, ubication: null }` |

The SQL doesn't change, and neither do the rules: they decide in the same way whether an object exists, and an object that doesn't exist is `null` as a whole, not an object full of nulls. What changes is how the absence is shown.

Which one to choose:

- **The default** (`parentId?: number`) gives smaller objects, and you check a value in the usual way. A property that isn't set doesn't appear either when the object is converted to JSON.
- **`projectingOptionalValuesAsNullable()`** (`parentId: number | null`) is for when the object must always have all its properties: the type you assign it to declares `| null`, or the receiver of a JSON expects the property with a `null`.

The same method exists after `returning(...)` in an [insert](insert.md#insert-returning), an update or a delete, and after a compound operator in a [compound select](compound-select.md). In [`aggregateAsArray`](aggregate-as-object-array.md#optional-values-in-the-elements) it goes after the call and only affects the elements of that array. For a flat object, see [Projecting optional values](basic-query-structure.md#projecting-optional-values).
