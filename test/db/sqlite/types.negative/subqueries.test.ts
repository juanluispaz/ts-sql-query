// Compile-time negative tests for subqueries, derived tables / CTEs
// (`forUseInQueryAs`), left-join sources (`forUseInLeftJoin`) and recursive
// selects on the sqlite dialect. These never execute any SQL — the value of
// the test is that `validate:tests` (tsc) rejects each `@ts-expect-error`
// line. If the library stops rejecting one of these, the directive becomes
// "unused" and the build fails with `TS2578` — exactly the regression signal
// we want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6. Each one sits next to a positive control that differs
// only in the thing under test.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue, tOrganization, tProject } from '../domain/connection.js'

declare const connection: DBConnection

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime, so the throw paths inside ts-sql-query are not triggered.
function _typeNegatives() {
    // ---- Correlation scope -------------------------------------------------

    // Rule: a plain `selectFrom(...)` subquery has no outer table in scope, so
    // referencing a column of the enclosing query's table must not compile;
    // correlation is declared with `subSelectUsing(outerTable)`.
    void connection.selectFrom(tProject)
        .where(tProject.id.in(connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).selectOneColumn(tIssue.projectId)))
        .select({ id: tProject.id })
    void connection.selectFrom(tProject)
        // @ts-expect-error tProject is not in scope of an uncorrelated selectFrom(tIssue)
        .where(tProject.id.in(connection.selectFrom(tIssue).where(tIssue.projectId.equals(tProject.id)).selectOneColumn(tIssue.projectId)))
        .select({ id: tProject.id })

    // Rule: `subSelectUsing(...)` puts only the listed outer tables in scope; a
    // table that is neither listed nor in the inner FROM must not compile.
    void connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).selectOneColumn(tIssue.id)
    // @ts-expect-error tOrganization is not among the correlated tables of subSelectUsing(tProject)
    void connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tOrganization.id)).selectOneColumn(tIssue.id)

    // Rule: a correlated inline value requires its outer table in the enclosing
    // query; projecting it in a query that does not have that table in FROM
    // must not compile.
    void connection.selectFrom(tProject)
        .select({
            n: connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).selectCountAll().forUseAsInlineQueryValue(),
        })
    void connection.selectFrom(tOrganization)
        .select({
            // @ts-expect-error the correlated tProject is not in the outer FROM(tOrganization)
            n: connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).selectCountAll().forUseAsInlineQueryValue(),
        })

    // Rule: the same requirement holds for `exists(...)`: the correlated outer
    // table must be in the enclosing query.
    void connection.selectFrom(tProject)
        .where(connection.exists(connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).selectOneColumn(tIssue.id)))
        .select({ id: tProject.id })
    void connection.selectFrom(tOrganization)
        // @ts-expect-error the correlated tProject is not in the outer FROM(tOrganization)
        .where(connection.exists(connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).selectOneColumn(tIssue.id)))
        .select({ id: tOrganization.id })

    // Rule: `exists(...)` takes a select query, not a value source.
    void connection.exists(connection.selectFrom(tIssue).selectOneColumn(tIssue.id))
    // @ts-expect-error exists takes a select query, not a column
    void connection.exists(tIssue.id)

    // ---- in / notIn (subquery) ---------------------------------------------

    // Rule: `in(subquery)` requires the subquery column to have the receiver's
    // data type.
    void tProject.id.in(connection.selectFrom(tIssue).selectOneColumn(tIssue.projectId))
    // @ts-expect-error the subquery column is a string; the receiver is int
    void tProject.id.in(connection.selectFrom(tIssue).selectOneColumn(tIssue.title))
    // Rule: `notIn(subquery)` carries the same data-type requirement.
    void tProject.id.notIn(connection.selectFrom(tIssue).selectOneColumn(tIssue.projectId))
    // @ts-expect-error the subquery column is a string; the receiver is int
    void tProject.id.notIn(connection.selectFrom(tIssue).selectOneColumn(tIssue.title))

    // Rule: `in(subquery)` takes a one-column select (`selectOneColumn`); an
    // object projection with several columns must not compile.
    void tProject.id.in(connection.selectFrom(tIssue).selectOneColumn(tIssue.projectId))
    // @ts-expect-error a multi-column select is not a valid in() subquery
    void tProject.id.in(connection.selectFrom(tIssue).select({ a: tIssue.projectId, b: tIssue.id }))

    // ---- Inline query value ------------------------------------------------

    // Rule: `forUseAsInlineQueryValue()` keeps the data type of the selected
    // column; comparing it against a column of another data type must not compile.
    void tProject.name.equals(connection.selectFrom(tIssue).selectOneColumn(tIssue.title).forUseAsInlineQueryValue())
    // @ts-expect-error the inline value is a string; the receiver is int
    void tProject.id.equals(connection.selectFrom(tIssue).selectOneColumn(tIssue.title).forUseAsInlineQueryValue())

    // Rule: an inline query value is optional (the subquery may return no row),
    // so it projects an optional property even when the selected column is
    // required; `valueWhenNull(...)` makes it required again.
    const inlineDefaulted: Promise<{ x: number }> = connection.selectFrom(tProject).select({ x: connection.selectFrom(tIssue).selectOneColumn(tIssue.id).forUseAsInlineQueryValue().valueWhenNull(0) }).executeSelectOne()
    // @ts-expect-error the inline value is optional in the row
    const inlineRequired: Promise<{ x: number }> = connection.selectFrom(tProject).select({ x: connection.selectFrom(tIssue).selectOneColumn(tIssue.id).forUseAsInlineQueryValue() }).executeSelectOne()
    void inlineDefaulted; void inlineRequired

    // ---- Derived table / CTE (forUseInQueryAs) -----------------------------

    const sub = connection.selectFrom(tIssue).select({ id: tIssue.id, title: tIssue.title }).forUseInQueryAs('sub')

    // Rule: a `forUseInQueryAs` view exposes exactly the projected columns.
    void sub.title
    // @ts-expect-error `bogus` is not a column of the derived table
    void sub.bogus

    // Rule: a derived-table column keeps the optionality it was projected with.
    const optionalSub = connection.selectFrom(tIssue).select({ id: tIssue.id, body: tIssue.body }).forUseInQueryAs('optionalSub')
    const subOptional: Promise<{ b?: string }> = connection.selectFrom(optionalSub).select({ b: optionalSub.body }).executeSelectOne()
    // @ts-expect-error `body` was projected from an optional column, so it is optional in the row
    const subRequired: Promise<{ b: string }> = connection.selectFrom(optionalSub).select({ b: optionalSub.body }).executeSelectOne()
    void subOptional; void subRequired

    // Rule: a derived-table column keeps the data type it was projected with.
    void sub.id.equals(1)
    // @ts-expect-error id is an int column; a string operand is rejected
    void sub.id.equals('x')

    // Rule: a derived-table column is only reachable from a query that has the
    // derived table in its FROM / JOIN.
    void connection.selectFrom(sub).select({ x: sub.id })
    // @ts-expect-error `sub` is not in the FROM of a query over tProject
    void connection.selectFrom(tProject).select({ x: sub.id })
    void connection.selectFrom(tProject).innerJoin(sub).on(sub.id.equals(tProject.id)).select({ id: tProject.id })
    // @ts-expect-error `sub` is not in the FROM of a query over tProject
    void connection.selectFrom(tProject).where(sub.id.equals(tProject.id)).select({ id: tProject.id })

    // ---- Left-join sources (forUseInLeftJoin) ------------------------------

    const orgLeft = tOrganization.forUseInLeftJoin()

    // Rule: a `forUseInLeftJoin()` source is only accepted by `leftJoin`; an
    // inner join of it must not compile.
    void connection.selectFrom(tProject).leftJoin(orgLeft).on(orgLeft.id.equals(tProject.organizationId)).select({ id: tProject.id })
    // @ts-expect-error a left-join source cannot be inner-joined
    void connection.selectFrom(tProject).join(orgLeft).on(orgLeft.id.equals(tProject.organizationId)).select({ id: tProject.id })
    // @ts-expect-error a left-join source cannot be inner-joined
    void connection.selectFrom(tProject).innerJoin(orgLeft).on(orgLeft.id.equals(tProject.organizationId)).select({ id: tProject.id })

    // Rule: `leftJoin` requires the `forUseInLeftJoin()` form, so the plain
    // table (whose columns are not optional) must not compile there.
    // @ts-expect-error leftJoin needs tOrganization.forUseInLeftJoin()
    void connection.selectFrom(tProject).leftJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId)).select({ id: tProject.id })

    // Rule: a derived table turned into a left-join source follows the same rule.
    const subLeft = connection.selectFrom(tIssue).select({ id: tIssue.id, projectId: tIssue.projectId }).forUseInQueryAs('subLeft').forUseInLeftJoin()
    void connection.selectFrom(tProject).leftJoin(subLeft).on(subLeft.projectId.equals(tProject.id)).select({ id: tProject.id })
    // @ts-expect-error a left-join source cannot be inner-joined
    void connection.selectFrom(tProject).join(subLeft).on(subLeft.projectId.equals(tProject.id)).select({ id: tProject.id })

    // Rule: a column read through a left-join source is optional in the result,
    // even when the underlying column is required.
    const leftRequired: Promise<{ id: number; name?: string }[]> = connection.selectFrom(tProject).leftJoin(orgLeft).on(orgLeft.id.equals(tProject.organizationId)).select({ id: tProject.id, name: orgLeft.name }).executeSelectMany()
    // @ts-expect-error `name` comes from a left join, so it is optional in the row
    const leftAsRequired: Promise<{ id: number; name: string }[]> = connection.selectFrom(tProject).leftJoin(orgLeft).on(orgLeft.id.equals(tProject.organizationId)).select({ id: tProject.id, name: orgLeft.name }).executeSelectMany()
    void leftRequired; void leftAsRequired

    // ---- Recursive selects -------------------------------------------------

    // Rule: the recursive arm must project the same columns with the same data
    // types as the anchor select.
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.id)).select({ id: tIssue.id, title: tIssue.title }))
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        // @ts-expect-error `title` is a string in the anchor and an int in the recursive arm
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.id)).select({ id: tIssue.id, title: tIssue.priority }))
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        // @ts-expect-error the recursive arm omits the anchor's `title` column
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.id)).select({ id: tIssue.id }))
    // TODO[BUG]: the recursive arm must not project a column the anchor does not have — should not compile
    // (the emitted `union all` arm carries three columns against the anchor's two, which the database rejects).
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.id)).select({ id: tIssue.id, title: tIssue.title, extra: tIssue.priority }))

    // Rule: the recursive arm must keep the anchor's optionality; an optional
    // column where the anchor's is required must not compile.
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        // @ts-expect-error `body` is optional, the anchor's `title` is required
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.id)).select({ id: tIssue.id, title: tIssue.body }))

    // Rule: the recursive reference exposes only the anchor's columns.
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        // @ts-expect-error `bogus` is not a column of the recursive reference
        .recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.bogus)).select({ id: tIssue.id, title: tIssue.title }))

    // Rule: the `recursiveUnion*On` condition may reference only the recursive
    // reference and the anchor's FROM tables; another table must not compile.
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        .recursiveUnionAllOn((child) => child.id.equals(tIssue.parentId))
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        // @ts-expect-error tProject is not in scope of the recursive condition
        .recursiveUnionAllOn((child) => child.id.equals(tProject.id))

    // Rule: the recursive reference columns keep the anchor's data types.
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id, title: tIssue.title })
        // @ts-expect-error child.title is a string; tIssue.parentId is int
        .recursiveUnionAllOn((child) => child.title.equals(tIssue.parentId))
}

test('subqueries-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
