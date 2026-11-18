---
search:
  boost: 0.55
---
# Branded and opaque types

A column of cents is a `number` in the database, and so is a column of a quantity. A **branded type** keeps them apart in your code: it's a `number`, a `string` or a `bigint` with a mark that only TypeScript sees, so a quantity can't be given where an amount of cents goes, and the compiler says so. An **opaque type** goes further: your code doesn't make or look into its values except through the functions you write for it. It is a brand that nothing else can imitate, or a value of a class of yours, like an amount of money as an object.

A [data type of yours](own-data-types.md) gives a column such a type: the values read from the database already have it, and the values given to the column must have it.

## A brand with a symbol of its own

The recommended way to brand a type is with a `unique symbol` declared for it:

```ts
import { IntegersType, Table } from "ts-sql-query"

declare const centsBrand: unique symbol
type Cents = number & { readonly [centsBrand]: true }

// The one place that makes an amount of cents
function cents(value: number): Cents {
    if (!Number.isInteger(value)) {
        throw new Error('An amount of cents is an integer: ' + value)
    }
    return value as Cents
}

abstract class CentsType extends IntegersType<Cents, 'Cents'> {
    static override readonly type = 'Cents'
}

const tProduct = new class TProduct extends Table<DBConnection, 'TProduct'> {
    id = this.primaryKey('id', 'int')
    price = this.column('price_cents', CentsType)
    constructor() {
        super('product')
    }
}()

const cheapProducts = await connection.selectFrom(tProduct)
    .where(tProduct.price.lessThan(cents(200)))
    .select({ id: tProduct.id, price: tProduct.price })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        price_cents as price 
    from product 
    where price_cents < ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        price_cents as price 
    from product 
    where price_cents < ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        price_cents as "price" 
    from product 
    where price_cents < :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        price_cents as price 
    from product 
    where price_cents < $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        price_cents as price 
    from product 
    where price_cents < ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        price_cents as price 
    from product 
    where price_cents < @0
    ```

The parameters are: `[ 200 ]`

`cheapProducts` is a `{ id: number, price: Cents }[]`: the price is read as an `int` and has the type of the column. `tProduct.price.lessThan(200)` doesn't compile, because `200` isn't an amount of cents; `cents(200)` is, and `cents(1.5)` throws before any query is built.

The symbol exists only for TypeScript: `declare` creates nothing at run time, and the value is the plain number. Why a symbol, and not a name like `{ readonly __brand: 'Cents' }`, which works the same way in the library:

| | Brand with a name | Brand with a `unique symbol` |
|---|---|---|
| Two brands declared apart with the same name | Are the same type: a `Cents` of one module is accepted as the `Cents` of another | Are two types: each symbol is unique |
| Autocompletion and `keyof` of a value | Show `__brand` as if the value had it | Show nothing |
| A plain `number` where the brand goes | Doesn't compile | Doesn't compile |
| The value where a `number` goes | Accepted | Accepted |

With either of them a value gets the brand by a cast (`value as Cents`). Keep that cast in one function, like `cents` above, which checks the value: then every amount of cents in your code went through it, or came from the database.

## A value of a class of yours

When the value in your code is an object, like an amount of money that carries its own operations, the class of the data type converts it on its way to the database and back. Its family is the one of what the values can do in a query, and since a family whose values aren't numbers converts nothing, the class says how: with `transformValueToDB` and `transformValueFromDB`, statics with the parameters of a [type adapter](type-adapters.md), where `next` is the conversion of the library. Here the money is kept in an integer column, as its number of cents:

```ts
import { ComparableType, Table, type DefaultTypeAdapter, type SqlDataType, type TypeAdapterValueFromDBContext, type TypeAdapterValueToDBContext } from "ts-sql-query"

class Money {
    constructor(readonly cents: bigint) {}
}

abstract class MoneyType extends ComparableType<Money, 'Money'> {
    static override readonly type = 'Money'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 8 }

    static override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('bigint')
        return next.transformValueToDB(value instanceof Money ? value.cents : value, context)
    }
    static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('bigint')
        const result = next.transformValueFromDB(value, context)
        return typeof result === 'bigint' ? new Money(result) : result
    }
}

const tOrder = new class TOrder extends Table<DBConnection, 'TOrder'> {
    id = this.primaryKey('id', 'int')
    total = this.column('total_cents', MoneyType)
    constructor() {
        super('customer_order')
    }
}()

const bigOrders = await connection.selectFrom(tOrder)
    .where(tOrder.total.greaterOrEqual(new Money(10000n)))
    .select({ id: tOrder.id, total: tOrder.total })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        total_cents as total 
    from customer_order 
    where total_cents >= ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        total_cents as total 
    from customer_order 
    where total_cents >= ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        total_cents as "total" 
    from customer_order 
    where total_cents >= :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        total_cents as total 
    from customer_order 
    where total_cents >= $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        total_cents as total 
    from customer_order 
    where total_cents >= ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        total_cents as total 
    from customer_order 
    where total_cents >= @0
    ```

The parameters are: `[ 10000n ]`

`bigOrders` is a `{ id: number, total: Money }[]`, and each `total` is an instance of `Money`. `setRequestedType('bigint')` says that the value goes and comes back as a `bigint`: the library sends `10000n` as an integer and checks and converts what the database gives as one, and the class turns it into a `Money`. The SQL data type says what the column is in the database, an integer of 8 bytes: see [The type of a column in the database](sql-data-types.md).

`ComparableType` gives the column equality and order, like `greaterOrEqual` and `between`; arithmetic in the database, like adding two amounts, would need a family that has it, like `AdditiveType`.

The conversion can be in the connection instead, for every type it applies to, or in a type adapter of one column: see [Type adapters](type-adapters.md).

## Combining your type with other values

A type of yours works only with values of its own type: `cents.multiply(3)` doesn't compile when `Cents` is a `number` with a brand, because `3` isn't a `Cents`. Which combinations make sense is a decision of your type, so its class adds them, with the types `ts-sql-query` exports to write them: `ValueSource`, `SourceOf`, `OptionalityOf`, `DataTypeOf`, `CombinedOptionality` and `OperandOf`. A class can add an overload to a method of its family, which repeats the ones it has and calls `super`:

```ts
import { IntegersType, IntType, type CombinedOptionality, type DataTypeOf, type OperandOf, type OptionalityOf, type SourceOf, type ValueSource } from "ts-sql-query"

declare const centsBrand: unique symbol
type Cents = number & { readonly [centsBrand]: true }

abstract class CentsType extends IntegersType<Cents, 'Cents'> {
    static override readonly type = 'Cents'

    // A number of cents, or a plain number of times
    override multiply(value: Cents | number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    // A value of cents, or an int, like a quantity
    override multiply<VALUE extends OperandOf<this> | OperandOf<IntType>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    override multiply(value: any): any {
        return super.multiply(value)
    }
}
```

| Type | What it is |
|---|---|
| `ValueSource<Source, DataType, Optionality>` | A value of a data type in a query |
| `SourceOf<X>` | The tables and views the value reaches, which the query must have |
| `OptionalityOf<X>` | Whether the value can be missing: `'required'`, `'optional'`… |
| `DataTypeOf<X>` | The class of the data type of the value |
| `CombinedOptionality<A, B>` | The optionality of a value computed from two: optional when one of them is |
| `OperandOf<DataType>` | A value the data type works with: its own, or of the group it belongs to (an int and a double); `OperandOf<this>` in its class |

A value given to the method, like `3`, is sent as a value of the type of the receiver: an integer for `CentsType`. Keep `SourceOf<VALUE>` in the source of the result: it's what makes a query reject a value of a table it doesn't have. A method of its own can do the same with another name, like `times(factor: number)`, and write its SQL: see [Methods of your own](methods-of-your-own.md).

## In a dynamic filter

A [dynamic filter](../../dynamic/caller-decides/filters.md) of a column of your type takes values of your type: in a `DynamicCondition<{ price: CentsType }>`, `{ price: { lessThan: cents(200) } }`. A filter that arrives as data, like one parsed from JSON, carries what JSON has: a number for a branded `number`, which is the value at run time, but never an instance of your class, so turn its values into your type, like `new Money(...)`, before giving it to the query. A filter typed from a business model, with `DynamicConditionForModel`, gives a branded `string` or `number` the operators of equality and comparison: see [Typing from a business model](../../dynamic/own-function/from-business-model.md).
