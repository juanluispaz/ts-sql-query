// Documentation snippets for the SELECT page (docs/queries/select.md).
//
// Tests prefixed `docs:` are scraped by the docs build. Inside each test,
// the code BETWEEN `// doc-start` and `// doc-end` is the snippet that
// appears on the page; SQL + params live in `toMatchInlineSnapshot(...)`
// so the test gates the snippet against drift and the snapshot can be
// refreshed in bulk via `bun test --update-snapshots`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:select/find-user-by-email', async () => {
        const expected = {
            id: 1,
            email: 'ada@acme.test',
            fullName: 'Ada Lovelace',
        }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const user = await connection.selectFrom(tAppUser)
            .where(tAppUser.email.equals('ada@acme.test'))
            .select({
                id:       tAppUser.id,
                email:    tAppUser.email,
                fullName: tAppUser.fullName,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email, full_name as fullName from app_user where email = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@acme.test",
          ]
        `)
        assertType<Exact<typeof user, {
            id:       number
            email:    string
            fullName: string
        }>>()
        expect(user).toEqual(expected)
    })

    test('docs:select/select-with-joins-and-orderby', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy', projectName: 'Marketing site' },
            { id: 3, title: 'Migrate to ESM',   projectName: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const project = tProject.as('proj')
        const openIssues = await connection.selectFrom(tIssue)
            .innerJoin(project).on(tIssue.projectId.equals(project.id))
            .where(tIssue.status.equals('open'))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                projectName: project.name,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, proj.\`name\` as projectName from issue inner join project as proj on issue.project_id = proj.id where issue.\`status\` = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof openIssues, Array<{
            id:          number
            title:       string
            projectName: string
        }>>>()
        expect(openIssues).toEqual(expected)
    })

    test('docs:select/select-with-aliased-table', async () => {
        const expected = [{ id: 1, fullName: 'Ada Lovelace' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const u = tAppUser.as('u')
        const onlyAda = await connection.selectFrom(u)
            .where(u.email.startsWith('ada@'))
            .select({
                id:       u.id,
                fullName: u.fullName,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`u\`.id as id, \`u\`.full_name as fullName from app_user as \`u\` where \`u\`.email like concat(?, '%')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@",
          ]
        `)
        assertType<Exact<typeof onlyAda, Array<{
            id:       number
            fullName: string
        }>>>()
        expect(onlyAda).toEqual(expected)
    })
})
