// A type adapter can request a type with a type adapter (setRequestedType(type, typeAdapter)): when the adapter calls
// next, the value goes through the adapter of the requested type, and then through the conversion of the connection.
// The query runner receives the requested type.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { CustomIntType, IntType, StringType, Table } from '../../../src/exports/v2/index.js'
import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../../../src/TypeAdapter.js'

// Writes what each step does, in the order it happens
const steps: string[] = []

// The adapter of the requested type: the value as text, wrapped, and its placeholder cast to text
const asText: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('asText to ' + String(value))
        return next.transformValueToDB('[' + String(value) + ']', context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('asText from ' + String(value))
        return next.transformValueFromDB(String(value).slice(1, -1), context)
    },
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        steps.push('asText placeholder')
        return next.transformPlaceholder(placeholder, context) + '::text'
    },
}

// The adapter of the column: it requests a text through asText
const viaText: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('viaText to ' + String(value))
        context.setRequestedType('string', asText)
        return next.transformValueToDB(value, context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('viaText from ' + String(value))
        context.setRequestedType(StringType, asText)
        return Number(next.transformValueFromDB(value, context))
    },
}

// An adapter that requests its own type with itself: it is already converting the value, so it is not applied again
const itself: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('itself to ' + String(value))
        context.setRequestedType(CodeType, itself)
        return next.transformValueToDB(value, context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    },
}

const CodeType = CustomIntType.of<number, 'Code'>('Code')

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}

const tThing = new class TThing extends Table<DBConnection, 'TThing'> {
    id = this.column('id', IntType)
    amount = this.column('amount', IntType, viaText)
    code = this.column('code', CodeType, itself)
    constructor() { super('thing') }
}()

let lastQuery = ''
let lastParams: any[] = []
const conn = new DBConnection(new MockQueryRunner((_type, query, params) => {
    lastQuery = query
    lastParams = params
    return [{ id: 1, amount: '[7]' }]
}))

describe('RequestedTypeAdapter', () => {
    test('a-value-goes-through-the-adapter-of-the-requested-type-and-then-the-connection', async () => {
        steps.length = 0
        await conn.selectFrom(tThing).where(tThing.amount.equals(5)).select({ id: tThing.id }).executeSelectMany()
        expect(lastQuery).toBe('select id as id from thing where amount = $1::text')
        expect(lastParams).toEqual(['[5]'])
        expect(steps).toEqual(['viaText to 5', 'asText to 5', 'asText placeholder'])
        // The query runner receives the type requested
        expect(getQueryContext(lastQuery, lastParams).getParam(0)?.requestedType).toBe(StringType)
        expect(getQueryContext(lastQuery, lastParams).getParam(0)?.originalType).toBe(IntType)
    })

    test('a-value-read-goes-through-the-adapter-of-the-requested-type', async () => {
        steps.length = 0
        const rows = await conn.selectFrom(tThing).select({ amount: tThing.amount }).executeSelectMany()
        expect(rows).toEqual([{ amount: 7 }])
        expect(steps).toEqual(['viaText from [7]', 'asText from [7]'])
    })

    test('the-adapter-already-converting-the-value-is-not-applied-again', async () => {
        steps.length = 0
        await conn.selectFrom(tThing).where(tThing.code.equals(3)).select({ id: tThing.id }).executeSelectMany()
        expect(lastParams).toEqual([3])
        expect(steps).toEqual(['itself to 3'])
    })
})
