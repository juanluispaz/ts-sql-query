# Select picking columns

You can create a select where the caller can conditionally pick the columns that want to be returned (like in GraphQL)

## Dynamically picking columns

```ts
import { dynamicPick } from "ts-sql-query/dynamicCondition"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday
}

const fieldsToPick = {
    firstName: true,
    lastName: true
}

// always include th id field in the result
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

const customerWithIdPeaking = connection.selectFrom(tCustomer)
    .select(pickedFields)
    .executeSelectOne()
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName
from customer
```

The parameters are: `[]`

The result type is:
```tsx
const customerWithIdPeaking: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
}>
```

The `fieldsToPick` object defines all the properties that will be included, and the value is a boolean that tells if that property must be included or not.

The utility function `dynamicPick` from `ts-sql-query/dynamicCondition` allows to you pick the fields from an object. This function returns a copy of the object received as the first argument with the properties with the same name and value `true` in the object received as the second argument. Optionally, you can include a list of the properties that always will be included as the third argument.

The type `DynamicPick<Type, Mandatory>` from `ts-sql-query/dynamicCondition` allows you to define a type expected for the object `fieldsToPick` where the first generic argument is the type to transform. Optionally you can provide a second generic argument with the name of the mandatories properties joined with `|`. Example: `DynamicPick<MyType, 'prop1' | 'prop2'>`.

## Optional joins

You can write selects where the columns are picked dynamically, but maybe a join is required depending on the picked columns. ts-sql-query offer you the possibility to indicate that join only must be included in the final query if the table involved in the join is used in the final query (by example, a column of that table was picked, or a column was used in a dynamic where). 

To indicate the join can be optionally included in the query, you must create the join using one of the following methods:

- `optionalJoin`
- `optionalInnerJoin`
- `optionalLeftJoin`
- `optionalLeftOuterJoin`

```ts
import { dynamicPick } from "ts-sql-query/dynamicCondition"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyId: tCompany.id,
    companyName: tCompany.name
}

const fieldsToPick = {
    firstName: true,
    lastName: true
}

// include allways id field as required
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

But in case of a column provided by the join is required, like when `fieldsToPick` is:
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