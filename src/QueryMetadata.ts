/*
 * What a type adapter keeps for a parameter, for the query runner: it goes in the context of the query
 * (QueryContext.getParam(index).getMetadata(key)), under a symbol of the adapter's own, so it can't collide.
 */

import { queryParamContextOf } from './internal/QueryContextImpl.js'

/**
 * Keeps a value for the parameter at that index of the params, under a symbol of whoever sets it: a type adapter in its
 * addQueryParamMetadata. Each one defines its own symbol, so they can't collide. Hidden: it isn't a param, and it isn't
 * listed nor serialised.
 */
export function setQueryParamMetadata(params: any[], index: number, key: symbol, value: unknown): void {
    queryParamContextOf(params, index).setMetadata(key, value)
}
