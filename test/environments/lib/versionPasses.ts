// Prints the passes of `tests:environments --all-versions`, one per line, for tests.sh: each pass gives every engine
// one image of test/lib/dockerImages.ts (the version folders that share it), so no pass starts two containers of the
// same engine. The first pass is the newest image of every engine, and also the databases without docker images
// (SQLite), which run once. Format: `<db>:<folder>[,<folder>…] …` (lib/versions.ts reads it).

import { ENGINE_IMAGES } from '../../lib/dockerImages.js'

const passes: string[][] = []
for (const [database, folders] of Object.entries(ENGINE_IMAGES)) {
    // The folders of each image, in the order of the map (newest first)
    const byImage = new Map<string, string[]>()
    for (const [folder, image] of Object.entries(folders)) {
        const group = byImage.get(image)
        if (group) group.push(folder)
        else byImage.set(image, [folder])
    }
    let index = 0
    for (const group of byImage.values()) {
        (passes[index] ??= []).push(database + ':' + group.join(','))
        index++
    }
}
passes[0]?.push('sqlite:newest')
for (const pass of passes) {
    console.log(pass.join(' '))
}
