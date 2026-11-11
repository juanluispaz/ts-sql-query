// The functions src/queryRunners/QueryRunner.ts exports for a query runner to
// read what the query builders recorded on the params of a query, and the
// metadata of a parameter (src/QueryMetadata.ts), kept under a symbol.

import { describe, expect, test } from '../../lib/testRunner.js'
import {
    getFunctionExecutingQuery, getQueryExecutionMetadata, getQueryExecutionName, getQueryExecutionSource,
    getQueryExecutionStack, getQueryParamForceTypeCast, getQueryParamType, getQueryParamTypeCategory, isSelectPageCountQuery,
} from '../../../src/queryRunners/QueryRunner.js'
import { getQueryParamMetadata, queryParamForceTypeCast, queryParamType, queryParamTypeCategory, setQueryParamMetadata } from '../../../src/QueryMetadata.js'
import { queryExecutionMetadata, queryExecutionSource, querySelectPageCount, setMetadata } from '../../../src/utils/metadataSymbols.js'

function paramsBuiltAt(stack: string): any[] {
    const source = new Error('source')
    source.stack = stack
    const params: any[] = [1]
    setMetadata(params, queryExecutionSource, source)
    return params
}

describe('QueryRunner functions', () => {
    test('nothing-recorded', () => {
        const params: any[] = [1]
        expect(getQueryExecutionName('q', params)).toBeUndefined()
        expect(getQueryExecutionMetadata('q', params)).toBeUndefined()
        expect(getQueryExecutionSource('q', params)).toBeUndefined()
        expect(getQueryExecutionStack('q', params)).toBeUndefined()
        expect(getFunctionExecutingQuery('q', params)).toBeUndefined()
        expect(isSelectPageCountQuery('q', params)).toBe(false)
    })

    test('execution-name-and-metadata', () => {
        const params: any[] = []
        setMetadata(params, queryExecutionMetadata, { queryExecutionName: 'load users', queryExecutionMetadata: { tag: 1 } })
        expect(getQueryExecutionName('q', params)).toBe('load users')
        expect(getQueryExecutionMetadata('q', params)).toEqual({ tag: 1 })
        expect(Object.keys(params)).toEqual([])
    })

    test('param-types', () => {
        const params: any[] = [1, 'a', null]
        const setType = (index: number, type: string, typeCategory: 'int' | 'customDouble', forceTypeCast: boolean) => {
            setQueryParamMetadata(params, index, queryParamType, type)
            setQueryParamMetadata(params, index, queryParamTypeCategory, typeCategory)
            setQueryParamMetadata(params, index, queryParamForceTypeCast, forceTypeCast)
        }
        setType(0, 'int', 'int', true)
        setType(2, 'Money', 'customDouble', false)
        expect([0, 1, 2].map(index => [getQueryParamType('q', params, index), getQueryParamTypeCategory('q', params, index), getQueryParamForceTypeCast('q', params, index)])).toEqual([
            ['int', 'int', true],
            [undefined, undefined, undefined],
            ['Money', 'customDouble', false],
        ])
        expect(Object.keys(params)).toEqual(['0', '1', '2'])
    })

    test('param-metadata-of-its-own-symbol', () => {
        const params: any[] = [1, 2]
        const mark = Symbol('mark')
        setQueryParamMetadata(params, 1, mark, 'kept')
        expect([getQueryParamMetadata(params, 0, mark), getQueryParamMetadata(params, 1, mark)]).toEqual([undefined, 'kept'])
        expect(getQueryParamMetadata(params, 1, queryParamType)).toBeUndefined()
        expect(Object.keys(params)).toEqual(['0', '1'])
        expect(JSON.stringify(params)).toBe('[1,2]')
        expect([...params]).toEqual([1, 2])
    })

    test('page-count-query', () => {
        const params: any[] = []
        setMetadata(params, querySelectPageCount, true)
        expect(isSelectPageCountQuery('q', params)).toBe(true)
    })

    test('function-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at loadUsers (/app/users.ts:10:5)\n    at main (/app/main.ts:3:1)\n')
        expect(getQueryExecutionSource('q', params)).toBeInstanceOf(Error)
        expect(getQueryExecutionStack('q', params)).toContain('loadUsers')
        expect(getFunctionExecutingQuery('q', params)).toEqual({ functionName: 'loadUsers', fileName: '/app/users.ts', lineNumber: '10', positionNumber: '5' })
    })

    test('async-function-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at async loadUsers (/app/users.ts:10)\n')
        expect(getFunctionExecutingQuery('q', params)).toEqual({ functionName: 'loadUsers', fileName: '/app/users.ts', lineNumber: '10', positionNumber: undefined })
    })

    test('top-level-code-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at /app/script.ts:7:2\n')
        expect(getFunctionExecutingQuery('q', params)).toEqual({ functionName: undefined, fileName: '/app/script.ts', lineNumber: '7', positionNumber: '2' })
    })

    test('anonymous-function-executing-the-query', () => {
        const params = paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at <anonymous> (/app/script.ts:7:2)\n')
        expect(getFunctionExecutingQuery('q', params)).toEqual({ functionName: undefined, fileName: '/app/script.ts', lineNumber: '7', positionNumber: '2' })
    })

    test('no-file-to-report', () => {
        expect(getFunctionExecutingQuery('q', paramsBuiltAt('Error\n    at libraryInternals (/lib/x.js:1:1)\n    at eval (<anonymous>)\n'))).toBeUndefined()
        expect(getFunctionExecutingQuery('q', paramsBuiltAt('Error without frames'))).toBeUndefined()
    })
})
