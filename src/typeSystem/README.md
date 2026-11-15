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
  `new typeClass(...)` (the `abstract` is only for TypeScript), and its constructor fills `__type` and `__customType`
  from the statics `type` and `customType` of the class: the run time knows a data type by those two strings (for a
  custom data type, `__type` is its type name and `__customType` its family, e.g. `'Money'` / `'customInt'`). The
  questions about them (`__isInt`, `__isLocalDate`, `__isExactDecimal`, ...) are in [`dataTypes.ts`](./dataTypes.ts).
  **Nothing at run time reads the NType** below: it exists only for TypeScript.
- **What every value source has at run time** (its fields, its node, `isConstValue`, `allowWhen`, ...) is
  `ValueSourceRoot`, in [`src/nodes/`](../nodes/README.md). `BaseType` extends it through a cast that TypeScript doesn't
  see (`ValueSourceRoot as unknown as abstract new () => object`), so the types and the `.d.ts` are only those of the
  classes. A method doesn't read those fields: it passes `this` to the functions of the nodes, which take it as a
  `DataTypeValueSource` (see the README of the nodes).
- A method gives a value source of the same data type with `this.constructor`. A base doesn't import the data types
  that extend it (see below), so the data types it gives are statics of the classes that can import them, the
  reflection of their phantom members: the boolean and the condition of the comparisons in `static [logicalTypes]`
  (`ComparableType`, `BooleanType`, `EnumType`, `CustomEqualableType`, read by `__conditionTypeOf` of
  [`valueSourceBase.ts`](./valueSourceBase.ts)), the int of `sign` in `static [intType]`, and the int and the double of
  the group number in `static [numberTypes]` (`__doubleTypeOf`). A family that can import a data type imports it
  (`StringsType` the `IntType` of `length`).
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
  a node, passing `this` and the class of the result (`__newSqlOperation1ValueSource('_concat', this, value,
  __typeClassOf(this), getOptionalType2(this, value), getTypeAdapter2(this, value))`, `__operation0(this, '_length',
  IntType)`).
- Nothing outside [`valueSourceFactory.ts`](./valueSourceFactory.ts) and the classes creates them: the factory creates
  the value sources (`__create*`) and recognises them (`__is*`). Its `__create*` functions return `any`, because the
  runtime is not typed by the data type: the code that calls them declares what it creates. They receive the class of
  the data type: a method that takes a data type turns a name of a built-in one into its class once, with
  `__dataTypeClassFrom` of [`dataTypeClasses.ts`](./dataTypeClasses.ts), and a value source of the data type of another
  one takes its class (`__typeClassOf`). `dataTypeClasses.ts` also gives the class of a type and a custom type (the
  custom ones with the `of` of their family). No class of a data type imports it.

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
type:<type>:<custom type or group>:
```

It always ends with `:`. The second segment is empty for a built-in data type, holds the family for a custom one, and
holds the group for the data types that work together:

| Data type | NType |
|---|---|
| `string`, `uuid`, `bigint`, `stringDecimal`, `localDate`, ... | `type:string:`, `type:uuid:`, ... |
| `int`, `double` (group `number`) | `type:int:number:`, `type:double:number:` |
| boolean, the `if` and `alwaysIf` conditions (group `logical`) | `type:boolean:logical:`, `type:if:logical:`, `type:alwaysIf:logical:` |
| a custom data type `'Money'` of `customInt` | `type:Money:customInt:` |
| an enum `'Status'`, a custom `'Status'` | `type:Status:enum:`, `type:Status:custom:` (different data types) |
| the aggregated arrays | `type:aggregatedArray:` |

Two different data types with the same type name (an enum and a custom one, two families) are a user error, and
TypeScript rejects comparing them.

## A value source is its data type plus where it is

```ts
type ValueSource<SOURCE, TYPE, OPTIONAL_TYPE> = TYPE & ValueSourceOfType<SOURCE, TYPE, OPTIONAL_TYPE>
```

- `TYPE` is the instance type of a data type class (`IntType`, `StringType`, `CustomIntType<Money, 'Money'>`). It
  carries the methods, the type of the value (`[valueType]`), the NType (`[typeName]`) and the operand NType
  (`[operandTypeName]`).
- `ValueSourceOfType` adds what places the value in a query: its source (`[source]`, an `NSource`), its optionality
  (`[optionalType]`) and a back reference to its data type (`[valueSourceType]`). It extends `TypedValueSource` of
  [`valueSource.ts`](./valueSource.ts), the base every value source has whatever its data type.
- The readers `SourceOf<X>`, `OptionalOf<X>`, `TypeOf<X>` and `ValueTypeOf<X>` of [`base.ts`](./base.ts) take those axes
  out of a value source. Each answers `any` for `any` (`0 extends (1 & X) ? any : ...`): a conditional type over `any`
  gives the union of its branches, so without that an argument of type `any` would give a source `string` and an
  optionality that is the union of all of them, and stop fitting anywhere.

A **condition** (`IfValueSource`, `AlwaysIfValueSource`, in [`logical.ts`](./logical.ts)) is its data type plus
`ConditionOfType`: it has a source and an optionality but **is not a value source** (no `isValueSourceObject` brand). It
can't be a column or be projected, and it has a value a boolean doesn't have, the neutral (no condition).

## The classes

```
BaseType<VALUE_TYPE>                         the NType, the operand NType, the type of the value, static type/customType
├── ValueSourceBaseType<VALUE_TYPE>          isConstValue, getConstValue, allowWhen, disallowWhen, is   (valueSourceBase.ts)
│   ├── NullableType<VALUE_TYPE>             isNull, valueWhenNull, asOptional, onlyWhenOrNull, ...
│   │   └── EqualableType<VALUE_TYPE>        equals, is, in, inN, ... (and their *IfValue forms)
│   │       ├── BooleanType                  negate, and, or, onlyWhen, ...                          (logical.ts)
│   │       ├── EnumType<T, NAME> (enum.ts), CustomEqualableType<T, NAME> (customEqualable.ts)
│   │       └── ComparableType<VALUE_TYPE>   lessThan, between, ...
│   │           ├── NumberType               the group number: IntType, DoubleType                         (number.ts)
│   │           ├── NumericType<V>           the numbers that work only with themselves: abs, add, multiply, ... (numeric.ts)
│   │           │   ├── IntegersType<V>      BigintType (number.ts), CustomIntType, CustomBigintType (customNumber.ts)
│   │           │   ├── RealsType<V>         its floating point functions keep the data type: CustomDoubleType (customNumber.ts)
│   │           │   └── DecimalsType<V>      exact; what can't be exact gives a double: StringDecimalType (decimals.ts), CustomDecimalType (customDecimals.ts)
│   │           ├── StringsType<V>           StringType
│   │           ├── UuidsType<V>             UuidType, CustomUuidType
│   │           ├── LocalDatesType / LocalTimesType / LocalDateTimesType and their leaves and custom ones
│   │           └── CustomComparableType<T, NAME>
│   └── AggregatedArraysType<V>              useEmptyArrayForNoValue, ...: AggregatedArrayType, AggregatedArrayProjectableAsNullableType
└── ConditionType                            IfType, AlwaysIfType                                    (logical.ts)
```

A method that applies to several data types is declared once, in the class they share. The methods are `this`
relative, so a method of a base gives back the data type of the value source it is called on:

```ts
abstract asOptional(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
abstract equals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE):
    ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
```

**No file depends on a file that depends on it, counting the types.** A base doesn't name a data type that extends it:
the comparisons of `NullableType` and `EqualableType` give a `BooleanType`, which is an `EqualableType`, so they declare
`BooleanOf<this>` and `IfValueSourceOf<this, ...>` (in [`base.ts`](./base.ts)), which read a member that each family
declares as high as it can import those data types: `declare [logicalTypes]: { boolean: BooleanType, if: IfType }` in
`ComparableType`, `BooleanType`, `EnumType` and `CustomEqualableType`. In the same way `NumericType.sign()` gives
`IntOf<this>` (`[intType]`, declared by `BigintType`, the custom numbers and `DecimalsType`), and `CoalesceTypeOf` reads the
data types of the group number from `[numberTypes]`, declared by `NumberType`. That is why the numbers are in several files:
the bases that work only with themselves ([`numeric.ts`](./numeric.ts)), the numbers of JavaScript
([`number.ts`](./number.ts): int, double and bigint, which name each other) and the exact decimals
([`decimals.ts`](./decimals.ts)). A new family declares these members in its base, and the bases never import it.

**A family is named in plural, its data types in singular.** A class in plural is a family: the base that its data
types extend, which has their shared methods and no type of its own (`UuidsType` for `UuidType` and `CustomUuidType`;
`LocalDatesType` for `LocalDateType` and `CustomLocalDateType`; `DecimalsType` for `StringDecimalType`,
`CustomDecimalType` and, tomorrow, the `Decimal` of JavaScript once it is standard, or the decimal of a library). A class
in singular is a data type with a value: a built-in one (`UuidType`, `IntType`) or a custom one. A file in plural has a
family and the built-in data types of it (`uuids.ts`, `localDates.ts`, `decimals.ts`); a file in singular has one data
type, a group or the tiers (`enum.ts`; `number.ts`, the group number; `logical.ts`, the group logical: the boolean and
the conditions; `numeric.ts`, `comparable.ts`, ...). A new kind of
values (the temporal types, the spatial ones, a decimal library) starts with its family in plural, so the custom ones
and the ones that come later extend it.

**The custom data types of a family are in a file of their own**, next to the file of the family they extend:
`customNumber.ts` (customInt, customBigint, customDouble), `customDecimals.ts`, `customUuids.ts`, `customLocalDates.ts`,
`customComparable.ts` and `customEqualable.ts`; `enum.ts` has the enumerations. A file of a family never imports its
custom file.

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
type of the value source for any other.

The other numbers (`bigint`, `stringDecimal`, the custom ones) work only with themselves. An exact number (an integer
or a decimal) has no `divide`, which wouldn't give an exact value (see `test/DEFERRED.md`); an exact decimal gives a
`double` for the computations that can't be exact.

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
- **The payload is not compared**: a gate matches the NType, not the type of the value. Two custom data types with the
  same type name and different payloads are a user error; comparing the payload would cost the compiler on every
  operand.
- **`IValueSource` is generic in the operand NType, not in the data type.** TypeScript compares two instances of the
  same generic interface by the variance of its type arguments, not by their content: an interface generic in `TYPE`
  would see `IntType` and `NumberType` as different inputs even though both give the same operand NType, and the arms
  of a compound select (`union`, a recursive `with`) would stop matching.

## Custom data types

A custom data type is a child class of its family class with its type name. Each family has a static `of`:

```ts
const MoneyType = CustomIntType.of<Money, 'Money'>('Money')   // type 'Money', customType 'customInt'
```

One static per family, because a single generic factory (`customType<Money, 'Money'>('customInt', 'Money')`) can't
know the family: when generic arguments are given explicitly, TypeScript doesn't infer the others. `of` gives a
`CustomTypeClass` (a `TypeClass` with the type guard); each family keeps the class it made for each type name and
gives the same one again, so a data type is one class wherever it is made. The users and the documentation give the class
wherever a data type goes; a custom data type is not taken by its names (`'customInt', 'Money'`).

## The data types by their classes

The methods that take a data type (`column`, `const`, `arg`, `fragmentWithType`, `executeFunction`, `sequence`, ...) have
one overload that takes a `TypeClass<TYPE>`, for any class with a type of its own: a built-in one (`IntType`) or one an
`of` made. It gives `ValueSource<SOURCE, TYPE, OPTIONAL_TYPE>` and their implementation reads `type` and `customType` of the
class. The class is the only way to give a custom data type. A class without a type of its own (a group such as
`NumberType`, or a family such as `CustomIntType`) is rejected when compiling: `BaseType` declares its static `type` as
`string | undefined`, a class with a type narrows it, and `TypeClass` requires a `string`. `TypeClass` has no `is`:
TypeScript infers the data type from `prototype`, and a generic `is` there would make the inference fail.

## The type guard: `is`

Each data type of a value source has a static `is(value: any)`, a type guard: whether the value is a value source of
that data type, of any source and optionality (`value is ValueSource<any, TYPE, any>`). It is declared once, in
`ValueSourceBaseType`, with a `this` parameter, so the class it is called on gives the guarded type, also for a class an
`of` made. A class that extends another answers by inheritance: `NumberType.is` says yes to an int and to a double,
`CustomIntType.is` to any customInt, `MoneyType.is` only to a customInt named `'Money'`.

At run time it reads the type and the custom type of the value source: a class with a type compares both, a family
class (a custom type and no type) its custom type, and the classes that group data types answer with their
`__isOfGroup` (direct questions about the type and the custom type, as in [`dataTypes.ts`](./dataTypes.ts)). What only
TypeScript tells apart, `is` can't: a condition is a boolean at run time, so the condition classes have no `is` (they
don't extend `ValueSourceBaseType`) and `BooleanType.is` says yes to a condition, also to the neutral (no condition,
recognised by its node); the two classes of an aggregated array
are one. A value that is not a value source is `false`.

## The data types by their names

[`builtInDataTypes.ts`](./builtInDataTypes.ts) maps the name of each built-in data type (`'int'`, `'string'`, ...) to its
class (`BuiltInDataTypes`), the type of its value, its value source, what a position that takes it accepts and its
fragment expression. The methods that take a data type by its name (`column`, `const`, `arg`, `fragmentWithType`,
`executeFunction`, `sequence`, ...) have one generic overload for the built-in ones over these maps. A union of names
(`t: 'int' | 'string'`) compiles and gives a union of value sources, on purpose: at run time the value is one of
them, so a union in gives a union out (the maintainer's decision; nothing rejects it).

## The rest of the folder

- [`base.ts`](./base.ts) also has the types that give a value source another source (`RemapValueSourceType` and its
  forms, used for the columns of an alias, a `with`, a left join): the same data type with another `SOURCE`.
- [`arguments.ts`](./arguments.ts): `Argument`, the argument of a fragment built with arguments, typed by its data
  type class, and the helpers that type the fragment and its function (`MapArgumentToValueSource`, `ArgForFn`, ...).
- [`fragments.ts`](./fragments.ts): `FragmentExpression<NO_SOURCE, TYPE, OPTIONAL_TYPE, EXTRA_SOURCE>`, the SQL of a
  fragment of any data type. The builders of fragments with arguments stay in `src/expressions/fragment.ts`.
- [`valueSource.ts`](./valueSource.ts): what every value source has whatever its data type: the optionality
  (`OptionalType`, `MergeOptional`, ...), `AnyValueSource`, `TypedValueSource`, the private state
  (`__ValueSourcePrivate`), how the library recognises one (`isValueSource`), the types of the value of a result
  (`ValueSourceValueType*`), and the executable queries.

## Checking a change

- `src/undistributed/typeSystemProbe.ts` asserts with the compiler, family by family, the operands accepted and
  rejected and the data type and optionality of the results. Add a case there for any rule you add or change: an
  `assertType<Equal<typeof result, ...>>()` on the result of a call (not `ReturnType` of an overloaded method, which
  measures only its last overload), and a `@ts-expect-error` for what must be rejected. `bun run validate` checks it.
- Then the test matrix: `bun run validate:tests` (the test scope compiles against these types; start with one cell,
  `bun run validate:tests postgres/newest/pg`) and `bun run tests`. A change of the types moves no SQL snapshot: if one
  moves, the change touched the runtime.
- Measure the compiler: `validate:tests` took ~150 s and ~7.6 GB at its peak when the library moved to this type system,
  the same as before. Compare against that before and after a change that adds conditional types or overloads.
- No recursive types (the rule of `CLAUDE.md`): the types here walk nothing; keep it so.

## Adding a data type

1. Its class in the file of its family (a family in plural, see above), extending the class that has the methods it
   shares, with its NType and
   operand NType, its `static type` / `customType`, and its own methods with the result types the runtime gives.
2. A custom one: its static `of`. A class that groups data types without a type of its own: its `__isOfGroup`.
3. A built-in one: its entry in each map of `builtInDataTypes.ts`.
4. A built-in one: its class in `dataTypeClasses.ts`; a new family of custom data types: its family there.
5. Its questions in `dataTypes.ts` and its handling in the runtime, as for any data type of the library.
6. Its cases in the probe, and its tests in the matrix.
