// Portable recursive file walk (bun's node:fs does not export globSync).
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Recursively collect files under `root` whose path ends with `suffix`. */
export function walkFiles(root: string, suffix: string): string[] {
    const out: string[] = []
    const rec = (dir: string): void => {
        let entries: string[]
        try { entries = readdirSync(dir) } catch { return }
        for (const name of entries) {
            const p = join(dir, name)
            let st: ReturnType<typeof statSync>
            try { st = statSync(p) } catch { continue }
            if (st.isDirectory()) rec(p)
            else if (p.endsWith(suffix)) out.push(p)
        }
    }
    rec(root)
    return out
}
