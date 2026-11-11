/*
 * The metadata of a query that a query runner reads, besides its SQL and its params: the library hangs it on the params
 * array, hidden (out of a listing, a spread and JSON.stringify), and never sends it to the database. What belongs to
 * each parameter is kept under a symbol: the library's own keys, and the one of whoever adds a value of its own (a type
 * adapter in its addQueryParamMetadata, a query runner of yours in its addParam), so they can't collide.
 */

import { getParamMetadata, queryParamForceTypeCast, queryParamType, queryParamTypeCategory, setParamMetadata } from './utils/metadataSymbols.js'

/**
 * The keys of the type of a parameter: its type name (a string), its type category (a TypeCategory) and whether the
 * database must receive its type (the forceTypeCast given to addParam, a boolean). A query runner of yours keeps them
 * with setQueryParamMetadata when it adds a parameter, in addParam and addOutParam
 */
export { queryParamType, queryParamTypeCategory, queryParamForceTypeCast }

/**
 * Keeps a value for the parameter at that index of the params, under a symbol of whoever sets it: a type adapter in its
 * addQueryParamMetadata, a query runner of yours in its addParam. Each one defines its own symbol, so they can't
 * collide. Hidden: it isn't a param, and it isn't listed nor serialised.
 */
export function setQueryParamMetadata(params: any[], index: number, key: symbol, value: unknown): void {
    setParamMetadata(params, index, key, value)
}

/** The value kept under that symbol for the parameter at that index of the params, or undefined when none was set */
export function getQueryParamMetadata(params: any[], index: number, key: symbol): unknown {
    return getParamMetadata(params, index, key)
}
