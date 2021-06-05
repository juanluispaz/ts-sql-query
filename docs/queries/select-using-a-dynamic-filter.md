# Select using a dynamic filter

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

See [Dynamic conditions](../../supported-operations/#dynamic-conditions) for more information.
