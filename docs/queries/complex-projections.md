---
search:
  boost: 2
---
# Complex projections

This page explains how to use complex projections in `ts-sql-query` to map the result of a SQL query into deeply structured JavaScript/TypeScript objects. It covers how to define nested objects in the result, how to manage optionality rules based on joins and field presence, and how to handle advanced features like required fields inside optional objects.

## Nested object projections

In `ts-sql-query`, the result of a query doesn't need to be a flat object. You can build results as nested objects, where properties themselves can be objects. Multiple levels of nesting are supported.

!!! warning "Limitation"

    - Only 5 nesting levels are supported.

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
    where company_id = ? 
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

## Rules for nested object projections

When projecting nested objects, it's important to determine when those objects and their fields should be required or optional. `ts-sql-query` applies a set of rules to infer these types based on the source tables and the way fields are selected or joined.

**Rules (in priority order)**:

1. In the case there are properties defined as `asRequiredInOptionalObject`: all other non-required properties will be marked as optional; the properties defined as `asRequiredInOptionalObject` will be considered required; the object will be considered optional. If any property defined as `asRequiredInOptionalObject` has no value, the whole object will be ignored, independently if there are other properties with value.
2. In the case that all properties are coming from the same outer (left) join and the original table has required properties, those properties will be treated automatically as `asRequiredInOptionalObject`.
3. In the case there are required properties or required inner objects: all other non-required properties or non-required inner objects properties will be marked as optional; the object will be considered required.
4. In any other case: all properties and inner objects will be marked as optional, the object will be considered optional.


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

!!! note

    When you indicate that a table will be used in a left join, all required columns are treated as optional in `ts-sql-query` because the left join is per se optional; the rule number 2 is the only one that can revert it implicitly.

!!! warning "Limitation"

    - You cannot use complex projections in queries that will be used as table in other query (created using `forUseInQueryAs` that corresponds to the with clause in SQL)

    - Only 5 nesting levels are supported.

## Optional nested objects with required fields

You can take advantage of the optional type of an inner object to mark the inner properties as required. That means the inner properties are optional, but we know they will be required together if they have value; in the case they have no value, the whole object must not exist. To do this, we must call the `asRequiredInOptionalObject` method on the properties that must exist. This helps model business rules where a group of fields should either all be present or all be absent, and avoids having to manually check each field for null or undefined.

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

## Nested objects with inner joins

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
    where customer.id = ?
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

When all inner object's properties come from the same left join, the inner object is transformed in optional, and the inner properties reflect optionality in the original table. All nested inner objects will only exist if their immediate parent object has values and any its properties (coming from a left join) has value (not null).

!!! note

    Even if a field is required in the original table, a left join makes it optional in the result unless additional conditions apply (see rule #2 above).

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
