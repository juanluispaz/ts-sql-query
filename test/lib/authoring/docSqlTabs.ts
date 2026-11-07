// `docs:sql-tabs` — add the per-database SQL tabs and the parameters after the
// ```ts blocks of the docs that run a query and show none. The SQL comes from
// running the block: the doc-code machinery (test/DOC_CODE_EXTRACTOR.md) turns a
// ```ts followed by SQL fences into a test per database against
// DocCodeMockRunner, so this tool puts a placeholder fence after each block,
// regenerates the doc-code cells, runs them with DOC_CODE_SQL_TABS_LOG set (the
// placeholder tests then record what they sent instead of asserting), puts the
// pages back, writes the tabs, and runs the doc-code tests of the pages again to
// check them. Run `docs:sql-tabs --help`.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { REPO_ROOT, abs, isEntryPoint, repoRel } from './testFile.js'

const HELP = `Usage:
  docs:sql-tabs <page.md>… [--partial <page:line>]… [--dry-run] [--no-verify]

After each \`\`\`ts block (at column 0) of the pages that runs a query
(\`.executeSelect…(\`, \`.executeInsert…(\`, \`.executeUpdate…(\`, \`.executeDelete…(\`
and a few call shapes of the docs) and has no tab (\`=== "…"\`) in the 8 lines after
it, add "The executed query is:", one tab per database with the SQL the block
sends there (PostgreSQL the default tab, \`===+\`), formatted one clause per line,
and "The parameters are: \`[ … ]\`" (the databases whose parameters differ are
named). executeSelectPage gets the data query and the count query. Blocks with
\`try {\` or \`.catch(\` are skipped.

How: a placeholder fence goes after each block, \`codegen:doc-code\` regenerates the
doc-code cells, their tests run (mock) with DOC_CODE_SQL_TABS_LOG set so the
placeholder tests record the SQL and the parameters (test/lib/mockRunners/
DocCodeMockRunner.ts) instead of asserting, the pages are put back, and the tabs are
written. Then codegen runs again and, unless --no-verify, the doc-code tests of
the pages, which now assert the new tabs.

A block is left without tabs, and listed at the end, when:
  - a database recorded nothing: the block threw before the assertion. A block
    whose terminal call is executeSelectOne (or another required *One) needs a
    row the mock can project: put \`<!-- doc-code-snippet-result: <row> -->\` on a
    comment line right before its \`\`\`ts (test/DOC_CODE_EXTRACTOR.md);
  - some databases recorded nothing because the method doesn't exist there:
    pass --partial <page>:<line> (the line of the \`\`\`ts fence, 1-based, before
    any change) to write those tabs as "-- Not available on <database>";
  - it sends more than one query and isn't executeSelectPage.

The blocks run without type-checking (bun runs the generated cells as they are): a
method typed on some databases only, but present at runtime on all, gets a tab on
every database. Check the result, and run \`bun run validate:tests\` (the
doc-code cells are in it) as test/DOC_CODE_EXTRACTOR.md says.

  --partial <page:line>  accept a block that only some databases run (repeatable)
  --dry-run              print the tabs, leave the pages as they were
  --no-verify            skip the last run of the doc-code tests
`

// [tab label, fence language, DatabaseType]
const DBS: readonly (readonly [string, string, string])[] = [
    ['MariaDB', 'mariadb', 'mariaDB'],
    ['MySQL', 'mysql', 'mySql'],
    ['Oracle', 'oracle', 'oracle'],
    ['PostgreSQL', 'postgresql', 'postgreSql'],
    ['SQLite', 'sqlite', 'sqlite'],
    ['SQL Server', 'sqlserver', 'sqlServer'],
]

const EXEC = /\.execute(Select|Insert|Update|Delete)\w*\(|await \w+\(connection|await \w+\(\d|await get\w+\(|\bgetCustomers\(/

interface Block { start: number, end: number, id: string }

/** The ```ts blocks (fence line indexes) that run a query and have no tabs after them. */
export function blocksWithoutSql(lines: readonly string[]): { start: number, end: number }[] {
    const out: { start: number, end: number }[] = []
    for (let i = 0; i < lines.length; i++) {
        if (!/^```ts\s*$/.test(lines[i]!)) continue
        const s = i
        i++
        while (i < lines.length && !lines[i]!.startsWith('```')) i++
        const body = lines.slice(s + 1, i).join('\n')
        let found = false
        for (let j = i + 1; j < lines.length && j < i + 8; j++) {
            if (/^===\+? "/.test(lines[j]!)) { found = true; break }
            if (lines[j]!.startsWith('```')) break
        }
        if (!found && EXEC.test(body) && !body.includes('try {') && !body.includes('.catch(')) out.push({ start: s, end: i })
    }
    return out
}

// ---------------------------------------------------------------------------
// SQL formatting: one top-level clause per line, the items of select / order by /
// group by / set / returning one per line, the conditions of where / having one
// per line aligned on their and / or, a with's queries indented.

const TOP_KEYWORDS = 'union all|union|intersect all|intersect|except all|except|minus all|minus|start with|connect by nocycle|connect by|with recursive|with|select distinct|select|from|(?:inner |left outer |left |right outer |right |full outer |cross )?join|where|group by|having|order by|limit|offset|fetch next|returning|set|update|delete from|insert into|values'

function splitTop(sql: string): string[] {
    const rx = new RegExp('\\b(' + TOP_KEYWORDS + ')\\b', 'iy')
    const cuts: number[] = []
    let depth = 0
    let quote: string | undefined
    for (let i = 0; i < sql.length;) {
        const c = sql[i]!
        if (quote) { if (c === quote) quote = undefined; i++; continue }
        if (c === "'" || c === '"' || c === '`') { quote = c; i++; continue }
        if (c === '(') depth++
        else if (c === ')') depth--
        else if (depth === 0 && (i === 0 || !/[\w.$@:]/.test(sql[i - 1]!))) {
            rx.lastIndex = i
            const m = rx.exec(sql)
            if (m) { cuts.push(i); i += m[0].length; continue }
        }
        i++
    }
    if (cuts[0] !== 0) cuts.unshift(0)
    cuts.push(sql.length)
    const out: string[] = []
    for (let k = 0; k < cuts.length - 1; k++) {
        const part = sql.slice(cuts[k], cuts[k + 1]).trim()
        if (part) out.push(part)
    }
    return out
}

/** Split at the separators outside parentheses and quotes: [separator before (trimmed), part]. */
function splitDepth0(s: string, seps: readonly string[]): [string | undefined, string][] {
    const out: [string | undefined, string][] = []
    let depth = 0
    let quote: string | undefined
    let cur = ''
    let conn: string | undefined
    for (let i = 0; i < s.length;) {
        const c = s[i]!
        if (quote) { cur += c; if (c === quote) quote = undefined; i++; continue }
        if (c === "'" || c === '"' || c === '`') { quote = c; cur += c; i++; continue }
        if (c === '(') depth++
        else if (c === ')') depth--
        if (depth === 0) {
            const hit = seps.find(sep => s.startsWith(sep, i))
            if (hit) { out.push([conn, cur.trim()]); conn = hit.trim(); cur = ''; i += hit.length; continue }
        }
        cur += c
        i++
    }
    out.push([conn, cur.trim()])
    return out
}

function formatLines(sql: string): string[] {
    const L: string[] = []
    for (const sec of splitTop(sql)) {
        if (/^(union all|union|intersect all|intersect|except all|except|minus all|minus)$/i.test(sec)) { L.push('', sec, ''); continue }
        let m = /^(with recursive|with)\s+(.*)$/is.exec(sec)
        if (m) {
            L.push(m[1]!)
            const items = splitDepth0(m[2]!, [', ']).map(([, x]) => x)
            items.forEach((x, k) => {
                const comma = k < items.length - 1 ? ',' : ''
                const mm = /^([^(]*?(?:\([^)]*\))? as )\((.*)\)(.*)$/s.exec(x)
                if (!mm) { L.push('    ' + x + comma); return }
                L.push('    ' + mm[1]! + '(')
                L.push(...formatLines(mm[2]!).map(y => y.trim() ? '        ' + y : y))
                L.push('    )' + mm[3]! + comma)
            })
            continue
        }
        m = /^(select distinct|select|order by|group by|set|returning)\s+(.*)$/is.exec(sec)
        if (m) {
            const items = splitDepth0(m[2]!, [', ', ',']).map(([, x]) => x)
            if (items.length === 1) L.push(sec)
            else {
                L.push(m[1]!)
                items.forEach((x, k) => L.push('    ' + x + (k < items.length - 1 ? ',' : '')))
            }
            continue
        }
        m = /^(where|having)\s+(.*)$/is.exec(sec)
        if (m) {
            const parts = splitDepth0(m[2]!, [' or ', ' and '])
            if (parts.length === 1) L.push(sec)
            else {
                const w = Math.max(...parts.map(([c]) => c?.length ?? 0))
                L.push(m[1]!)
                for (const [c, x] of parts) L.push('    ' + (c === undefined ? ' '.repeat(w + 1) : c.padStart(w) + ' ') + x)
            }
            continue
        }
        L.push(sec)
    }
    // The docs end every line but the last with a space (the SQL reads the same joined back).
    return L.map((l, k) => k < L.length - 1 && l && !l.endsWith(' ') ? l + ' ' : l)
}

/** Format one statement of the builder (one line) for a docs tab. */
export function formatSql(sql: string): string[] {
    return formatLines(sql.replace(/ for update/g, ' for\0update')).map(l => l.replace(/\0/g, ' '))
}

// ---------------------------------------------------------------------------

interface Recorded { id: string, database: string, sqls: string[], params: string[] }

function run(cmd: string, args: readonly string[], env: typeof process.env): { status: number, output: string } {
    const r = spawnSync(cmd, args, { cwd: REPO_ROOT, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    return { status: r.status ?? 1, output: (r.stdout ?? '') + (r.stderr ?? '') }
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function docTests(pages: readonly string[], env: typeof process.env): { status: number, output: string } {
    const pattern = '(' + pages.map(escapeRegex).join('|') + '):[0-9]'
    return run('bash', ['scripts/tests.sh', '*/newest/documentation', '--no-color', '--test-name-pattern', pattern], env)
}

function tabsFor(body: string, res: ReadonlyMap<string, Recorded>): string[] | string {
    const n = Math.max(...[...res.values()].map(d => d.sqls.length))
    if (n > 1 && !body.includes('executeSelectPage')) return `${n} queries`
    const ins: string[] = []
    for (let q = 0; q < n; q++) {
        ins.push('', n === 1 ? 'The executed query is:' : q === 0 ? 'The executed query to get the data is:' : 'The executed query to get the count is:', '')
        for (const [label, fence, db] of DBS) {
            const head = (label === 'PostgreSQL' ? '===+ ' : '=== ') + `"${label}"`
            const d = res.get(db)
            if (!d) { ins.push(head, `    \`\`\`${fence}`, `    -- Not available on ${label}`, '    ```'); continue }
            ins.push(head, `    \`\`\`${fence}`, ...formatSql(d.sqls[q] ?? '').map(x => '    ' + x), '    ```')
        }
        const ps = new Map<string, string>()
        for (const [, , db] of DBS) {
            const d = res.get(db)
            if (d) ps.set(db, d.params[q] ?? '[]')
        }
        const base = ps.get('postgreSql') ?? [...ps.values()][0]!
        const others = new Map<string, string[]>()
        for (const [label, , db] of DBS) {
            const p = ps.get(db)
            if (p !== undefined && p !== base) others.set(p, [...(others.get(p) ?? []), label])
        }
        let txt = n === 1 ? `The parameters are: \`${base}\`` : `And its parameters are: \`${base}\``
        if (others.size) txt += ' (' + [...others].map(([p, labels]) => `on ${labels.join(' and ')}: \`${p}\``).join('; ') + ')'
        ins.push('', txt)
    }
    return ins
}

function main(argv: readonly string[]): number {
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) { process.stdout.write(HELP); return argv.length ? 0 : 2 }
    const pages: string[] = []
    const partial = new Set<string>()
    let dryRun = false, verify = true
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!
        if (a === '--dry-run') dryRun = true
        else if (a === '--no-verify') verify = false
        else if (a === '--partial') {
            const v = argv[++i]
            if (!v) throw new Error('--partial needs <page>:<line>')
            const at = v.lastIndexOf(':')
            partial.add(repoRel(v.slice(0, at)) + v.slice(at))
        } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`)
        else {
            const rel = repoRel(a)
            if (!existsSync(abs(rel)) || !rel.startsWith('docs/') || !rel.endsWith('.md')) throw new Error(`${a} is not a page of docs/`)
            pages.push(rel)
        }
    }

    const texts = new Map(pages.map(p => [p, readFileSync(abs(p), 'utf8')]))
    const plan = new Map<string, Block[]>()
    for (const p of pages) {
        const blocks = blocksWithoutSql(texts.get(p)!.split('\n')).map((b, k) => ({ ...b, id: `${p}#${k}` }))
        plan.set(p, blocks)
        console.log(`${p}: ${blocks.length} blocks without SQL`)
    }
    const total = [...plan.values()].reduce((n, b) => n + b.length, 0)
    if (!total) return 0

    // 1. placeholders in, run, pages back
    const dir = mkdtempSync(join(tmpdir(), 'doc-sql-tabs-'))
    const log = join(dir, 'sql.jsonl')
    const env = { ...process.env, DOC_CODE_SQL_TABS_LOG: log }
    try {
        for (const p of pages) {
            const lines = texts.get(p)!.split('\n')
            for (const b of [...plan.get(p)!].reverse()) {
                const ins = ['']
                for (const [label, fence] of DBS) ins.push(`=== "${label}"`, `    \`\`\`${fence}`, `    select 1 /*@@${b.id}@@*/`, '    ```')
                lines.splice(b.end + 1, 0, ...ins)
            }
            writeFileSync(abs(p), lines.join('\n'))
        }
        const gen = run('bash', ['scripts/codegen-doc-code.sh'], process.env)
        if (gen.status !== 0) throw new Error('codegen:doc-code failed:\n' + gen.output)
        docTests(pages, env)
    } finally {
        for (const p of pages) writeFileSync(abs(p), texts.get(p)!)
    }
    const got = new Map<string, Map<string, Recorded>>()
    if (existsSync(log)) {
        for (const line of readFileSync(log, 'utf8').split('\n')) {
            if (!line) continue
            const d = JSON.parse(line) as Recorded
            const m = got.get(d.id) ?? new Map<string, Recorded>()
            m.set(d.database, d)
            got.set(d.id, m)
        }
    }
    rmSync(dir, { recursive: true, force: true })

    // 2. the tabs
    const missing: string[] = []
    let written = 0
    for (const p of pages) {
        const lines = texts.get(p)!.split('\n')
        for (const b of [...plan.get(p)!].reverse()) {
            const where = `${p}:${b.start + 1}`
            const res = got.get(b.id) ?? new Map<string, Recorded>()
            const empty = [...res.values()].filter(d => d.sqls.length === 0).map(d => d.database)
            const absent = DBS.filter(([, , db]) => !res.has(db)).map(([label]) => label)
            if (!res.size || empty.length) { missing.push(`${where}: no SQL recorded${empty.length ? ' on ' + empty.join(', ') : ''} (executeSelectOne? add a doc-code-snippet-result)`); continue }
            if (absent.length && !partial.has(where)) { missing.push(`${where}: nothing recorded on ${absent.join(', ')} (--partial ${where} to write them as not available)`); continue }
            const ins = tabsFor(lines.slice(b.start, b.end).join('\n'), res)
            if (typeof ins === 'string') { missing.push(`${where}: ${ins}, and it isn't executeSelectPage`); continue }
            if (dryRun) console.log(`--- ${where}\n${ins.join('\n')}\n`)
            lines.splice(b.end + 1, 0, ...ins)
            written++
        }
        if (!dryRun) writeFileSync(abs(p), lines.join('\n'))
    }

    // 3. regenerate from the pages as they are now, and check
    const gen = run('bash', ['scripts/codegen-doc-code.sh'], process.env)
    if (gen.status !== 0) console.log('codegen:doc-code failed:\n' + gen.output)
    console.log(`${written} blocks ${dryRun ? 'would get' : 'got'} their SQL tabs`)
    for (const m of missing) console.log('left without tabs ' + m)
    if (verify && !dryRun && written) {
        const r = docTests(pages, process.env)
        const summary = r.output.split('\n').filter(l => /\b(pass|fail)\b/.test(l)).slice(-2).join('\n')
        console.log(r.status === 0 ? `doc-code tests of the pages pass\n${summary}` : `doc-code tests of the pages FAIL:\n${r.output.slice(-3000)}`)
        return r.status === 0 ? 0 : 1
    }
    return 0
}

if (isEntryPoint(import.meta.url, import.meta.main)) {
    try {
        process.exit(main(process.argv.slice(2)))
    } catch (e) {
        console.error('docs:sql-tabs: ' + (e instanceof Error ? e.message : String(e)))
        process.exit(2)
    }
}
