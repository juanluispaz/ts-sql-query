# ts-sql-query

[![npm](https://img.shields.io/npm/v/ts-sql-query.svg)](http://npm.im/ts-sql-query)

Type-safe SQL query builder like QueryDSL or JOOQ in Java for TypeScript with MariaDB, MySql, Oracle, PostgreSql, Sqlite and SqlServer support.

This package provides a way to build dynamic SQL queries in a type-safe way, that means, the TypeScript compiler verifies the queries. Note: this is not an ORM, and the most probably is you don't need one.

Type-safe sql means the mistakes writting a query will be detected during the compilation time. With ts-sql-query you don't need to be affraid of change the database, the problems caused by the change will be detected during compilation time.

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save ts-sql-query
```

## Basic queries

### Select one row

```ts
const customerId = 10;

const customersWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectOne();
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday 
from customer 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is:
```ts
const customersWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}>
```

The `executeSelectOne` returns one result, but if it is not found in the database an exception will be thrown. If you want to return the result when it is found or null when it is not found you must use the `executeSelectNoneOrOne` method.

### Select with joins and order by

```ts
const firstName = 'John';
const lastName = '';

const company = tCompany.as('comp');
const customersWithCompanyName = connection.selectFrom(tCustomer)
    .innerJoin(company).on(tCustomer.companyId.equals(company.id))
    .where(tCustomer.firstName.startWithInsensitive(firstName))
        .and(tCustomer.lastName.startWithInsensitiveIfValue(lastName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        companyName: company.name
    })
    .orderBy('firstName')
    .orderBy('lastName', 'asc')
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday, comp.name as companyName 
from customer inner join company as comp on company_id = comp.id 
where first_name ilike ($1 || '%') 
order by firstName, lastName asc
```

The parameters are: `[ 'John' ]`

The result type is:
```ts
const customersWithCompanyName: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    companyName: string;
    birthday?: Date;
}[]>
```

### Select with subquery and dynamic order by

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
    select id from company where name like ('%' || $1 || '%')
) 
order by customerFirstName asc nulls first, customerLastName
```

The parameters are: `[ 'Cia.' ]`

The result type is:
```ts
const customerWithSelectedCompanies: Promise<{
    customerId: number;
    customerFirstName: string;
    customerLastName: string;
}[]>
```

### Select with aggregate functions and group by

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
select id as companyId, name as companyName, count(id) as customerCount 
from company inner join customer on company_id = id 
group by id, name
```

The parameters are: `[]`

The result type is:
```ts
const customerCountPerCompany: Promise<{
    companyId: number;
    companyName: string;
    customerCount: number;
}[]>
```

### Select page

Select page execute the query twice, the first one to get the data from the database and the second one to get the count of all data without the limit and the offset. Note: select page is only available if you don't define a group by clause.

```ts
const customerName = 'Smi'
const customerPageWithName = connection.selectFrom(tCustomer)
    .where(
        tCustomer.firstName.startWithInsensitive(customerName)
    ).or(
        tCustomer.lastName.startWithInsensitive(customerName)
    ).select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('firstName')
    .orderBy('lastName')
    .limit(10)
    .offset(20)
    .executeSelectPage();
```

The executed query to get the data is:
```sql
select id as id, first_name as firstName, last_name as lastName 
from customer 
where first_name ilike ($1 || '%') 
    or last_name ilike ($2 || '%') 
order by firstName, lastName 
limit $3 
offset $4
```

And its parameters are: `[ 'Smi', 'Smi', 10, 20 ]`

The executed query to get the count is:
```sql
select count(*) 
from customer 
where first_name ilike ($1 || '%') 
    or last_name ilike ($2 || '%')
```

And its parameters are: `[ 'Smi', 'Smi' ]`

The result type is:
```ts
const customerPageWithName: Promise<{
    data: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
    count: number;
}>
```

### Select with custom sql fragment

Sql fragments allows to include sql in your query, that give you the possibility to do some operations not included in ts-sql-query.

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
```ts
const customersUsingCustomFragment: Promise<{
    idAsString: string;
    name: string;
} | null>
```

### Insert

```ts
const insertCustomer = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    }).setIfNotSet({
        birthday: new Date()
    }).returningLastInsertedId()
    .executeInsert();
```

The executed query is:
```sql
insert into customer (first_name, last_name, company_id, birthday) 
values ($1, $2, $3, $4) 
returning id
```

The parameters are: `[ 'John', 'Smith', 1, 2019-08-16T15:02:32.849Z ]`

The result type is a promise with the id of the last inserted row:
```ts
const insertCustomer: Promise<number>
```

### Update

```ts
const updateCustomer = connection.update(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        birthday: new Date()
    }).ignoreIfSet('birthday')
    .where(tCustomer.id.equals(10))
    .executeUpdate();
```

The executed query is:
```sql
update customer 
set first_name = $1, last_name = $2 
where id = $3
```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is a promise with the number of updated rows:
```ts
const updateCustomer: Promise<number>
```

### Delete

```ts
const deleteCustomer = connection.deleteFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .executeDelete();
```

The executed query is:
```sql
delete from customer 
where id = $1
```

The parameters are: `[ 10 ]`

The result type is a promise with the number of deleted rows:
```ts
const deleteCustomer: Promise<number>
```

### Defining the connection object

When you define the connection object you extends your database connection class that will receive two generic arguments, the first one is the connection class itself and the second one is a name for the database in your system.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<DBConection, 'DBConnection'> { }
```

### Instantiating the connection with the database connection

```ts
const { Pool } = require('pg');
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

const pool = new Pool();

async function main() {
    const pgConnection = await pool.connect();
    try {
        const connection = new DBConection(new PgQueryRunner(pgConnection));
        // Do your queries here
        /*
         * Maybe you want to call:
         * await connection.beginTransaction();
         * await connection.commit();
         * await connection.rollback();
         */
    } finally {
        pgConnection.release();
    }
}
```

### Instantiating the connection with a mock database connection

Have a mock database connection is useful when you want to make unit tests. Using a mock connection allows you to test your code against the generated query instead of run the query in the database.

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

function test('my db tets', () => {
    const connection = new DBConection(new MockQueryRunner(
        (type, query, params, index) => {
            switch (index) {
            case 0:
                expect(type).toBe('delete');
                expect(query).toBe('delete from customer where id = $1');
                expect(params).toEqual([10]);
                return 1; // Returns the result of the query execution
            default:
                throw new Error('Unexpected query');
            }
        }
    ));

    // Do your queries here, example:
    const deleteCustomer = connection.deleteFrom(tCustomer)
        .where(tCustomer.id.equals(10))
        .executeDelete();

    return deleteCustomer.then((result) => {
        expect(result).toBe(1);
    });
});
```

### Mapping the tables

In order to use the tables in queries you need to map it in your system. To do it you need to extends the table class that receives as generic argument the connection class.

```ts
import { Table } from "ts-sql-query/Table";

const tCompany = new class TCompany extends Table<DBConection> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    name = this.column('name', 'string');
    constructor() {
        super('company'); // table name in the database
    }
}();

const tCustomer = new class TCustomer extends Table<DBConection> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    firstName = this.column('first_name', 'string');
    lastName = this.column('last_name', 'string');
    birthday = this.optionalColumn('birthday', 'localDate');
    companyId = this.column('company_id', 'int');
    constructor() {
        super('customer'); // table name in the database
    }
}();
```

### Mapping the views

In order to use the views in queries you need to map it in your system. To do it you need to extends the view class that receives as generic argument the connection class.

```ts
import { View } from "ts-sql-query/View";

const vCustomerAndCompany = new class VCustomerAndCompany extends View<DBConection> {
    companyId = this.column('company_id', 'int');
    companyName = this.column('company_name', 'string');
    customerId = this.column('customer_id', 'int');
    customerFirstName = this.column('customer_first_name', 'string');
    customerLastName = this.column('customer_last_name', 'string');
    customerBirthday = this.optionalColumn('customer_birthday', 'localDate');
    constructor() {
        super('customer_company'); // view name in the database
    }
}();
```

### Creating methods that allows to call a procedure

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<DBConection, 'DBConnection'> { 
    myOwnprocedure(param1: number) {
        return this.executeProcedure('myOwnprocedure', [this.const(param1, 'int')]);
    }
}
```

Executing the procedure:
```ts
const result = connection.myOwnprocedure(10);
```

The executed query is:
```sql
call myOwnprocedure($1)
```

The parameters are: `[ 10 ]`

The result type is a promise with the number of deleted rows:
```ts
const result: Promise<void>
```

### Creating methods that allows to call a function

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<DBConection, 'DBConnection'> { 
    myOwnFunction(param1: number) {
        return this.executeFunction('myOwnFunction', [this.const(param1, 'int')], 'int', 'required');
    }
}
```

Executing the function:
```ts
const result = connection.myOwnFunction(10);
```

The executed query is:
```sql
select myOwnFunction($1)
```

The parameters are: `[ 10 ]`

The result type is a promise with the number of deleted rows:
```ts
const result: Promise<number>
```

## Supported operations

The most common operations over the data are suported by ts-sql-query; in the case the database don't support it, an emulation is provided, if an emulation is not possible you will get an error during the compilation of your source code.

Some API are fluent API, that means, every function you call returns an object that contains the functions that you can call in that step. 

Here is shown a simplified version of the ts-sql-query APIs.

### Operations definitions

All values managed by the database are represented as a subclass of `ValueSource`, almost all methods listed here support the TypeScript value and the database value (as overload).

The methods which name ends with `IfValue` do the same that the one without `IfValue` but only if the provided value(s) are different to undefined, null or empty string, otherwise it is ignored.

Be aware, in the database, when null is part of an operation the result of the operation is null (It is not represented in the following definition but it is implemented)

All the data manipulation operations are implemented as a methods inside the value, that means if you what to calculate the abolute, in sql is `abs(value)` but in ts-sql-query is reprecented as `value.abs()`.

```ts
interface ValueSource {

}

interface NullableValueSource extends ValueSource {
    isNull(): boolean
    isNotNull(): boolean
    valueWhenNull(value: this): this
    asOptional(): this | null | undefined
}

interface EqualableValueSource extends NullableValueSource {
    equalsIfValue(value: this | null | undefined): boolean
    equals(value: this): boolean
    notEqualsIfValue(value: this | null | undefined): boolean
    notEquals(value: this): boolean
    isIfValue(value: this | null | undefined): boolean
    /** 'is' is the same that equals, but returns true when booth are null */
    is(value: this): boolean
    isNotIfValue(value: this | null | undefined): boolean
    isNot(value: this): boolean
}

interface ComparableValueSource extends EqualableValueSource {
    smallerIfValue(value: this | null | undefined): boolean
    smaller(value: this): boolean
    largerIfValue(value: this | null | undefined): boolean
    larger(value: this): boolean
    smallAsIfValue(value: this | null | undefined): boolean
    smallAs(value: this): boolean
    largeAsIfValue(value: this | null | undefined): boolean
    largeAs(value: this): boolean
    inIfValue(values: this[] | null | undefined): boolean
    inIfValue(value: this | null | undefined): boolean
    in(values: this[]): boolean
    in(value: this): boolean
    in(select: Subquery): boolean
    notInIfValue(values: this[] | null | undefined): boolean
    notInIfValue(value: this | null | undefined): boolean
    notIn(values: this[]): boolean
    notIn(value: this): boolean
    notIn(select: Subquery): boolean
    inN(...value: this[]): boolean
    notInN(...value: this[]): boolean
    between(value: this, value2: this): boolean
    notBetween(value: this, value2: this): boolean
}

/**
 * Represents a boolean
 */
interface BooleanValueSource extends EqualableValueSource {
    negate(): boolean
    and(value: boolean): boolean
    or(value: boolean): boolean
}

/**
 * Represents a stringInt or a stringDouble
 */
interface NumberValueSource extends ComparableValueSource {
    asStringNumber(): number|string
    abs(): number
    ceil(): number
    floor(): number
    round(): number
    exp(): number
    ln(): number
    log10(): number
    sqrt(): number
    cbrt(): number
    sign(): number
    acos(): number
    asin(): number
    atan(): number
    cos(): number
    cot(): number
    sin(): number
    tan(): number
    power(value: number): number
    logn(value: number): number
    roundn(value: number): number
    minValue(value: number): number
    maxValue(value: number): number
    add(value: number): number
    substract(value: number): number
    multiply(value: number): number
    divide(value: number): number
    mod(value: number): number
    atan2(value: number): number
}

/**
 * Represents a int or a double
 */
interface StringNumberValueSource extends ComparableValueSource {
    abs(): number|string
    ceil(): number|string
    floor(): number|string
    round(): number|string
    exp(): number|string
    ln(): number|string
    log10(): number|string
    sqrt(): number|string
    cbrt(): number|string
    sign(): number|string
    acos(): number|string
    asin(): number|string
    atan(): number|string
    cos(): number|string
    cot(): number|string
    sin(): number|string
    tan(): number|string
    power(value: number|string): number|string
    logn(value: number|string): number|string
    roundn(value: number|string): number|string
    minValue(value: number|string): number|string
    maxValue(value: number|string): number|string
    add(value: number|string): number|string
    substract(value: number|string): number|string
    multiply(value: number|string): number|string
    divide(value: number|string): number|string
    mod(value: number|string): number|string
    atan2(value: number|string): number|string
}

/**
 * Represents a string
 */
interface StringValueSource extends ComparableValueSource {
    equalsInsensitiveIfValue(value: string | null | undefined): boolean
    equalsInsensitive(value: string): boolean
    notEqualsInsensitiveIfValue(value: string | null | undefined): boolean
    notEqualsInsensitive(value: string): boolean
    likeIfValue(value: string | null | undefined): boolean
    like(value: string): boolean
    notLikeIfValue(value: string | null | undefined): boolean
    notLike(value: string): boolean
    likeInsensitiveIfValue(value: string | null | undefined): boolean
    likeInsensitive(value: string): boolean
    notLikeInsensitiveIfValue(value: string | null | undefined): boolean
    notLikeInsensitive(value: string): boolean
    startWithIfValue(value: string | null | undefined): boolean
    startWith(value: string): boolean
    notStartWithIfValue(value: string | null | undefined): boolean
    notStartWith(value: string): boolean
    endWithIfValue(value: string | null | undefined): boolean
    endWith(value: string): boolean
    notEndWithIfValue(value: string | null | undefined): boolean
    notEndWith(value: string): boolean
    startWithInsensitiveIfValue(value: string | null | undefined): boolean
    startWithInsensitive(value: string): boolean
    notStartWithInsensitiveIfValue(value: string | null | undefined): boolean
    notStartWithInsensitive(value: string): boolean
    endWithInsensitiveIfValue(value: string | null | undefined): boolean
    endWithInsensitive(value: string): boolean
    notEndWithInsensitiveIfValue(value: string | null | undefined): boolean
    notEndWithInsensitive(value: string): boolean
    containsIfValue(value: string | null | undefined): boolean
    contains(value: string): boolean
    notContainsIfValue(value: string | null | undefined): boolean
    notContains(value: string): boolean
    containsInsensitiveIfValue(value: string | null | undefined): boolean
    containsInsensitive(value: string): boolean
    notContainsInsensitiveIfValue(value: string | null | undefined): boolean
    notContainsInsensitive(value: string): boolean
    lower(): string
    upper(): string
    length(): number
    trim(): string
    ltrim(): string
    rtrim(): string
    reverse(): string
    concatIfValue(value: string | null | undefined): string
    concat(value: string): string
    substringToEnd(start: number): string
    substring(start: number, end: number): string
    replaceIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): string
    replace(findString: string, replaceWith: string): string
}

/**
 * Represents a local date without time (using a Date object)
 */
interface DateValueSource extends ComparableValueSource {
    /** Gets the year */
    getFullYear(): number
    /** Gets the month (value between 0 to 11)*/
    getMonth(): number
    /** Gets the day-of-the-month */
    getDate(): number
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): number
}

/**
 * Represents a local time without date (using a Date object)
 */
interface TimeValueSource extends ComparableValueSource {
    /** Gets the hours */
    getHours(): number
    /** Gets the minutes */
    getMinutes(): number
    /** Gets the seconds */
    getSeconds(): number
    /** Gets the milliseconds */
    getMilliseconds(): number
}

/**
 * Represents a local date with time (using a Date object)
 */
interface DateTimeValueSource extends ComparableValueSource {
    /** Gets the year */
    getFullYear(): number
    /** Gets the month (value between 0 to 11)*/
    getMonth(): number
    /** Gets the day-of-the-month */
    getDate(): number
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): number
    /** Gets the hours */
    getHours(): number
    /** Gets the minutes */
    getMinutes(): number
    /** Gets the seconds */
    getSeconds(): number
    /** Gets the milliseconds */
    getMilliseconds(): number
    /** Gets the time value in milliseconds */
    getTime(): number
}
```

### Connection definition

```ts
interface Connection {
    /** Query runner used to create the connection */
    readonly queryRunner: QueryRunner

    // Transaction management
    beginTransaction(): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>

    // Querying
    insertInto(table: Table): InsertExpression
    update(table: Table): UpdateExpression
    updateAllowingNoWhere(table: Table): UpdateExpression
    deleteFrom(table: Table): DeleteExpression
    deleteAllowingNoWhereFrom(table: Table): DeleteExpression
    selectFrom(table: Table | View): SelectExpression
    selectDistinctFrom(table: Table | View): SelectExpression
    selectFromNoTable(): SelectExpressionFromNoTable

    // These methods allows to create a subquery that depends of a outer table defined in the main query 
    subSelectUsing(table: Table | View): SelectExpression
    subSelectUsing(table1: Table | View, table2: Table | View): SelectExpression
    subSelectUsing(table1: Table | View, table2: Table | View, table3: Table | View): SelectExpression
    subSelectDistinctUsing(table: Table | View): SelectExpression
    subSelectDistinctUsing(table1: Table | View, table2: Table | View): SelectExpression
    subSelectDistinctUsing(table1: Table | View, table2: Table | View, table3: Table | View): SelectExpression
    
    // default value for use in insert queries
    default(): Default

    // values that can be returned by the database
    pi(): NumberValueSource
    random(): NumberValueSource
    currentDate(): DateValueSource
    currentTime(): TimeValueSource
    currentDateTime(): DateTimeValueSource
    currentTimestamp(): DateTimeValueSource
    true(): BooleanValueSource
    false(): BooleanValueSource

    // methods that allows to create a value source with a constant value
    const(value: boolean, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    const(value: number | string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    const(value: number, type: 'int', adapter?: TypeAdapter): NumberValueSource
    const(value: number | string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    const(value: number, type: 'double', adapter?: TypeAdapter): NumberValueSource
    const(value: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    const(value: Date, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    const(value: Date, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    const(value: Date, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    const<T>(value: T, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    const<T>(value: T, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    
    // allows to use the exits function on a subquery
    exists(select: Subquery): BooleanValueSource
    notExists(select: Subquery): BooleanValueSource

    // aggregate functions
    /** count(*) */
    countAll(): NumberValueSource
    /** count(value) */
    count(value: ValueSource): NumberValueSource
    /** count(distinct value) */
    countDistinct(value: ValueSource): NumberValueSource
    /** max(value) */
    max<TYPE extends ComparableValueSource>(value: TYPE): TYPE
    /** min(value) */
    min<TYPE extends ComparableValueSource>(value: TYPE): TYPE
    /** sum(value) */
    sum(value: NumberValueSource): NumberValueSource
    sum(value: StringNumberValueSource): StringNumberValueSource
    /** sum(distinct value) */
    sumDistinct(value: NumberValueSource): NumberValueSource
    sumDistinct(value: StringNumberValueSource): StringNumberValueSource
    /** avg(value) */
    average(value: NumberValueSource): NumberValueSource
    average(value: StringNumberValueSource): StringNumberValueSource
    /** avg(disctinct value) */
    averageDistinct(value: NumberValueSource): NumberValueSource
    averageDistinct(value: StringNumberValueSource): StringNumberValueSource
    /** group_concat(value, separator) sometimes called string_agg or listagg. The default separator is ',' */
    stringConcat(value: StringValueSource, separator?: string): StringValueSource
    /** group_concat(distinct value, separator) sometimes called string_agg or listagg. The default separator is ',' */
    stringConcatDistinct(value: StringValueSource, separator?: string): StringValueSource

    // Methods that allows create sql fragments
    fragmentWithType(type: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'stringInt', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'stringDouble', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType(type: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): FragmentExpression
    
    // Protected methods that allows call a stored procedure
    executeProcedure(procedureName: string, params: ValueSource[]): Promise<void>

    // Protected methods that allows call a function
    executeFunction(functionName: string, params: ValueSource[], returnType: 'boolean', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<boolean>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'stringInt', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'int', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'stringDouble', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'double', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<number>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'string', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<string>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'localDate', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'localTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction(functionName: string, params: ValueSource[], returnType: 'localDateTime', required: 'required' | 'optional', adapter?: TypeAdapter): Promise<Date>
    executeFunction<T>(functionName: string, params: ValueSource[], returnType: 'enum', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>
    executeFunction<T>(functionName: string, params: ValueSource[], returnType: 'custom', typeName: string, required: 'required' | 'optional', adapter?: TypeAdapter): Promise<T>

    // Protected methods to define a sequence (only available in oracle, postgreSql and sqlServer)
    sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource>
    sequence(name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringNumberValueSource>
    sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringNumberValueSource>
    sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource>
    sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource>
    sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<DateValueSource>
    sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<TimeValueSource>
    sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<DateTimeValueSource>
    sequence<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource>
    sequence<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource>

    /** Protected method that allows to transform the values received from the database */
    transformValueFromDB(value: any, type: string): any
    /** Protected method that allows to transform the values that will be send to the database */
    transformValueToDB(value: any, type: string): any
}

interface FragmentExpression {
    /** This is a template, you can call as: .sql`sql text with ${valueSourceParam}` */
    sql(sql: TemplateStringsArray, ...p: ValueSource[]): ValueSource
}

interface TypeAdapter {
    transformValueFromDB(value: any, type: string, next: DefaultTypeAdapter): any
    transformValueToDB(value: any, type: string, next: DefaultTypeAdapter): any
}

interface DefaultTypeAdapter {
    transformValueFromDB(value: any, type: string): any
    transformValueToDB(value: any, type: string): any
}

interface Sequence<T> {
    nextValue(): T
    currentValue(): T
}
```

### Table definition

```ts
interface Table {
    /** Allows to define an alias for the table to be used in the selects queries */
    as(as: string): this
    /** Allows  to use the table in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Allows  to use the table in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that allow to create a required column that doesn't admits null
    column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource

    // Protected methods that allow to create an optional column that admits null
    optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    
    // Protected methods that allow to create a required column that doesn't admits null but have a default value when insert
    columnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    columnWithDefaultValue(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    columnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    columnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    columnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    columnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    columnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    columnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    columnWithDefaultValue<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    columnWithDefaultValue<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    
    // Protected methods that allow to create an optional column that admits null and have a default value when insert
    optionalColumnWithDefaultValue(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumnWithDefaultValue(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumnWithDefaultValue(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    optionalColumnWithDefaultValue(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    optionalColumnWithDefaultValue<T>(name: string, type: 'enum', typeNme: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumnWithDefaultValue<T>(name: string, type: 'custom', typeNme: string, adapter?: TypeAdapter): EqualableValueSource
    
    // Protected methods that allow to create a primary key column autogenerated in the database
    // When you insert you don't need specify this column
    autogeneratedPrimaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKey(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    autogeneratedPrimaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    autogeneratedPrimaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    autogeneratedPrimaryKey<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    autogeneratedPrimaryKey<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource

    // Protected methods that allow to create a primary key column not automatically generated
    // When you insert you must specify this column
    primaryKey(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    primaryKey(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    primaryKey(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    primaryKey(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    primaryKey(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    primaryKey(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    primaryKey(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    primaryKey(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    primaryKey<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    primaryKey<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
      
    // Protected methods that allow to create a primary key column generated by a sequence
    // When you insert you don't need specify this column, it will be added automatically by ts-sql-query
    // This method is only supported by oracle, postgreSql and sqlServer
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    autogeneratedPrimaryKeyBySequence(name: string, sequenceName: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    autogeneratedPrimaryKeyBySequence<T>(name: string, sequenceName: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    autogeneratedPrimaryKeyBySequence<T>(name: string, sequenceName: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
}
```

### View definition

```ts
interface View {
    /** Allows to define an alias for the view to be used in the selects queries */
    as(as: string): this
    /** Allows  to use the view in a left join */
    forUseInLeftJoin(): this & OuterJoinSource
    /** Allows  to use the view in a left join with an alias */
    forUseInLeftJoinAs(as: string): this & OuterJoinSource

    // Protected methods that allow to create a required column that doesn't admits null
    column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource

    // Protected methods that allow to create an optional column that admits null
    optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource
    optionalColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource
    optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource
    optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource
    optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource
    optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource
    optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource
    optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource
    optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource
}
```

### Insert definition

```ts
interface InsertExpression {
    /** Set the values for insert */
    set(columns: InsertSets): this
    /** Set a value only if the provided value is not null or undefined */
    setIfValue(columns: OptionalInsertSets): this
    /** Set a previous set value only */
    setIfSet(columns: InsertSets): this
    /** Set a previous set value only if the provided value is not null or undefined */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** Set a unset value (only if the value was not previously set) */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Set a unset value only if the provided value is not null or undefined 
     * (only if the value was not previously set) 
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this
    /** Unset the listed columns previous set */
    ignoreIfSet(...columns: string[]): this
    /** Allows to set the values dynamically */
    dynamicSet(): this

    /** Insert the default values in the table */
    defaultValues(): this

    /** Indicate that the query must return the last inserted id */
    returningLastInsertedId(): this

    /** Execute the insert, by default returns the number of inserted rows*/
    executeInsert(): Promise<RESULT>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}

/** Columns required by the insert */
type InsertSets = { [columnName: string]: any }
/** Columns required by the insert, but marked as optionals */
type OptionalInsertSets = { [columnName: string]: any }
```

## Update definition

```ts
interface UpdateExpression {
    /** Set the values for insert */
    set(columns: InsertSets): this
    /** Set a value only if the provided value is not null or undefined */
    setIfValue(columns: OptionalInsertSets): this
    /** Set a previous set value only */
    setIfSet(columns: InsertSets): this
    /** Set a previous set value only if the provided value is not null or undefined */
    setIfSetIfValue(columns: OptionalInsertSets): this
    /** Set a unset value (only if the value was not previously set) */
    setIfNotSet(columns: InsertSets): this
    /** 
     * Set a unset value only if the provided value is not null or undefined 
     * (only if the value was not previously set) 
     */
    setIfNotSetIfValue(columns: OptionalInsertSets): this
    /** Unset the listed columns previous set */
    ignoreIfSet(...columns: string[]): this
    /** Allows to set the values dynamically */
    dynamicSet(): this

    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this

    /** Allows to extends the where using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where using an or */
    or(condition: BooleanValueSource): this

    /**
     * Execute the update returning the number of updated rows
     * 
     * @param min Indicate the minimum of rows that must be updated, 
     *           if the minimum is not reached an exception will be thrown
     * @param max Indicate the maximum of rows that must be updated, 
     *           if the maximum is exceeded an exception will be thrown
     */
    executeUpdate(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}

/** Columns required by the update */
type UpdateSets = { [columnName: string]: any }
/** Columns required by the update, but marked as optional */
type OptionalUpdateSets = { [columnName: string]: any }
```

### Delete definition

```ts
interface DeleteExpression {
    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this

    /** Allows to extends the where using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where using an or */
    or(condition: BooleanValueSource): this

    /**
    * Execute the delete returning the number of deleted rows
    * 
    * @param min Indicate the minimum of rows that must be deleted, 
    *           if the minimum is not reached an exception will be thrown
    * @param max Indicate the maximum of rows that must be deleted, 
    *           if the maximum is exceeded an exception will be thrown
    */
    executeDelete(min?: number, max?: number): Promise<number>
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}
```

### Select definition

The select query definition must follow the logical order or the alternative order:
- **Logical order**: from, join, where, group by, having, select, limit, offset
- **Alternative order**: from, join, select, where, group by, having, limit, offset

```ts
interface SelectExpression {
    /** Allows to add a from to the select query */
    from(table: Table | View): this

    /** Allows to add a join to the select query */
    join(table: Table | View): this
    /** Allows to add a inner join to the select query */
    innerJoin(table: Table | View): this
    /** 
     * Allows to add a left join to the select query. 
     * Note: to use a table or view here you must call first forUseInLeftJoin methods on it
     */
    leftJoin(source: OuterJoinSource): this
    /** 
     * Allows to add a left outer join to the select query. 
     * Note: to use a table or view here you must call first forUseInLeftJoin methods on it
     */
    leftOuterJoin(source: OuterJoinSource): this

    /** Allows to create the on clause of a join dynamically */
    dynamicOn(): this
    /** Allows to specify the on clause of a join */
    on(condition: BooleanValueSource): this

    /** Allows to create the where dynamically */
    dynamicWhere(): this
    /** Allows to specify the where */
    where(condition: BooleanValueSource): this
    
    /** Allows to specify the group by of the select query */
    groupBy(...columns: ValueSource[]): this
    /** 
     * Allows to specify the group by of the select query.
     * 
     * If you already defined the select clause, you can use the name of
     * the properties returned by the select instead of its definition, it
     * will be replace by the definition automatically.
     * 
     * Note: this overload is only available if you define the select clause first.
     */
    groupBy(...columns: string[]): this
    /** Allows to create the having clause of the group by dynamically */
    dynamicHaving(): this
    /** Allows to specify the having clause of the group by */
    having(condition: BooleanValueSource): this

    /** 
     * Allows to specify the select clause.
     * It must be an object where the name of the property is the name of the resulting property
     * and the value is the ValueSource where the value will be obtained.
     */
    select(columns: SelectValues): this
    /** 
     * Allows to specify the select clause of a query that returns only one column.
     * It receives as argument the ValueSource where the value will be obtained.
     */
    selectOneColumn(column: ValueSource): this

    /** 
     * Allows to specify an order by used by the query, you must indicate the name of the column
     * returned by the query.
     * If you select one column the name of the column is 'result'.
     */
    orderBy(column: string, mode?: OrderByMode): this
    /** Allows to specify an order by dynamically, it is parsed from the provided string */
    orderByFromString(orderBy: string): this

    /** Allows to specify the maximum number of rows that will be returned by the query */
    limit(limit: number): this
     /** Allows to specify the number of first rows ignored by the query */
    offset(offset: number): this


    /** Allows to extends the where, or the on clause of a join, or the having clause using an and */
    and(condition: BooleanValueSource): this
    /** Allows to extends the where, or the on clause of a join, or the having clause using an or */
    or(condition: BooleanValueSource): this

    /** Execute the select query that returns one o no result from the database */
    executeSelectNoneOrOne(): Promise<RESULT | null>
    /** 
     * Execute the select query that returns one result from the database.
     * If no result is returned by the database an exception will be thrown.
     */
    executeSelectOne(): Promise<RESULT>
    /** Execute the select query that returns zero or many results from the database */
    executeSelectMany(): Promise<RESULT[]>
    /** 
     * Execute the select query that returns zero or many results from the database.
     * Select page execute the query twice, the first one to get the data from the database 
     * and the second one to get the count of all data without the limit and the offset. 
     * Note: select page is only available if you don't define a group by clause.
     */
    executeSelectPage(): Promise<{ data: RESULT[], count: number }>
    /** 
     * Execute the select query as a select page, but allows to include extra properties to will be resulting object.
     * If the object provided by argument includes the property count, the query that count the data will be omitted and
     * this value will be used. If the object provided by argument includes the property data, the query that extract 
     * the data will be omitted and this value will be used.
     */
    executeSelectPage<EXTRAS extends {}>(extras: EXTRAS): Promise<{ data: RESULT[], count: number } & EXTRAS>
    
    /** Returns the sql query to be executed in the database */
    query(): string
    /** Returns the required parameters by the sql query */
    params(): any[]
}
```

## Supported databases

The way to define what database to use is when you define the connection and extends the proper database connection. You need to choose the proper database in order to generate the queries in the sql dialect handled by that database.

### MariaDB

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConection extends MariaDBConnection<DBConection, 'DBConnection'> { }
```

### MySql

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConection extends MySqlConnection<DBConection, 'DBConnection'> { }
```

### Oracle

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConection extends OracleConnection<DBConection, 'DBConnection'> { }
```

### PostgreSql

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<DBConection, 'DBConnection'> { }
```

### Sqlite

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConection extends SqliteConnection<DBConection, 'DBConnection'> { }
```

### SqlServer

**Note**: Empty string will be treated as null value, if you need a different behaviour let me know.

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConection extends SqlServerConnection<DBConection, 'DBConnection'> { }
```

## Supported databases with extended ts types

If you uses this variant, the types defined in [ts-extended-types](https://www.npmjs.com/package/ts-extended-types). It types allows to make your application even more type-safe and represents better the data handled by the database.

### MariaDB

```ts
import { TypeSafeMariaDBConnection } from "ts-sql-query/connections/TypeSafeMariaDBConnection";

class DBConection extends TypeSafeMariaDBConnection<DBConection, 'DBConnection'> { }
```

### MySql

```ts
import { TypeSafeMySqlConnection } from "ts-sql-query/connections/TypeSafeMySqlConnection";

class DBConection extends TypeSafeMySqlConnection<DBConection, 'DBConnection'> { }
```

### Oracle

```ts
import { TypeSafeOracleConnection } from "ts-sql-query/connections/TypeSafeOracleConnection";

class DBConection extends TypeSafeOracleConnection<DBConection, 'DBConnection'> { }
```

### PostgreSql

```ts
import { TypeSafePostgreSqlConnection } from "ts-sql-query/connections/TypeSafePostgreSqlConnection";

class DBConection extends TypeSafePostgreSqlConnection<DBConection, 'DBConnection'> { }
```

### Sqlite

```ts
import { TypeSafeSqliteConnection } from "ts-sql-query/connections/TypeSafeSqliteConnection";

class DBConection extends TypeSafeSqliteConnection<DBConection, 'DBConnection'> { }
```

### SqlServer

**Note**: Empty string will be treated as null value, if you need a different behaviour let me know.

```ts
import { TypeSafeSqlServerConnection } from "ts-sql-query/connections/TypeSafeSqlServerConnection";

class DBConection extends TypeSafeSqlServerConnection<DBConection, 'DBConnection'> { }
```

## Query runners

### any-db

It allows to execute the queries using an [any-db](https://www.npmjs.com/package/any-db) connection. To use this query runner you need to install as well [any-db-transaction](https://www.npmjs.com/package/any-db-transaction).

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer

It internally uses:
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer
- [mysql](https://www.npmjs.com/package/mysql) for connections to MariaDB and MySql
- [pg](https://www.npmjs.com/package/pg) for connections to PostgreSql
- [sqlite3](https://www.npmjs.com/package/sqlite3) for connections to SqlLite

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
const anyDB = require('any-db');
import { AnyDBQueryRunner } from "ts-sql-query/queryRunners/AnyDBQueryRunner";

const pool = anyDB.createPool('postgres://user:pass@localhost/dbname', {
  min: 5,
  max: 15,
  reset: function(conn, done) {
    conn.query('ROLLBACK', done)
  },
});

function main() {
    pool.acquire((error, anyDBConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new AnyDBQueryRunner(anyDBConnection));
            doYourLogic(connection).finally(() => {
                pool.release(anyDBConnection);
            });
        } catch(e) {
            pool.release(anyDBConnection);
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

### better-sqlite3

It allows to execute the queries using a [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) connection.

**Supported databases**: sqlite

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
const db = require('better-sqlite3')('foobar.db', options);

async function main() {
    const connection = new DBConection(new BetterSqlite3QueryRunner(db));
    // Do your queries here
}
```

### ConsoleLogNoopQueryRunner

A fake connections that write all the queries to the standard output using `console.log` and returns an empty result.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogNoopQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogNoopQueryRunner";

async function main() {
    const connection = new DBConection(new ConsoleLogNoopQueryRunner());
    // Do your queries here
}
```

### ConsoleLogQueryRunner

A query runner that write all the queries to the standard output using `console.log` and delegate the execution of the queries to the query runner received as argument in the constructor.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { ConsoleLogQueryRunner } from "ts-sql-query/queryRunners/ConsoleLogQueryRunner";

async function main() {
    const connection = new DBConection(new ConsoleLogQueryRunner(otherQueryRunner));
    // Do your queries here
}
```

### mariadb

It allows to execute the queries using a [mariadb](https://www.npmjs.com/package/mariadb) connection.

**Supported databases**: mariaDB, mySql

```ts
const mariadb = require('mariadb');
import { MariaDBQueryRunner } from "ts-sql-query/queryRunners/MariaDBQueryRunner";

const pool = mariadb.createPool({
    host: 'mydb.com', 
    user: 'myUser', 
    password: 'myPwd',
    database: 'myDB',
    connectionLimit: 5
});

async function main() {
    const mariaDBConnection = await pool.getConnection();
    try {
        const connection = new DBConection(new MariaDBQueryRunner(mariaDBConnection));
        // Do your queries here
    } finally {
        mariaDBConnection.release();
    }
}
```

### MockQueryRunner

Mock connection that allows you inspect the queries and return the desired value as result of the query execution.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

async function main() {
    const connection = new DBConection(new MockQueryRunner(
        (type, query, params, index) => {
            // verify your queries here
        }
    ));

    // Do your queries here
}
```

The `MockQueryRunner` receives a function as argument to the constructor, this function returns the result of the query execution and receive as argument:
- **`type: QueryType`**: type of the query to be executed. The `QueryType` is defined as:

    ```ts
    type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' | 
    'insert' | 'insertReturningLastInsertedId' | 'update' | 'delete' | 
    'executeProcedure' | 'executeFunction' | 
    'beginTransaction' | 'commit' | 'rollback'
    ```

- **`query: string`**: query required to be executed
- **`params: any[]`**: parameters received by the query
- **`index: number`**: this is a counter of queries executed by the connection; that means, when the first query is executed the value is 0, when the second query is executed the value is 1, etc.

### msnodesqlv8

It allows to execute the queries using an [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) connection.

**Supported databases**: sqlServer (only on Windows)

```ts
const sql = require("msnodesqlv8");
import { MsNodeSqlV8QueryRunner } from "ts-sql-query/queryRunners/MsNodeSqlV8QueryRunner";

const connectionString = "server=.;Database=Master;Trusted_Connection=Yes;Driver={SQL Server Native Client 11.0}";

// Note: this code doesn't create a pool, maybe you want one

function main() {
    sql.open(connectionString, function (error, sqlServerConnection) {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new MsNodeSqlV8QueryRunner(sqlServerConnection));
            yourLogic(connection).finally(() => {
                sqlServerConnection.close((closeError) => {
                    throw closeError;
                });
            });
        } catch(e) {
            sqlServerConnection.close((closeError) => {
                throw closeError;
            });
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

### mssql

It allows to execute the queries using a [mssql](https://www.npmjs.com/package/mssql) connection.

**Supported databases**: sqlServer

It internally uses:
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer on any OS
- [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) for connections to SqlServer only on Windows

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
const sql = require('mssql');
import { MssqlQueryRunner } from "./queryRunners/MssqlQueryRunner";

const pool = new sql.ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const mssqlPool = await pool;
    const connection = new DBConection(new MssqlQueryRunner(mssqlPool));
    // Do your queries here
}
```

### mysql

It allows to execute the queries using a [mysql](https://www.npmjs.com/package/mysql) connection.

**Supported databases**: mariaDB, mySql

```ts
var mysql = require('mysql');
import { MySqlQueryRunner } from "ts-sql-query/queryRunners/MySqlQueryRunner";

const pool  = mysql.createPool({
  connectionLimit : 10,
  host            : 'example.org',
  user            : 'bob',
  password        : 'secret',
  database        : 'my_db'
});

function main() {
    pool.getConnection((error, mysqlConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new MySqlQueryRunner(mysqlConnection));
            doYourLogic(connection).finnaly(() => {
                mysqlConnection.release();
            });
        } catch(e) {
            mysqlConnection.release();
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

### mysql2

It allows to execute the queries using a [mysql2](https://www.npmjs.com/package/mysql2) connection.

**Supported databases**: mariaDB, mySql

```ts
const mysql = require('mysql2');
import { MySql2QueryRunner } from "ts-sql-query/queryRunners/MySql2QueryRunner";

const pool = mysql.createPool({
  host: 'localhost',
  user: 'user',
  password: 'secret',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function main() {
    pool.getConnection((error, mysql2Connection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new MySql2QueryRunner(mysql2Connection));
            doYourLogic(connection).finnaly(() => {
                mysql2Connection.release();
            });
        } catch(e) {
            mysql2Connection.release();
            throw e;
        }
    });
}

async doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

### NoopQueryRunner

A fake connections that returns an empty result.

**Supported databases**: mariaDB, mySql, oracle, postgreSql, sqlite, sqlServer

```ts
import { NoopQueryRunner } from "ts-sql-query/queryRunners/NoopQueryRunner";

async function main() {
    const connection = new DBConection(new NoopQueryRunner());
    // Do your queries here
}
```

### oracledb

It allows to execute the queries using an [oracledb](https://www.npmjs.com/package/oracledb) connection.

**Supported databases**: oracle

```ts
const oracledb = require('oracledb');
import { OracleDBQueryRunner } from "ts-sql-query/queryRunners/OracleDBQueryRunner";

async function init() {
    try {
        await oracledb.createPool({
            user: 'user',
            password: 'pwd',
            connectString: 'localhost/XEPDB1'
        });
        await main();
    } finally {
        await closePoolAndExit();
    }
}

async function closePoolAndExit() {
    try {
        await oracledb.getPool().close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit);

init();

async function main() {
    const oracleConnection = await oracledb.getConnection();
    try {
        const connection = new DBConection(new OracleDBQueryRunner(oracleConnection));
        // Do your queries here
    } finally {
        await oracleConnection.close();
    }
}
```

### pg

It allows to execute the queries using a [pg](https://www.npmjs.com/package/pg) connection.

**Supported databases**: postgreSql

```ts
const { Pool } = require('pg');
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

const pool = new Pool({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const pgConnection = await pool.connect();
    try {
        const connection = new DBConection(new PgQueryRunner(pgConnection));
        // Do your queries here
    } finally {
        pgConnection.release();
    }
}
```

### sqlite3

It allows to execute the queries using an [sqlite3](https://www.npmjs.com/package/sqlite3) connection.

**Supported databases**: sqlite

```ts
import sqlite from 'sqlite';
import { SqliteQueryRunner } from "ts-sql-query/queryRunners/SqliteQueryRunner";

const dbPromise = sqlite.open('./database.sqlite', { Promise });

async function main() {
    const db = await dbPromise;
    const connection = new DBConection(new SqliteQueryRunner(db));
    // Do your queries here
}
```

### tedious

It allows to execute the queries using a [tedious](https://www.npmjs.com/package/tedious) connection and a [tedious-connection-pool](https://www.npmjs.com/package/tedious-connection-pool) pool.

**Supported databases**: sqlServer

```ts
const ConnectionPool = require('tedious-connection-pool');
import { TediousQueryRunner } from "ts-sql-query/queryRunners/TediousQueryRunner";

var poolConfig = {
    min: 2,
    max: 4,
    log: true
};

var connectionConfig = {
    userName: 'login',
    password: 'password',
    server: 'localhost'
};

var pool = new ConnectionPool(poolConfig, connectionConfig);

function main() {
    pool.acquire((error, sqlServerConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new TediousQueryRunner(sqlServerConnection));
            doYourLogic(connection).finnaly(() => {
                sqlServerConnection.release();
            });
        } catch(e) {
            sqlServerConnection.release();
            throw e;
        }
    });
}

async doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

## License

MIT

<!--
Edited with: https://stackedit.io/app
-->
