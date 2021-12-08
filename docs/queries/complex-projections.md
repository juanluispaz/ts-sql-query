# Complex projections

## Inner objects

In ts-sql-query, the result of a query doesn't require to be a flat object; you can create a result that is an object that contains properties that are objects as well (multiple object nesting is supported).

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
```sql
select id as id, first_name as "name.firstName", last_name as "name.lastName", birthday as birthday 
from customer 
where company_id = $1 
order by "name.firstName", "name.lastName"
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

## Inner object's rules

**Rules (in priority order)**:

1. In the case there are properties defined as `asRequiredInOptionalObject`: all other non-required properties will be marked as optional; the properties defined as `asRequiredInOptionalObject` will be considered required; the object will be considered optional. If any property defined as `asRequiredInOptionalObject` has no value, the whole object will be ignored, independently if there are other properties with value.
2. In the case that all properties are coming from the same outer (left) join and the original table has required properties, those properties will be treated automatically as `asRequiredInOptionalObject`.
3. In the case there are required properties or inner objects: all other non-required properties or inner objects properties will be marked as optional; the object will be considered required.
4. In any other case: all properties and inner objects will be marked as optional, the object will be considered optional.

**Detailed rules (in priority order)**:

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

**Note**: When you indicate that a table will be used in a left join, all required columns are treated as optional in ts-sql-query because the left join is per se optional; the rule number 2 is the only one that can revert it implicitly.

**Limitation**: You cannot use complex projections in queries that will be used as table in other query (created using `forUseInQueryAs` that corresponds to the with clause in SQL)

## Optional inner object with required properties

You can take advantage of the optional type of an inner object to mark the inner properties as required. That means the inner properties are optional, but we know they will be required together if they have value; in the case they have no value, the whole object must not exist. To do this, we must call the `asRequiredInOptionalObject` method on the properties that must exist.

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
```sql
select id as id, name as name, parent_id as "parentId", 
    ubication_latitude as "ubication.latitude", ubication_longitude as "ubication.longitude", ubication_comment as "ubication.comment" 
from company
```

The parameters are: `[ ]`

The result type is:
```tsx
const customerWithCompanyInOneQuery: Promise<{
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

**Bussiness rule**: Ubication information is optional, but, `ubicationLatitude` and `ubicationLongitude` must be null or have value at the same time; `ubicationComment` can have value (or not) only if `ubicationLatitude` and `ubicationLongitude` have value.

## Inner objects and joins

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
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday, 
    company.id as "company.id", company.name as "company.name" 
from customer inner join company on company.id = customer.company_id 
where customer.id = $1
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

## Inner objects and left joins

When all inner object's properties come from the same left join, the inner object is transformed in optional, and the inner properties reflect optionality in the original table. All inner inner objects will only exist if the inner object (coming from the left join) produces value.

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
```sql
select company.id as id, company.name as name, 
       parent.id as "parent.id", parent.name as "parent.name", 
       parentParent.id as "parent.parent.id", parentParent.name as "parent.parent.name", parentParent.parent_id as "parent.parent.parentId" 
from company left join company as parent on company.parent_id = parent.id left join company as parentParent on parent.parent_id = parentParent.id
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
```sql
select customer.id as id, 
    customer.first_name as "name.firstName", customer.last_name as "name.lastName", 
    customer.birthday as birthday, 
    company.id as "company.id", company.name as "company.name" 
from customer inner join company on company.id = customer.company_id 
where company.name = $1 
    and (
           customer.first_name ilike ('%' || $2 || '%') 
        or customer.last_name ilike ('%' || $3 || '%')
    ) 
order by lower("company.name") asc, birthday desc
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

See [Select using a dynamic filter](dynamic-queries.md#select-using-a-dynamic-filter) and [Dynamic conditions](../supported-operations.md#dynamic-conditions) for more information.

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
```sql
select customer.id as id, 
    customer.first_name as "name.firstName", customer.last_name as "name.lastName" 
from customer 
where customer.id = $1
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
```sql
select customer.id as id, 
    customer.first_name as "name.firstName", customer.last_name as "name.lastName", 
    company.id as "company.id", company.name as "company.name" 
from customer inner join company on company.id = customer.company_id 
where customer.id = $1
```

The parameters are: `[ 12 ]`

See [Select dynamically picking columns](dynamic-queries.md#select-dynamically-picking-columns) and [Optional joins](dynamic-queries.md#optional-joins) for more information.