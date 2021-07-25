# Connection, tables & views

## Defining the connection object

When you define the connection object, you extend your database connection class; that class receives one generic argument with a unique name for the database in your system.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { }
```

## Allowing empty string

By default empty string as treated as null, if you want to allow to send and receive empty string to the database set the `allowEmptyString` property in the connection to true.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
    allowEmptyString = true
}
```

**Recommendation**: Set this flag at the beginning of the project or create a derivated connection if you require to do it. Changing this flag change the way of the SQL query are constructed when you use the methods that the name ends in 'IfValue'.

## Insensitive strategies

By default, when you specify that you want to perform an insensitive operation (like `startsWithInsensitive`) the operation is performed calling the function `lower` on the affected parts. But, another way to perform it is changing the collation of the text by one insensitive. If you set the insesitiveCollation in the connection, the provided collate will be used instead of calling the `lower` function.

Providing the collation allows you to perform more advanced insensitive operations like case insensitive and accent insensitive, or even more in some languages (like manage some letter composition alternatives). Some databases offer general collations that are case insensitive and accent insensitive. But it is expected you want to use a collated specific for the language used by the user.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
    insesitiveCollation = 'insensitive'
}
```

**Usefull collations per database**:

The following collations are case insensitive and accent insensitive:

- **PostgreSQL**: Starting from PostgreSQL 12 you can create custom non-deterministic collates from ICU database (previously it was OS dependant) with specific rules.
    - For a general collation case insensitive and accent insensitive, you create the collation using:

```sql
CREATE COLLATION insensitive (
    provider = 'icu',
    locale = 'und@colStrength=primary', -- or 'und-u-ks-level1'
    deterministic = false
)
```

- 
    - For a collation specific for one language (in this example: Spanish) case insensitive and accent insensitive, you create the collation using:

```sql
CREATE COLLATION es_insensitive (
    provider = 'icu',
    locale = 'es@colStrength=primary', -- or 'es-u-ks-level1'
    deterministic = false
)
```

- 
    - For more information, visit [this blog post](https://postgresql.verite.pro/blog/2019/10/14/nondeterministic-collations.html)
    - Execute `SELECT * FROM pg_collation` to list the already created collations
- **MySql**/**MariaDB**: 
    - `utf8_general_ci` for utf8 charset
    - `utf16_unicode_ci` for utf16 charset
    - `utf8_spanish_ci` for utf8 charset with spanish rules
    - Execute `SHOW COLLATION` to list the supported locations in your database; all locations ended with `_ci` are case insensitive and accent insensitive.
- **SqlServer**:
    - `Latin1_General_CI_AI` for a general case insensitive and accent insensitive for Latin alphabet-based languages
    - `Modern_Spanish_CI_AI` for a specific case insensitive and accent insensitive for the Spanish language only
    - Execute `SELECT * FROM sys.fn_helpcollations()` to list the supported locations in your database 
- **Oracle**:
    - `binary_ai` for a general case insensitive and accent insensitive for Latin alphabet-based languages
    - `spanish_m_ai` for a specific case insensitive and accent insensitive extended with the Spanish language rules
    - To see the collations list visit the [Oracle 11g](https://docs.oracle.com/cd/B28359_01/server.111/b28298/applocaledata.htm#i637232) or [Oracle 19](https://docs.oracle.com/en/database/oracle/oracle-database/19/nlspg/appendix-A-locale-data.html#GUID-CC85A33C-81FC-4E93-BAAB-1B3DB9036060) documentation webpage

**Note**: If you set the startsWithInsensitive property to an empty string (''), the function `lower` will not be called, neither a collated will be specified. It is useful when you already defined the insensitive collate rules at the database level.

## Instantiating the connection with the database connection

```ts
const { Pool } = require('pg');
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool();

async function main() {
    const connection = new DBConection(new PgPoolQueryRunner(pool));
    // Do your queries here
    /*
     * Maybe you want to perform the queries in a transaction:
     * await connection.transaction(async () => {
     *     // Do your queries here
     * })
     * 
     * You also can manage the transaction at low level:
     * await connection.beginTransaction();
     * await connection.commit();
     * await connection.rollback();
     */
}
```

**Important**: A ts-sql-query connection object and the queries runners objects received as constructor's arguments represent a dedicated connection; consequently, don't share connections between requests when you are handling HTTP requests; create one connection object per request with its own query runners. Even when the ts-sql-query connection object uses a query runner that receives a connection pool, the ts-sql-query connection sill represents a dedicated connection to the database extracted automatically from the pool and must not be shared.

## Instantiating the connection with a mock database connection

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

## Mapping the tables

In order to use the tables in queries, you need to map it in your system. To do it, you need to extend the table class that receives two generic arguments, the first one is the connection class, and the second one is a unique name for the table in your system.

```ts
import { Table } from "ts-sql-query/Table";

const tCompany = new class TCompany extends Table<DBConection, 'TCompany'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    name = this.column('name', 'string');
    parentId = this.optionalColumn('parent_id', 'int');
    constructor() {
        super('company'); // table name in the database
    }
}();

const tCustomer = new class TCustomer extends Table<DBConection, 'TCustomer'> {
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

**Important**: The constructor of a table must expect no arguments.

## Mapping the views

In order to use the views in queries, you need to map it in your system. To do it, you need to extend the view class that receives two generic arguments, the first one is the connection class, and the second one is a unique name for the view in your system.

```ts
import { View } from "ts-sql-query/View";

const vCustomerAndCompany = new class VCustomerAndCompany extends View<DBConection, 'VCustomerAndCompany'> {
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

**Important**: The constructor of a view must expect no arguments.

## Creating methods that allows to call a procedure

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
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

The result type is a promise:
```tsx
const result: Promise<void>
```

## Creating methods that allows to call a function

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConection extends PostgreSqlConnection<'DBConnection'> { 
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

The result type is a promise with the result returned by the function:
```tsx
const result: Promise<number>
```