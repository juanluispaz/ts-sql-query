// Guardrail for `--docker-version closest` (see `tests.sh`).
//
// WHY THIS EXISTS
// ----------------
// Under `closest`, each selected version folder runs against ITS OWN image
// (`test/db/<db>/<version>` → the image in the hard `ENGINE_IMAGES` map). The
// older images are SEPARATE keep-alive containers, so bringing up two DIFFERENT
// images of the same engine at once needs two of its containers — the memory
// spike the preflight exists to avoid. This guard rejects exactly that case.
//
// Two version folders that resolve to the SAME image (e.g. mysql/8_000_000 and
// mysql/8_000_017 → mysql:8.0) are NOT a conflict: the container registry keys
// keep-alive handles by image, so they collapse to one container started once.
// That is the whole point of keying on the resolved image instead of the
// version-folder string — the script never computes "closest", it only reads
// the hard map through `closestImage`.
//
// INPUT
// -----
// argv = every real docker cell coord the selection resolves to
// (`<db>/<version>/<connector>`), one per (engine × version folder), computed by
// `real_docker_rep_cells` in `scripts/_test-common.sh`. The guard runs at
// argument-validation time (before the run, independent of reuse mode), so it
// reads NO env — it always resolves the closest image, because it only ever
// runs when `--docker-version closest` is active.
//
// EXIT CODES (consumed by `assert_closest_docker_ok`)
//   0  ok — prints the resolved `<db> / <version> → <image>` summary
//   1  conflict — one engine needs two different images
//   2  no real docker cell in the selection (nothing to run against)

import { closestImage } from './dockerImages.js'

interface Cell {
    readonly coord: string
    readonly engine: string
    readonly version: string
    readonly image: string
}

function parse(argv: readonly string[]): Cell[] {
    const out: Cell[] = []
    for (const raw of argv) {
        const coord = raw.replace(/\/+$/, '')
        if (coord === '') continue
        const [engine = '', version = ''] = coord.split('/')
        if (engine === '' || version === '') continue
        // Throws on an unmapped folder — a hard error surfaced by main().
        out.push({ coord, engine, version, image: closestImage(engine, version) })
    }
    return out
}

function main(): number {
    let cells: Cell[]
    try {
        cells = parse(process.argv.slice(2))
    } catch (err) {
        // Unmapped version folder: fail loud (no "closest-below" guessing).
        console.error(`Error: ${(err as Error).message}`)
        return 1
    }

    if (cells.length === 0) {
        console.error('Error: --docker-version closest needs at least one real docker cell.')
        console.error('  Add --docker (optionally with a coord) so a docker cell runs real, e.g.:')
        console.error('    npm run tests -- postgres/oldest/pg --docker --docker-version closest')
        return 2
    }

    // Group each engine's DISTINCT images (image → a sample version using it).
    const byEngine = new Map<string, Map<string, string>>()
    for (const c of cells) {
        let images = byEngine.get(c.engine)
        if (!images) { images = new Map(); byEngine.set(c.engine, images) }
        if (!images.has(c.image)) images.set(c.image, c.version)
    }

    for (const [engine, images] of byEngine) {
        if (images.size > 1) {
            const parts = [...images].map(([img, ver]) => `${ver} → ${img}`).join(', ')
            console.error('Error: --docker-version closest cannot run more than one image of the same engine in a single invocation:')
            console.error(`  ${engine} (${parts})`)
            console.error('  Each engine resolves to ONE image under closest; two DIFFERENT images would start two containers of the same engine.')
            console.error('  Run them in separate invocations, one image per engine at a time.')
            console.error('  (Two version folders that resolve to the SAME image are fine — they share one container.)')
            return 1
        }
    }

    // Ok. Print the resolved images, deduped per (engine, image).
    console.error('docker-version=closest — resolving version-appropriate images for:')
    const shown = new Set<string>()
    for (const c of cells) {
        const key = `${c.engine}\t${c.image}`
        if (shown.has(key)) continue
        shown.add(key)
        console.error(`  ${c.engine} / ${c.version} → ${c.image}`)
    }
    return 0
}

process.exit(main())
