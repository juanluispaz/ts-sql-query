---
search:
  boost: 0.55
---
# Methods of your own

A [data type of yours](own-data-types.md) has the operations of its family, and its class can add methods of its own: a method that writes its SQL, like a number of milliseconds in seconds, and a method that a dynamic filter can call by its name, like whether a birthday falls on 29 February. To give a method of the family another signature, like multiplying milliseconds by a plain number, see [Combining your type with other values](branded-and-opaque-types.md#combining-your-type-with-other-values), which also has the types `ts-sql-query` exports to write the signatures.

## SQL of your own in a method

A method of your type can write its SQL, with `this.fragmentWithType`, as `fragmentWithType` of the connection: the data type of the result, `'required'` or `'optional'`, and the SQL with the value the method is called on, `${this}`. A value given to the method goes in it with `this.const` (or `this.optionalConst`), as `const` of the connection. Both exist only inside the class (they are `protected`), and the result has the source of the column the method is called on:

```ts
import { IntegersType, Table } from "ts-sql-query"

declare const millisecondsBrand: unique symbol
type Milliseconds = number & { readonly [millisecondsBrand]: true }

abstract class MillisecondsType extends IntegersType<Milliseconds, 'Milliseconds'> {
    static override readonly type = 'Milliseconds'

    // The value in seconds
    inSeconds() {
        return this.fragmentWithType('double', 'required').sql`${this} / 1000.0`
    }
    // Whether it is longer than the seconds given
    exceedsSeconds(seconds: number) {
        return this.fragmentWithType('boolean', 'required').sql`${this} > ${this.const(seconds, 'double')} * 1000`
    }
}

const tCall = new class TCall extends Table<DBConnection, 'TCall'> {
    id = this.primaryKey('id', 'int')
    duration = this.column('duration_ms', MillisecondsType)
    constructor() {
        super('phone_call')
    }
}()

const calls = await connection.selectFrom(tCall)
    .where(tCall.duration.exceedsSeconds(10))
    .select({ id: tCall.id, seconds: tCall.duration.inSeconds() })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        duration_ms / 1000.0 as seconds 
    from phone_call 
    where duration_ms > ? * 1000
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        duration_ms / 1000.0 as seconds 
    from phone_call 
    where duration_ms > ? * 1000
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        duration_ms / 1000.0 as "seconds" 
    from phone_call 
    where duration_ms > :0 * 1000
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        duration_ms / 1000.0 as seconds 
    from phone_call 
    where duration_ms > $1 * 1000
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        duration_ms / 1000.0 as seconds 
    from phone_call 
    where duration_ms > ?1 * 1000
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        duration_ms / 1000.0 as seconds 
    from phone_call 
    where duration_ms > @0 * 1000
    ```

The parameters are: `[ 10 ]`

A method like these can be exposed to a dynamic filter too, as the next section shows. The SQL of a fragment is written as it is, so it must be valid on your database.

## Operations of your own in a dynamic filter

A [dynamic filter](../../dynamic/caller-decides/filters.md) calls the methods of the data type of each column: `{ birthday: { greaterThan: date } }` is `birthday.greaterThan(date)`. A type of yours has the operations of its family, and its class can offer methods of its own to a filter. Each of these methods gives a condition and has no parameters or one. List them in `[filterOperation]`, a static of the class, with `exposeFilterOperations`, and declare that static on the instance, so the type of the filter has them:

```ts
import { DynamicCondition, LocalDatesType, Table, exposeFilterOperations, filterOperation } from "ts-sql-query"

abstract class BirthdayType extends LocalDatesType<Date, 'Birthday'> {
    static override readonly type = 'Birthday'
    static override readonly [filterOperation] = exposeFilterOperations(this, LocalDatesType, ['isLeapDay', 'inYear'])
    declare [filterOperation]: (typeof BirthdayType)[typeof filterOperation]

    // Born on 29 February
    isLeapDay() {
        return this.getMonth().equals(1).and(this.getDate().equals(29))
    }
    inYear(year: number) {
        return this.getFullYear().equals(year)
    }
}

const tCustomerBirthday = new class TCustomerBirthday extends Table<DBConnection, 'TCustomerBirthday'> {
    id = this.primaryKey('id', 'int')
    birthday = this.optionalColumn('birthday', BirthdayType)
    constructor() {
        super('customer')
    }
}()

const filter: DynamicCondition<{ birthday: BirthdayType }> = {
    birthday: { inYear: 2000, isLeapDay: true }
}

const customers = await connection.selectFrom(tCustomerBirthday)
    .where(connection.dynamicConditionFor({ birthday: tCustomerBirthday.birthday }).withValues(filter))
    .select({ id: tCustomerBirthday.id })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select id as id 
    from customer 
    where 
            year(birthday) = ? 
        and (month(birthday) - 1) = ? 
        and (dayofmonth(birthday)) = ?
    ```
=== "MySQL"
    ```mysql
    select id as id 
    from customer 
    where 
            year(birthday) = ? 
        and (month(birthday) - 1) = ? 
        and (dayofmonth(birthday)) = ?
    ```
=== "Oracle"
    ```oracle
    select id as "id" 
    from customer 
    where 
            extract(year from birthday) = :0 
        and (extract(month from birthday) - 1) = :1 
        and extract(day from birthday) = :2
    ```
===+ "PostgreSQL"
    ```postgresql
    select id as id 
    from customer 
    where 
            extract(year from birthday) = $1 
        and (extract(month from birthday) - 1) = $2 
        and extract(day from birthday) = $3
    ```
=== "SQLite"
    ```sqlite
    select id as id 
    from customer 
    where 
            cast(strftime('%Y', birthday) as integer) = ?1 
        and (cast(strftime('%m', birthday) as integer) - 1) = ?2 
        and cast(strftime('%d', birthday) as integer) = ?3
    ```
=== "SQL Server"
    ```sqlserver
    select id as id 
    from customer 
    where 
            datepart(year, birthday) = @0 
        and (datepart(month, birthday) - 1) = @1 
        and datepart(day, birthday) = @2
    ```

The parameters are: `[ 2000, 1, 29 ]`

`exposeFilterOperations` receives the class, the class it extends, whose operations it keeps, and the names of the methods it adds. The compiler checks each name: a method that doesn't give a condition, or has more than one parameter, or an optional one, isn't accepted.

What the filter gives each method:

- A method with a parameter receives the value of the filter, of the type of its parameter: `inYear: 2000` is `inYear(2000)`.
- A method without parameters receives `true` or `false`: `true` applies the condition, `isLeapDay()`, and `false` its negation, `isLeapDay().negate()`.
- A value `null` or `undefined` adds no condition, as with the operations of the library, unless the name of the method is `is` or `isNot` or ends in `IfValue`: those receive it. See [Empty values in a filter](../../dynamic/caller-decides/filters.md#empty-values-in-a-filter).

A filter that another system writes keeps the names it was written with. When a method is renamed, the old name can stay as an alias, which `withValues` applies as the method it stands for, and which the type of the filter doesn't offer: the fourth argument of `exposeFilterOperations`, like `{ leapDay: 'isLeapDay' }`. A name the class or its family exposes wins over an alias with that name, and a class keeps the aliases of its family: the names that version 1 used for the comparisons, like `smaller` for `lessThan`, keep working on every data type with an order.

`FilterOf<BirthdayType>`, from `ts-sql-query`, is the type of the filter of the column: the operations of `LocalDatesType` and `isLeapDay` and `inYear`. Without the `declare` line, the type of the filter doesn't have them, but a filter that arrives as data, like one parsed from JSON, can still use them: the class has them. A method that isn't in the list is rejected with `DYNAMIC_CONDITION_UNKNOWN_OPERATION`, and one that gives something that isn't a condition at run time, like a method whose type is `any`, with `DYNAMIC_CONDITION_INVALID_OPERATION_RETURN_TYPE`.
