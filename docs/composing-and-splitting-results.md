# Composing and splitting results (legacy)

**LEGACY**: This feature will continue to be maintained, but its usage is not recommended, and its functionality will not be extended. This functionality is intended to be deprecated in the future when the current code using it is migrated away. Use [complex projections](queries/complex-projections.md) or [aggregate as an object array](queries/aggregate-as-object-array.md) instead.

Sometime you whan to create a result where the content looks like:

1. The result item contains a property with an array with the related items. By example, for each company you want to get the list of its customers.
2. The result item contains a property with an object of a related item. By example, for each customer you want to get the company information as well.
3. The result item optionally contains a property with an object of a related item (if exists). By example, for each customer you want to get his preferred company (if he has one).

To do this you have two strategies:

- **Composing**: You can execute a second query that returns the additional data. Valid for the case 1, and also work for the case 2 or 3 but this is not the best approach. Before use splitting evaluate if you can use [aggregate as an object array](queries/aggregate-as-object-array.md) instead.
- **Splitting**: You can return all the data in the same query, and then move the additional data to the object in the internal property. Valid for the case 2 and 3 but it doesn't work for the case 1. Before use splitting evaluate if you can use [complex projections](queries/complex-projections.md) instead.

**Note**: You can apply composing/spliting on select/insert/update/delete that returns objects.

## Composing results

**Note**: Before use splitting evaluate if you can use [aggregate as an object array](queries/aggregate-as-object-array.md) instead.

**How it works**:

1. The first step is to perform a first query (the external one) that returns the data and the id needed to execute a second query. 
2. When the first query is executed, all ids needed to perform the second query are collected in an array. 
3. Then, a second query (the internal one) is executed with the ids collected from the first query; this query returns the additional data and the id provided by the first query.
4. The data is joined by the id provided by the first query and returned as well by the second query.
5. If required, the property with the id used to join the data can be deleted from the external or the internal object.

**What you need**:

- Name of the property in the external object that contains the id to be used to query the internal objects.
- Name of the property in the internal object that will contain the id used to query the internal objects.
- Name of the property in the external object that will contain the internal objects.
- Determine the cardinality of the property to be added to the external object: `many` (an array), `one` (a required object), `noneOrOne` (an optional object).
- Determine if the property need with the id required to join the data needs to be deleted from the external or internal object.
- A function that receives the list of ids needed to join the data and returns a list with the data to be used to construct the result.

**Defining the composition rule**:

Before executing the query, you must call one of the next methods:

- `compose`: that indicates the composition must be executed without delete any property.
- `composeDeletingInternalProperty`: that indicates the composition must be performed deleting the internal property with the id used to join the information.
- `composeDeletingExternalProperty`: that indicates the composition must be performed deleting the external property with the id used to join the information.

This method receives an object with the following information:

- `externalProperty`: name of the property that contains the shared id returned by the external query.
- `internalProperty`: name of the property that contains the shared id returned by the internal query.
- `propertyName`: name of the property to be included in the external object with the corresponding result from the second query.

Then you must call one of the next methods:

- `withNoneOrOne`: That indicates the cardinality of the property to be added to the external result is an optional object.
- `withOne`: That indicates the cardinality of the property to be added to the external result is a required object.
- `withMany`: That indicates the cardinality of the property to be added to the external result is a required array with objects. No values are represented with an empty array.
- `withOptionalMany`: That indicates the cardinality of the property to be added to the external result is an optional array with objects. No values are represented with an `undefined` value.

This method receives a function with argument an array with the ids and returns a promise with an array that contains the result of the second query (the internal one).

**Note**: In a select where the columns are picked, if the external column is not a required column, the created property will always be optional. The inner function with the query only will be executed if the external property was picked.

## Composing many items in the result

**Note**: Before use splitting evaluate if you can use [aggregate as an object array](queries/aggregate-as-object-array.md) instead.

```ts
const companiesWithCustomers = connection.selectFrom(tCompany)
        .select({
            id: tCompany.id,
            name: tCompany.name
        }).where(
            tCompany.name.containsInsensitive('ACME')
        ).composeDeletingInternalProperty({
            externalProperty: 'id',
            internalProperty: 'companyId',
            propertyName: 'customers'
        }).withMany((ids) => {
            return connection.selectFrom(tCustomer)
                .select({
                    id: tCustomer.id,
                    firstName: tCustomer.firstName,
                    lastName: tCustomer.lastName,
                    birthday: tCustomer.birthday,
                    companyId: tCustomer.companyId
                }).where(
                    tCustomer.companyId.in(ids)
                ).executeSelectMany()
        }).executeSelectMany()
```

The result type is:
```tsx
const companiesWithCustomers: Promise<{
    id: number;
    name: string;
    customers: {
        id: number;
        birthday?: Date;
        firstName: string;
        lastName: string;
    }[];
}[]>
```

## Composing one item in the result

**Note**: Before use splitting evaluate if you can use [aggregate as an object array](queries/aggregate-as-object-array.md) instead.

```ts
const customerWithCompany = connection.selectFrom(tCustomer)
        .select({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName,
            birthday: tCustomer.birthday,
            companyId: tCustomer.companyId
        }).where(
            tCustomer.id .equals(12)
        ).composeDeletingExternalProperty({
            externalProperty: 'companyId',
            internalProperty: 'id',
            propertyName: 'company'
        }).withOne((ids) => {
            return connection.selectFrom(tCompany)
                .select({
                    id: tCompany.id,
                    name: tCompany.name
                }).where(
                    tCompany.id.in(ids)
                ).executeSelectMany()
        }).executeSelectOne()
```

The result type is:
```tsx
const customerWithCompany: Promise<{
    id: number;
    birthday?: Date;
    firstName: string;
    lastName: string;
    company: {
        id: number;
        name: string;
    };
}>
```

## Splitting results

**Note**: Before use splitting evaluate if you can use [complex projections](queries/complex-projections.md) instead.

**How it works**:

The property that you indicate will be moved from the result of the query to a new object that will be stored as a property of it.

**What you need**:

- Name of the property in the result object that will contain the new object with the moved properties.
- A mapping rule that determined how the properties will be moved; basically, you must indicate as a key the new name of the property in the new object and value the old property's name.

**Defining the splitting rule**:

Before executing the query, you must call one of the next methods:

- `splitRequired`: that split the result, and the new property will be added as a required property.
- `splitOptional`: The split result will be added as an optional property. If the new object has no data, the new property is omitted.
- `split`: that split the result, and the new property will be added as an optional property if all the moved properties are optional; otherwise, it will be required.

Before executing the query, you must call `split` method with the following arguments:

1. `propertyName`: name of the property to be included in each item returned by the query.
2. `mapping`: an object map where the key is the new name of the property and the value is the old name of the property.

## Splitting the result of one query

```ts
const customerWithCompanyInOneQuery = connection.selectFrom(tCustomer)
        .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
        .select({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName,
            birthday: tCustomer.birthday,
            companyId: tCompany.id,
            companyName: tCompany.name
        }).where(
            tCustomer.id .equals(12)
        ).split('company', {
            id: 'companyId',
            name: 'companyName'
        }).executeSelectOne()
```

The result type is:
```tsx
const customerWithCompanyInOneQuery: Promise<{
    id: number;
    birthday?: Date;
    firstName: string;
    lastName: string;
    company: {
        id: number;
        name: string;
    };
}>
```

## Splitting results and dynamic queries

**Note**: Before use splitting evaluate if you can use [complex projections](queries/complex-projections.md) instead.

When you use dynamic parts of your query where the name of a field moved to an inner object is used, you can name those fields in the query with the path in the resulting object to allow easy usage of the dynamic query.

```ts
import { DynamicCondition } from "ts-sql-query/dynamicCondition"

type FilterType = DynamicCondition<{
    id: 'int',
    firstName: 'string',
    lastName: 'string',
    birthday: 'localDate',
    'company.id': 'int',
    'company.name': 'string'
}>

const filter: FilterType = {
    'company.name': {equals: 'ACME'},
    or: [
        { firstName: { containsInsensitive: 'John' } },
        { lastName: { containsInsensitive: 'Smi' } }
    ]
}

const orderBy = 'company.name asc insensitive, birthday desc'

const selectFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    'company.id': tCompany.id,
    'company.name': tCompany.name
}

const queryDynamicWhere = connection.dynamicConditionFor(selectFields).withValues(filter)

const customerWithCompanyObject = connection.selectFrom(tCustomer)
        .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
        .select(selectFields)
        .where(dynamicWhere)
        .orderByFromString(orderBy)
        .split('company', {
            id: 'company.id',
            name: 'company.name'
        }).executeSelectOne()
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday, company.id as "company.id", company.name as "company.name" 
from customer inner join company on company.id = customer.company_id 
where 
    company.name = $1 
    and (
           customer.first_name ilike ('%' || $2 || '%') 
        or customer.last_name ilike ('%' || $3 || '%')
    )
order by lower("company.name") asc, birthday desc
```

The parameters are: `[ 'John', 'Smi', 'ACME' ]`

The result type is:
```tsx
const customerWithCompanyObject: Promise<{
    id: number;
    birthday?: Date;
    firstName: string;
    lastName: string;
    company: {
        id: number;
        name: string;
    };
}>
```

## Guided splitting results

**Note**: Before use splitting evaluate if you can use [complex projections](queries/complex-projections.md) instead.

Sometimes the default splitting strategy is not enough to express the correct result type due to optional type information that cannot be extracted from the query. For example: when you perform a left join, all the fields coming from the left join table are optional, but you can know when this join exists; some of these fields are not optional at the same time. Adding additional information, you can express this optional combination in the split object.

**How it works**:

The property that you indicate will be moved from the result of the query to a new object that will be stored as a property of it. You can indicate if the property must be treated as required or optional in the new object.

**What you need**:

- Name of the property in the result object that will contain the new object with the moved properties.
- A mapping rule that determined how the properties will be moved; basically, you must indicate as a key the new name of the property in the new object and value the old property's name. Optionally, at the end of the old property's name, you can add `!` to force treat it as mandatory, or `?` to force treat it as optional.

**Defining the splitting rule**:

Before executing the query, you must call one of the next methods:

- `guidedSplitRequired`: that split the result, and the new property will be added as a required property.
- `guidedSplitOptional`: The split result will be added as an optional property. If the new object has no data, the new property is omitted.

Before executing the query, you must call `guidedSplit` method with the following arguments:

1. `propertyName`: name of the property to be included in each item returned by the query.
2. `mapping`: an object map where the key is the new name of the property and the value is the old name of the property.

**Note**: When you force a property as required in the split object when this object is created, the forced-as-required properties must have value; if not, you will get an error.

## Splitting the result of a left join query

```ts
const parent = tCompany.forUseInLeftJoinAs('parent')

const leftJoinCompany = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: parent.id,
        parentName: parent.name
    }).guidedSplitOptional('parent', {
        id: 'parentId!',
        name: 'parentName!'
    }).executeSelectMany()
```

The executed query is:
```sql
select company.id as id, company.name as name, parent.id as parentId, parent.name as parentName 
from company 
left join company as parent on company.parent_id = parent.id
```

The parameters are: `[ ]`

The result type is:
```tsx
const leftJoinCompany: Promise<{
    id: number;
    name: string;
    parent?: {
        id: number;
        name: string;
    };
}[]>
```

## Prefixing

**Note**: Before use splitting evaluate if you can use [complex projections](queries/complex-projections.md) instead.

To deal with complex queries, sometimes you need to combine data coming from different tables and then split the result into different objects; but, because the tables can have columns with the same name, you need to prefix it.

The file `ts-sql-query/extras/utils` offers the following functions to deal with prefixing and splitting values:

- `prefixDotted`: create a copy of the provided object using the provided prefix where every property's name has the pattern `prefix.name`.
- `prefixMapForSplitDotted`: create a map object where the key is the generated property by the previous function, and the value is the property's original name. The result of this function is designed to use in the split function in the query.
- `prefixCapitalized`: create a copy of the provided object using the provided prefix where every property's name has the pattern `prefixName`.
- `prefixMapForSplitCapitalized`: create a map object where the key is the generated property by the previous function, and the value is the property's original name. The result of this function is designed to use in the split function in the query.

```ts
import { prefixDotted, prefixMapForSplitDotted } from "ts-sql-query/extras/utils";

const customerColumns = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday
};

const companyColumns = {
    id: tCompany.id,
    name: tCompany.name
};

const customerWithCompanyPrefixed = connection.selectFrom(tCustomer)
        .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
        .select({
            ...prefixDotted(customerColumns, 'customer'),
            ...prefixDotted(companyColumns, 'company')
        }).where(
            tCustomer.id.equals(12)
        )
        .split('customer', prefixMapForSplitDotted(customerColumns, 'customer'))
        .split('company', prefixMapForSplitDotted(companyColumns, 'company'))
        .executeSelectOne();
```

The executed query is:
```sql
select customer.id as "customer.id", customer.first_name as "customer.firstName", customer.last_name as "customer.lastName", customer.birthday as "customer.birthday", company.id as "company.id", company.name as "company.name" 
from customer inner join company on company.id = customer.company_id 
where customer.id = $1
```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithCompanyPrefixed: Promise<{
    customer: {
        id: number;
        firstName: string;
        lastName: string;
        birthday?: Date;
    };
    company: {
        id: number;
        name: string;
    };
}>
```

## Prefix map for guided split

**Note**: Before use splitting evaluate if you can use [complex projections](queries/complex-projections.md) instead.

When you perform a left join, all the fields coming from the left join table are optional, but you can know when this join exists; some of these fields are not optional at the same time. You can use a guided split to create an inner object with the properties coming from the left join, but you will need to mark the fields that need to be transformed as non-optional in the new object.

The file `ts-sql-query/extras/utils` offers the following functions to help you creating these mapping rules for a guided split:

- `prefixMapForGuidedSplitDotted`: analogous function to `prefixMapForSplitDotted` that create a map object where the key is the generated property by the `prefixDotted` function, and the value is the property's original name. The original name will be followed with the required mark when the reference table gave as the second argument has a required column with the same original name. The result of this function is designed to use in the guided split function in the query.
- `prefixMapForGuidedSplitCapitalized`: analogous function to `prefixMapForSplitCapitalized` that create a map object where the key is the generated property by the `prefixCapitalized` function, and the value is the property's original name. The original name will be followed with the required mark when the reference table gave as the second argument has a required column with the same original name. The result of this function is designed to use in the guided split function in the query.
- `mapForGuidedSplit`: Create a map object where the key is the name of the key of the first object, and the value is the property's original name (the key). The original name will be followed with the required mark when the reference table gave as the second argument has a required column with the same original name. The result of this function is designed to use in the guided split function in the query. This function is analogous to the previous ones but without prefixing.

```ts
import { prefixDotted, prefixMapForGuidedSplitCapitalized } from "ts-sql-query/extras/utils";

const parentCompany = tCompany.forUseInLeftJoinAs('parent')

const companyFields = {
    id: tCompany.id,
    name: tCompany.name
}

const parentCompanyFields = {
    id: parentCompany.id,
    name: parentCompany.name,
    parentId: parentCompany.parentId
}

const companyPrefixed = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        ...companyFields,
        ...prefixCapitalized(parentCompanyFields, 'parent')
    }).guidedSplitOptional('parent', prefixMapForGuidedSplitCapitalized(parentCompanyFields, tCompany, 'parent'))
    .executeSelectMany()
```

The executed query is:
```sql
select company.id as id, company.name as name, parent.id as "parentId", parent.name as "parentName", parent.parent_id as "parentParentId"
from company left join company as parent on company.parent_id = parent.id
```

The parameters are: `[ ]`

The result type is:
```tsx
const companyPrefixed: Promise<{
    name: string;
    id: number;
    parent?: {
        name: string;
        id: number;
        parentId?: number;
    };
}[]>
```