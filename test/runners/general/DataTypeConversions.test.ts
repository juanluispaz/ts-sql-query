// The class of a data type converts the values of its data type: its statics transformValueFromDB, transformValueToDB,
// transformPlaceholder and transformProjection, with the names and the parameters of a type adapter. A value goes to the
// database through the type adapter of the value, then its class, then the type adapter of the type requested with one,
// and then the connection; a value read comes back the other way round.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { IntType, StringType, Table } from '../../../src/exports/v2/index.js'
import { IntegersType } from '../../../src/typeSystem/numeric.js'
import { operandTypeName, typeName } from '../../../src/utils/symbols.js'
import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../../../src/TypeAdapter.js'

// Writes what each step of the chain does, in the order it happens; a projection only when it receives SQL (the
// library also calls it with an empty one, to know whether it converts the value)
const steps: string[] = []

// The type adapter of the type the class requests: the value as its text
const asText: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('asText to ' + String(value))
        return next.transformValueToDB(String(value), context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        const result = next.transformValueFromDB(value, context)
        steps.push('asText from ' + String(result))
        return Number(result)
    },
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        steps.push('asText placeholder')
        return next.transformPlaceholder(placeholder, context) + '::text'
    },
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (sql !== '') { steps.push('asText projection') }
        const result = next.transformProjection(sql, context)
        return result === '' ? '' : result + '::text'
    },
}

// An integer of the user sent and read as its text, through asText; it adds 1 to what it sends and to what it reads
abstract class TracedType extends IntegersType<number> {
    static override readonly type = 'Traced'
    static override readonly customType = 'customInt'
    declare [typeName]: 'type:Traced:customInt:'
    declare [operandTypeName]: 'type:Traced:customInt:'

    static override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('type to ' + String(value))
        context.setRequestedType(StringType, asText)
        return next.transformValueToDB((value as number) + 1, context)
    }
    static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType(StringType, asText)
        const result = next.transformValueFromDB(value, context)
        steps.push('type from ' + String(result))
        return (result as number) + 1
    }
    static override transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        steps.push('type placeholder')
        return '(' + next.transformPlaceholder(placeholder, context) + ')'
    }
    static override transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (sql !== '') { steps.push('type projection') }
        context.setRequestedType(StringType, asText)
        const result = next.transformProjection(sql, context)
        return result === '' ? '' : '(' + result + ')'
    }
}

// The type adapter of a column of TracedType: it multiplies by 10 what it sends and what it reads
const tenTimes: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('adapter to ' + String(value))
        return next.transformValueToDB((value as number) * 10, context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        const result = next.transformValueFromDB(value, context)
        steps.push('adapter from ' + String(result))
        return (result as number) * 10
    },
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        steps.push('adapter placeholder')
        return 'abs' + next.transformPlaceholder(placeholder, context)
    },
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (sql !== '') { steps.push('adapter projection') }
        const result = next.transformProjection(sql, context)
        return result === '' ? '' : 'abs' + result
    },
}

// A type adapter that converts the value twice through the rest of the chain, and sends the second one
const twice: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        steps.push('twice to ' + String(value))
        next.transformValueToDB(value, context)
        return next.transformValueToDB(value, context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    },
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}

const tThing = new class TThing extends Table<DBConnection, 'TThing'> {
    id = this.column('id', IntType)
    traced = this.column('traced', TracedType)
    tracedAdapted = this.column('traced_adapted', TracedType, tenTimes)
    tracedTwice = this.column('traced_twice', TracedType, twice)
    constructor() { super('thing') }
}()

let lastQuery = ''
let lastParams: any[] = []
let rowsToReturn: any[] = []
const conn = new DBConnection(new MockQueryRunner((_type, query, params) => {
    lastQuery = query
    lastParams = params
    return rowsToReturn
}))

describe('DataTypeConversions', () => {
    test('a-value-goes-through-its-class-then-the-requested-adapter-then-the-connection', async () => {
        steps.length = 0
        rowsToReturn = [{ traced: '7' }]
        const rows = await conn.selectFrom(tThing).where(tThing.traced.equals(5)).select({ traced: tThing.traced }).executeSelectMany()
        expect(lastQuery).toBe('select (traced::text) as traced from thing where traced = ($1::text)')
        expect(lastParams).toEqual(['6'])
        expect(rows).toEqual([{ traced: 8 }])
        expect(steps).toEqual([
            'type projection', 'asText projection',
            'type to 5', 'asText to 6', 'type placeholder', 'asText placeholder',
            'asText from 7', 'type from 7',
        ])
        expect(getQueryContext(lastQuery, lastParams).getParam(0)?.requestedType).toBe(StringType)
    })

    test('a-value-with-a-type-adapter-goes-through-the-adapter-first', async () => {
        steps.length = 0
        rowsToReturn = [{ tracedAdapted: '7' }]
        const rows = await conn.selectFrom(tThing).where(tThing.tracedAdapted.equals(5)).select({ tracedAdapted: tThing.tracedAdapted }).executeSelectMany()
        expect(lastQuery).toBe('select abs(traced_adapted::text) as "tracedAdapted" from thing where traced_adapted = abs($1::text)')
        expect(lastParams).toEqual(['51'])
        expect(rows).toEqual([{ tracedAdapted: 80 }])
        expect(steps).toEqual([
            'adapter projection', 'type projection', 'asText projection',
            'adapter to 5', 'type to 50', 'asText to 51', 'adapter placeholder', 'type placeholder', 'asText placeholder',
            'asText from 7', 'type from 7', 'adapter from 8',
        ])
    })

    test('a-step-that-calls-next-twice-goes-through-the-rest-of-the-chain-twice', async () => {
        steps.length = 0
        rowsToReturn = []
        await conn.selectFrom(tThing).where(tThing.tracedTwice.equals(5)).select({ id: tThing.id }).executeSelectMany()
        expect(lastParams).toEqual(['6'])
        expect(steps).toEqual(['twice to 5', 'type to 5', 'asText to 6', 'type to 5', 'asText to 6', 'type placeholder', 'asText placeholder'])
    })
})
