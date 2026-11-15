# The type system of the value sources

This folder types the value sources of the library: what a column, a constant, a function or an expression is for
TypeScript, which methods it has, what each method gives, and which operands each position accepts. It also holds the
one module through which the rest of the library builds and recognises the value sources at run time.

Read this before changing anything here. The code is the reference; this file says why it is shaped the way it is.

## The two halves: types here, runtime elsewhere

- **The types** are the classes of this folder. They are `abstract` and are never instantiated: their methods are
  `abstract` declarations, and they exist so TypeScript knows what a value source can do.
- **The runtime** is `src/internal/ValueSourceImpl.ts` (and `DBColumnImpl.ts`, `RawFragmentImpl.ts`), untouched by this
  type system. Nothing outside [`valueSourceFactory.ts`](./valueSourceFactory.ts) imports those classes: it builds them
  (`__create*`) and recognises them (`__is*`). Its `__create*` functions return `any`, because the runtime is not
  typed by the data type: the code that calls them declares what it builds.
- At run time a value source knows its data type by two strings, `__type` and `__customType` (for a custom data type,
  `__type` is its type name and `__customType` its family, e.g. `'Money'` / `'customInt'`). The questions about them
  (`__isInt`, `__isLocalDate`, `__isExactDecimal`, ...) are in [`dataTypes.ts`](./dataTypes.ts). **Nothing at run time
  reads the NType** below: it exists only for TypeScript.

Replacing the runtime by one built from these classes (methods with bodies instead of `abstract`) is possible later,
behind `valueSourceFactory.ts`, without touching the rest of the library; it was left out on purpose.

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

A **condition** (`IfValueSource`, `AlwaysIfValueSource`, in [`booleans.ts`](./booleans.ts)) is its data type plus
`ConditionOfType`: it has a source and an optionality but **is not a value source** (no `isValueSourceObject` brand). It
can't be a column or be projected, and it has a value a boolean doesn't have, the neutral (no condition).

## The classes

```
BaseType<VALUE_TYPE>                         the NType, the operand NType, the type of the value, static __type/__customType
├── ValueSourceBaseType<VALUE_TYPE>          isConstValue, getConstValue, allowWhen, disallowWhen
│   ├── NullableType<VALUE_TYPE>             isNull, valueWhenNull, asOptional, onlyWhenOrNull, ...
│   │   └── EqualableType<VALUE_TYPE>        equals, is, in, inN, ... (and their *IfValue forms)
│   │       ├── BooleanType                  negate, and, or, onlyWhen, ...
│   │       ├── EnumType<T, NAME>, CustomEqualableType<T, NAME>
│   │       └── ComparableType<VALUE_TYPE>   lessThan, between, ...
│   │           ├── NumberType               the group number: IntType, DoubleType
│   │           ├── NumericType<V>           the numbers that work only with themselves: abs, add, multiply, ...
│   │           │   ├── IntegerType<V>       BigintType, CustomIntType, CustomBigintType
│   │           │   ├── RealType<V>          its floating point functions keep the data type: CustomDoubleType
│   │           │   └── DecimalType<V>       exact; what can't be exact gives a double: StringDecimalType, CustomDecimalType
│   │           ├── StringType
│   │           ├── UuidsType<V>             UuidType, CustomUuidType
│   │           ├── LocalDatesType / LocalTimesType / LocalDateTimesType and their leaves and custom ones
│   │           └── CustomComparableType<T, NAME>
│   └── AggregatedArrayType<V>               useEmptyArrayForNoValue, ...; AggregatedArrayProjectableAsNullableType
└── ConditionType                            IfType, AlwaysIfType
```

A method that applies to several data types is declared once, in the class they share. The methods are `this`
relative, so a method of a base gives back the data type of the value source it is called on:

```ts
abstract asOptional(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
abstract equals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE):
    ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
```

Each method declares the data type **the runtime gives** for its result (read it in `ValueSourceImpl.ts` before
declaring it): a getter of a date gives `IntType`, `asString()` of a uuid gives `StringType`, `length()` gives
`IntType`. A subclass can't change the type of a result its base declares (TS2416); when a family needs a different
result, the base declares it through a type that asks the data type, like `CoalesceTypeOf` below.

## The numbers

`int` and `double` are the numbers of JavaScript and work together, in the group `number`: an `int` position takes a
`double` and an operation of both gives a `double`. The rule is `PromotedNumberType<RECEIVER, OPERAND>` in
[`numbers.ts`](./numbers.ts): a `double` if any of them is a `double`, an `int` if both are, and `NumberType` (the data
type of both) when one of them can be either. A number given as a value (`intColumn.add(1)`) gives `NumberType`:
`1` and `0.5` are both `number` for TypeScript, and the runtime decides with the value (`Number.isInteger`).
`valueWhenNull` widens the same way: `NullableType` declares its result as `CoalesceTypeOf<this, OPERAND>`, which is
`PromotedNumberType` for a number and the data type of the value source for any other.

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
const MoneyType = CustomIntType.of<Money, 'Money'>('Money')   // __type 'Money', __customType 'customInt'
```

One static per family, because a single generic factory (`customType<Money, 'Money'>('customInt', 'Money')`) can't
know the family: when generic arguments are given explicitly, TypeScript doesn't infer the others. For the same
reason the methods that take a custom data type by its names (`column<Money, 'Money'>('amount', 'customInt', 'Money')`)
keep one overload per family.

## The data types by their names

[`builtInDataTypes.ts`](./builtInDataTypes.ts) maps the name of each built-in data type (`'int'`, `'string'`, ...) to its
class (`BuiltInDataTypes`), the type of its value, its value source, what a position that takes it accepts and its
fragment expression. The methods that take a data type by its name (`column`, `const`, `arg`, `fragmentWithType`,
`executeFunction`, `sequence`, ...) have one generic overload for the built-in ones over these maps. A union of names
(`t: 'int' | 'string'`) compiles and gives a union of value sources; for now the library assumes none reaches it
(`test/DEFERRED.md`).

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

1. Its class in the file of its family, extending the class that has the methods it shares, with its NType and
   operand NType, its `static __type` / `__customType`, and its own methods with the result types the runtime gives.
2. A custom one: its static `of`.
3. A built-in one: its entry in each map of `builtInDataTypes.ts`.
4. Its questions in `dataTypes.ts` and its handling in the runtime, as for any data type of the library.
5. Its cases in the probe, and its tests in the matrix.
