// The context of a query (getQueryContext of src/QueryContext.ts and the method of the query runners): what the query
// builders recorded of a query, hidden on its params, and what a type adapter kept of a parameter under a symbol of its
// own. Also the readers of version 1, kept on its paths, which read the same context.

import { describe, expect, test } from '../../lib/testRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { queryContextOf, queryParamContextOf } from '../../../src/internal/QueryContextImpl.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import {
    getFunctionExecutingQuery, getQueryExecutionMetadata, getQueryExecutionName, getQueryExecutionStack, isSelectPageCountQuery,
} from '../../../src/queryRunners/QueryRunner.js'

function paramsBuiltAt(stack: string): any[] {
    const source = new Error('source')
    source.stack = stack
    const params: any[] = [1]
    queryContextOf(params).executionSource = source
    return params
}

describe('QueryRunner functions', () => {
    test('nothing-recorded', () => {
        const params: any[] = [1]
        const context = getQueryContext('q', params)
        expect(context.executionName).toBeUndefined()
        expect(context.executionMetadata).toBeUndefined()
        expect(context.executionSource).toBeUndefined()
        expect(context.executionStack).toBeUndefined()
        expect(context.functionExecutingQuery).toBeUndefined()
        expect(context.isSelectPageCount).toBe(false)
        expect(context.resultColumns).toBeUndefined()
        expect(context.getResultColumn('id')).toBeUndefined()
        expect(context.connectionConfiguration).toBeUndefined()
        expect(context.getParam(0)).toBeUndefined()
        // Reading it doesn't hang a context on the params
        expect(Object.getOwnPropertySymbols(params)).toEqual([])
    })

    test('execution-name-and-metadata', () => {
        const params: any[] = []
        queryContextOf(params).executionName = 'load users'
        queryContextOf(params).executionMetadata = { tag: 1 }
        expect(getQueryContext('q', params).executionName).toBe('load users')
        expect(getQueryContext('q', params).executionMetadata).toEqual({ tag: 1 })
        expect(Object.keys(params)).toEqual([])
    })

    test('the-method-of-the-query-runner-reads-the-same-context', () => {
        const params: any[] = []
        queryContextOf(params).executionName = 'load users'
        const runner = new MockQueryRunner(() => undefined)
        expect(runner.getQueryContext('q', params)).toBe(getQueryContext('q', params))
        expect(runner.getQueryContext('q', params).executionName).toBe('load users')
    })

    test('param-types', () => {
        const params: any[] = [1, 'a', null]
        const setType = (index: number, type: string, customType: 'customDouble' | undefined, forceTypeCast: boolean) => {
            const param = queryParamContextOf(params, index)
            param.setOriginalType(type, customType)
            param.forceTypeCast = forceTypeCast
        }
        setType(0, 'int', undefined, true)
        setType(2, 'Money', 'customDouble', false)
        // A type adapter requested to send the third one as a text
        queryParamContextOf(params, 2).requestedType = 'string'
        queryParamContextOf(params, 2).requestedCustomType = undefined
        const context = getQueryContext('q', params)
        expect([0, 1, 2].map(index => {
            const param = context.getParam(index)
            return [param?.originalType, param?.originalCustomType, param?.requestedType, param?.requestedCustomType, param?.forceTypeCast, param?.isValueForColumn]
        })).toEqual([
            ['int', undefined, 'int', undefined, true, false],
            [undefined, undefined, undefined, undefined, undefined, undefined],
            ['Money', 'customDouble', 'string', undefined, false, false],
        ])
        expect(Object.keys(params)).toEqual(['0', '1', '2'])
    })

    test('param-metadata-of-its-own-symbol', () => {
        const params: any[] = [1, 2]
        const mark = Symbol('mark')
        queryParamContextOf(params, 1).setMetadata(mark, 'kept')
        const context = getQueryContext('q', params)
        expect([context.getParam(0)?.getMetadata(mark), context.getParam(1)?.getMetadata(mark)]).toEqual([undefined, 'kept'])
        expect(context.getParam(1)?.originalType).toBeUndefined()
        expect(Object.keys(params)).toEqual(['0', '1'])
        expect(JSON.stringify(params)).toBe('[1,2]')
        expect([...params]).toEqual([1, 2])
    })

    test('page-count-query', () => {
        const params: any[] = []
        queryContextOf(params).isSelectPageCount = true
        expect(getQueryContext('q', params).isSelectPageCount).toBe(true)
    })

    test('result-columns', () => {
        const params: any[] = []
        queryContextOf(params).resultColumns = [{ name: 'id', path: 'id', originalType: 'int', originalCustomType: undefined, requestedType: 'int', requestedCustomType: undefined }]
        expect(getQueryContext('q', params).getResultColumn('id')).toEqual({ name: 'id', path: 'id', originalType: 'int', originalCustomType: undefined, requestedType: 'int', requestedCustomType: undefined })
        expect(getQueryContext('q', params).getResultColumn('name')).toBeUndefined()
    })

    test('function-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at loadUsers (/app/users.ts:10:5)\n    at main (/app/main.ts:3:1)\n')
        const context = getQueryContext('q', params)
        expect(context.executionSource).toBeInstanceOf(Error)
        expect(context.executionStack).toContain('loadUsers')
        expect(context.functionExecutingQuery).toEqual({ functionName: 'loadUsers', fileName: '/app/users.ts', lineNumber: '10', positionNumber: '5' })
    })

    test('async-function-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at async loadUsers (/app/users.ts:10)\n')
        expect(getQueryContext('q', params).functionExecutingQuery).toEqual({ functionName: 'loadUsers', fileName: '/app/users.ts', lineNumber: '10', positionNumber: undefined })
    })

    test('top-level-code-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at /app/script.ts:7:2\n')
        expect(getQueryContext('q', params).functionExecutingQuery).toEqual({ functionName: undefined, fileName: '/app/script.ts', lineNumber: '7', positionNumber: '2' })
    })

    test('anonymous-function-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at <anonymous> (/app/script.ts:7:2)\n')
        expect(getQueryContext('q', params).functionExecutingQuery).toEqual({ functionName: undefined, fileName: '/app/script.ts', lineNumber: '7', positionNumber: '2' })
    })

    test('no-file-to-report', () => {
        expect(getQueryContext('q', paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at eval (<anonymous>)\n')).functionExecutingQuery).toBeUndefined()
        expect(getQueryContext('q', paramsBuiltAt('Error without frames')).functionExecutingQuery).toBeUndefined()
    })

    test('the-readers-of-version-1-read-the-context', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at loadUsers (/app/users.ts:10:5)\n')
        queryContextOf(params).executionName = 'load users'
        queryContextOf(params).executionMetadata = { tag: 1 }
        queryContextOf(params).isSelectPageCount = true
        expect(getQueryExecutionName('q', params)).toBe('load users')
        expect(getQueryExecutionMetadata('q', params)).toEqual({ tag: 1 })
        expect(getQueryExecutionStack('q', params)).toContain('loadUsers')
        expect(getFunctionExecutingQuery('q', params)).toEqual({ functionName: 'loadUsers', fileName: '/app/users.ts', lineNumber: '10', positionNumber: '5' })
        expect(isSelectPageCountQuery('q', params)).toBe(true)
        expect(getQueryExecutionName('q', [])).toBeUndefined()
        expect(isSelectPageCountQuery('q', [])).toBe(false)
    })
})
