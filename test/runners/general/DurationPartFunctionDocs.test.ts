// The function tsq_duration_part that the page Dates and times gives for each database is the one the suite creates in
// the schema of that database (test/db/<db>/domain/schema.sql), which the tests of the arithmetic of durations run
// against every engine: the text of the page is the tested one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from '../../lib/testRunner.js'

const root = join(import.meta.dirname, '../../..')
const page = readFileSync(join(root, 'docs/configuration/dates-and-times.md'), 'utf8')

/** The code of the tab of the section of tsq_duration_part, without the indentation of the tab */
function documented(tab: string): string {
    const section = page.slice(page.indexOf('### A duration kept as text: the function `tsq_duration_part`'))
    const start = section.indexOf('"' + tab + '"\n    ```sql\n')
    expect(start).toBeGreaterThan(0)
    const code = section.slice(section.indexOf('```sql\n', start) + '```sql\n'.length)
    return code.slice(0, code.indexOf('\n    ```')).split('\n').map(line => line.slice(4)).join('\n')
}

/** The function in the schema of the database, after its comment, up to the comment of the next function of the library */
function tested(db: string): string {
    const schema = readFileSync(join(root, 'test/db', db, 'domain/schema.sql'), 'utf8')
    const lines = schema.slice(schema.indexOf('-- tsq_duration_part:')).split('\n')
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
})
