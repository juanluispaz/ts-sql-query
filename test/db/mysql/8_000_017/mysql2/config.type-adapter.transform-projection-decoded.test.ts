// With the default uuid strategy, 'binary', a uuid is stored in a BINARY(16) and the library reads it with
// `bin_to_uuid(...)`, in a column of the result and inside the JSON of an aggregated array. The `transformProjection`
// of a type adapter receives the value as the library reads it, the uuid as text, and writes its SQL around it.
// `upperUuid` gives the uuid in upper case, and its `transformValueFromDB` reads it back in lower case: it rejects a
// text that isn't in upper case, so a value the database didn't convert fails the test.
// issue: 1 has the external_ref 0a8f9c1e-1111-4222-8333-444455556666 and 2 has 7b3e9d20-2222-4c55-9b66-dddd00009999,
// both of the project 1, titled 'Update hero copy' and 'Redesign navbar'.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DefaultTypeAdapter, ProjectionOutput, TypeAdapter, TypeCategory } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

type IssueRef = string & { readonly __brand: 'IssueRef' }

const upperUuid: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (typeof value === 'string') {
            if (value !== value.toUpperCase()) {
                throw new Error('The uuid was not converted to upper case: ' + value)
            }
            return next.transformValueFromDB(value.toLowerCase(), type, typeCategory)
        }
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        return 'upper(' + next.transformProjection(sql, type, typeCategory, output) + ')'
    },
}

const tIssueRef = new class TIssueRef extends Table<DBConnection, 'TIssueRef'> {
    id        = this.primaryKey('id', 'int')
    projectId = this.column('project_id', 'int')
    title     = this.column('title', 'string')
    ref       = this.optionalColumn<IssueRef, 'IssueRef'>('external_ref', 'customUuid', 'IssueRef', upperUuid)
    constructor() { super('issue') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('transform-projection-decoded/uuid: the adapter wraps the uuid read with bin_to_uuid in a column of the result', async () => {
        ctx.mockNext([
            { id: 1, ref: '0A8F9C1E-1111-4222-8333-444455556666' },
            { id: 2, ref: '7B3E9D20-2222-4C55-9B66-DDDD00009999' },
            { id: 3, ref: null },
        ])
        const rows = await ctx.conn.selectFrom(tIssueRef)
            .where(tIssueRef.id.lessOrEqual(3))
            .select({ id: tIssueRef.id, ref: tIssueRef.ref })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(bin_to_uuid(external_ref)) as ref from issue where id <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; ref?: IssueRef }[]>>()
        expect(rows).toEqual([
            { id: 1, ref: '0a8f9c1e-1111-4222-8333-444455556666' },
            { id: 2, ref: '7b3e9d20-2222-4c55-9b66-dddd00009999' },
            { id: 3 },
        ])
    })

    test('transform-projection-decoded/uuid: the adapter wraps the uuid read with bin_to_uuid inside an aggregated array', async () => {
        ctx.mockNext({
            id:     1,
            refs:   ['0A8F9C1E-1111-4222-8333-444455556666', '7B3E9D20-2222-4C55-9B66-DDDD00009999'],
            issues: [
                { ref: '0A8F9C1E-1111-4222-8333-444455556666', title: 'Update hero copy' },
                { ref: '7B3E9D20-2222-4C55-9B66-DDDD00009999', title: 'Redesign navbar' },
            ],
        })
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                refs:   ctx.conn.subSelectUsing(tProject).from(tIssueRef)
                    .where(tIssueRef.projectId.equals(tProject.id))
                    .and(tIssueRef.ref.isNotNull())
                    .selectOneColumn(tIssueRef.ref)
                    .forUseAsInlineAggregatedArrayValue(),
                issues: ctx.conn.subSelectUsing(tProject).from(tIssueRef)
                    .where(tIssueRef.projectId.equals(tProject.id))
                    .select({ ref: tIssueRef.ref, title: tIssueRef.title })
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(upper(bin_to_uuid(external_ref))) from issue where project_id = project.id and external_ref is not null) as char) as refs, cast((select json_arrayagg(json_object('ref', upper(bin_to_uuid(external_ref)), 'title', title)) from issue where project_id = project.id) as char) as issues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; refs: IssueRef[]; issues: { ref?: IssueRef; title: string }[] }>>()
        // The aggregates carry no order by: compare them sorted by uuid
        expect({
            id:     row.id,
            refs:   [...row.refs].sort(),
            issues: [...row.issues].sort((a, b) => (a.ref ?? '').localeCompare(b.ref ?? '')),
        }).toEqual({
            id:     1,
            refs:   ['0a8f9c1e-1111-4222-8333-444455556666', '7b3e9d20-2222-4c55-9b66-dddd00009999'],
            issues: [
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
            ],
        })
    })

    test('transform-projection-decoded/uuid: the adapter wraps the uuid read with bin_to_uuid in an ordered aggregated array', async () => {
        // Ordered by title: 'Redesign navbar' (7b3e9d20-…) before 'Update hero copy' (0a8f9c1e-…)
        ctx.mockNext({
            id:     1,
            refs:   ['7B3E9D20-2222-4C55-9B66-DDDD00009999', '0A8F9C1E-1111-4222-8333-444455556666'],
            issues: [
                { ref: '7B3E9D20-2222-4C55-9B66-DDDD00009999', title: 'Redesign navbar' },
                { ref: '0A8F9C1E-1111-4222-8333-444455556666', title: 'Update hero copy' },
            ],
        })
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                refs:   ctx.conn.subSelectUsing(tProject).from(tIssueRef)
                    .where(tIssueRef.projectId.equals(tProject.id))
                    .and(tIssueRef.ref.isNotNull())
                    .selectOneColumn(tIssueRef.ref)
                    .orderBy(tIssueRef.title)
                    .forUseAsInlineAggregatedArrayValue(),
                issues: ctx.conn.subSelectUsing(tProject).from(tIssueRef)
                    .where(tIssueRef.projectId.equals(tProject.id))
                    .select({ ref: tIssueRef.ref, title: tIssueRef.title })
                    .orderBy('title')
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(upper(bin_to_uuid(a_1_.result))) from (select external_ref as result from issue where project_id = project.id and external_ref is not null order by issue.title limit 2147483647) as a_1_) as char) as refs, cast((select json_arrayagg(json_object('ref', upper(bin_to_uuid(a_2_.ref)), 'title', a_2_.title)) from (select external_ref as ref, title as title from issue where project_id = project.id order by title limit 2147483647) as a_2_) as char) as issues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; refs: IssueRef[]; issues: { ref?: IssueRef; title: string }[] }>>()
        expect(row).toEqual({
            id:     1,
            refs:   ['7b3e9d20-2222-4c55-9b66-dddd00009999', '0a8f9c1e-1111-4222-8333-444455556666'],
            issues: [
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
            ],
        })
    })
})
