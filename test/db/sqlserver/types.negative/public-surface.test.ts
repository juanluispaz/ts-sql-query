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
import { CustomBooleanTypeAdapter, type DefaultTypeAdapter, type TypeAdapter, type CustomType } from '../../../../src/TypeAdapter.js'
import { type ConnectionConfiguration, type QueryResultColumn } from '../../../../src/queryRunners/QueryRunner.js'
import { getQueryContext } from '../../../../src/QueryContext.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { tCountry } from '../domain/connection.js'

function _typeNegatives() {
    // Rule: the configuration of the connection a query runner reads has the settings of the connection, and only them.
    const configuration: ConnectionConfiguration | undefined = getQueryContext('', []).connectionConfiguration
    void configuration?.compatibilityVersion
    void configuration?.getDateTimeFormat?.('dateTime')
    // @ts-expect-error not a setting of the connection
    void configuration?.database
    if (configuration) {
        // @ts-expect-error the configuration of the connection is read-only
        configuration.compatibilityVersion = 1
    }
    // The context of a query is read with a function of the root entry; what is specific to a database is not
    void root.getQueryContext
    // @ts-expect-error the readers of version 1 are not exported by the paths of version 2
    void root.getQueryExecutionName
    // Rule: the context of a query and of its parameters is read-only.
    const queryContext = getQueryContext('', [])
    // @ts-expect-error the context of a query is read-only
    queryContext.executionName = 'name'
    const paramContext = queryContext.getParam(0)
    if (paramContext) {
        // @ts-expect-error the context of a parameter is read-only
        paramContext.requestedType = 'int'
    }
    // @ts-expect-error the connection of a database is exported by the entry of that database
    void root.SqlServerConnection

    // Rule: what a query runner reads of the result columns is read-only.
    const resultColumn: QueryResultColumn = { name: 'id', path: 'id', originalType: 'int', originalCustomType: undefined, requestedType: 'int', requestedCustomType: undefined }
    // @ts-expect-error a result column is read-only
    resultColumn.requestedType = 'bigint'
    // @ts-expect-error the custom type of a result column is one of the list
    void ({ name: 'id', path: 'id', originalType: 'Money', originalCustomType: 'number', requestedType: 'Money', requestedCustomType: undefined } satisfies QueryResultColumn)
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

    // Rule: the argument of a transform is what it transforms; the types of the value are in its context, which next
    // receives.
    void ({
        transformValueFromDB(value, context, next) { return next.transformValueFromDB(value, context) },
        transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
    } satisfies TypeAdapter)
    void ({
        // @ts-expect-error the type isn't a parameter of a transform: it is in the context
        transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter) { return next.transformValueFromDB(value, type) },
        transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
    } satisfies TypeAdapter)
    void ({
        transformValueFromDB(value, _context, next) {
            // @ts-expect-error next needs the context
            return next.transformValueFromDB(value)
        },
        transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
    } satisfies TypeAdapter)
    // Rule: the original type of a value never changes; the requested one changes only with setRequestedType, which
    // takes a type as a column does: a built-in one by its name, a custom one with which custom type it is.
    void ({
        transformValueFromDB(value, context, next) {
            context.setRequestedType('localDate')
            return next.transformValueFromDB(value, context)
        },
        transformValueToDB(value, context, next) {
            context.setRequestedType('customLocalDate', 'ReleaseDay')
            context.resetRequestedType()
            // @ts-expect-error the original type is read-only
            context.originalType = 'string'
            // @ts-expect-error the requested type changes with setRequestedType
            context.requestedType = 'string'
            // @ts-expect-error a custom type needs which custom type it is
            context.setRequestedType('ReleaseDay')
            // @ts-expect-error a custom type needs its name
            context.setRequestedType('customLocalDate')
            return next.transformValueToDB(value, context)
        },
        transformPlaceholder(placeholder, context, next) {
            // @ts-expect-error the type of a parameter is requested in transformValueToDB; the placeholder is already written
            context.setRequestedType('string')
            return next.transformPlaceholder(placeholder, context)
        },
    } satisfies TypeAdapter)
    // Rule: whether the database receives the type of a parameter is said in transformValueToDB; transformPlaceholder
    // only reads it, the placeholder is already written.
    void ({
        transformValueFromDB(value, context, next) { return next.transformValueFromDB(value, context) },
        transformValueToDB(value, context, next) {
            context.forceTypeCast = true
            return next.transformValueToDB(value, context)
        },
        transformPlaceholder(placeholder, context, next) {
            // @ts-expect-error forceTypeCast is read-only in transformPlaceholder
            context.forceTypeCast = true
            return next.transformPlaceholder(placeholder, context)
        },
    } satisfies TypeAdapter)
    // Rule: transformValueToDB doesn't know the index of the parameter: the value may be only looked at.
    void ({
        transformValueFromDB(value, context, next) { return next.transformValueFromDB(value, context) },
        transformValueToDB(value, context, next) {
            // @ts-expect-error there is no index in transformValueToDB
            void context.index
            return next.transformValueToDB(value, context)
        },
    } satisfies TypeAdapter)
    // Rule: a type adapter has four transforms; whether the database receives the type of a parameter, what is kept of
    // it and how a projection compares are said in their context, not in methods of their own.
    void ({
        transformValueFromDB(value, context, next) { return next.transformValueFromDB(value, context) },
        transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
        // @ts-expect-error forceTypeCast is not a method of a type adapter
        forceTypeCast() { return true },
    } satisfies TypeAdapter)
    void ({
        transformValueFromDB(value, context, next) { return next.transformValueFromDB(value, context) },
        transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
        // @ts-expect-error projectionComparison is not a method of a type adapter
        projectionComparison() { return 'value' },
    } satisfies TypeAdapter)
    void ('customLocalDate' satisfies CustomType)
    // @ts-expect-error a built-in type is not a custom one
    void ('localDate' satisfies CustomType)

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
}

test('public-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
