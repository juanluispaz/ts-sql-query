# Dynamic queries

## Introduction

ts-sql-query offers many commodity methods with name ended with `IfValue` to build dynamic queries; these methods allow to be ignored when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour). When these methods are used in operations that return booleans value, ts-sql-query is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

When you realize an insert or update, you can:

- set a column value conditionally using the method `setIfValue`
- replace a previously set value during the construction of the query using  the method `setIfSet` or the method `setIfSetIfValue`
- set a value if it was not previously set during the construction of the query using the method `setIfNotSet` or the method `setIfNotSetIfValue`
- ignore a previously set value using the method `ignoreIfSet`
- don't worry if you end with an update or delete with no where, you will get an error instead of update or delete all rows. You can allow explicitly having an update or delete with no where if you create it using the method `updateAllowingNoWhere` or `deleteAllowingNoWhereFrom` respectively

When you realize a select, you can:

- specify in your order by clause that the order must be case insensitive when the column type is string (ignored otherwise). To do it, add `insensitive` at the end of the ordering criteria/mode
- add a dynamic `order by` provided by the user without risk of SQL injection and without exposing the internal structure of the database. To build a dynamic `order by` use the method `orderByFromString` with the usual order by syntax (and with the possibility to use the insensitive extension), but using as column's name the name of the property in the resulting object

Additionally, you can:

- create a dynamic boolean expression that you can use in a where (by example), calling the `dynamicBooleanExpresionUsing` method in the connection object.
- create a custom boolean condition from criteria object that you can use in a where (by example), calling the `dynamicConditionFor` method in the connection object. This functionality is useful when creating a complex search & filtering functionality in the user interface, where the user can apply a different combination of constraints.
- create a query where it is possible to pick the columns to be returned by the query.
- define an optional join in a select query. That join only must be included in the final query if the table involved in the join is used in the final query. For example, a column of the joined table was picked or used in a dynamic where.

## Easy dynamic queries

The methods ended with `IfValue` allows you to create dynamic queries in the easyest way; these methods works in the way when the values specified by argument are `null` or `undefined` or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour) return a special neutral boolean that is ignored when it is used in `and`s, `or`s, `on`s or `where`s.

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

const searchedCustomers = connection.selectFrom(tCustomer)
    .where(
                tCustomer.firstName.containsIfValue(firstNameContains)
            .or(tCustomer.lastName.containsIfValue(lastNameContains))
        ).and(
            tCustomer.birthday.equalsIfValue(birthdayIs)
        )
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name || $1 || last_name as name, birthday as birthday 
from customer 
where first_name like ('%' || $2 || '%') 
order by lower(name), birthday asc nulls last
```

The parameters are: `[ ' ', 'ohn' ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```

## Complex dynamic boolean expressions

When the methods ended with `IfValue` are not enough to create dynamic complex boolean expressions, you can call the `dynamicBooleanExpresionUsing` method to create your complex boolean expressions. The `dynamicBooleanExpresionUsing` method is in the connection object. It allows you to create a dynamic expression with the initial value of the special neutral boolean. This method receives by argument the tables you expect to use while constructing the complex boolean expression.

The previous example can be written in the following way:

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

let searchedCustomersWhere = connection.dynamicBooleanExpressionUsing(tCustomer)
if (firstNameContains) {
    searchedCustomersWhere = searchedCustomersWhere.and(tCustomer.firstName.contains(firstNameContains))
}
if (lastNameContains) {
    searchedCustomersWhere = searchedCustomersWhere.or(tCustomer.lastName.contains(lastNameContains))
}
if (birthdayIs) {
    searchedCustomersWhere = searchedCustomersWhere.and(tCustomer.birthday.equals(birthdayIs))
}

const searchedCustomers = connection.selectFrom(tCustomer)
    .where(searchedCustomersWhere)
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name || $1 || last_name as name, birthday as birthday 
from customer 
where first_name like ('%' || $2 || '%') 
order by lower(name), birthday asc nulls last
```

The parameters are: `[ ' ', 'ohn' ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```