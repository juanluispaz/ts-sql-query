# SQL fragments

## Select with custom SQL fragment

SQL fragments allows to include sql in your query, that give you the possibility to do some operations not included in ts-sql-query.

```ts
const id = 10;

const customersUsingCustomFragment = connection.selectFrom(tCustomer)
    .where(connection.fragmentWithType('boolean', 'required').sql`!!${tCustomer.id} = !!${connection.const(id, 'int')}`)
    .select({
        idAsString: connection.fragmentWithType('string', 'required').sql`${tCustomer.id}::varchar`,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName)
    })
    .executeSelectNoneOrOne();
```

The executed query is:
```sql
select id::varchar as idAsString, first_name || $1 || last_name as name 
from customer 
where !!id = !!$2
```

The parameters are: `[ ' ', 10 ]`

The result type is:
```tsx
const customersUsingCustomFragment: Promise<{
    idAsString: string;
    name: string;
} | null>
```

## Select with custom reusable SQL fragment

You can define functions in your connection that create custom reusable SQL fragments, that give you the possibility to do some operations or functions not included in ts-sql-query.

If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 

    bitwiseShiftLeft = this.buildFragmentWithArgs(
        this.arg('int', 'required'),
        this.arg('int', 'required')
    ).as((left, right) => {
        // The fragment here is: ${left} << ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('int', 'required').sql`${left} << ${right}`
    })
}
```

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; this arguments can be numbers or elements in the database that represents integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function only will accept values but not elements of the database. You can use the defined function as a regular database function in your query.

```ts
const bitwiseMovements = 1;
const multiplier = 2;

const companiesUsingCustomFunctionFragment = connection.selectFrom(tCompany)
    .where(tCompany.id.multiply(multiplier).equals(connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        idMultiplyBy2: connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)
    })
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, name as name, id << $1 as idMultiplyBy2 
from company 
where (id * $2) = (id << $3)
```

The parameters are: `[ 1, 2, 1 ]`

The result type is:
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
    idMultiplyBy2: number;
}[]>
```

## Select with custom reusable SQL fragment if value

You can define functions in your connection that create custom reusable SQL fragments that have the same behaviour of the functions with name ended with `IfValue`, that give you the possibility to do some operations or functions not included in ts-sql-query.

ts-sql-query offers many commodity methods with name ended with `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, ts-sql-query is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

The method `buildFragmentWithArgsIfValue` allows you to create a function, where if any optional value argument receives `null` or `undefined` or an empty string, the execution of the provided function is omitted.

If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 

    valuePlusOneEqualsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} + 1 = ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('boolean', 'required').sql`${left} + 1 = ${right}`
    })
}
```

You will define the function `bitwiseShiftLeft` that receives two `int` as argument and returns an `int`; this arguments can be numbers or elements in the database that represents integer numbers. If you create the argument using the function `valueArg` instead of the `arg` function, the defined function only will accept values but not elements of the database. You can use the defined function as a regular database function in your query.

```ts
const noValue = null
const withValue = 2

const companiesUsingCustomFunctionFragmentIfValue = connection.selectFrom(tCompany)
    .where(connection.valuePlusOneEqualsIfValue(tCompany.id, noValue))
        .or(connection.valuePlusOneEqualsIfValue(tCompany.id, withValue))
    .select({
        id: tCompany.id,
        name: tCompany.name,
    })
    .executeSelectMany()
```

The executed query is:
```sql
select id as id, name as name 
from company 
where id + 1 = $1
```

The parameters are: `[ 2 ]`

The result type is:
```ts
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
}[]>
```
