// The functions of the library for durations and zoned dates and times that the page Dates and times gives for each
// database (tsq_duration_part, tsq_duration_text, tsq_duration_round, tsq_duration_total, tsq_duration_add,
// tsq_zoned_until, tsq_zoned_of_wall) are the ones the suite creates in the
// schema of that database (test/db/<db>/domain/schema.sql), which the tests of the arithmetic, the differences of dates,
// the totals and the sums of durations run against every engine: the text of the page is the tested one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from '../../lib/testRunner.js'

const root = join(import.meta.dirname, '../../..')
const page = readFileSync(join(root, 'docs/configuration/dates-and-times.md'), 'utf8')

/** The code of the tab of a section, without the indentation of the tab */
function documented(tab: string, heading = '### A duration kept as text: the function `tsq_duration_part`'): string {
    const section = page.slice(page.indexOf(heading))
    const start = section.indexOf('"' + tab + '"\n    ```sql\n')
    expect(start).toBeGreaterThan(0)
    const code = section.slice(section.indexOf('```sql\n', start) + '```sql\n'.length)
    return code.slice(0, code.indexOf('\n    ```')).split('\n').map(line => line.slice(4)).join('\n')
}

/** The function in the schema of the database, after its comment, up to the comment of the next function of the library */
function tested(db: string, name = 'tsq_duration_part'): string {
    const schema = readFileSync(join(root, 'test/db', db, 'domain/schema.sql'), 'utf8')
    const lines = schema.slice(schema.indexOf('-- ' + name + ':')).split('\n')
    while (lines[0]?.startsWith('--')) {
        lines.shift()
    }
    const end = lines.findIndex(line => line.startsWith('-- tsq_'))
    return (end < 0 ? lines : lines.slice(0, end)).join('\n').trim()
}

describe('DurationPartFunctionDocs', () => {
    test('the-documented-function-is-the-tested-one', () => {
        expect(documented('MariaDB')).toBe(tested('mariadb'))
        expect(documented('MySQL')).toBe(tested('mysql'))
        expect(documented('Oracle')).toBe(tested('oracle'))
        expect(documented('PostgreSQL')).toBe(tested('postgres'))
        expect(documented('SQL Server')).toBe(tested('sqlserver'))
    })

    test('the-documented-functions-of-until-and-since-are-the-tested-ones', () => {
        const heading = '### The functions `tsq_duration_text` and `tsq_duration_round`'
        const both = (db: string) => tested(db, 'tsq_duration_text') + '\n\n' + tested(db, 'tsq_duration_round')
        expect(documented('MariaDB', heading)).toBe(both('mariadb'))
        expect(documented('MySQL', heading)).toBe(both('mysql'))
        expect(documented('Oracle', heading)).toBe(both('oracle'))
        expect(documented('PostgreSQL', heading)).toBe(tested('postgres', 'tsq_duration_round'))
        // tsq_duration_round and tsq_duration_add use tsq_duration_text: they are dropped first to create them again
        expect(documented('SQL Server', heading)).toBe('DROP FUNCTION IF EXISTS dbo.tsq_duration_round;\nDROP FUNCTION IF EXISTS dbo.tsq_duration_add;\nGO\n\n' + both('sqlserver'))
    })

    test('the-documented-function-of-total-is-the-tested-one', () => {
        const heading = '### The function `tsq_duration_total`'
        expect(documented('MariaDB', heading)).toBe(tested('mariadb', 'tsq_duration_total'))
        expect(documented('MySQL', heading)).toBe(tested('mysql', 'tsq_duration_total'))
        expect(documented('Oracle', heading)).toBe(tested('oracle', 'tsq_duration_total'))
        expect(documented('PostgreSQL', heading)).toBe(tested('postgres', 'tsq_duration_total'))
        expect(documented('SQL Server', heading)).toBe(tested('sqlserver', 'tsq_duration_total'))
    })

    test('the-documented-functions-of-zoned-dates-and-times-are-the-tested-ones', () => {
        const heading = '### The functions `tsq_zoned_until` and `tsq_zoned_of_wall`'
        expect(documented('Oracle', heading)).toBe(tested('oracle', 'tsq_zoned_until'))
        // tsq_zoned_until uses tsq_zoned_of_wall, created first
        expect(documented('PostgreSQL', heading)).toBe(tested('postgres', 'tsq_zoned_of_wall'))
    })

    test('the-documented-function-of-durations-added-together-is-the-tested-one', () => {
        const heading = '### The function `tsq_duration_add`'
        expect(documented('MariaDB', heading)).toBe(tested('mariadb', 'tsq_duration_add'))
        expect(documented('MySQL', heading)).toBe(tested('mysql', 'tsq_duration_add'))
        expect(documented('Oracle', heading)).toBe(tested('oracle', 'tsq_duration_add'))
        expect(documented('PostgreSQL', heading)).toBe(tested('postgres', 'tsq_duration_add'))
        expect(documented('SQL Server', heading)).toBe(tested('sqlserver', 'tsq_duration_add'))
    })
})
