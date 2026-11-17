# The type system of the value sources

This folder types the value sources of the library: what a column, a constant, a function or an expression is for
TypeScript, which methods it has, what each method gives, and which operands each position accepts. It also holds the
one module through which the rest of the library builds and recognises the value sources at run time.

Read this before changing anything here. The code is the reference; this file says why it is shaped the way it is.

## The types and the run time

- **The types** are the classes of this folder: TypeScript knows from them what a value source can do, and each class
  has the bodies of the methods it declares. They are `abstract` for TypeScript, and only two kinds of methods stay
  `abstract`: those of `ValueSourceBaseType` (`isConstValue`, `allowWhen`, ...), which `ValueSourceRoot` has, and those
  of the conditions (`IfType`, `AlwaysIfType`), which are never created: a condition is a `BooleanType` at run time
  (a `BooleanConditionType`), which has them.
- **A value source is an instance of the class of its data type**: `column('price', MoneyType)` is a `MoneyType`,
  `int.add(0.5)` a `DoubleType`, a comparison a `BooleanType` (a condition too). The library creates it with
  `new typeClass(...)` (the `abstract` is only for TypeScript). The run time knows a data type by its class: what a value is, by the SQL data type of the class (below), and how the connection converts it, by the family
  the class extends (`instanceof`, in [`dataTypeQuestions.ts`](./dataTypeQuestions.ts), which only the connections ask).
  **Nothing at run time reads the NType** below: it exists only for TypeScript.
- **The conversions of the values of a data type** are statics of its class, with the names and parameters of a type
  adapter (`transformValueFromDB`, `transformValueToDB`, `transformPlaceholder`, `transformProjection`), in `BaseType`:
  by default they call `next`, and a class overrides the ones it needs. They are a step of the chain of a conversion,
  after the type adapter of the value and before the connection (`NextTypeAdapter`, in
  `src/internal/TypeAdapterContextImpl.ts`). Its static `sqlDataType` is the type in the database of its values when
  the column doesn't say a more precise one: the SQL builders, the query runners and the connections decide by it
  what the value is, never by knowing the class (`__sqlFamilyOf`, `__temporalFieldsOf`, `__isExactDecimalSql`, ... of
  [`dataTypes.ts`](./dataTypes.ts)); how a database that emulates a type keeps it is the strategy of the connection.
- **What every value source has at run time** (its fields, its node, `isConstValue`, `allowWhen`, ...) is
  `ValueSourceRoot`, in [`src/nodes/`](../nodes/README.md). `BaseType` extends it through a cast that TypeScript doesn't
  see (`ValueSourceRoot as unknown as abstract new () => object`), so the types and the `.d.ts` are only those of the
  classes. A method doesn't read those fields: it passes `this` to the functions of the nodes, which take it as its data
  type (`AnyType`) and read the fields with `__asNodeValueSource` (see the README of the nodes).
- A method gives a value source of the same data type with `this.constructor`. A base can't import at run time the
  data types that extend it (see below): it asks the registry of the data types for them when the method is called
  (`__internalDataType('condition')`, the boolean of a condition its comparisons give; `'int'` for `sign`; `'double'`
  for `valueWhenNull` of an int with a double). A class that extends a base, also one of the user, needs nothing more.
  A family that can import a data type imports it (`StringsType` the `IntType` of `length`).
- **The registry of the data types** ([`dataTypeRegistry.ts`](./dataTypeRegistry.ts)) has the class of each data type
  by its type name: the built-in ones and the ones the user registers with the public `registerDataType(MoneyType)`,
  which takes the class's own `static type` (a class without one, which has only the name of its class, is an error)
  and needs the name declared in the public interface `DataTypes` (`dataTypeNames.ts`) for TypeScript. A type name is
  registered once: the same class again does nothing, another class is an error, and a name nobody registered is
  `UNKNOWN_DATA_TYPE`. Nothing registers on its own: two classes with the same type name are only a problem for the
  user who registers them. `condition` (the boolean of a condition, only for the run time) is kept apart
  (`__internalDataType`), so it is no type name. The registry imports no class. It is filled by
  [`registerDataTypes.ts`](./registerDataTypes.ts), **the only module of the library with side effects**: it registers
  the data types of the library the same way as any other one, it is declared in `sideEffects` of `package.json`, and
  the modules a user always starts from import it (`AbstractConnection`, `Table`, `View` and `Values`). The user's own
  registration is a call in the user's code, not a side effect of the library.
- A data type can say, in `static [computedType]`, the class a value computed from it gets, when it is not its own:
  the text of a uuid (`UuidTextType`, [`uuidText.ts`](./uuidText.ts), only for the run time: TypeScript sees a
  `StringType`) is still the uuid in SQL, and the SQL builder converts it where it meets another text. A method gives
  a computed value the class `__typeClassOf` says (`concat`, `valueWhenNull` or `max` of the text of a uuid give a
  text), and a value source that keeps the SQL of another one (`allowWhen`, `asOptional`, a column of a `with`, a
  select used as a value) its very class (`__sameTypeClassOf`). The boolean of a condition is the other one
  (`BooleanConditionType`, in [`logical.ts`](./logical.ts)): a comparison, `and`, `or`, `negate`, `exists`, a fragment of
  a boolean and the neutral are conditions in SQL, which a database without a boolean value writes as they are where a
  condition goes and turns into a value elsewhere (`__isCondition`); it has the methods only the conditions have
  (`trueWhenNoValue`, ...), so no boolean value has them. A projected column (of a `with`, of a compound select, a
  select used as a value) has the data type the select projects: the text of a uuid is still the uuid, the boolean
  of a condition is a value (`__projectedTypeClassOf`).
- A value source has two axes apart: its data type (its class) and its **node**: how it is written and what it
  reaches in the tree (a constant, a function of a value source, a fragment, a column, an aggregate, ...). The nodes are
  in [`src/nodes/`](../nodes/README.md), which explains them; a method of a class creates its result with the function of
  a node, passing `this` and the class of the result, which says its type adapter (`__operation1(this, '_add', value,
  __computedClassOf(this, __typeClassOf(this)))`, `__operation0(this, '_length', IntType)`; see "The type adapter of a
  result" in the README of the nodes).
- Nothing outside [`valueSourceFactory.ts`](./valueSourceFactory.ts) and the classes creates them: the factory creates
  the value sources (`__create*`) and recognises them (`__is*`). Its `__create*` functions return `any`, because the
  runtime is not typed by the data type: the code that calls them declares what it creates. They receive the class of
  the data type: a method that takes a data type turns a name of a built-in one into its class once, with
  `__dataTypeClassFrom` of [`dataTypeClasses.ts`](./dataTypeClasses.ts), and a value source of the data type of another
  one takes its class (`__typeClassOf`). `dataTypeClasses.ts` also gives the class a value given to an operation is sent
  with (see "The class of a value given to an operation"). No class of a data type imports it.

## The operations that disappear without a value (`*IfValue`)

An `*IfValue` method gives an operation that disappears when its operand is not a value. Whether it is a value is
decided when the SQL is written, by `sqlBuilder._isValue`: `null`, `undefined`, an empty array, and `''` when the
connection doesn't allow empty strings (`allowEmptyString`, which only the connection knows), are not values. Without a
value the operation becomes one of two things:

| Without a value it is | Methods | SQL with a value / without |
|---|---|---|
| the **neutral**: no condition | `equalsIfValue`, `inIfValue`, `containsIfValue`, ... | `name = $1` / nothing |
| its **receiver**, without the operation | `concatIfValue`, `replaceAllIfValue`, ... | `name \|\| $1` / `name` |

The neutral is also a value source of its own (`noValueBoolean()`, `onlyWhen(false)`, the start of a dynamic boolean
expression): a boolean recognised by its node, never by its type.

Two rules hold them:

- **The neutral is written as an empty SQL** (`''`). Whoever composes conditions skips an empty side: `_and` and `_or`
  give the other side, a `where` or a `having` with nothing is not written. A new place that composes conditions must
  do the same.
- **Without a value, an operation reaches only what it writes**: the neutral reaches nothing (its receiver must not
  make a table of an optional join required, nor add a `with`), the receiver reaches what the receiver reaches.

One function of [`src/nodes/ifValue.ts`](../nodes/ifValue.ts), `ifValueNode`, makes the node of each of these operations from the node of the
operation it applies when there is a value (`sqlOperation1ValueSourceNode`, the `in`, the operation of two operands):
each method of the node asks for the value once, as `__toSql` does, and without one gives what the neutral or the
receiver gives. The value source keeps the fields of its operation (`__operation`, `__valueSource`, `__value`), so what
reads them (the flattening of a `concat`) sees the same thing with or without `IfValue`.

## The NType: the name of a data type for TypeScript

Every data type class declares its NType in `[typeName]`:

```
type:<type name>:<group>:
```

It always ends with `:`. The first segment is the type name; the second one exists only for the data types that work
together, their group:

| Data type | NType |
|---|---|
| `string`, `uuid`, `bigint`, `stringDecimal`, `localDate`, ... | `type:string:`, `type:uuid:`, ... |
| `int`, `double` (group `number`) | `type:int:number:`, `type:double:number:` |
| boolean, the `if` and `alwaysIf` conditions (group `logical`) | `type:boolean:logical:`, `type:if:logical:`, `type:alwaysIf:logical:` |
| a data type of the user `'Money'`, of any family | `type:Money:` |
| the aggregated arrays | `type:aggregatedArray:` |

A family that the user extends builds it from the type name in its generic (`` `type:${TYPE_NAME}:` ``): a class of the
user declares nothing of it, and a built-in data type of a family gets it the same way (`BigintType extends
IntegersType<bigint, 'bigint'>` is `type:bigint:`); only the data types of a group and `StringType` declare their own.
What a data type can do is said by its methods, not by its NType: two data types of the user with the same type name
are one for TypeScript, whatever their family, an error of the user.

## A value source is its data type plus where it is

```ts
type ValueSource<SOURCE, TYPE, OPTIONAL_TYPE> = TYPE & ValueSourceOfType<SOURCE, TYPE, OPTIONAL_TYPE>
```

- `TYPE` is the instance type of a data type class (`IntType`, `StringType`, `MoneyType`). It
  carries the methods, the type of the value (`[valueType]`), the NType (`[typeName]`) and the operand NType
  (`[operandTypeName]`).
- `ValueSourceOfType` adds what places the value in a query: its source (`[source]`, an `NSource`), its optionality
  (`[optionalType]`) and a back reference to its data type (`[valueSourceType]`). It extends `TypedValueSource` of
  [`valueSource.ts`](./valueSource.ts), the base every value source has whatever its data type.
- The readers `SourceOf<X>`, `OptionalityOf<X>`, `DataTypeOf<X>` and `ValueTypeOf<X>` of [`base.ts`](./base.ts) take those axes
  out of a value source. Each answers `any` for `any` (`0 extends (1 & X) ? any : ...`): a conditional type over `any`
  gives the union of its branches, so without that an argument of type `any` would give a source `string` and an
  optionality that is the union of all of them, and stop fitting anywhere.

A **condition** (`IfValueSource`, `AlwaysIfValueSource`, in [`logical.ts`](./logical.ts)) is its data type plus
`ConditionOfType`: it has a source and an optionality but **is not a value source** (no `isValueSourceObject` mark, which exists only in the types). It
can't be a column or be projected, and it has a value a boolean doesn't have, the neutral (no condition).

## The classes

```
BaseType<VALUE_TYPE>                         the NType, the operand NType, the type of the value, static type and sqlDataType, the conversions
├── ValueSourceBaseType<VALUE_TYPE>          isConstValue, getConstValue, allowWhen, disallowWhen, is   (valueSourceBase.ts)
│   ├── NullableType<VALUE_TYPE>             isNull, valueWhenNull, asOptional, onlyWhenOrNull, ...
│   │   └── EqualableType<V, NAME>           equals, is, in, inN, ... (and their *IfValue forms)     ← user: compared for equality
│   │       ├── BooleanType                  negate, and, or, onlyWhen, ...                          (logical.ts)
│   │       ├── EnumType<V, NAME>            the enumerations                                        ← user (enum.ts)
│   │       └── ComparableType<V, NAME>      lessThan, between, ...                                  ← user: with an order
│   │           ├── StringsType<V>           StringType (not extended by the user)
│   │           ├── UuidsType<V, NAME>       UuidType                                                ← user: sent and read as a uuid
│   │           ├── LocalDatesType / LocalTimesType / LocalDateTimesType<V, NAME> and their leaves   ← user: as a date, a time, both
│   │           └── ArithmeticType<V, NAME>  the numbers (numeric.ts)
│   │               ├── NumberType           the group number: IntType, DoubleType (number.ts)
│   │               └── AdditiveType<V, NAME>        abs, sign, minValue, maxValue, add, subtract, modulo   ← user: converts nothing
│   │                   └── MultipliableType<V, NAME>    multiply                                    ← user: converts nothing
│   │                       ├── IntegersType<V, NAME>    BigintType (bigint.ts)                      ← user: as an int
│   │                       ├── DecimalsType<V, NAME>    ceil, floor, round, roundn; what can't be exact gives a double: StringDecimalType (decimals.ts)  ← user: as its text
│   │                       └── DivisibleType<V, NAME>   divide                                      ← user: converts nothing
│   │                           └── RealsType<V, NAME>   ceil, floor, round, roundn, the floating point functions, of its data type  ← user: as a double
│   └── AggregatedArraysType<V>              useEmptyArrayForNoValue, ...: AggregatedArrayType, AggregatedArrayProjectableAsNullableType
└── ConditionType                            IfType, AlwaysIfType                                    (logical.ts)
```

A data type of the user extends the family of what its values can do, with its type name in the generic and, by
convention, in its static `type`: `class MoneyType extends AdditiveType<Money, 'Money'> { static override readonly type
= 'Money' }`. The family gives it its methods, its SQL data type (`IntegersType` an int of 4 bytes, `DecimalsType` an
exact number, `RealsType` a double, `UuidsType` and the dates theirs; the others none) and how the connection converts
its values (the family it extends, by `instanceof`, in `dataTypeQuestions.ts`; an integer is a `number` when the SQL
data type of its class fits in one, up to 6 bytes or 15 digits, and a `bigint` otherwise: what its values are says how
they are kept in JavaScript, so a class of the user says 8 bytes to have a `bigint`). Outside the group number, a data type
works only with itself: what it takes and what it gives is its data type (the exceptions: `sign` gives an int, an
exact decimal gives a double for what can't be exact, and the number of decimals of `roundn` is a number).

A method that applies to several data types is declared once, in the class they share. The methods are `this`
relative, so a method of a base gives back the data type of the value source it is called on:

```ts
abstract asOptional(): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
abstract equals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE):
    ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
```

**No file depends at run time on a file that depends on it; for the types it may.** A cycle of imports at run time
breaks depending on which module is loaded first: a class that extends one not yet evaluated throws a
`ReferenceError`. An `import type` is erased from the JavaScript, so a cycle of types only is safe, and the types name
the data types directly: the comparisons of `NullableType` and `EqualableType` give a `BooleanType` (an
`EqualableType`) with `import type { BooleanType } from './logical.js'`, `AdditiveType.sign()` gives an `IntType`, and
`CoalesceTypeOf` asks whether the data type is a `NumberType`. At run time a base never imports a data type that
extends it: it asks the registry for the classes it needs (above). That is why the numbers are in several files: the
bases ([`numeric.ts`](./numeric.ts)), the numbers of JavaScript ([`number.ts`](./number.ts): int and double, the group
number; [`bigint.ts`](./bigint.ts), which `asBigint` of a number gives), the exact decimals
([`decimals.ts`](./decimals.ts)), and the SQL data types of the numbers
([`numericSqlDataTypes.ts`](./numericSqlDataTypes.ts)), apart so the bases give them without importing the classes that
extend them.

**A family is named in plural, its data types in singular.** A class in plural is a family: the base that its data
types extend, which has their shared methods and no type of its own (`UuidsType` for `UuidType`; `LocalDatesType` for
`LocalDateType`; `DecimalsType` for `StringDecimalType` and, tomorrow, the `Decimal` of JavaScript once it is standard,
or the decimal of a library). A class in singular is a data type with a value: a built-in one (`UuidType`, `IntType`)
or one of the user. A file in plural has a family and the built-in data types of it (`uuids.ts`, `localDates.ts`,
`decimals.ts`); a file in singular has one data type, a group or the tiers (`enum.ts`; `bigint.ts`; `number.ts`, the
group number; `logical.ts`, the group logical: the boolean and the conditions; `numeric.ts`, `comparable.ts`, ...). A
new kind of values (the spatial ones, a decimal library) starts with its family in plural, so the data types of the
user and the ones that come later extend it.

Each method declares the data type **the runtime gives** for its result (read it in the body of the method before
declaring it): a getter of a date gives `IntType`, `asString()` of a uuid gives `StringType`, `length()` gives
`IntType`. A subclass can't change the type of a result its base declares (TS2416); when a family needs a different
result, the base declares it through a type that asks the data type, like `CoalesceTypeOf` below.

## The numbers

`int` and `double` are the numbers of JavaScript and work together, in the group `number`: an `int` position takes a
`double` and an operation of both gives a `double`. The rule is `PromotedNumberType<RECEIVER, OPERAND>` in
[`number.ts`](./number.ts): a `double` if any of them is a `double`, an `int` if both are, and `NumberType` (the data
type of both) when one of them can be either. A number given as a value (`intColumn.add(1)`) gives `NumberType`:
`1` and `0.5` are both `number` for TypeScript, and the runtime decides with the value (`Number.isInteger`).
`valueWhenNull` widens the same way: `NullableType` declares its result as `CoalesceTypeOf<this, OPERAND>` (`OPERAND` is
`'value'` for a JavaScript value), which promotes like `PromotedNumberType` for a number of the group and is the data
type of the value source for any other. `NumberType` is closed: a class may extend `IntType` or `DoubleType` to add
methods, and it is still an int or a double.

The other numbers (`bigint`, `stringDecimal`, the ones of the user) work only with themselves, and each level of the
classes adds what its numbers can do: an integer and an exact decimal have no `divide`, which wouldn't give an exact
value (see `test/DEFERRED.md`); only the numbers with decimals are rounded (`ceil`, `floor`, `round`, `roundn`); an
exact decimal gives a `double` for the computations that can't be exact. `sum` and `average` take any of them, by the
mark of `AdditiveType` (`IAnyAdditiveValueSource`).

## The gates: what a position accepts

An input position never takes a full value source: it takes a light interface with only what has to match.

| Gate | Accepts |
|---|---|
| `IValueWithType<OPERAND_NTYPE>` | a value source whose NType matches (the operand of `equals`, `add`, ...) |
| `IValueSource<SOURCE, TYPE, OPTIONAL_TYPE>` = `IValueSourceOfOperand<SOURCE, TYPE[operandTypeName], OPTIONAL_TYPE>` | a value source of the data type, with a source and an optionality |
| `INumberValue`, `IStringValue`, `IBooleanValue` | an int or double, a text, a boolean value |
| `ILogicalValue`, `ILogicalValueSource<S, O>` | a boolean or a condition (`and`, `or`) |
| `IConditionValueSource<S, O>` | a condition |
| `IAnyComparableValueSource<S>` | a value source of any data type with an order (`max`, `min`) |

- **The operand NType** (`[operandTypeName]`) is the NType itself, or the pattern of the group for a number
  (`` `type:${string}:number:` ``). It is what makes an `int` accept a `double` without any special rule.
- **The payload is not compared**: a gate matches the NType, not the type of the value. Two data types of the user with the
  same type name and different payloads are a user error; comparing the payload would cost the compiler on every
  operand.
- **`IValueSource` is generic in the operand NType, not in the data type.** TypeScript compares two instances of the
  same generic interface by the variance of its type arguments, not by their content: an interface generic in `TYPE`
  would see `IntType` and `NumberType` as different inputs even though both give the same operand NType, and the arms
  of a compound select (`union`, a recursive `with`) would stop matching.

## The data types by their classes

The methods that take a data type (`column`, `const`, `arg`, `fragmentWithType`, `executeFunction`, `sequence`, ...) have
one overload that takes a `TypeClass<TYPE>`, for any class with a type name of its own: a built-in one (`IntType`) or one
of the user. It gives `ValueSource<SOURCE, TYPE, OPTIONAL_TYPE>`. A class without a type name of its
own (a group such as `NumberType`, or a family such as `IntegersType`) is rejected when compiling: its NType has no
literal type name (`TypeNameOf`), and `TypeClass` then requires a `name` it can't have. `TypeClass` has no `is`:
TypeScript infers the data type from `prototype`, and a generic `is` there would make the inference fail.

The static `type` is the type name the run time knows a data type by (the messages of the errors, the registry of the
data types, the context of a query): a class of the user says it by convention, the one of its NType; when it
doesn't, `BaseType` gives the name of the class (a getter, which the subclass that carries a type adapter answers with
the class of its data type).

## The class of a value given to an operation

A value given to an operation is sent with the class of the data type of the operation, with its type adapter (a value
compared with a column takes the SQL data type of the column), unless the data type says another class for that value,
in two statics of its class (keyed by the symbols `valueOperandClass` and `arithmeticOperandClass`), which give
`undefined` when the value is of the data type:

| Position | Static | Who says another class |
|---|---|---|
| a value of the data type (`equals`, `in`, `between`, `valueWhenNull`, `nullIfValue`, ...) | `[valueOperandClass]` | `IntType`: a fraction (in a list or in the bounds of `between`, any of them) is a double |
| a number given to an arithmetic operation (`add`, `minValue`, `power`, the decimals of `roundn`, ...) | `[arithmeticOperandClass]` | `NumberType`: an integer is an int, a fraction a double; `DecimalsType`: a number of JavaScript is an int or a double |

The SQL builder asks them through `__valueOperandClassOf` and `__arithmeticOperandClassOf` of
[`dataTypeClasses.ts`](./dataTypeClasses.ts) and never decides a class itself; it writes the type of the parameter
(`forceTypeCast`, which only PostgreSQL acts on) when the data type of the operation is an integer and the value is sent
as a floating point number, a question of their SQL data types.

## The type guard: `is`

Each data type of a value source has a static `is(value)`, a type guard that takes a value source: whether it is of that
data type, keeping what is known of it (`NarrowedToType` of [`valueSourceBase.ts`](./valueSourceBase.ts)). Of a union
of value sources, it leaves the ones of the data type or of one that extends it, as they are; a value source of a data
type it extends (a `NumberType` asked with `IntType.is`) becomes one of the data type asked, with its source and its
optionality; `any` gives the value source of the data type of any source and optionality. A value that may not be a
value source is asked with `instanceof`, which gives only the class. It is declared once, in `ValueSourceBaseType`,
with a `this` parameter, so the class it is called on gives the guarded type. A class that extends another answers by
inheritance: `NumberType.is` says yes to an int and to a double, `IntegersType.is` to a bigint and to any integer of the
user, `MoneyType.is` only to its own.

At run time it is `instanceof` the class: a value source is an instance of the class of its data type (or of the
subclass that carries its type adapter). What only TypeScript tells apart, `is` can't: a condition is a boolean at run
time, so the condition classes have no `is` (they don't extend `ValueSourceBaseType`) and `BooleanType.is` says yes to
a condition, also to the neutral (no condition, recognised by its node).

## The data types by their names

[`dataTypeNames.ts`](./dataTypeNames.ts) has the public interface `DataTypes`, from each type name to its data type: the
built-in ones (`'int'`, `'string'`, ...) and the ones the user declares there with a module augmentation, after
registering their class. From it come the type of the value of a name (`DataTypeValueOfName`), its value source, what a
position that takes it accepts and its fragment expression. The methods that take a data type by its name (`column`,
`const`, `arg`, `fragmentWithType`, `executeFunction`, `sequence`, `setRequestedType`, a column of a dynamic condition,
...) have one generic overload over these maps, so a name the user declares works in all of them. A union of names
(`t: 'int' | 'string'`) compiles and gives a union of value sources, on purpose: at run time the value is one of
them, so a union in gives a union out (the maintainer's decision; nothing rejects it).

## The rest of the folder

- [`base.ts`](./base.ts) also has the types that give a value source another source (`RemapValueSourceType` and its
  forms, used for the columns of an alias, a `with`, a left join): the same data type with another `SOURCE`.
- [`arguments.ts`](./arguments.ts): `Argument`, the argument of a fragment built with arguments, typed by its data
  type class, and the helpers that type the fragment and its function (`MapArgumentToValueSource`, `ArgForFn`, ...).
- [`filterOperations.ts`](./filterOperations.ts): `filterOperation` and `exposeFilterOperations`, how a class of a data
  type says which of its methods a dynamic filter can call. Each family lists its own in its static `[filterOperation]`
  and declares it on the instance; `FilterOf` (in `src/expressions/dynamicConditionUsingFilters.ts`) reads the names
  from the instance and the value of each from the parameter of its method, and `DynamicConditionBuilder` asks the
  class at run time.
- [`fragments.ts`](./fragments.ts): `FragmentExpression<NO_SOURCE, TYPE, OPTIONAL_TYPE, EXTRA_SOURCE>`, the SQL of a
  fragment of any data type. The builders of fragments with arguments stay in `src/expressions/fragment.ts`.
- [`valueSource.ts`](./valueSource.ts): what every value source has whatever its data type: the optionality
  (`OptionalType`, `CombinedOptionality`, ...), `AnyValueSource`, `TypedValueSource`, the types of the value of a result
  (`ValueSourceValueType*`), and the executable queries.

## Checking a change

- `test/runners/general/DataTypeOperations.test.ts` asserts with the compiler, family by family, the operands accepted
  and rejected and the data type and optionality of the results. Add a case there for any rule you add or change: an
  `assertType<Exact<typeof result, ...>>()` on the result of a call (not `ReturnType` of an overloaded method, which
  measures only its last overload), and a `@ts-expect-error` for what must be rejected. `bun run validate:tests runners`
  checks it, and `bun run tests runners/general/DataTypeOperations.test.ts` runs it.
- Then the test matrix: `bun run validate:tests` (the test scope compiles against these types; start with one cell,
  `bun run validate:tests postgres/newest/pg`) and `bun run tests`. A change of the types moves no SQL snapshot: if one
  moves, the change touched the runtime.
- Measure the compiler: `validate:tests` took ~150 s and ~7.6 GB at its peak when the library moved to this type system,
  the same as before. Compare against that before and after a change that adds conditional types or overloads.
- No recursive types (the rule of `CLAUDE.md`): the types here walk nothing; keep it so.

## Adding a data type

1. Its class in the file of its family (a family in plural, see above), extending the family of what its values can
   do with its type name (`extends IntegersType<bigint, 'bigint'>`, which gives its NType), its `static type`, its
   `static sqlDataType` when it isn't the one of its family (the type in the database of its values, by which the query
   runners send and read them), and its own methods with the result types the runtime gives.
2. A built-in one: its entry in `DataTypes` of `dataTypeNames.ts`, and its registration in `registerDataTypes.ts`.
3. Its question in `dataTypeQuestions.ts`, if the connection converts it in its own way.
4. Its cases in the probe, and its tests in the matrix.
