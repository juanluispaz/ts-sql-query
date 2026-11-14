// The version folders of each database an environment test runs against, with the compatibilityVersion of the cells
// of each one, read from the setup of the cell of the connector the matrix connects with, so the SQL a probe sends is
// the one of that version.
//
// `tests:environments` runs on `newest`. With `--all-versions` tests.sh runs one pass per version of the engines
// mapped in test/lib/dockerImages.ts (versionPasses.ts), each with one image per engine, and gives the pass in
// TS_SQL_QUERY_ENVIRONMENT_VERSIONS: `<db>:<folder>[,<folder>…] …`. A database not in the pass runs nothing in it.

const ENVIRONMENT_VERSIONS = 'TS_SQL_QUERY_ENVIRONMENT_VERSIONS'

export interface EnvironmentVersion {
    /** The version folder, like `newest` or `oldest` */
    readonly version: string
    /** The compatibilityVersion of its cells; undefined for `newest`, the default of the connection */
    readonly compatibilityVersion: number | undefined
    /** Appended to the title of a describe: empty for `newest` */
    readonly label: string
}

/** The version folders of the database in this run: `newest`, or the ones of the pass of --all-versions */
export function environmentVersionFolders(database: string): readonly string[] {
    const pass = process.env[ENVIRONMENT_VERSIONS]
    if (pass === undefined) return ['newest']
    for (const entry of pass.split(/\s+/)) {
        const [db, folders] = entry.split(':')
        if (db === database && folders) return folders.split(',')
    }
    return []
}

/** Whether this run includes that version of the database: a test that runs once, on `newest`, asks it */
export function isEnvironmentVersionSelected(database: string, version: string): boolean {
    return environmentVersionFolders(database).includes(version)
}

/** The versions of the database in this run, each with the compatibilityVersion of its cells */
export async function environmentVersions(database: string, connector: string): Promise<readonly EnvironmentVersion[]> {
    const result: EnvironmentVersion[] = []
    for (const version of environmentVersionFolders(database)) {
        if (version === 'newest') {
            result.push({ version, compatibilityVersion: undefined, label: '' })
            continue
        }
        const setup = await import(`../../db/${database}/${version}/${connector}/setup.js`) as { ctx: { compatibilityVersion: number | undefined } }
        result.push({ version, compatibilityVersion: setup.ctx.compatibilityVersion, label: ` (${version})` })
    }
    return result
}
