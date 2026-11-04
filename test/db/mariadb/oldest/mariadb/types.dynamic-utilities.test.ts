// The result types of the dynamic utilities, compared with what the same input really
// produces: a literal `select` of the same subset, the runtime pick functions, and the
// rows the projection returns. Issue 1 has a NULL body and belongs to project 1; issue 2
// has a body and belongs to project 1.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, expandTypeFromDynamicPickPaths, expandTypeProjectedAsNullableFromDynamicPickPaths, type DynamicPick, type DynamicPickPaths, type PickValuesPath, type PickValuesPathProjectedAsNullable, type PickValuesPathWitAllProperties } from '../../../../../src/dynamic/pick.js'
import { tIssue, tProject, vReleaseOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const tProjectLeft = tProject.forUseInLeftJoin()

    // Every shape in one map: value, optional value, left-joined object, required object,
    // computed values, and an object gated by a required-in-optional leaf.
    const shapes = {
        id:   tIssue.id,
        body: tIssue.body,
        project: {
            id:         tProjectLeft.id,
            name:       tProjectLeft.name,
            archivedAt: tProjectLeft.archivedAt,
        },
        info: {
            priority: tIssue.priority,
            status:   tIssue.status,
        },
        computed: {
            nextPriority: tIssue.priority.add(1),
        },
        gated: {
            gate:  tIssue.body.asRequiredInOptionalObject(),
            title: tIssue.title,
        },
    }

    test('dynamic-utilities/pick-values-path-is-the-type-of-a-literal-select', async () => {
        const expected = [
            {
                id: 1,
                project: { name: 'Marketing site' },
                info: { priority: 2 },
                computed: { nextPriority: 3 },
            },
            {
                id: 2,
                body: 'Use new tokens',
                project: { name: 'Marketing site' },
                info: { priority: 1 },
                computed: { nextPriority: 2 },
                gated: { gate: 'Use new tokens', title: 'Redesign navbar' },
            },
        ]
        ctx.mockNext([
            { id: 1, body: null, 'project.name': 'Marketing site', 'info.priority': 2, 'computed.nextPriority': 3, 'gated.gate': null, 'gated.title': 'Update hero copy' },
            { id: 2, body: 'Use new tokens', 'project.name': 'Marketing site', 'info.priority': 1, 'computed.nextPriority': 2, 'gated.gate': 'Use new tokens', 'gated.title': 'Redesign navbar' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjectLeft).on(tProjectLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.in([1, 2]))
            .select({
                id:       shapes.id,
                body:     shapes.body,
                project:  { name: shapes.project.name },
                info:     { priority: shapes.info.priority },
                computed: shapes.computed,
                gated:    shapes.gated,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.\`body\` as \`body\`, project.name as \`project.name\`, issue.priority as \`info.priority\`, issue.priority + ? as \`computed.nextPriority\`, issue.\`body\` as \`gated.gate\`, issue.title as \`gated.title\` from issue left join project on project.id = issue.project_id where issue.id in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            2,
          ]
        `)
        type Paths = 'id' | 'body' | 'project.name' | 'info.priority' | 'computed' | 'gated'
        assertType<Exact<typeof rows, Array<PickValuesPath<typeof shapes, Paths>>>>()
        assertType<Exact<typeof rows, Array<{
            id:       number
            body?:    string
            project?: { name: string }
            info:     { priority: number }
            computed: { nextPriority: number }
            gated?:   { gate: string; title: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('dynamic-utilities/pick-values-path-projected-as-nullable-is-the-type-of-a-literal-select', async () => {
        const expected = [
            {
                id: 1,
                body: null,
                project: { name: 'Marketing site' },
                info: { priority: 2 },
                gated: null,
            },
        ]
        ctx.mockNext([
            { id: 1, body: null, 'project.name': 'Marketing site', 'info.priority': 2, 'gated.gate': null, 'gated.title': 'Update hero copy' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjectLeft).on(tProjectLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                id:      shapes.id,
                body:    shapes.body,
                project: { name: shapes.project.name },
                info:    { priority: shapes.info.priority },
                gated:   shapes.gated,
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.\`body\` as \`body\`, project.name as \`project.name\`, issue.priority as \`info.priority\`, issue.\`body\` as \`gated.gate\`, issue.title as \`gated.title\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        type Paths = 'id' | 'body' | 'project.name' | 'info.priority' | 'gated'
        assertType<Exact<typeof rows, Array<PickValuesPathProjectedAsNullable<typeof shapes, Paths>>>>()
        expect(rows).toEqual(expected)
    })

    test('dynamic-utilities/pick-values-path-of-a-view-keeps-custom-and-virtual-columns', async () => {
        const fields = {
            id:      vReleaseOverview.id,
            version: vReleaseOverview.version,
            dates: {
                releasedOn:  vReleaseOverview.releasedOn,
                signedOffAt: vReleaseOverview.signedOffAt,
            },
            versionUpper: vReleaseOverview.versionUpper,
        }
        const expected = [{ id: 1, version: '1.2.0', dates: { releasedOn: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }, versionUpper: '1.2.0' }]
        ctx.mockNext([{ id: 1, version: '1.2.0', 'dates.releasedOn': new Date(Date.UTC(2024, 0, 15, 10, 0, 0)), versionUpper: '1.2.0' }])
        const paths: ('version' | 'dates.releasedOn' | 'versionUpper')[] = ['version', 'dates.releasedOn', 'versionUpper']
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select(dynamicPickPaths(fields, paths, ['id']))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, version as version, released_on as \`dates.releasedOn\`, upper(version) as versionUpper from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        const typed = expandTypeFromDynamicPickPaths(fields, paths, rows, ['id'])
        const first = typed[0]!
        const id: PickValuesPath<typeof fields, 'id'>['id'] = first.id
        const version: PickValuesPath<typeof fields, 'version'>['version'] = first.version
        expect([id, version]).toEqual([1, '1.2.0'])
        expect(typed).toEqual(expected)
    })

    test('dynamic-utilities/both-pick-functions-agree-on-the-same-selection', () => {
        const fields = { id: tIssue.id, title: tIssue.title, info: { priority: tIssue.priority, status: tIssue.status } }

        const fromMap = dynamicPick(fields, { title: true, info: { status: true } }, ['id', 'info.priority'])
        const fromPaths = dynamicPickPaths(fields, ['title', 'info.status'], ['id', 'info.priority'])

        assertType<Exact<typeof fromMap, typeof fromPaths>>()
        expect(fromMap).toEqual(fromPaths)
        expect(Object.keys(fromMap)).toEqual(['id', 'title', 'info'])
        expect(Object.keys(fromMap.info)).toEqual(['priority', 'status'])
    })

    test('dynamic-utilities/whole-object-path-brings-all-of-it', () => {
        const fields = { id: tIssue.id, info: { priority: tIssue.priority, status: tIssue.status } }

        const picked = dynamicPickPaths(fields, ['info'])

        expect(Object.keys(picked)).toEqual(['info'])
        expect(Object.keys(picked.info!)).toEqual(['priority', 'status'])
        assertType<Exact<PickValuesPath<typeof fields, 'info'>, { info: { priority: number; status: string } }>>()
        assertType<Exact<PickValuesPathWitAllProperties<typeof fields, 'info'>, { id?: number; info: { priority: number; status: string } }>>()
    })

    test('dynamic-utilities/empty-pick-types-match-the-empty-object-it-returns', () => {
        const fields = { id: tIssue.id, info: { priority: tIssue.priority, status: tIssue.status } }

        const fromMap = dynamicPick(fields, {})
        const fromPaths = dynamicPickPaths(fields, [])

        expect(fromMap).toEqual({})
        expect(fromPaths).toEqual({})
        assertType<Exact<PickValuesPath<typeof fields, never>, {}>>()
        assertType<Exact<PickValuesPathWitAllProperties<typeof fields, never>, { id?: number; info?: { priority?: number; status?: string } }>>()
    })

    test('dynamic-utilities/pick-input-types-drop-only-the-always-included-fields', () => {
        const fields = { id: tIssue.id, title: tIssue.title, info: { priority: tIssue.priority, status: tIssue.status } }

        assertType<Exact<DynamicPick<typeof fields>, { id?: boolean; title?: boolean; info?: { priority?: boolean; status?: boolean } }>>()
        assertType<Exact<DynamicPick<typeof fields, 'id' | 'info.status'>, { title?: boolean; info?: { priority?: boolean } }>>()
        assertType<Exact<DynamicPickPaths<typeof fields>, 'id' | 'title' | 'info' | 'info.priority' | 'info.status'>>()
        assertType<Exact<DynamicPickPaths<typeof fields, 'id' | 'info.status'>, 'title' | 'info' | 'info.priority'>>()
    })

    test('dynamic-utilities/expand-type-projected-as-nullable-over-generic-fields', async () => {
        const fields = { id: tProject.id, name: tProject.name, archivedAt: tProject.archivedAt }

        async function getProjects<FIELDS extends DynamicPickPaths<typeof fields>>(picked: FIELDS[]): Promise<PickValuesPathProjectedAsNullable<typeof fields, FIELDS | 'id'>[]> {
            const rows = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select(dynamicPickPaths(fields, picked, ['id']))
                .projectingOptionalValuesAsNullable()
                .executeSelectMany()
            return expandTypeProjectedAsNullableFromDynamicPickPaths(fields, picked, rows, ['id'])
        }

        const expected = [{ id: 1, archivedAt: null }]
        ctx.mockNext(expected)
        const result = await getProjects(['archivedAt'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, archived_at as archivedAt from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; archivedAt: Date | null }>>>()
        expect(result).toEqual(expected)
    })

    test('dynamic-utilities/sibling-of-a-mandatory-path-is-optional', async () => {
        const fields = { id: tIssue.id, info: { priority: tIssue.priority, status: tIssue.status } }

        const picked = dynamicPick(fields, { info: {} }, ['id', 'info.priority'])
        const expected = [{ id: 1, info: { priority: 2 } }]
        ctx.mockNext([{ id: 1, 'info.priority': 2 }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as \`info.priority\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; info: { priority: number; status?: string } }>>>()
        expect(rows).toEqual(expected)
    })

    test('dynamic-utilities/with-all-properties-keeps-unselected-siblings-optional', () => {
        const fields = {
            id: tIssue.id,
            assignee: { id: tProjectLeft.id, fullName: tProjectLeft.name },
            gated: { gate: tIssue.status.asRequiredInOptionalObject(), title: tIssue.title },
            deep: { a: { b: { x: tIssue.id, y: tIssue.title }, z: tIssue.status }, w: tIssue.body },
        }
        assertType<Exact<PickValuesPathWitAllProperties<typeof fields, 'assignee.fullName'>['assignee'], { fullName: string; id?: number } | undefined>>()
        assertType<Exact<PickValuesPathWitAllProperties<typeof fields, 'gated.gate'>['gated'], { gate: string; title?: string } | undefined>>()
        assertType<Exact<PickValuesPathWitAllProperties<typeof fields, 'deep.a.b.x'>['deep'], { a: { b: { x: number; y?: string }; z?: string }; w?: string }>>()
    })

    test('dynamic-utilities/always-included-nested-path-survives-any-pick', () => {
        const fields = { id: tIssue.id, info: { priority: tIssue.priority, status: tIssue.status }, a: { b: { c: tIssue.title } } }

        const fromMap = dynamicPick(fields, {}, ['id', 'info.priority', 'a.b.c'])
        const fromPaths = dynamicPickPaths(fields, [], ['id', 'info.priority', 'a.b.c'])

        assertType<Exact<typeof fromMap, typeof fromPaths>>()
        expect(fromMap).toEqual(fromPaths)
        expect(fromMap.info.priority).toBe(tIssue.priority)
        expect(fromMap.a.b.c).toBe(tIssue.title)
    })

    // TODO[BUG]: expandTypeFromDynamicPickPaths types the object as required (the rule of all its leaves) when the picked leaves make it optional; the row doesn't have it.
    /*
    test('dynamic-utilities/expand-type-object-is-optional-when-its-picked-leaves-are', async () => {
        const fields = { id: tIssue.id, info: { priority: tIssue.priority, body: tIssue.body } }
        const paths: 'info.body'[] = ['info.body']

        ctx.mockNext([{ id: 1, 'info.body': null }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(dynamicPickPaths(fields, paths, ['id']))
            .executeSelectMany()
        const typed = expandTypeFromDynamicPickPaths(fields, paths, rows, ['id'])

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof typed, Array<PickValuesPath<typeof fields, 'id' | 'info.body'>>>>()
        expect(typed).toEqual([{ id: 1 }])
    })
    */

    // TODO[BUG]: a picked required-in-optional leaf drops the object at runtime when it has no value, but picked leaves don't count for the type, which keeps the object required.
    /*
    test('dynamic-utilities/picked-required-in-optional-leaf-makes-the-object-optional', async () => {
        const fields = { id: tIssue.id, info: { priority: tIssue.priority, gate: tIssue.body.asRequiredInOptionalObject() } }

        ctx.mockNext([{ id: 1, 'info.priority': 2, 'info.gate': null }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(dynamicPick(fields, { info: { gate: true } }, ['id', 'info.priority']))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; info?: { priority: number; gate?: string } }>>>()
        expect(rows).toEqual([{ id: 1 }])
    })
    */

    // TODO[BUG]: a picked leaf from another table turns rule 2 off at runtime, so the mandatory left-join leaf can be missing while the object exists; the type keeps it required.
    /*
    test('dynamic-utilities/picked-leaf-from-another-table-leaves-the-left-join-leaf-optional', async () => {
        const fields = { id: tIssue.id, project: { id: tProjectLeft.id, title: tIssue.title } }

        ctx.mockNext([{ id: 1, 'project.id': null, 'project.title': 'Update hero copy' }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjectLeft).on(tProjectLeft.id.equals(tIssue.projectId).and(tProjectLeft.id.equals(-1)))
            .where(tIssue.id.equals(1))
            .select(dynamicPick(fields, { project: { title: true } }, ['id', 'project.id']))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; project: { id?: number; title?: string } }>>>()
        expect(rows).toEqual([{ id: 1, project: { title: 'Update hero copy' } }])
    })
    */

    // TODO[BUG]: a select projects 5 levels of objects, but the pick types stop before the fifth; the runtime picks them all the same.
    /*
    test('dynamic-utilities/pick-types-reach-the-fifth-level', () => {
        const fields = { a: { b: { c: { d: { e: tIssue.id } } } } }

        assertType<Exact<DynamicPickPaths<typeof fields>, 'a' | 'a.b' | 'a.b.c' | 'a.b.c.d' | 'a.b.c.d.e'>>()
        assertType<Exact<DynamicPick<typeof fields>, { a?: { b?: { c?: { d?: { e?: boolean } } } } }>>()
        const picked = dynamicPickPaths(fields, ['a.b.c.d.e'])
        expect(picked.a!.b!.c!.d!.e).toBe(tIssue.id)
    })
    */
})
