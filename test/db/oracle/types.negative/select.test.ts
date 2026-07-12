// Compile-time negative tests for SELECT-shaped APIs on the oracle dialect.
// These never execute any SQL — the value of the test is that
// `validate:tests` (tsc) rejects each `@ts-expect-error` line. If the
// library stops rejecting one of these, the directive becomes "unused" and
// `tsc` fails the build with `TS2578` — exactly the regression signal we
// want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the
// rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../lib/assertType.js'
import type { DBConnection } from '../domain/connection.js'
import { tAppUser, tCountry, tIssue, tIssueWorklog, tOrganization, tProject, tProjectReview } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime, so we don't need a real instance and don't
// open any driver-level resource just to make the file load.
declare const connection: DBConnection

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime; we keep it wrapped in an unreachable function so the throw
// paths inside ts-sql-query are not triggered by accident.
function _typeNegatives() {
    // Rule: `.equals()` requires the same scalar type on both sides.
    // tAppUser.id is `int`; passing a string must not compile.
    // @ts-expect-error string passed where int is required
    void tAppUser.id.equals('1')

    // Rule: you cannot select a column from a table that is not in the FROM
    // clause. Selecting from tProject and trying to project a column from
    // tIssue without joining it must not compile.
    void connection.selectFrom(tProject)
        .select({
            id:    tProject.id,
            // @ts-expect-error tIssue.title is not reachable from tProject alone
            title: tIssue.title,
        })

    // Rule: ORDER BY by alias must reference an alias that exists in the
    // current select shape.
    void connection.selectFrom(tProject)
        .select({ id: tProject.id, name: tProject.name })
        // @ts-expect-error 'unknownAlias' is not a key of the projected select
        .orderBy('unknownAlias')

    // Rule: on a recursive-union result the ORDER BY runs against the CTE
    // output (`select ... from <cte>`), so the value-source / raw-fragment
    // orderBy overloads accept only no-table expressions — a table-bound term
    // is out of scope in the outer FROM and every engine rejects it. Order the
    // recursive result by the projected column name (or orderByFromString)
    // instead. Mirrors the restriction a compound query's ORDER BY carries.
    void connection.selectFrom(tIssue)
        .where(tIssue.id.equals(1))
        .select({ id: tIssue.id, title: tIssue.title })
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
            .join(parent).on(tIssue.parentId.equals(parent.id))
            .select({ id: tIssue.id, title: tIssue.title }))
        // @ts-expect-error a table-bound column cannot order a recursive result; use .orderBy('id', 'desc')
        .orderBy(tIssue.id, 'desc')

    void connection.selectFrom(tIssue)
        .where(tIssue.id.equals(1))
        .select({ id: tIssue.id, title: tIssue.title })
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
            .join(parent).on(tIssue.parentId.equals(parent.id))
            .select({ id: tIssue.id, title: tIssue.title }))
        // @ts-expect-error a raw fragment over an anchor table cannot order a recursive result
        .orderBy(connection.rawFragment`${tIssue.id} desc`)

    // The column-name form is the supported way to order a recursive result
    // and must keep compiling; a plain (non-recursive) select must keep
    // accepting a table-bound value-source / raw-fragment ordering term.
    void connection.selectFrom(tIssue)
        .where(tIssue.id.equals(1))
        .select({ id: tIssue.id, title: tIssue.title })
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
            .join(parent).on(tIssue.parentId.equals(parent.id))
            .select({ id: tIssue.id, title: tIssue.title }))
        .orderBy('id', 'desc')

    // Rule: `orderingSiblingsOnly()` is only reachable after a hierarchical
    // `startWith` / `connectBy` / `connectByNoCycle` query (it emits Oracle's
    // `order siblings by`). A recursive-union result never enables it, so calling
    // it there is a type error — `order siblings by` has no meaning for a
    // recursive-union CTE.
    void connection.selectFrom(tIssue)
        .where(tIssue.id.equals(1))
        .select({ id: tIssue.id, title: tIssue.title })
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
            .join(parent).on(tIssue.parentId.equals(parent.id))
            .select({ id: tIssue.id, title: tIssue.title }))
        .orderBy('id')
        // @ts-expect-error orderingSiblingsOnly is only available after startWith/connectBy, not on a recursive-union result
        .orderingSiblingsOnly()

    void connection.selectFrom(tIssue)
        .select({ id: tIssue.id, title: tIssue.title })
        .orderBy(tIssue.id, 'desc')

    // Rule: on a compound (union / intersect / except) result the ORDER BY runs
    // against the set-operation output, so the value-source / raw-fragment orderBy
    // overloads accept only no-table expressions — a table-bound term references a
    // branch's base table that is out of scope for the compound result and every
    // engine rejects it. Order a compound by the projected column name (or
    // orderByFromString) instead. This is the very restriction the recursive block
    // above states it "mirrors".
    void connection.selectFrom(tProject).select({ label: tProject.name })
        .union(connection.selectFrom(tIssue).select({ label: tIssue.title }))
        // @ts-expect-error a table-bound column cannot order a compound result; use .orderBy('label')
        .orderBy(tProject.id)

    // Rule: the raw-fragment arm of a compound ORDER BY carries the same no-table
    // restriction as the value-source arm above — a raw fragment over a branch's base
    // table cannot order a compound result (it would emit an unwrapped
    // `... union ... order by project.id desc` that every engine rejects). Use a
    // no-table raw fragment or .orderBy('label') instead.
    void connection.selectFrom(tProject).select({ label: tProject.name })
        .union(connection.selectFrom(tIssue).select({ label: tIssue.title }))
        // @ts-expect-error a table-bound raw fragment cannot order a compound result; use a no-table fragment or .orderBy('label')
        .orderBy(connection.rawFragment`${tProject.id} desc`)

    // The column-name and no-table raw-fragment forms are the supported ways to
    // order a compound result and must keep compiling.
    void connection.selectFrom(tProject).select({ label: tProject.name })
        .union(connection.selectFrom(tIssue).select({ label: tIssue.title }))
        .orderBy('label')

    void connection.selectFrom(tProject).select({ label: tProject.name })
        .union(connection.selectFrom(tIssue).select({ label: tIssue.title }))
        .orderBy(connection.rawFragment`label desc`)

    // Rule: .equals(value) must match the column's TS type.
    // tProject.id is int; passing a Date must not compile.
    // @ts-expect-error Date passed where number is required
    void tProject.id.equals(new Date())

    // Rule: .startsWith and other string-only ops are not available on int
    // columns.
    // @ts-expect-error startsWith does not exist on a NumberValueSource
    void tProject.id.startsWith('1')

    // Rule: .equals on a string column requires a string, not a number.
    // @ts-expect-error number passed where string is required
    void tAppUser.email.equals(1)

    // Rule: comparison methods between mismatched columns. tProject.id is int,
    // tAppUser.email is string — equals across types must not compile.
    // @ts-expect-error string column not equals-comparable with int column
    void tProject.id.equals(tAppUser.email)

    // Rule: aggregate functions returned a value source — they cannot be
    // called on the connection without a column argument when their
    // overload requires one (e.g. sum needs a NumberValueSource).
    // @ts-expect-error sum requires a number value source, not a string
    void connection.sum(tAppUser.email)

    // Rule: orderByFromString segments must be the column alias plus
    // optional direction/nulls modifier — random strings are not
    // typechecked. (orderByFromString is a `string` parameter so it
    // can't be statically rejected here — covered at runtime.)
    // void connection.selectFrom(tProject).select({...}).orderByFromString('arbitrary')

    // Rule: select on a typed projection must use IValueSource leaves.
    // Passing a plain string instead of a value source must not compile.
    void connection.selectFrom(tProject)
        .select({
            id:   tProject.id,
            // @ts-expect-error plain strings are not value sources
            name: 'a plain string',
        })

    // Rule: limit() requires a number.
    // @ts-expect-error string passed to limit
    void connection.selectFrom(tProject).select({ id: tProject.id }).limit('5')

    // Rule: offset() requires a number.
    // @ts-expect-error string passed to offset
    void connection.selectFrom(tProject).select({ id: tProject.id }).limit(5).offset('a')

    // Rule: equalsIfValue accepts a nullable value but the type must still
    // match the column's underlying type.
    // @ts-expect-error string passed where number | null | undefined expected
    void tIssue.priority.equalsIfValue('high')

    // Rule: aggregate functions are not allowed in a WHERE clause. An
    // aggregate carries an aggregate marker in its source that the FROM
    // source does not include, so the condition is not assignable to where().
    void connection.selectFrom(tIssue).where(
        // @ts-expect-error sum(...) is an aggregate and cannot appear in WHERE
        connection.sum(tIssue.priority).greaterThan(1)
    )

    // Rule: aggregate functions are not allowed in GROUP BY.
    void connection.selectFrom(tIssue).groupBy(
        // @ts-expect-error count(...) is an aggregate and cannot appear in GROUP BY
        connection.count(tIssue.id)
    )

    // Rule: aggregate functions are not allowed in a JOIN ON condition.
    void connection.selectFrom(tIssue).innerJoin(tProject).on(
        // @ts-expect-error max(...) is an aggregate and cannot appear in ON
        connection.max(tIssue.priority).equals(tProject.id)
    )

    // Rule: aggregateAsArray(...) / aggregateAsArrayOfOneColumn(...) are
    // aggregates too — their result carries the aggregate marker, so they are
    // rejected wherever a plain aggregate is (here: GROUP BY).
    void connection.selectFrom(tIssue).groupBy(
        // @ts-expect-error aggregateAsArrayOfOneColumn(...) is an aggregate and cannot appear in GROUP BY
        connection.aggregateAsArrayOfOneColumn(tIssue.priority)
    )

    // Rule: an aggregate written as a SQL fragment (aggregateFragmentWithType /
    // buildAggregateFragmentWith*) carries the aggregate marker too, so it is
    // rejected outside aggregate-legal clauses — here, in WHERE.
    void connection.selectFrom(tIssue).where(
        // @ts-expect-error an aggregate SQL fragment cannot appear in WHERE
        connection.aggregateFragmentWithType('int', 'optional').sql`sum(${tIssue.priority})`.greaterThan(1)
    )
    // Rule: Oracle does not allow outer references inside a recursive subquery, so forUseAsInlineAggregatedArrayValue() is typed `never`
    // on a recursive inline aggregate that references the outer query.
    {
        const parentIssue = tIssue.as('parentIssue')
        void connection.subSelectUsing(tIssue).from(parentIssue)
            .select({ id: parentIssue.id, parentId: parentIssue.parentId })
            .where(parentIssue.id.equals(tIssue.parentId))
            .recursiveUnionAllOn((child) => child.parentId.equals(parentIssue.id))
            // @ts-expect-error forUseAsInlineAggregatedArrayValue is `never` on a recursive inline aggregate
            .forUseAsInlineAggregatedArrayValue()
    }


    // Rule: nested-object projection is limited to four nested-object levels
    // (the complex-projection recursion `ResultObjectValues`..`5`). Depth 4
    // (`a.b.c.d`) is the deepest renderable level; a 5th nested-object level
    // (`a.b.c.d.e`) exceeds the recursion depth, so the innermost object is no
    // longer accepted as a projection object — the column slot at that depth
    // expects a value source, not another object literal.
    void connection.selectFrom(tIssue)
        .select({
            iid: tIssue.id,
            a: { b: { c: { d: { e: {
                // @ts-expect-error 5th nested-object level exceeds the projection recursion depth
                num: tIssue.number,
            } } } } },
        })

    // Rule: subSelectUsing(...) fixes the correlated outer tables in scope; at
    // arity 5 each type parameter stays distinct, so the correlation scope is
    // exactly the five listed tables (plus the inner FROM). A table that is NOT
    // among them (here tCountry) is out of scope, so a correlation predicate
    // referencing it must not compile. This locks the arity-5 overload keeping
    // the fifth table its own type parameter rather than collapsing it onto the
    // fourth (which would also mis-scope the correlated-source union).
    void connection.subSelectUsing(tOrganization, tProject, tIssue, tAppUser, tIssueWorklog).from(tProjectReview)
        .where(
            // @ts-expect-error tCountry is not among the five correlated tables in scope at arity 5
            tCountry.code.equals('US')
        )

    // Rule: the customInt `valueWhenNull<VALUE>` / `nullIfValue<VALUE>` value-source
    // overloads union the OPERAND column's source into the result (like CustomDouble /
    // Bigint / Number and the base value sources), so the "column not in FROM" net
    // covers the operand for customInt too. `tIssueWorklog.costCents` is a
    // `customInt 'Cents'` column; `worklog2` is a distinct self-aliased source of the
    // same TYPE_NAME.
    const worklog2 = tIssueWorklog.as('worklog2')
    // Positive control: with both the receiver's and the operand's source joined,
    // the coalesce/nullif projection compiles.
    void connection.selectFrom(tIssueWorklog)
        .join(worklog2).on(worklog2.id.equals(tIssueWorklog.id))
        .select({ x: tIssueWorklog.costCents.valueWhenNull(worklog2.costCents) })
    // Guard: `worklog2` is NOT in the FROM, so selecting a valueWhenNull result whose
    // operand comes from it must not compile (the result carries worklog2's source).
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error valueWhenNull operand worklog2.costCents is from a table not in the FROM
            x: tIssueWorklog.costCents.valueWhenNull(worklog2.costCents),
        })
    // Guard: the nullIfValue twin unions the operand's source the same way.
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error nullIfValue operand worklog2.costCents is from a table not in the FROM
            x: tIssueWorklog.costCents.nullIfValue(worklog2.costCents),
        })

    // Rule: the customInt ARITHMETIC value-source overloads (add / subtract /
    // modulo / minValue / maxValue) union the OPERAND column's source into the
    // result, the same table-tracking as valueWhenNull / nullIfValue above — so
    // an operand from a table not in the FROM must not compile.
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error add operand worklog2.costCents is from a table not in the FROM
            x: tIssueWorklog.costCents.add(worklog2.costCents),
        })
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error subtract operand worklog2.costCents is from a table not in the FROM
            x: tIssueWorklog.costCents.subtract(worklog2.costCents),
        })
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error modulo operand worklog2.costCents is from a table not in the FROM
            x: tIssueWorklog.costCents.modulo(worklog2.costCents),
        })
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error minValue operand worklog2.costCents is from a table not in the FROM
            x: tIssueWorklog.costCents.minValue(worklog2.costCents),
        })
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error maxValue operand worklog2.costCents is from a table not in the FROM
            x: tIssueWorklog.costCents.maxValue(worklog2.costCents),
        })

    // Rule: CustomDouble source-tracking is symmetric with CustomInt — the
    // valueWhenNull / nullIfValue / arithmetic overloads union the operand's
    // source too. Only CustomInt was previously locked (the comment above even
    // asserts "like CustomDouble" without a CustomDouble lock). billedAmount is a
    // customDouble 'Money' column; worklog2.billedAmount is a distinct self-alias
    // of the same TYPE_NAME.
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error valueWhenNull operand worklog2.billedAmount is from a table not in the FROM
            x: tIssueWorklog.billedAmount.valueWhenNull(worklog2.billedAmount),
        })
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error nullIfValue operand worklog2.billedAmount is from a table not in the FROM
            x: tIssueWorklog.billedAmount.nullIfValue(worklog2.billedAmount),
        })
    void connection.selectFrom(tIssueWorklog)
        .select({
            // @ts-expect-error add operand worklog2.billedAmount is from a table not in the FROM
            x: tIssueWorklog.billedAmount.add(worklog2.billedAmount),
        })

    // Rule: CustomDoubleValueSource deliberately OMITS the numeric CAST methods
    // asInt / asDouble / asBigint — a custom double carries its own brand +
    // TYPE_NAME, and casting it to a plain int/double/bigint would erase that
    // brand, so those casts are `NumberValueSource`-only (commented out in the
    // CustomDoubleValueSource interface). Each must stay absent so an accidental
    // un-comment would be caught here. billedAmount is a customDouble 'Money' column.
    // @ts-expect-error asInt is a NumberValueSource-only cast, absent on customDouble
    void tIssueWorklog.billedAmount.asInt()
    // @ts-expect-error asDouble is a NumberValueSource-only cast, absent on customDouble
    void tIssueWorklog.billedAmount.asDouble()
    // @ts-expect-error asBigint is a NumberValueSource-only cast, absent on customDouble
    void tIssueWorklog.billedAmount.asBigint()

    // Rule: BigintValueSource deliberately OMITS the float-only math methods
    // (multiply / divide / power / sqrt / exp / ln / log10 / cbrt / atan2 / logn
    // / roundn / sin) — bigint arithmetic stays exact. Each must stay absent so
    // that an accidentally-uncommented method would be caught here. viewCount is
    // a bigint column.
    // @ts-expect-error multiply is not a BigintValueSource method
    void tIssue.viewCount.multiply(2n)
    // @ts-expect-error divide is not a BigintValueSource method
    void tIssue.viewCount.divide(2n)
    // @ts-expect-error power is not a BigintValueSource method
    void tIssue.viewCount.power(2n)
    // @ts-expect-error sqrt is not a BigintValueSource method
    void tIssue.viewCount.sqrt()
    // @ts-expect-error exp is not a BigintValueSource method
    void tIssue.viewCount.exp()
    // @ts-expect-error ln is not a BigintValueSource method
    void tIssue.viewCount.ln()
    // @ts-expect-error log10 is not a BigintValueSource method
    void tIssue.viewCount.log10()
    // @ts-expect-error cbrt is not a BigintValueSource method
    void tIssue.viewCount.cbrt()
    // @ts-expect-error atan2 is not a BigintValueSource method
    void tIssue.viewCount.atan2(2n)
    // @ts-expect-error logn is not a BigintValueSource method
    void tIssue.viewCount.logn(2n)
    // @ts-expect-error roundn is not a BigintValueSource method
    void tIssue.viewCount.roundn(2)
    // @ts-expect-error sin is not a BigintValueSource method
    void tIssue.viewCount.sin()

    // Rule: CustomIntValueSource — like BigintValueSource — OMITS the float-only
    // math methods so a custom INT stays exact: exp / ln / log10 / sqrt / cbrt, the
    // trigonometric acos / asin / atan / cos / cot / sin / tan, and power / logn /
    // roundn / divide / atan2 are all absent (commented out in the interface). Only
    // the integer-preserving arithmetic (add / subtract / multiply / modulo /
    // minValue / maxValue) plus abs / ceil / floor / round / sign are offered — so
    // `multiply` is NOT locked here (it is active on customInt, unlike on bigint).
    // Each absent method must stay absent so an accidental un-comment is caught.
    // costCents is a customInt 'Cents' column.
    // @ts-expect-error exp is not a CustomIntValueSource method
    void tIssueWorklog.costCents.exp()
    // @ts-expect-error ln is not a CustomIntValueSource method
    void tIssueWorklog.costCents.ln()
    // @ts-expect-error log10 is not a CustomIntValueSource method
    void tIssueWorklog.costCents.log10()
    // @ts-expect-error sqrt is not a CustomIntValueSource method
    void tIssueWorklog.costCents.sqrt()
    // @ts-expect-error cbrt is not a CustomIntValueSource method
    void tIssueWorklog.costCents.cbrt()
    // @ts-expect-error acos is not a CustomIntValueSource method
    void tIssueWorklog.costCents.acos()
    // @ts-expect-error asin is not a CustomIntValueSource method
    void tIssueWorklog.costCents.asin()
    // @ts-expect-error atan is not a CustomIntValueSource method
    void tIssueWorklog.costCents.atan()
    // @ts-expect-error cos is not a CustomIntValueSource method
    void tIssueWorklog.costCents.cos()
    // @ts-expect-error cot is not a CustomIntValueSource method
    void tIssueWorklog.costCents.cot()
    // @ts-expect-error sin is not a CustomIntValueSource method
    void tIssueWorklog.costCents.sin()
    // @ts-expect-error tan is not a CustomIntValueSource method
    void tIssueWorklog.costCents.tan()
    // @ts-expect-error power is not a CustomIntValueSource method
    void tIssueWorklog.costCents.power(2)
    // @ts-expect-error logn is not a CustomIntValueSource method
    void tIssueWorklog.costCents.logn(2)
    // @ts-expect-error roundn is not a CustomIntValueSource method
    void tIssueWorklog.costCents.roundn(2)
    // @ts-expect-error divide is not a CustomIntValueSource method
    void tIssueWorklog.costCents.divide(2)
    // @ts-expect-error atan2 is not a CustomIntValueSource method
    void tIssueWorklog.costCents.atan2(2)

    // Rule: numeric arithmetic requires operands of the SAME leaf kind — a bigint
    // receiver rejects a number/int operand and an int receiver rejects a bigint
    // operand, so distinct numeric domains cannot silently mix.
    // @ts-expect-error bigint receiver rejects a plain number operand
    void tIssue.viewCount.add(1)
    // @ts-expect-error int receiver rejects a bigint operand
    void tIssue.priority.add(1n)
    // @ts-expect-error bigint receiver rejects an int-column operand
    void tIssue.viewCount.add(tIssue.priority)
    // @ts-expect-error int receiver rejects a bigint-column operand
    void tIssue.priority.add(tIssue.viewCount)

    // Rule: ordered-comparison methods (lessThan / greaterThan / lessOrEquals /
    // greaterOrEquals / between / notBetween) exist only on a
    // ComparableValueSource. A boolean / enum / custom leaf is Equalable but NOT
    // Comparable, so these must not compile. `lessThan` pins the not-Comparable
    // contract; `between` pins the range-comparison group (a distinct signature).
    // @ts-expect-error boolean is not ordered-comparable — no lessThan
    void tIssueWorklog.billable.lessThan(true)
    // @ts-expect-error boolean is not ordered-comparable — no between
    void tIssueWorklog.billable.between(true, false)
    // @ts-expect-error enum is not ordered-comparable — no lessThan
    void tIssueWorklog.activity.lessThan('coding')
    // @ts-expect-error enum is not ordered-comparable — no between
    void tIssueWorklog.activity.between('coding', 'review')
    // @ts-expect-error custom (branded union) is not ordered-comparable — no lessThan
    void connection.const<string, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel').lessThan('beta')

    // Rule: equalsInsensitive / notEqualsInsensitive are string-only (case
    // folding is meaningless off a StringValueSource), so they must not exist on
    // an int / boolean / enum leaf.
    // @ts-expect-error equalsInsensitive is string-only — absent on int
    void tProject.id.equalsInsensitive(1)
    // @ts-expect-error notEqualsInsensitive is string-only — absent on int
    void tProject.id.notEqualsInsensitive(1)
    // @ts-expect-error equalsInsensitive is string-only — absent on boolean
    void tIssueWorklog.billable.equalsInsensitive(true)
    // @ts-expect-error equalsInsensitive is string-only — absent on enum
    void tIssueWorklog.activity.equalsInsensitive('coding')

    // Rule: a custom value source captures its brand (TYPE_NAME) as a type
    // parameter, and `equals` requires the operand to carry the SAME brand
    // (`IEqualableValueSource<…, TYPE, TYPE_NAME, …>`). Two sources of the same
    // kind but DIFFERENT brands must not compile — the brand is the type-level
    // guard keeping distinct domains from mixing. One lock per branded
    // value-source class. Each `@ts-expect-error` sits on the `.equals(...)`
    // line because that is where the overload-mismatch error lands.
    void connection.const<number, 'ReleaseTag'>(7, 'customInt', 'ReleaseTag')
        // @ts-expect-error customInt 'ReleaseTag' is not equals-comparable with customInt 'Cents'
        .equals(connection.const<number, 'Cents'>(5, 'customInt', 'Cents'))
    void connection.const<number, 'Money'>(1.5, 'customDouble', 'Money')
        // @ts-expect-error customDouble 'Money' is not equals-comparable with customDouble 'Rate'
        .equals(connection.const<number, 'Rate'>(2.5, 'customDouble', 'Rate'))
    void connection.const<string, 'SigningKey'>('0a8f9c1e-1111-4222-8333-444455556666', 'customUuid', 'SigningKey')
        // @ts-expect-error customUuid 'SigningKey' is not equals-comparable with customUuid 'SessionKey'
        .equals(connection.const<string, 'SessionKey'>('0a8f9c1e-1111-4222-8333-444455556666', 'customUuid', 'SessionKey'))
    void connection.const<string, 'Semver'>('1.0.0', 'customComparable', 'Semver')
        // @ts-expect-error customComparable 'Semver' is not equals-comparable with customComparable 'Calver'
        .equals(connection.const<string, 'Calver'>('2024.01', 'customComparable', 'Calver'))
    void connection.const<string, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel')
        // @ts-expect-error custom 'ReleaseChannel' is not equals-comparable with custom 'Tier'
        .equals(connection.const<string, 'Tier'>('gold', 'custom', 'Tier'))
    void connection.const<Date, 'ReleaseDay'>(new Date(), 'customLocalDate', 'ReleaseDay')
        // @ts-expect-error customLocalDate 'ReleaseDay' is not equals-comparable with customLocalDate 'SprintDay'
        .equals(connection.const<Date, 'SprintDay'>(new Date(), 'customLocalDate', 'SprintDay'))
    void connection.const<Date, 'CutoffClock'>(new Date(), 'customLocalTime', 'CutoffClock')
        // @ts-expect-error customLocalTime 'CutoffClock' is not equals-comparable with customLocalTime 'ShiftClock'
        .equals(connection.const<Date, 'ShiftClock'>(new Date(), 'customLocalTime', 'ShiftClock'))
    void connection.const<Date, 'SignOffStamp'>(new Date(), 'customLocalDateTime', 'SignOffStamp')
        // @ts-expect-error customLocalDateTime 'SignOffStamp' is not equals-comparable with customLocalDateTime 'PublishStamp'
        .equals(connection.const<Date, 'PublishStamp'>(new Date(), 'customLocalDateTime', 'PublishStamp'))

    // Positive control: the SAME brand on the same kind IS equals-comparable and
    // must keep compiling — proves the brand lock is not over-broad.
    void connection.const<number, 'ReleaseTag'>(7, 'customInt', 'ReleaseTag')
        .equals(connection.const<number, 'ReleaseTag'>(5, 'customInt', 'ReleaseTag'))
    // Rule: Oracle's recursive CTE only supports UNION ALL, so the DISTINCT
    // `recursiveUnion` / `recursiveUnionOn` are typed `never` on this dialect — only the
    // `*All` variants are reachable.
    const _recBase = connection.selectFrom(tIssue).where(tIssue.id.equals(1))
        .select({ id: tIssue.id, title: tIssue.title })
    assertType<Exact<typeof _recBase.recursiveUnion, never>>()
    assertType<Exact<typeof _recBase.recursiveUnionOn, never>>()

    // Rule: a correlated sub-select (`subSelectUsing(...)`) cannot be promoted to a named
    // CTE via `forUseInQueryAs(...)` on Oracle (no correlated-CTE / LATERAL support), so
    // the method is typed `never`.
    const _corr = connection.subSelectUsing(tProject).from(tIssue)
        .where(tIssue.projectId.equals(tProject.id))
        .select({ id: tIssue.id })
    assertType<Exact<typeof _corr.forUseInQueryAs, never>>()
}

test('select-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
