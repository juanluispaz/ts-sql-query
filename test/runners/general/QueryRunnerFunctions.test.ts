// The functions src/queryRunners/QueryRunner.ts exports for a query runner to
// read what the query builders recorded on the params of a query.

import { describe, expect, test } from '../../lib/testRunner.js'
import {
    getFunctionExecutingQuery, getQueryExecutionMetadata, getQueryExecutionName, getQueryExecutionSource,
    getQueryExecutionStack, isSelectPageCountQuery,
} from '../../../src/queryRunners/QueryRunner.js'
import { setQueryExecutionMetadata, setQueryExecutionSource, setSelectPageCountQuery } from '../../../src/utils/queryParamsMetadata.js'

function paramsBuiltAt(stack: string): any[] {
    const source = new Error('source')
    source.stack = stack
    const params: any[] = [1]
    setQueryExecutionSource(params, source)
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
        setQueryExecutionMetadata(params, { queryExecutionName: 'load users', queryExecutionMetadata: { tag: 1 } })
        expect(getQueryExecutionName('q', params)).toBe('load users')
        expect(getQueryExecutionMetadata('q', params)).toEqual({ tag: 1 })
        expect(Object.keys(params)).toEqual([])
    })

    test('page-count-query', () => {
        const params: any[] = []
        setSelectPageCountQuery(params)
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
