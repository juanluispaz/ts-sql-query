// Compile-time negative tests for the public helpers that do not belong to a query:
// the type adapters, the deep utilities, the column extractors, sync and the public
// entries. These never execute any SQL: `validate:tests` (tsc) rejects each
// `@ts-expect-error` line.

import { test, expect } from '../../../lib/testRunner.js'
import * as root from '../../../../src/exports/v2/index.js'
import * as compat from '../../../../src/exports/v1/dynamicCondition.js'
import { deepOmit, deepPick, type DeepPick, type DeepOmit } from '../../../../src/extras/deepUtilities.js'
import { sync } from '../../../../src/extras/sync.js'
import { extractColumnNamesFrom, extractColumnsFrom } from '../../../../src/extras/utils.js'
import { CustomBooleanTypeAdapter, type DefaultTypeAdapter, type TypeAdapter, type TypeCategory } from '../../../../src/TypeAdapter.js'
import { getQueryConnectionConfiguration, type ConnectionConfiguration, type QueryResultColumn } from '../../../../src/queryRunners/QueryRunner.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { Values } from '../../../../src/Values.js'
import type { DBConnection } from '../domain/connection.js'
import { tCountry, tProject, vProjectOverview } from '../domain/connection.js'

declare const connection: DBConnection

class VRow extends Values<DBConnection, 'vRow'> {
    name = this.column('string')
}

function _typeNegatives() {
    // Rule: the configuration of the connection a query runner reads has the settings of the connection, and only them.
    const configuration: ConnectionConfiguration | undefined = getQueryConnectionConfiguration('', [])
    void configuration?.compatibilityVersion
    void configuration?.getDateTimeFormat?.('dateTime')
    // @ts-expect-error not a setting of the connection
    void configuration?.database
    if (configuration) {
        // @ts-expect-error the configuration of the connection is read-only
        configuration.compatibilityVersion = 1
    }
    // The readers of the query runner are exported by the root entry; what is specific to a database is not
    void root.getQueryConnectionConfiguration
    // @ts-expect-error the connection of a database is exported by the entry of that database
    void root.PostgreSqlConnection

    // Rule: what a query runner reads of the result columns is read-only.
    const resultColumn: QueryResultColumn = { name: 'id', path: 'id', type: 'int', typeCategory: 'int' }
    // @ts-expect-error a result column is read-only
    resultColumn.type = 'bigint'
    // @ts-expect-error the category of a result column is one of the list
    void ({ name: 'id', path: 'id', type: 'int', typeCategory: 'number' } satisfies QueryResultColumn)
    // Rule: the mock imitates a query runner of the library by the name of its class.
    new MockQueryRunner(() => undefined, { queryRunner: 'PostgresQueryRunner' })
    new MockQueryRunner(() => undefined, { queryRunner: 'MySql2QueryRunner', database: 'mariaDB' })
    // @ts-expect-error not a query runner of the library
    new MockQueryRunner(() => undefined, { queryRunner: 'postgres' })
    // @ts-expect-error a wrapper adds no parameter of its own
    new MockQueryRunner(() => undefined, { queryRunner: 'InterceptorQueryRunner' })
    // Rule: both values of a custom boolean have the same data type.
    new CustomBooleanTypeAdapter(1, 0)
    new CustomBooleanTypeAdapter('yes', 'no')
    // @ts-expect-error a number and a string cannot be mixed
    new CustomBooleanTypeAdapter(1, 'no')

    // Rule: the transforms receive the category of the type after its name, and pass it on to next.
    void ({
        transformValueFromDB(value, type, typeCategory, next) { return next.transformValueFromDB(value, type, typeCategory) },
        transformValueToDB(value, type, typeCategory, next) { return next.transformValueToDB(value, type, typeCategory) },
    } satisfies TypeAdapter)
    void ({
        // @ts-expect-error the third parameter is the category of the type, not next
        transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter) { return next.transformValueFromDB(value, type, '') },
        transformValueToDB(value, type, typeCategory, next) { return next.transformValueToDB(value, type, typeCategory) },
    } satisfies TypeAdapter)
    void ({
        transformValueFromDB(value, type, _typeCategory, next) {
            // @ts-expect-error next needs the category of the type
            return next.transformValueFromDB(value, type)
        },
        transformValueToDB(value, type, typeCategory, next) { return next.transformValueToDB(value, type, typeCategory) },
    } satisfies TypeAdapter)
    // @ts-expect-error a category is one of the list, not the name of a type
    void ('Money' satisfies TypeCategory)

    // Rule: the paths of deepPick and deepOmit are the paths of the object.
    const model = { id: 1, company: { name: 'a' } }
    deepPick(model, ['company.name'])
    deepOmit(model, ['company.name'])
    // @ts-expect-error `company.id` is not a path of the object
    deepPick(model, ['company.id'])
    // @ts-expect-error `company.id` is not a path of the object
    deepOmit(model, ['company.id'])

    // Rule: deepPick, deepOmit and the column extractors take an object, never null.
    // @ts-expect-error null is not an object
    deepPick(null, [])
    // @ts-expect-error null is not an object
    deepOmit(null, [])
    // @ts-expect-error null is not an object
    extractColumnsFrom(null)
    // @ts-expect-error null is not an object
    extractColumnNamesFrom(null)

    // Rule: only a column of the object can be excluded.
    extractColumnsFrom(tCountry, ['name'])
    // @ts-expect-error `id` is not a column of the table
    extractColumnsFrom(tCountry, ['id'])

    // Rule: the paths of the deep types are not validated, an unknown path selects nothing.
    const noKeys: keyof DeepPick<typeof model, 'unknown'> extends never ? true : false = true
    const allKeys: keyof DeepOmit<typeof model, 'unknown'> extends 'id' | 'company' ? true : false = true
    void noKeys
    void allKeys

    // Rule: sync takes a promise.
    // @ts-expect-error 1 is not a promise
    sync(1)

    // Rule: IDEncrypter stays out of the root entry, it is only at its subpath.
    // @ts-expect-error not exported by the root entry
    void root.IDEncrypter
    // Rule: the compatibility entry only keeps the surface it had; the model helpers are at the new subpaths.
    // @ts-expect-error not exported by the compatibility entry
    void compat.deepPick

    // Rule: a column of a view or of a Values view cannot be read in the DO UPDATE of an upsert.
    const row = Values.create(VRow, 'vRow', [{ name: 'a' }])
    const upsert = connection.insertInto(tProject)
        .values({ organizationId: 1, slug: 's', name: 'n' })
        .onConflictOn(tProject.organizationId, tProject.slug)
    upsert.doUpdateSet({ name: 'n' })
    // @ts-expect-error the view is not a source of the upsert
    upsert.doUpdateSet({ name: vProjectOverview.name })
    // @ts-expect-error the Values view is not a source of the upsert
    upsert.doUpdateSet({ name: row.name })
}

test('public-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
