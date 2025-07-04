---
search:
  boost: 0.7
---
# Extract columns from an object

These utility functions allow you to dynamically extract the structure of tables or views in a flexible and type-safe way. They are particularly helpful when building generic data manipulation logic, scaffolding operations, or ensuring consistency across large schemas.

## Extract columns

It is sometimes useful to extract all columns available in an object, like a table or view; this allows to use in a select, ensuring the select uses all columns defined in the provided object. For this purpose you can find the function `extractColumnsFrom` in the file `ts-sql-query/extras/utils`. This function receives the object that contains the columns as its first argument and optionally, as its second argument, an array with the name of the properties to exclude.

```ts
import { extractColumnsFrom } from "ts-sql-query/extras/utils";

const selectAll = connection.selectFrom(tCustomer)
    .select(extractColumnsFrom(tCustomer))
    .where(tCustomer.id.equals(9))
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId, 
        concat(first_name, ?, last_name) as name, 
        calculateAge(birthday) as age 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId, 
        concat(first_name, ?, last_name) as `name`, 
        calculateAge(birthday) as age 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday", 
        company_id as "companyId", 
        first_name || :0 || last_name as "name", 
        calculateAge(birthday) as "age" 
    from customer 
    where id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday, 
        company_id as "companyId", 
        first_name || $1 || last_name as name, 
        calculateAge(birthday) as age 
    from customer 
    where id = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId, 
        first_name || ? || last_name as name, 
        calculateAge(birthday) as age 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId, 
        first_name + @0 + last_name as name, 
        calculateAge(birthday) as age 
    from customer 
    where id = @1
    ```

The parameters are: `[ " ", 9 ]`

The result type is:
```tsx
const selectAll: Promise<{
    companyId: number;
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    birthday?: Date;
    age?: number;
}
```

Additionally, if you want to get an array with the column names, you can call the function `extractColumnNamesFrom` in the file `ts-sql-query/extras/utils`.

```ts
import { extractColumnNamesFrom } from "ts-sql-query/extras/utils";

const tCustomerColumnNames = extractColumnNamesFrom(tCustomer);
```

## Extract writable columns

It is sometimes useful to extract all columns available in an object, like a table or view, excluding those that cannot be used in INSERT or UPDATE statements. This function is analogous to `extractColumnsFrom` but ignoring computed and virtual columns. For this purpose you can find the function `extractWritableColumnsFrom` in the file `ts-sql-query/extras/utils`. This function receives the object that contains the columns as its first argument and optionally, as its second argument, an array with the name of the properties to exclude.

```ts
import { extractWritableColumnsFrom } from "ts-sql-query/extras/utils";

const selectAll = connection.selectFrom(tCustomer)
    .select(extractWritableColumnsFrom(tCustomer))
    .where(tCustomer.id.equals(9))
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday", 
        company_id as "companyId" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday, 
        company_id as "companyId" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId 
    from customer 
    where id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        company_id as companyId 
    from customer 
    where id = @0
    ```

The parameters are: `[ 9 ]`

The result type is:
```tsx
const selectAll: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    companyId: number;
    birthday?: Date;
}>
```

Additionally, if you want to get an array with the writable column names, you can call the function `extractWritableColumnNamesFrom` in the file `ts-sql-query/extras/utils`.

```ts
import { extractWritableColumnNamesFrom } from "ts-sql-query/extras/utils";

const tCustomerWritableColumnNames = extractWritableColumnNamesFrom(tCustomer);
```

## Extract writable shape

This function returns the insert or update shape where the property name in the value object and the remapped property are the same, like `{property: 'property'}`. This function receives the object that contains the columns as its first argument and optionally, as its second argument, an array with the name of the properties to exclude.

```ts
import { extractWritableShapeFrom } from "ts-sql-query/extras/utils";

const tCustomerWritableShape = extractWritableShapeFrom(tCustomer);
```

## Extract id columns

It is sometimes useful to extract all primary key columns available in an object, like a table or view. This function is analogous to `extractColumnsFrom` but only returning primary key columns. For this purpose you can find the function `extractIdColumnsFrom` in the file `ts-sql-query/extras/utils`. This function receives the object that contains the columns as its first argument and optionally, as its second argument, an array with the name of the properties to exclude.

```ts
import { extractIdColumnsFrom } from "ts-sql-query/extras/utils";

const idColumns = extractIdColumnsFrom(tCustomer);
```

Additionally, if you want to get an array with the writable column names, you can call the function `extractIdColumnNamesFrom` in the file `ts-sql-query/extras/utils`.

```ts
import { extractIdColumnNamesFrom } from "ts-sql-query/extras/utils";

const tCustomerIdColumnNames = extractIdColumnNamesFrom(tCustomer);
```

## Extract autogenerated id columns

It is sometimes useful to extract all primary key columns marked as autogenerated available in an object, like a table or view. This function is analogous to `extractColumnsFrom` but only returning autogenerated primary key columns. For this purpose you can find the function `extractAutogeneratedIdColumnsFrom` in the file `ts-sql-query/extras/utils`. This function receives the object that contains the columns as its first argument and optionally, as its second argument, an array with the name of the properties to exclude.

```ts
import { extractAutogeneratedIdColumnsFrom } from "ts-sql-query/extras/utils";

const autogeneratedIdColumns = extractAutogeneratedIdColumnsFrom(tCustomer);
```

Additionally, if you want to get an array with the writable column names, you can call the function `extractAutogeneratedIdColumnNamesFrom` in the file `ts-sql-query/extras/utils`.

```ts
import { extractAutogeneratedIdColumnNamesFrom } from "ts-sql-query/extras/utils";

const tCustomerAutogeneratedIdColumnNames = extractAutogeneratedIdColumnNamesFrom(tCustomer);
```

## Extract provided id columns

It is sometimes useful to extract all primary key columns not marked as autogenerated (the value must be provided) available in an object, like a table or view. This function is analogous to `extractColumnsFrom` but only returning non-autogenerated primary key columns. For this purpose you can find the function `extractProvidedIdColumnsFrom` in the file `ts-sql-query/extras/utils`. This function receives the object that contains the columns as its first argument and optionally, as its second argument, an array with the name of the properties to exclude.

```ts
import { extractProvidedIdColumnsFrom } from "ts-sql-query/extras/utils";

const providedIdColumns = extractProvidedIdColumnsFrom(tCustomer);
```

Additionally, if you want to get an array with the writable column names, you can call the function `extractProvidedIdColumnNamesFrom` in the file `ts-sql-query/extras/utils`.

```ts
import { extractProvidedIdColumnNamesFrom } from "ts-sql-query/extras/utils";

const tCustomerProvidedIdColumnNames = extractProvidedIdColumnNamesFrom(tCustomer);
```
