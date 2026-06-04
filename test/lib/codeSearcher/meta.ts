// Staleness / compatibility gate for the code searcher.
//
// Before trusting the index, a consumer must check the `meta` table the indexer
// writes (schema_version, built_at, git_rev, git_dirty, resolve). This module
// reads it, compares the recorded provenance to the current working tree, and
// reports whether the index is incompatible (refuse) or merely stale (warn).

import { execSync } from 'node:child_process'
import type { QueryDb } from '../codeIndexer/db.js'
import { SCHEMA_VERSION } from '../codeIndexer/schema.js'

export interface MetaInfo {
    /** Raw key/value pairs from the meta table. */
    map: Record<string, string>
    /** Schema-version mismatch (or other) that makes the index unusable — caller must abort. */
    fatal: string | null
    /** Soft warnings (staleness, dirty tree, name-based build) — surfaced, not blocking. */
    warnings: string[]
    /** Whether the index carries type-resolved FKs (resolve='resolved'). */
    resolved: boolean
}

function short(rev: string): string {
    return rev.slice(0, 8)
}

function gitHead(): { rev: string | null, dirty: boolean } {
    try {
        const rev = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
        const dirty = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0
        return { rev, dirty }
    } catch {
        return { rev: null, dirty: false }
    }
}

export function readMeta(db: QueryDb): MetaInfo {
    const rows = db.all<{ key: string, value: string | null }>('SELECT key, value FROM meta')
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value ?? ''

    const warnings: string[] = []
    let fatal: string | null = null

    // Incompatibility: a schema the tool can't read → refuse rather than mislead.
    const sv = Number(map['schema_version'])
    if (!Number.isFinite(sv)) {
        warnings.push('index has no recorded schema_version — provenance unknown')
    } else if (sv !== SCHEMA_VERSION) {
        fatal = `index schema_version ${sv} ≠ tool schema_version ${SCHEMA_VERSION} — rebuild with \`tests:index\``
    }

    // Staleness: the index is a snapshot of the tree at build time.
    const head = gitHead()
    const builtRev = map['git_rev']
    if (head.rev && builtRev && head.rev !== builtRev) {
        warnings.push(`index built at ${short(builtRev)}, working tree is at ${short(head.rev)} — likely STALE; rebuild with \`tests:index\``)
    }
    if (head.rev && head.dirty) {
        warnings.push('working tree is dirty — the index may not reflect uncommitted edits')
    } else if (map['git_dirty'] === '1') {
        warnings.push('index was built from a dirty tree — its git_rev is only approximate provenance')
    }

    const resolved = map['resolve'] === 'resolved'
    if (!resolved) {
        warnings.push('index built with --no-resolve — resolved_* links are empty; reachability/precise answers fall back to name matching')
    }

    return { map, fatal, warnings, resolved }
}
