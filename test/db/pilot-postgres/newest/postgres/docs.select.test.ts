// Documentation snippets for the SELECT page.
//
// Tests prefixed `docs:` are scraped by the docs build. Inside each test,
// the code BETWEEN `// doc-start` and `// doc-end` is the snippet that
// appears on the page; SQL + params live in `toMatchInlineSnapshot(...)`
// so the test gates the snippet against drift and the snapshot can be
// refreshed in bulk via `bun test --update-snapshots`.
//
// The file lives inside every (version × connector) folder so every
// variant verifies the snippet against a real DB. The variant flagged
// `canonicalForDocs: true` in `setup.ts` is the one the scraper publishes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email, full_name as "fullName" from app_user where email = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@acme.test",
          ]
        `)
        expect(user).toEqual(expected)
    })
})
