// The conversion of the types of a database to SQL data types and back (sqlDataTypeFrom / nativeSqlDataTypeOf of its
// connection), against the catalogue of the real engine: a table with a column of each type is created, the type each
// column has in the catalogue is read, and it must give the family expected, keep its name as the native one, and give
// it back; the family alone gives the canonical type, which the engine accepts and reads as the same family.

import { expect } from '../../lib/testRunner.js'
import type { DatabaseType } from '../../../src/queryRunners/QueryRunner.js'
import type { SqlDataType } from '../../../src/TypeAdapter.js'

export interface CatalogCase {
    /** The type as it is declared in the table */
    readonly ddl: string
    /** The family read from the catalogue, without its native name */
    readonly family: SqlDataType
    /** The type the family alone gives, or undefined when the database can't hold it without its native name */
    readonly canonical: string | undefined
}

export interface CatalogEngine {
    readonly database: DatabaseType
    readonly from: (nativeName: string) => SqlDataType
    readonly of: (sqlDataType: SqlDataType) => string | undefined
    /** Creates the table with these column declarations (`c0 <type>`, …) */
    createTable(table: string, columns: readonly string[]): Promise<void>
    /** The type of each column of the table, in order, as the catalogue gives it */
    catalogTypes(table: string): Promise<string[]>
    dropTable(table: string): Promise<void>
}

export function withoutNative(sqlDataType: SqlDataType): SqlDataType {
    const { native: _native, ...rest } = sqlDataType
    if (rest.family === 'collection' && rest.of) {
        return { ...rest, of: withoutNative(rest.of) }
    }
    return rest as SqlDataType
}

export async function checkCatalog(engine: CatalogEngine, cases: readonly CatalogCase[], table: string): Promise<void> {
    await engine.createTable(table, cases.map((c, i) => 'c' + i + ' ' + c.ddl))
    let texts: string[]
    try {
        texts = await engine.catalogTypes(table)
    } finally {
        await engine.dropTable(table)
    }
    const read = cases.map((c, i) => {
        const text = texts[i]!
        const sqlDataType = engine.from(text)
        return { ddl: c.ddl, text, family: withoutNative(sqlDataType), native: sqlDataType.native, back: engine.of(sqlDataType), canonical: engine.of(c.family) }
    })
    expect(read).toEqual(cases.map((c, i) => ({ ddl: c.ddl, text: texts[i], family: c.family, native: { [engine.database]: texts[i] }, back: texts[i], canonical: c.canonical })))

    const canonical = cases.filter(c => c.canonical !== undefined)
    await engine.createTable(table + '_c', canonical.map((c, i) => 'c' + i + ' ' + c.canonical))
    let canonicalTexts: string[]
    try {
        canonicalTexts = await engine.catalogTypes(table + '_c')
    } finally {
        await engine.dropTable(table + '_c')
    }
    expect(canonical.map((c, i) => ({ canonical: c.canonical, family: withoutNative(engine.from(canonicalTexts[i]!)) })))
        .toEqual(canonical.map(c => ({ canonical: c.canonical, family: withoutNative(engine.from(c.canonical!)) })))
}
