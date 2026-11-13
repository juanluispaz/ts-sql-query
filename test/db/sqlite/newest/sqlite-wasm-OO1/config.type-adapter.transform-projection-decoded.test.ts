// The library reads some values of SQLite decoded, and the `transformProjection` of a type adapter receives the value
// as the library reads it and writes its SQL around it, in a column of the result and inside the JSON of an aggregated
// array.
//
//   - With the uuid strategy 'uuid-extension' a uuid is stored as a blob of 16 bytes and read with `uuid_str(...)`.
//     The shared test connection uses 'string', so these tests pin 'uuid-extension' with `ctx.withUuidStrategy`, and
//     give the uuid of issue.external_ref as the strategy stores it with the fragment `uuid_blob(external_ref)`.
//     `upperUuid` gives the uuid in upper case, and its `transformValueFromDB` reads it back in lower case: it rejects
//     a text that isn't in upper case, so a value the database didn't convert fails the test.
//   - With the default decimal strategy, 'decimal-extension and tsq-functions with canonical text', a computed
//     customDecimal (here `valueWhenNull` and a fragment) is read in its canonical text. `markedAmount` writes a `#`
//     before the text, and its `transformValueFromDB` takes it away: it rejects a text without it.
//
// issue: 1 has the external_ref 0a8f9c1e-1111-4222-8333-444455556666 and 2 has 7b3e9d20-2222-4c55-9b66-dddd00009999,
// both of the project 1, titled 'Update hero copy' and 'Redesign navbar'.
// exact_amount: 1 has the price 1.5, 3 the price 0 and 4 no price.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, TypeAdapterProjectionContext } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection, tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

type IssueRef = string & { readonly __brand: 'IssueRef' }
type Amount = string & { readonly __brand: 'Amount' }

const upperUuid: TypeAdapter = {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        if (typeof value === 'string') {
            if (value !== value.toUpperCase()) {
                throw new Error('The uuid was not converted to upper case: ' + value)
            }
            return next.transformValueFromDB(value.toLowerCase(), context)
        }
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, context)
    },
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        return 'upper(' + next.transformProjection(sql, context) + ')'
    },
}

const markedAmount: TypeAdapter = {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        if (typeof value === 'string') {
            if (!value.startsWith('#')) {
                throw new Error('The amount was not marked: ' + value)
            }
            return next.transformValueFromDB(value.substring(1), context)
        }
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, context)
    },
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        return "'#' || " + next.transformProjection(sql, context)
    },
}

const tMarkedAmount = new class TMarkedAmount extends Table<DBConnection, 'TMarkedAmount'> {
    id    = this.primaryKey('id', 'int')
    price = this.optionalColumn<Amount, 'Amount'>('price', 'customDecimal', 'Amount', markedAmount)
    constructor() { super('exact_amount') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    function issueRefOf(conn: DBConnection) {
        return conn.fragmentWithType<IssueRef, 'IssueRef'>('customUuid', 'IssueRef', 'required', upperUuid).sql`uuid_blob(${tIssue.externalRef})`
    }

    test('transform-projection-decoded/uuid: the adapter wraps the uuid read with uuid_str in a column of the result', async () => {
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext([
            { id: 1, ref: '0A8F9C1E-1111-4222-8333-444455556666' },
            { id: 2, ref: '7B3E9D20-2222-4C55-9B66-DDDD00009999' },
        ])
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.externalRef.isNotNull())
            .select({ id: tIssue.id, ref: issueRefOf(conn) })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(uuid_str(uuid_blob(external_ref))) as ref from issue where external_ref is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; ref: IssueRef }[]>>()
        expect(rows).toEqual([
            { id: 1, ref: '0a8f9c1e-1111-4222-8333-444455556666' },
            { id: 2, ref: '7b3e9d20-2222-4c55-9b66-dddd00009999' },
        ])
    })

    test('transform-projection-decoded/uuid: the adapter wraps the uuid read with uuid_str inside an aggregated array', async () => {
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext({
            id:     1,
            refs:   ['0A8F9C1E-1111-4222-8333-444455556666', '7B3E9D20-2222-4C55-9B66-DDDD00009999'],
            issues: [
                { ref: '0A8F9C1E-1111-4222-8333-444455556666', title: 'Update hero copy' },
                { ref: '7B3E9D20-2222-4C55-9B66-DDDD00009999', title: 'Redesign navbar' },
            ],
        })
        const row = await conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                refs:   conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(issueRefOf(conn))
                    .forUseAsInlineAggregatedArrayValue(),
                issues: conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .select({ ref: issueRefOf(conn), title: tIssue.title })
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_group_array(upper(uuid_str(uuid_blob(external_ref)))) from issue where project_id = project.id) as refs, (select json_group_array(json_object('ref', upper(uuid_str(uuid_blob(external_ref))), 'title', title)) from issue where project_id = project.id) as issues from project where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; refs: IssueRef[]; issues: { ref: IssueRef; title: string }[] }>>()
        // The aggregates carry no order by: compare them sorted by uuid
        expect({
            id:     row.id,
            refs:   [...row.refs].sort(),
            issues: [...row.issues].sort((a, b) => a.ref.localeCompare(b.ref)),
        }).toEqual({
            id:     1,
            refs:   ['0a8f9c1e-1111-4222-8333-444455556666', '7b3e9d20-2222-4c55-9b66-dddd00009999'],
            issues: [
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
            ],
        })
    })

    test('transform-projection-decoded/uuid: the adapter wraps the uuid read with uuid_str in an ordered aggregated array', async () => {
        // Ordered by title: 'Redesign navbar' (7b3e9d20-…) before 'Update hero copy' (0a8f9c1e-…)
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext({
            id:     1,
            refs:   ['7B3E9D20-2222-4C55-9B66-DDDD00009999', '0A8F9C1E-1111-4222-8333-444455556666'],
            issues: [
                { ref: '7B3E9D20-2222-4C55-9B66-DDDD00009999', title: 'Redesign navbar' },
                { ref: '0A8F9C1E-1111-4222-8333-444455556666', title: 'Update hero copy' },
            ],
        })
        const row = await conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                refs:   conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(issueRefOf(conn))
                    .orderBy(tIssue.title)
                    .forUseAsInlineAggregatedArrayValue(),
                issues: conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .select({ ref: issueRefOf(conn), title: tIssue.title })
                    .orderBy('title')
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_group_array(upper(uuid_str(a_1_.result))) from (select uuid_blob(external_ref) as result from issue where project_id = project.id order by issue.title) as a_1_) as refs, (select json_group_array(json_object('ref', upper(uuid_str(a_2_.ref)), 'title', a_2_.title)) from (select uuid_blob(external_ref) as ref, title as title from issue where project_id = project.id order by title) as a_2_) as issues from project where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; refs: IssueRef[]; issues: { ref: IssueRef; title: string }[] }>>()
        expect(row).toEqual({
            id:     1,
            refs:   ['7b3e9d20-2222-4c55-9b66-dddd00009999', '0a8f9c1e-1111-4222-8333-444455556666'],
            issues: [
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
            ],
        })
    })

    test('transform-projection-decoded/decimal: the adapter wraps the canonical text of a computed customDecimal in a column of the result', async () => {
        // The fragment gives 1.50 and 00, read in their canonical text 1.5 and 0
        const padded = ctx.conn.fragmentWithType<Amount, 'Amount'>('customDecimal', 'Amount', 'optional', markedAmount).sql`${tMarkedAmount.price} || '0'`
        ctx.mockNext([
            { id: 1, price: '#1.5', padded: '#1.5' },
            { id: 3, price: '#0', padded: '#0' },
            { id: 4, price: '#0', padded: null },
        ])
        const rows = await ctx.conn.selectFrom(tMarkedAmount)
            .where(tMarkedAmount.id.in([1, 3, 4]))
            .select({
                id:     tMarkedAmount.id,
                price:  tMarkedAmount.price.valueWhenNull('0' as Amount),
                padded: padded,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, '#' || (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select ifnull(price, ?1) as tsq_v)) as price, '#' || (select case when typeof(tsq_v) = 'text' and tsq_v not glob '*[^0-9.-]*' then (case when tsq_v is null then null when rtrim(ltrim(ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0'), '0'), '0') = '' then '0' else (case when substr(tsq_v, 1, 1) = '-' then '-' else '' end) || (case when ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') = '' then '0' else ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') end) || (case when rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0') <> '' then '.' || rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0') else '' end) end) else tsq_v end from (select price || '0' as tsq_v)) as padded from exact_amount where id in (?2, ?3, ?4) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0",
            1,
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; price: Amount; padded?: Amount }[]>>()
        expect(rows).toEqual([
            { id: 1, price: '1.5', padded: '1.5' },
            { id: 3, price: '0', padded: '0' },
            { id: 4, price: '0' },
        ])
    })

    test('transform-projection-decoded/decimal: the adapter wraps the canonical text of a computed customDecimal inside an aggregated array', async () => {
        const padded = ctx.conn.fragmentWithType<Amount, 'Amount'>('customDecimal', 'Amount', 'optional', markedAmount).sql`${tMarkedAmount.price} || '0'`
        ctx.mockNext({
            prices:  ['#1.5', '#0', '#0'],
            amounts: [
                { id: 1, price: '#1.5', padded: '#1.5' },
                { id: 3, price: '#0', padded: '#0' },
                { id: 4, price: '#0', padded: null },
            ],
        })
        const row = await ctx.conn.selectFrom(tMarkedAmount)
            .where(tMarkedAmount.id.in([1, 3, 4]))
            .select({
                prices:  ctx.conn.aggregateAsArrayOfOneColumn(tMarkedAmount.price.valueWhenNull('0' as Amount)),
                amounts: ctx.conn.aggregateAsArray({
                    id:     tMarkedAmount.id,
                    price:  tMarkedAmount.price.valueWhenNull('0' as Amount),
                    padded: padded,
                }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select json_group_array('#' || (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select ifnull(price, ?1) as tsq_v))) as prices, json_group_array(json_object('id', id, 'price', '#' || (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select ifnull(price, ?2) as tsq_v)), 'padded', '#' || (select case when typeof(tsq_v) = 'text' and tsq_v not glob '*[^0-9.-]*' then (case when tsq_v is null then null when rtrim(ltrim(ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0'), '0'), '0') = '' then '0' else (case when substr(tsq_v, 1, 1) = '-' then '-' else '' end) || (case when ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') = '' then '0' else ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') end) || (case when rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0') <> '' then '.' || rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0') else '' end) end) else tsq_v end from (select price || '0' as tsq_v)))) as amounts from exact_amount where id in (?3, ?4, ?5)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0",
            "0",
            1,
            3,
            4,
          ]
        `)
        assertType<Exact<typeof row, { prices: Amount[]; amounts: { id: number; price: Amount; padded?: Amount }[] }>>()
        // The aggregates carry no order by: compare them sorted
        expect({
            prices:  [...row.prices].sort(),
            amounts: [...row.amounts].sort((a, b) => a.id - b.id),
        }).toEqual({
            prices:  ['0', '0', '1.5'],
            amounts: [
                { id: 1, price: '1.5', padded: '1.5' },
                { id: 3, price: '0', padded: '0' },
                { id: 4, price: '0' },
            ],
        })
    })
})
