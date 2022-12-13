import * as glob from "glob"
import * as fs from "node:fs/promises"
import { promisify } from "node:util"

const globP = promisify(glob)

const main = async () => {
    const rawManifest = await fs.readFile("package.json", "utf8")
    const manifest = JSON.parse(rawManifest)

    process.chdir("dist")

    const distPaths = await globP('**/*.js')

    manifest.exports = Object.fromEntries(distPaths.map(p => {
        if (p.match(/^esm\//) || p.match(/^examples\//)) {
            return []
        }
        const target = {
            import: `./esm/${p.replace(/\.js$/, '.mjs')}`,
            require: `./${p}`
        }
        return [
            [`./${p}`, target],
            [`./${p.replace(/\.js$/, '')}`, target]
        ]
    }).flat())

    await fs.writeFile("package.json", JSON.stringify(manifest, null, 4))
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})