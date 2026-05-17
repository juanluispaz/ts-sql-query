// Basic SELECT scenarios. Body is single-pass: one query through `ctx.conn`,
// then four assertions — emitted SQL (inline snapshot), emitted params
// (inline snapshot), exact result type, returned value.
//
// SQL and params live in `toMatchInlineSnapshot(...)` so they can be
// updated en masse via `bun test --update-snapshots` (or
// `bunx vitest run -u`) whenever the library's emitted SQL changes.
//
// The seed dataset (test/db/sqlite/domain/seed.sql) and the values primed
// via `ctx.mockNext(...)` are kept aligned so a single
// `expect(result).toEqual(expected)` line covers both modes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('list-organizations-ordered-by-name', async () => {
        const expected = [
            { id: 1, name: 'Acme Corp',  plan: 'pro' },
            { id: 2, name: 'Globex Ltd', plan: 'free' },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tOrganization)
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
                plan: tOrganization.plan,
            })
            .orderBy('name')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, plan as plan from \`organization\` order by \`name\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)

        assertType<Exact<typeof result, Array<{
            id: number
            name: string
            plan: string
        }>>>()

        expect(result).toEqual(expected)
    })

    test('find-user-by-email', async () => {
        const expected = {
            id: 1,
            email: 'ada@acme.test',
            fullName: 'Ada Lovelace',
        }
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.equals('ada@acme.test'))
            .select({
                id:       tAppUser.id,
                email:    tAppUser.email,
                fullName: tAppUser.fullName,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email, full_name as fullName from app_user where email = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@acme.test",
          ]
        `)

        assertType<Exact<typeof result, {
            id: number
            email: string
            fullName: string
        }>>()

        expect(result).toEqual(expected)
    })

    test('active-projects-of-organization', async () => {
        // Seed has 2 active projects in org 1: "Internal tools" (id=2,
        // slug=tools) and "Marketing site" (id=1, slug=mktg-site). Alphabetic
        // order: 'Internal tools' < 'Marketing site'.
        const expected = [
            { id: 2, name: 'Internal tools', slug: 'tools' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
              .and(tProject.archivedAt.isNull())
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('name')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, slug as slug from project where organization_id = ? and archived_at is null order by \`name\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)

        assertType<Exact<typeof result, Array<{
            id: number
            name: string
            slug: string
        }>>>()

        expect(result).toEqual(expected)
    })

    test('issues-joined-with-project', async () => {
        // Seed has two open issues: id=1 ("Update hero copy") in project 1
        // ("Marketing site") and id=3 ("Migrate to ESM") in project 2
        // ("Internal tools").
        const expected = [
            { issueId: 1, title: 'Update hero copy', projectName: 'Marketing site' },
            { issueId: 3, title: 'Migrate to ESM',   projectName: 'Internal tools' },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tIssue.status.equals('open'))
            .select({
                issueId:     tIssue.id,
                title:       tIssue.title,
                projectName: tProject.name,
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, issue.title as title, project.\`name\` as projectName from issue inner join project on project.id = issue.project_id where issue.\`status\` = ? order by issueId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)

        assertType<Exact<typeof result, Array<{
            issueId: number
            title: string
            projectName: string
        }>>>()

        expect(result).toEqual(expected)
    })

    test('count-issues-grouped-by-status', async () => {
        const expected = [
            { status: 'closed',      total: 1 },
            { status: 'in_progress', total: 1 },
            { status: 'open',        total: 2 },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`status\` as \`status\`, count(id) as total from issue group by \`status\` order by \`status\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)

        assertType<Exact<typeof result, Array<{
            status: string
            total: number
        }>>>()

        expect(result).toEqual(expected)
    })
})
