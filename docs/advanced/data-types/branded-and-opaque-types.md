---
search:
  boost: 0.55
---
# Branded and opaque types

A column of units in stock is a `number` in the database, and so is a column of an id. A **branded type** keeps them apart in your code: it's a `number`, a `string` or a `bigint` with a mark that only TypeScript sees, so an id can't be given where a number of units goes, and the compiler says so. An **opaque type** goes further: your code doesn't make or look into its values except through the functions you write for it. It is a brand that nothing else can imitate, or a value of a class of yours, like an amount of money as an object.

A [data type of yours](own-data-types.md) gives a column such a type: the values read from the database already have it, and the values given to the column must have it.

## A brand with a symbol of its own

The recommended way to brand a type is with a `unique symbol` declared for it:

```ts
import { IntegersType, Table } from "ts-sql-query"

declare const unitsBrand: unique symbol
type Units = number & { readonly [unitsBrand]: true }

// The one place that makes a number of units
function units(value: number): Units {
    if (!Number.isInteger(value)) {
        throw new Error('A number of units is an integer: ' + value)
    }
    return value as Units
}

abstract class UnitsType extends IntegersType<Units, 'Units'> {
    static override readonly type = 'Units'
}

const tProduct = new class TProduct extends Table<DBConnection, 'TProduct'> {
    id = this.primaryKey('id', 'int')
    stock = this.column('stock', UnitsType)
    constructor() {
        super('product')
    }
}()

const lowStock = await connection.selectFrom(tProduct)
    .where(tProduct.stock.lessThan(units(200)))
    .select({ id: tProduct.id, stock: tProduct.stock })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        stock as stock 
    from product 
    where stock < ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        stock as stock 
    from product 
    where stock < ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        stock as "stock" 
    from product 
    where stock < :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        stock as stock 
    from product 
    where stock < $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        stock as stock 
    from product 
    where stock < ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        stock as stock 
    from product 
    where stock < @0
    ```

The parameters are: `[ 200 ]`

`lowStock` is a `{ id: number, stock: Units }[]`: the stock is read as an `int` and has the type of the column. `tProduct.stock.lessThan(200)` doesn't compile, because `200` isn't a number of units; `units(200)` is, and `units(1.5)` throws before any query is built.

The symbol exists only for TypeScript: `declare` creates nothing at run time, and the value is the plain number. Why a symbol, and not a name like `{ readonly __brand: 'Units' }`, which works the same way in the library:

| | Brand with a name | Brand with a `unique symbol` |
|---|---|---|
| Two brands declared apart with the same name | Are the same type: a `Units` of one module is accepted as the `Units` of another | Are two types: each symbol is unique |
| Autocompletion and `keyof` of a value | Show `__brand` as if the value had it | Show nothing |
| A plain `number` where the brand goes | Doesn't compile | Doesn't compile |
| The value where a `number` goes | Accepted | Accepted |

With either of them a value gets the brand by a cast (`value as Units`). Keep that cast in one function, like `units` above, which checks the value: then every number of units in your code went through it, or came from the database.

## A value of a class of yours

When the value in your code is an object, like an amount of money that carries its own operations, the class of the data type converts it on its way to the database and back. Its family is the one of what the values can do in a query, and since a family whose values aren't numbers converts nothing, the class says how: with `transformValueToDB` and `transformValueFromDB`, statics with the parameters of a [type adapter](type-adapters.md), where `next` is the conversion of the library. Here the money is kept in a `decimal(10, 2)` column, and its amount in your code is a [scaled bigint](../../configuration/data-types.md#scaled-bigints) of 2 decimals, `ScaledBigInt<2>`:

```ts
import { ComparableType, Table, scaledBigInt,  type DefaultTypeAdapter, type ScaledBigInt, type SqlDataType, type TypeAdapterValueFromDBContext, type TypeAdapterValueToDBContext } from "ts-sql-query"

class Money {
    constructor(readonly amount: ScaledBigInt<2>) {}
}

abstract class MoneyType extends ComparableType<Money, 'Money'> {
    static override readonly type = 'Money'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', precision: 10, scale: 2 }

    static override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('ScaledBigInt<2>')
        return next.transformValueToDB(value instanceof Money ? value.amount : value, context)
    }
    static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('ScaledBigInt<2>')
        const result = next.transformValueFromDB(value, context)
        return typeof result === 'bigint' ? new Money(scaledBigInt(result, 2)) : result
    }
}

const tOrder = new class TOrder extends Table<DBConnection, 'TOrder'> {
    id = this.primaryKey('id', 'int')
    total = this.column('total', MoneyType)
    constructor() {
        super('customer_order')
    }
}()

const bigOrders = await connection.selectFrom(tOrder)
    .where(tOrder.total.greaterOrEqual(new Money(scaledBigInt(10000n, 2))))
    .select({ id: tOrder.id, total: tOrder.total })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        total as total 
    from customer_order 
    where total >= cast(? as decimal(5, 2))
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        total as total 
    from customer_order 
    where total >= cast(? as decimal(5, 2))
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        total as "total" 
    from customer_order 
    where total >= :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        total as total 
    from customer_order 
    where total >= $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        total as total 
    from customer_order 
    where decimal_cmp(total, ?1) >= 0
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        convert(nvarchar(41), total) as total 
    from customer_order 
    where total >= cast(@0 as decimal(5, 2))
    ```

The parameters are: `[ '100.00' ]`

`bigOrders` is a `{ id: number, total: Money }[]`, and each `total` is an instance of `Money`. `setRequestedType('ScaledBigInt<2>')` says that the value goes and comes back as a `ScaledBigInt<2>`: the library sends `10000n` as the text of the decimal, `'100.00'`, and converts what the database gives into a `bigint` of 2 decimals, like `150n` for `1.50`, and the class turns it into a `Money`. The SQL data type says what the column is in the database, a decimal of 10 digits with 2 decimals: see [The type of a column in the database](sql-data-types.md).

`ComparableType` gives the column equality and order, like `greaterOrEqual` and `between`; arithmetic in the database, like adding two amounts, would need a family that has it, like `AdditiveType`.

The conversion can be in the connection instead, for every type it applies to, or in a type adapter of one column: see [Type adapters](type-adapters.md).

## Combining your type with other values

A type of yours works only with values of its own type: `tProduct.stock.multiply(3)` doesn't compile when `Units` is a `number` with a brand, because `3` isn't a `Units`. Which combinations make sense is a decision of your type, so its class adds them, with the types `ts-sql-query` exports to write them: `ValueSource`, `SourceOf`, `OptionalityOf`, `DataTypeOf`, `CombinedOptionality` and `OperandOf`. A class can add an overload to a method of its family, which repeats the ones it has and calls `super`:

```ts
import { IntegersType, IntType, type CombinedOptionality, type DataTypeOf, type OperandOf, type OptionalityOf, type SourceOf, type ValueSource } from "ts-sql-query"

declare const unitsBrand: unique symbol
type Units = number & { readonly [unitsBrand]: true }

abstract class UnitsType extends IntegersType<Units, 'Units'> {
    static override readonly type = 'Units'

    // A number of units, or a plain number, like a number of packs
    override multiply(value: Units | number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    // A value of units, or an int, like a column with the number of packs
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

A value given to the method, like `3`, is sent as a value of the type of the receiver: an integer for `UnitsType`. Keep `SourceOf<VALUE>` in the source of the result: it's what makes a query reject a value of a table it doesn't have. A method of its own can do the same with another name, like `times(factor: number)`, and write its SQL: see [Methods of your own](methods-of-your-own.md).

## In a dynamic filter

A [dynamic filter](../../dynamic/caller-decides/filters.md) of a column of your type takes values of your type: in a `DynamicCondition<{ stock: UnitsType }>`, `{ stock: { lessThan: units(200) } }`. A filter that arrives as data, like one parsed from JSON, carries what JSON has: a number for a branded `number`, which is the value at run time, but never an instance of your class, so turn its values into your type, like `new Money(scaledBigInt(..., 2))`, before giving it to the query. A filter typed from a business model, with `DynamicConditionForModel`, gives a branded `string` or `number` the operators of equality and comparison: see [Typing from a business model](../../dynamic/own-function/from-business-model.md).
