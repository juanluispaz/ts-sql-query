# Select

## Select with joins and order by

```ts
const firstName = 'John';
const lastName = null;

const company = tCompany.as('comp');
const customersWithCompanyName = connection.selectFrom(tCustomer)
    .innerJoin(company).on(tCustomer.companyId.equals(company.id))
    .where(tCustomer.firstName.startsWithInsensitive(firstName))
        .and(tCustomer.lastName.startsWithInsensitiveIfValue(lastName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        companyName: company.name
    })
    .orderBy('firstName', 'insensitive')
    .orderBy('lastName', 'asc insensitive')
    .executeSelectMany();
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday, comp.name as companyName
from customer inner join company as comp on customer.company_id = comp.id 
where customer.first_name ilike ($1 || '%') 
order by lower(firstName), lower(lastName) asc
```

The parameters are: `[ 'John' ]`

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

## Select with subquery and dynamic order by

```ts
const orderBy = 'customerFirstName asc nulls first, customerLastName';

const customerWithSelectedCompanies = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.in(
        connection.selectFrom(tCompany)
            .where(tCompany.name.contains('Cia.'))
            .selectOneColumn(tCompany.id)
    )).select({
        customerId: tCustomer.id,
        customerFirstName: tCustomer.firstName,
        customerLastName: tCustomer.lastName
    }).orderByFromString(orderBy)
    .executeSelectMany();
```

The executed query is:
```sql
select id as customerId, first_name as customerFirstName, last_name as customerLastName 
from customer 
where company_id in (
    select id as result from company where name like ('%' || $1 || '%')
) 
order by customerFirstName asc nulls first, customerLastName
```

The parameters are: `[ 'Cia.' ]`

The result type is:
```tsx
const customerWithSelectedCompanies: Promise<{
    customerId: number;
    customerFirstName: string;
    customerLastName: string;
}[]>
```

## Select with aggregate functions and group by

```ts
const customerCountPerCompany = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .groupBy(tCompany.id, tCompany.name)
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:
```sql
select company.id as companyId, company.name as companyName, count(customer.id) as customerCount 
from company inner join customer on customer.company_id = company.id 
group by company.id, company.name
```

The parameters are: `[]`

The result type is:
```tsx
const customerCountPerCompany: Promise<{
    companyId: number;
    companyName: string;
    customerCount: number;
}[]>
```

## Select with left join

To use a table or view on a left join, you must get a left join representation calling the method `forUseInLeftJoin` or `forUseInLeftJoinAs` previous to write the query.

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const leftJoinCompany = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: parent.id,
        parentName: parent.name
    }).executeSelectMany();
```

The executed query is:
```sql
select company.id as id, company.name as name, parent.id as parentId, parent.name as parentName 
from company left join company as parent on company.parent_id = parent.id
```

The parameters are: `[]`

The result type is:
```tsx
const leftJoinCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
    parentName?: string;
}[]>
```

## Select with a compound operator (union, intersect, except)

```ts
const allDataWithName = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        type: connection.const<'customer' | 'company'>('customer', 'enum', 'customerOrCompany')
    }).unionAll(
        connection.selectFrom(tCompany)
        .select({
            id: tCompany.id,
            name: tCompany.name,
            type: connection.const<'customer' | 'company'>('company', 'enum', 'customerOrCompany')
        })
    ).executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name || $1 || last_name as name, $2 as type 
from customer 

union all 

select id as id, name as name, $3 as type 
from company
```

The parameters are: `[ ' ', 'customer', 'company' ]`

The result type is:
```tsx
const allDataWithName: Promise<{
    id: number;
    name: string;
    type: "customer" | "company";
}[]>
```

**Note**: depending on your database, the supported compound operators are: `union`, `unionAll`, `intersect`, `intersectAll`, `except`,  `exceptAll`, `minus` (alias for `except`), `minusAll` (alias for `exceptAll`)

## Using a select as a view in another select query (SQL with clause)

You can define a select query and use it as it were a view in another select query. To allow ait you must call the `forUseInQueryAs` instead of executing the query; this will return a view representation of the query as it were a view, and the query will be included as a `with` clause in the final sql query with the name indicated by argument to the `forUseInQueryAs` method.

```ts
const customerCountPerCompanyWith = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    }).groupBy('companyId', 'companyName')
    .forUseInQueryAs('customerCountPerCompany');

const customerCountPerAcmeCompanies = connection.selectFrom(customerCountPerCompanyWith)
    .where(customerCountPerCompanyWith.companyName.containsInsensitive('ACME'))
    .select({
        acmeCompanyId: customerCountPerCompanyWith.companyId,
        acmeCompanyName: customerCountPerCompanyWith.companyName,
        acmeCustomerCount: customerCountPerCompanyWith.customerCount
    })
    .executeSelectMany();
```

The executed query is:
```sql
with
    customerCountPerCompany as (
        select company.id as companyId, company.name as companyName, count(customer.id) as customerCount
        from company inner join customer on customer.company_id = company.id
        group by company.id, company.name
    )
select companyId as "acmeCompanyId", companyName as "acmeCompanyName", customerCount as "acmeCustomerCount"
from customerCountPerCompany
where companyName ilike ('%' || $1 || '%')
```

The parameters are: `[ 'ACME' ]`

The result type is:
```tsx
const customerCountPerAcmeCompanies: Promise<{
    acmeCompanyId: number;
    acmeCompanyName: string;
    acmeCustomerCount: number;
}[]>
```

## Select clauses order

The select query clauses must follow one of the next orders:

- **Logical order**: from, join, *where*, **group by**, **having**, **select**, union/intersect/except/minus/recursive, order by, limit, offset
- **Alternative logical order 1**: from, join, **group by**, **having**, *where*, **select**, union/intersect/except/minus/recursive, order by, limit, offset
- **Arternative logical order 2**: from, join, **group by**, **having**, **select**, *where*, union/intersect/except/minus/recursive, order by, limit, offset
- **Alternative order 1**: from, join, **select**, *where*, **group by**, **having**, union/intersect/except/minus/recursive, order by, limit, offset
- **Alternative order 2**: from, join, **select**, **group by**, **having**, *where*, union/intersect/except/minus/recursive, order by, limit, offset