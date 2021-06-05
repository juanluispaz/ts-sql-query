# Select picking columns

You can create a select where the caller can conditionally pick the columns that want to be returned (like in GraphQL)

```ts
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
select id as id, first_name as "firstName", last_name as "lastName" 
from customer
```

The parameters are: `[]`

The result type is:
```ts
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