# The nodes of the value sources

This folder is the run time of the value sources: how each one is written in SQL and what it reaches in the tree of
the query. A value source has two axes apart:

- **Its data type** is its class, in [`src/typeSystem/`](../typeSystem/README.md): `column('price', MoneyType)` is a
  `MoneyType`, `int.add(0.5)` a `DoubleType`. The class has the methods (`equals`, `concat`, `add`, ...), and it is
  where a new data type goes.
- **Its node** is how it was made: a constant, a column, a function of another value source, a fragment of SQL, an
  aggregate, a select used as a value, ... It says how the value source is written (`__toSql`) and what it reaches
  (the tables, the `with`s, the aggregates, ...). It is what this folder has.

The two axes don't depend on each other: `price.add(1)` and `quantity.add(1)` have the same node with different data
types, and `price` and `price.abs()` the same data type with different nodes. Read the README of the type system
first; this one says how the nodes are made and why.

Nothing outside [`src/typeSystem/valueSourceFactory.ts`](../typeSystem/valueSourceFactory.ts), the classes of the data
types and [`src/internal/columnsFrom.ts`](../internal/columnsFrom.ts) (the columns of a `with` or of a compound select)
imports this folder: the factory creates the value sources and recognises their nodes for the rest of the library (the
SQL builders, the query builders, the connections).

## A node is a strategy

```ts
interface NodeStrategy<VS extends NodeValueSource> {
    __toSql(vs: VS, sqlBuilder, context, forceTypeCast): string
    __addWiths(vs: VS, sqlBuilder, withs): void
    ...
}
```

A node is a `NodeStrategy` ([`NodeStrategy.ts`](./NodeStrategy.ts)): **one object for each kind of node, shared by
every value source of that kind and without state.** Each of its methods receives the value source, which has the
fields of its node (`__operation`, `__valueSource`, `__value`, ...) and its node in `__node`. A value source asks its
node for everything: `vs.__toSql(sqlBuilder, context)` is `vs.__node.__toSql(vs, sqlBuilder, context)`.

So the data type and the node can be combined freely without a class for each pair: the class of the value source is
the one of its data type, and its node is a field. A strategy is created once, when its module is loaded (a constant of
its own module, as the rule of the modules without side effects allows), and costs nothing per value source.

Each kind of node has three things, side by side in its file:

| What | Example | What it is |
|---|---|---|
| Its interface | `SqlOperation0ValueSource` | the fields of the node, on a `NodeValueSource` |
| Its strategy | `sqlOperation0ValueSourceNode` | how it is written and what it reaches |
| Its creation | `__newSqlOperation0ValueSource(operation, valueSource, typeClass, optionalType)` | creates the value source with `new` of `typeClass`, the class of the result with its type adapter (see below), sets its node and its fields |

A creation receives **the class of the data type** of the value source it creates, never a name: the method of the
class that calls it decides it (its own class, the boolean of a comparison, the int of `length`, ...), and
[`dataTypeClassOf.ts`](./dataTypeClassOf.ts) has the two questions it asks to another value source:
`__typeClassOf` (the class of a value computed from it, which its data type can change with `static [computedType]`:
the text of a uuid gives a text) and `__sameTypeClassOf` (the class itself, for a value source that keeps its SQL, like
`allowWhen` or `asOptional`).

## What a node does

| Method | What it answers |
|---|---|
| `__toSql`, `__toSqlForCondition` | the SQL of the value source, as a value and where a condition goes |
| `__addWiths` | the `with`s the query needs because of it |
| `__registerTableOrView`, `__registerRequiredColumn` | the tables and the columns it uses: an optional join is written only when something uses it |
| `__getOldValues`, `__getValuesForInsert` | the old values of an update or the values of an insert it refers to |
| `__isAllowed` | whether the query is allowed (`allowWhen` / `disallowWhen` anywhere inside it) |
| `__hasAggregation` | whether it has an aggregate (the group by, the having, an aggregate inside an aggregate) |
| `isConstValue`, `getConstValue` | whether it is a constant, and which |

`valueSourceNode` is what a node does when it doesn't say otherwise: it reaches nothing, it is written for a condition
as for a value, it is not a constant. A node spreads it and writes what it changes:

```ts
export const sqlOperation0ValueSourceNode: NodeStrategy<SqlOperation0ValueSource> = {
    ...valueSourceNode,
    __toSql(vs, sqlBuilder, context) { return sqlBuilder[vs.__operation](context, vs.__valueSource) },
    __addWiths(vs, sqlBuilder, withs) { vs.__valueSource.__addWiths(sqlBuilder, withs) },
    ...
}
```

A few methods of a value source depend on its node and not only on its data type. The node says it in an optional
**hook**, which the method asks first:

| Hook | Who has it | Method that asks it |
|---|---|---|
| `valueWhenNoValue` | the neutral condition | `valueWhenNoValue` |
| `asRequiredInOptionalObject` | a column (it stays a column), an aggregate as array | `asRequiredInOptionalObject` |
| `withOptionalType`, `asNull`, `allowWhen`, `projectingOptionalValuesAsNullable` | the aggregates as array | `useEmptyArrayForNoValue`, `asOptionalNonEmptyArray`, `onlyWhenOrNull`, `ignoreWhenAsNull`, `allowWhen`, `disallowWhen`, `projectingOptionalValuesAsNullable` |

## The root: `ValueSourceRoot`

[`valueSourceRoot.ts`](./valueSourceRoot.ts) has the class every value source is an instance of at run time:

- its fields: `__type` (filled by its constructor from the static `type` of the class created, the name of its data
  type for the messages of the errors), its optionality, the fields of an aggregated array, and `__node`;
- its type adapter, `__typeAdapter`, read from its class: a value source with a type adapter is an instance of a
  subclass of the class of its data type that carries the adapter, created once for each class and adapter
  ([`adaptedTypeClass.ts`](./adaptedTypeClass.ts)). A creation receives only that class, already carrying its
  adapter: its caller builds it with `__adaptedTypeClassOf(<class of the data type>, <adapter>)`; `__typeClassOf` and
  `__sameTypeClassOf` give the class without the adapter. The subclass only carries the adapter: the conversions of a
  value (the type adapter, then the statics of the class of its data type, `transformValueToDB`, ..., in `BaseType`,
  then the type adapter of a requested type, then the connection) are the chain of `NextTypeAdapter`
  (`src/internal/TypeAdapterContextImpl.ts`), where the SQL builder and the query builders start them;
- the delegation of each method of the node to `__node`;
- `isConstValue`, `getConstValue`, `allowWhen` and `disallowWhen`, which every value source has;
- the functions of the methods two families of data types declare (`__asRequiredInOptionalObjectOf`,
  `__onlyWhenOrNullOf`, `__ignoreWhenAsNullOf`), which the classes call.

`BaseType`, the root of the classes of the data types, extends `ValueSourceRoot` through a cast TypeScript doesn't see
(`ValueSourceRoot as unknown as abstract new () => object`): every value source has these fields and methods at run
time, and the public types and the `.d.ts` have only what the classes declare.

## How a method of a data type creates its result

A method of a class doesn't see the fields of the run time, so it passes `this` to the functions of the nodes, which
take it as a **`DataTypeValueSource`** ([`NodeStrategy.ts`](./NodeStrategy.ts)): the value source as a method of a data
type class passes it. It requires only the NType (`[typeName]`), the member `BaseType` declares for TypeScript, so
`this` of any class of a data type fits and a plain object doesn't; the function casts it once to `NodeValueSource`
where it reads a field. The class says the operation, its operands and the class of the result, with its type adapter,
and its optionality:

```ts
add(value: any): any {
    return __operation1(this, '_add', value, __computedClassOf(this, __typeClassOf(this)))
}
```

**The type adapter of a result** is decided by the method, by what the operation gives
([`adaptedTypeClass.ts`](./adaptedTypeClass.ts)):

- a value of one of its operands (`valueWhenNull`, `nullIfValue`, `max`, `minValue`, `asOptional`, `allowWhen`, a
  `*WhenNoValue`, `collate`): the type adapter of the receiver as it has it, with its SQL data type (`__keptClassOf`);
  a fallback of another SQL data type keeps only its conversions;
- a number computed from the receiver, of its data type (`add`, `subtract`, `multiply`, `modulo`, `abs`, `round`,
  `roundn`, the `divide` of a customDouble, `sum`): the conversions of its type adapter, without its SQL data type
  (`__computedClassOf`): a value computed from a column is not a value of that column;
- anything else, none: a comparison, `length`, `sign`, the mathematical functions, an `as*`, `average`, `count`, and the
  operations of a text that give a new text (`concat`, `substr`, `replaceAll`, `trim`, ...): an adapter of a text says
  how the stored value is written, and a piece of it is not that value.

With two operands the receiver decides; the type adapter of the other one is never taken. A value given to an operation
is converted with the class of the result when the result is of the data type of the receiver, and with the one of the
receiver otherwise (a value compared with a column takes the column's); a number without a unit (the factor of
`multiply`, the divisor of `divide`, the decimals of `roundn`, the exponent of `power`) with the data type of the
receiver, without its type adapter.

- **The creations** (`__newSqlOperation1ValueSource`, `__newSqlOperation1ValueSourceIfValueOrNoop`, `__newSqlOperationInValueSource`,
  `__newNoopValueSource`, ...) take the value source they apply to as `DataTypeValueSource | NodeValueSource`: a class
  passes `this`, a node or the factory another value source.
- **The operands** ([`operands.ts`](./operands.ts): `getOptionalType2`, `getOptionalType3`, `getRequiredType2`,
  `getOptionalTypeOfIn`, `getOptionalTypeN`) take the receiver the same way.
- **The class of the result**: `__typeClassOf` and `__sameTypeClassOf` ([`dataTypeClassOf.ts`](./dataTypeClassOf.ts)) take a
  `DataTypeValueSource` or the private state of a value source (`__ValueSourcePrivate`); the class of a data type that
  extends the receiver's (the boolean of a condition, the int of `sign`) comes from the registry of the data types
  (`src/typeSystem/dataTypeRegistry.ts`).
- **An operation of the receiver with its own optionality and type adapter**: `__operation0(this, operation, typeClass)`,
  and `__operation1(this, operation, value, typeClass)` with those of the receiver and the value
  ([`operations.ts`](./operations.ts)).
- **The methods two families share**: `__asRequiredInOptionalObjectOf`, `__onlyWhenOrNullOf`, `__ignoreWhenAsNullOf`
  ([`valueSourceRoot.ts`](./valueSourceRoot.ts)), and `__priorOf` (`operations.ts`).

A method that passes a field of the receiver itself (its optionality or its type adapter where no function above takes
them, its node for a hook, its type to decide a promotion) still reads it with `const vs = this as unknown as
ValueSourceRoot`: `collate`, `isNull`, `isNotNull`, `asOptional`, `valueWhenNull`, `onlyWhen`, `ignoreWhen`,
`trueWhenNoValue`, `falseWhenNoValue`, `valueWhenNoValue`, `asInt` and `asBigint` of a number, and
`useEmptyArrayForNoValue`, `asOptionalNonEmptyArray` and `projectingOptionalValuesAsNullable` of an aggregated array;
and `promotedNumberOperation` of `src/typeSystem/number.ts`, whose int keeps only the type adapter of the receiver.

## The files

| File | What it has |
|---|---|
| [`NodeStrategy.ts`](./NodeStrategy.ts) | `NodeStrategy`, `NodeValueSource` (a value source as its node sees it), `DataTypeValueSource` (a value source as a method of its class passes it) and `valueSourceNode` |
| [`valueSourceRoot.ts`](./valueSourceRoot.ts) | `ValueSourceRoot`, and the functions of the methods two families share |
| [`dataTypeClassOf.ts`](./dataTypeClassOf.ts) | the class of the data type of a value source, and how a class creates one |
| [`adaptedTypeClass.ts`](./adaptedTypeClass.ts) | the subclass of the class of a data type that carries a type adapter, kept in the adapter, and the conversions of the values of a class |
| [`operands.ts`](./operands.ts) | the optionality and the type adapter of an operation from those of its operands |
| [`constants.ts`](./constants.ts) | a constant, the functions without operands (`currentDate`, `true`, `exists`, ...), a sequence, a null |
| [`operations.ts`](./operations.ts) | the functions and the operators of a value source with zero, one or two operands, `in`, `collate`, `isNull`, `valueWhenNull`, the no-op of `asOptional`, `__operation0` / `__operation1` (an operation of the receiver with the class of its result) |
| [`ifValue.ts`](./ifValue.ts) | the operations that disappear without a value (`*IfValue`), the neutral, and `valueWhenNoValue` / `trueWhenNoValue` / `falseWhenNoValue` |
| [`allowWhen.ts`](./allowWhen.ts) | a value source guarded by `allowWhen` / `disallowWhen` |
| [`fragments.ts`](./fragments.ts) | a fragment of SQL, a call to a function of the database, a virtual column made with a fragment |
| [`aggregateFunctions.ts`](./aggregateFunctions.ts) | the aggregate functions (`count`, `sum`, `max`, `stringConcat`, ...) |
| [`aggregatedArrays.ts`](./aggregatedArrays.ts) | the aggregates as array (a select used as an aggregated array, `aggregateAsArray`, ...), guarded or not, and the null that replaces them |
| [`inlineSelect.ts`](./inlineSelect.ts) | a select used as a value |
| [`column.ts`](./column.ts) | a column of a table, a view or values, and its marks (`__asPrimaryKey`, ...) |
| [`tableOrViewRawFragment.ts`](./tableOrViewRawFragment.ts) | the name or the alias of a table in a raw fragment: the only value source that is not an instance of a class of a data type, because it has none |

How a value source is written for each database is the SQL builder's (`sqlBuilder._abs(...)`, ...): a node says which
operation it is and passes its parts, and never writes the SQL of a database.

## Rules

- **A node never imports a class of a data type, nor `ValueSourceRoot`.** It types a value source as a
  `NodeValueSource` and creates it with the class it receives. `ValueSourceRoot` and the classes of the data types
  import the nodes, never the other way round, and the files of this folder don't import each other in a cycle.
- **A value source is created only through the factory or by the methods of the classes**, which give the class of
  its data type.
- **The code of a node runs on each query**: no closure, copy or temporary object per call, no cache of what is cheap
  (the rule of the hot path of `CLAUDE.md`). A strategy is made once; `ifValueNode` and `allowWhenAggregateNode`, which
  make one from another, run when their module is loaded.
- **Without a value, an operation reaches only what it writes**, and the neutral is written as an empty SQL: see
  "The operations that disappear without a value" in the README of the type system.

## Adding a kind of node

1. Its interface (the fields it needs, on a `NodeValueSource`), its strategy (`...valueSourceNode` and what it
   changes) and its creation, in the file of its group, or in a new file when it is a group of its own. A creation that
   a method of a class calls takes the value source it applies to as `DataTypeValueSource | NodeValueSource`, so the
   method passes `this`.
2. Its creation in `valueSourceFactory.ts` if something outside the classes creates it, and a question there
   (`__isX(value)`, comparing `value.__node`) if something else must recognise it.
3. Its method in the SQL builder (`SqlBuilder.ts` and `AbstractSqlBuilder.ts`) if it writes an operation of its own.
4. Its tests in the matrix: the SQL it writes, and what it reaches (an optional join used only by it, a `with` inside
   it, an aggregate inside it).
