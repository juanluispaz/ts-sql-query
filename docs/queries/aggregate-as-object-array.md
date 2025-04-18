---
search:
  boost: 2
---
# Aggregate as an object array

## Introduction

You can create a property in your query that contains a list of values, or a list of objects with values, using some special aggregate functions in the same way you can create a string concatenation using the aggregate function `stringConcat`; but, instead of returning a string an array with proper values will result of the query.

Aggregate functions:

- `aggregateAsArray`: This is an aggregate function that returns an array of objects. It receives the object with the projections as an argument, in the same way that the select function.
- `aggregateAsArrayOfOneColumn`: This is an aggregate function that returns an array of values. It receives as an argument the value source to project into the array.

You can transform a whole query in an array to use an inline value in another query calling `forUseAsInlineAggregatedArrayValue()` at the end of the query to be inlined.

The resulting aggregate value source contains the following methods that help to define how to deal with no values:

- `useEmptyArrayForNoValue()`: (default) If there is no value, an empty array is used.
- `asOptionalNonEmptyArray()`: (used in an inline query that returns the aggregation, for consistency) If there is no value, `undefined` is used instead of an empty array.

## Aggregate as an array of objects

```ts
const tCustomerLeftJoin = tCustomer.forUseInLeftJoin();

const acmeCompanyWithCustomers = connection.selectFrom(tCompany)
    .leftJoin(tCustomerLeftJoin).on(tCustomerLeftJoin.companyId.equals(tCompany.id))
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: connection.aggregateAsArray({
            id: tCustomerLeftJoin.id,
            firstName: tCustomerLeftJoin.firstName,
            lastName: tCustomerLeftJoin.lastName
        }).asOptionalNonEmptyArray()
    })
    .groupBy('id')
    .executeSelectOne();
```

The executed query is:
```sql
select 
    company.id as id, 
    company.name as name, 
    json_agg(json_build_object('id', customer.id, 'firstName', customer.first_name, 'lastName', customer.last_name)) as customers 
from company left join customer on customer.company_id = company.id 
where company.id = $1 
group by company.id
```

The parameters are: `[ 1 ]`

The result type is:
```tsx
const acmeCompanyWithCustomers: Promise<{
    id: number;
    name: string;
    customers?: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
}>
```

!!! note

    You can project optional values in objects as always-required properties that allow null calling `projectingOptionalValuesAsNullable()` immediately after `aggregateAsArray(...)`.

## Aggregate as an array of values

```ts
const tCustomerLeftJoin = tCustomer.forUseInLeftJoin();

const acmeCompanyWithCustomers = connection.selectFrom(tCompany).leftJoin(tCustomerLeftJoin).on(tCustomerLeftJoin.companyId.equals(tCompany.id))
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: connection.aggregateAsArrayOfOneColumn(tCustomerLeftJoin.firstName.concat(' ').concat(tCustomerLeftJoin.lastName))
    })
    .groupBy('id')
    .executeSelectOne();
```

The executed query is:
```sql
select 
    company.id as id, 
    company.name as name, 
    json_agg(customer.first_name || $1 || customer.last_name) as customers 
from company left join customer on customer.company_id = company.id 
where company.id = $2 
group by company.id
```

The parameters are: `[ " ", 1 ]`

The result type is:
```tsx
const acmeCompanyWithCustomers: Promise<{
    id: number;
    name: string;
    customers: string[];
}>
```

## Query as an inline array of objects

```ts
const aggregatedCustomersOfAcme = connection.subSelectUsing(tCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('id')
    .forUseAsInlineAggregatedArrayValue()

const acmeCompanyWithCustomers = await connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: aggregatedCustomersOfAcme
    })
    .executeSelectOne();
```

The executed query is:
```sql
select 
    id as id, 
    name as name, 
    (   select json_agg(json_build_object('id', a_1_.id, 'firstName', a_1_.firstName, 'lastName', a_1_.lastName)) 
        from (  select id as id, first_name as firstName, last_name as lastName 
                from customer where company_id = company.id 
                order by id
            ) as a_1_
    ) as customers 
from company 
where id = $1
```

The parameters are: `[ 1 ]`

The result type is:
```tsx
const acmeCompanyWithCustomers5: Promise<{
    id: number;
    name: string;
    customers: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
}>
```

!!! note

    - You can project optional values in objects as always-required properties that allow null calling `projectingOptionalValuesAsNullable()` immediately after `select(...)`.
    - The `forUseAsInlineAggregatedArrayValue` method takes care of wrapping the inline query in another query (when it is required) to ensure clauses like `order by` works as expected.

## Queries as an inline array of values

```ts
const aggregatedCustomersOfAcme = connection.subSelectUsing(tCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectOneColumn(tCustomer.firstName.concat(' ').concat(tCustomer.lastName))
    .orderBy('result')
    .forUseAsInlineAggregatedArrayValue();

const acmeCompanyWithCustomers = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: aggregatedCustomersOfAcme
    })
    .executeSelectOne();
```

The executed query is:
```sql
select 
    id as id, 
    name as name, 
    (   select json_agg(a_1_.result) 
        from (  select first_name || $1 || last_name as result 
                from customer 
                where company_id = company.id 
                order by result
            ) as a_1_
    ) as customers 
from company 
where id = $2
```

The parameters are: `[ " ", 1 ]`

The result type is:
```tsx
const acmeCompanyWithCustomers7: Promise<{
    id: number;
    name: string;
    customers: string[];
}>
```

!!! note
    
    The `forUseAsInlineAggregatedArrayValue` method takes care of wrapping the inline query in another query (when it is required) to ensure clauses like `order by` works as expected.

## Recursive query as an inline array of objects

```ts
const parentCompany = tCompany.as('parentCompany')

const parentCompanies = connection.subSelectUsing(tCompany)
    .from(parentCompany)
    .select({
        id: parentCompany.id,
        name: parentCompany.name,
        parentId: parentCompany.parentId
    })
    .where(parentCompany.id.equals(tCompany.parentId))
    .recursiveUnionAllOn((child) => {
        return child.parentId.equals(parentCompany.id)
    })
    .forUseAsInlineAggregatedArrayValue();

const myCompany = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId,
        parents: parentCompanies
    })
    .where(tCompany.id.equals(10))
    .executeSelectOne()
```

The executed query is:
```sql
select 
    id as id, 
    name as name, 
    parent_id as parentId, 
    (   with recursive recursive_select_1 as (
            select parentCompany.id as id, parentCompany.name as name, parentCompany.parent_id as parentId 
            from company as parentCompany 
            where parentCompany.id = company.parent_id 
            union all 
            select parentCompany.id as id, parentCompany.name as name, parentCompany.parent_id as parentId 
            from company as parentCompany 
            join recursive_select_1 on recursive_select_1.parentId = parentCompany.id
        ) 
        select json_agg(json_build_object('id', id, 'name', name, 'parentId', parentId)) 
        from recursive_select_1
    ) as parents 
from company 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const lowCompany: Promise<{
    id: number;
    name: string;
    parents: {
        id: number;
        name: string;
        parentId?: number;
    }[];
    parentId?: number;
}>
```

**Limitation**: SqlServer, Oracle, and MariaDB don't support recursive queries that reference outer tables (using `subSelectUsing`). If you try to use this query on any of these databases, you will get a compilation error. A workaround is to avoid the outer reference in the recursive query indicating the parent id in the `parentCompanies` query.