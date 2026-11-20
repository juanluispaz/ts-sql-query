// The functions of the library for durations and zoned dates and times that the page of the functions of each database
// gives (tsq_duration_part, tsq_duration_text, tsq_duration_round, tsq_duration_total, tsq_duration_add,
// tsq_zoned_until, tsq_zoned_of_wall) are the ones the suite creates in the
// schema of that database (test/db/<db>/domain/schema.sql), which the tests of the arithmetic, the differences of dates,
// the totals and the sums of durations run against every engine: the text of the page is the tested one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from '../../lib/testRunner.js'

const root = join(import.meta.dirname, '../../..')

/** The code of the section of a function in the page of the functions of a database: its blocks of SQL, one after another */
function documented(db: string, name: string): string {
    const page = readFileSync(join(root, 'docs/configuration/supported-databases', db, 'functions.md'), 'utf8')
    const heading = '\n## `' + name + '`\n'
    expect(page.indexOf(heading)).toBeGreaterThan(0)
    let section = page.slice(page.indexOf(heading) + heading.length)
    const next = section.indexOf('\n## ')
    section = next < 0 ? section : section.slice(0, next)
    const blocks: string[] = []
    let start = section.indexOf('\n```sql\n')
    while (start >= 0) {
        const code = section.slice(start + '\n```sql\n'.length)
        blocks.push(code.slice(0, code.indexOf('\n```\n')))
        start = section.indexOf('\n```sql\n', start + 1)
    }
    expect(blocks.length).toBeGreaterThan(0)
    return blocks.join('\n\n')
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
        expect(documented('mariadb', 'tsq_duration_part')).toBe(tested('mariadb'))
        expect(documented('mysql', 'tsq_duration_part')).toBe(tested('mysql'))
        expect(documented('oracle', 'tsq_duration_part')).toBe(tested('oracle'))
        expect(documented('postgresql', 'tsq_duration_part')).toBe(tested('postgres'))
        expect(documented('sqlserver', 'tsq_duration_part')).toBe(tested('sqlserver'))
    })

    test('the-documented-functions-of-until-and-since-are-the-tested-ones', () => {
        const both = (db: string) => tested(db, 'tsq_duration_text') + '\n\n' + tested(db, 'tsq_duration_round')
        const documentedBoth = (db: string) => documented(db, 'tsq_duration_text') + '\n\n' + documented(db, 'tsq_duration_round')
        expect(documentedBoth('mariadb')).toBe(both('mariadb'))
        expect(documentedBoth('mysql')).toBe(both('mysql'))
        expect(documentedBoth('oracle')).toBe(both('oracle'))
        expect(documented('postgresql', 'tsq_duration_round')).toBe(tested('postgres', 'tsq_duration_round'))
        // tsq_duration_round and tsq_duration_add use tsq_duration_text: they are dropped first to create them again
        expect(documentedBoth('sqlserver')).toBe('DROP FUNCTION IF EXISTS dbo.tsq_duration_round;\nDROP FUNCTION IF EXISTS dbo.tsq_duration_add;\nGO\n\n' + both('sqlserver'))
    })

    test('the-documented-function-of-total-is-the-tested-one', () => {
        expect(documented('mariadb', 'tsq_duration_total')).toBe(tested('mariadb', 'tsq_duration_total'))
        expect(documented('mysql', 'tsq_duration_total')).toBe(tested('mysql', 'tsq_duration_total'))
        expect(documented('oracle', 'tsq_duration_total')).toBe(tested('oracle', 'tsq_duration_total'))
        expect(documented('postgresql', 'tsq_duration_total')).toBe(tested('postgres', 'tsq_duration_total'))
        expect(documented('sqlserver', 'tsq_duration_total')).toBe(tested('sqlserver', 'tsq_duration_total'))
    })

    test('the-documented-functions-of-zoned-dates-and-times-are-the-tested-ones', () => {
        expect(documented('oracle', 'tsq_zoned_until')).toBe(tested('oracle', 'tsq_zoned_until'))
        // tsq_zoned_until uses tsq_zoned_of_wall, created first
        expect(documented('postgresql', 'tsq_zoned_of_wall') + '\n\n' + documented('postgresql', 'tsq_zoned_until')).toBe(tested('postgres', 'tsq_zoned_of_wall'))
    })

    test('the-documented-function-of-durations-added-together-is-the-tested-one', () => {
        expect(documented('mariadb', 'tsq_duration_add')).toBe(tested('mariadb', 'tsq_duration_add'))
        expect(documented('mysql', 'tsq_duration_add')).toBe(tested('mysql', 'tsq_duration_add'))
        expect(documented('oracle', 'tsq_duration_add')).toBe(tested('oracle', 'tsq_duration_add'))
        expect(documented('postgresql', 'tsq_duration_add')).toBe(tested('postgres', 'tsq_duration_add'))
        expect(documented('sqlserver', 'tsq_duration_add')).toBe(tested('sqlserver', 'tsq_duration_add'))
    })
})
