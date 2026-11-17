import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { valueSourceNode, type NodeStrategy, type NodeValueSource, type InCreation } from './NodeStrategy.js'
import type { ValueSourceConstructor } from './dataTypeClassOf.js'

/**
 * The name or the alias of a table or view in a raw fragment: the only value source without a data type, an instance
 * of ValueSourceRoot itself
 */
export interface TableOrViewRawFragmentValueSource extends NodeValueSource {
    readonly __tableOrView: AnyTableOrView
    readonly __operation: '_rawFragmentTableName' | '_rawFragmentTableAlias'
}

/** The name or the alias of a table or view guarded by `allowWhen` / `disallowWhen` */
export interface AllowWhenTableOrViewRawFragmentValueSource extends TableOrViewRawFragmentValueSource {
    readonly __allowed: boolean
    readonly __error: Error
}

/** The name or the alias of a table or view: it reaches nothing, and keeps being one when it is guarded */
export const tableOrViewRawFragmentNode: NodeStrategy<TableOrViewRawFragmentValueSource> = {
    ...valueSourceNode,
    __toSql(vs, sqlBuilder, context) {
        return sqlBuilder[vs.__operation](context, vs.__tableOrView)
    },
    allowWhen(vs, allowed, error) {
        return newAllowWhenTableOrViewRawFragment(vs, allowed, error)
    },
}

/** The name or the alias of a table or view guarded by `allowWhen` / `disallowWhen`: its SQL throws when not allowed */
export const allowWhenTableOrViewRawFragmentNode: NodeStrategy<AllowWhenTableOrViewRawFragmentValueSource> = {
    ...tableOrViewRawFragmentNode,
    __toSql(vs, sqlBuilder, context) {
        if (!vs.__allowed) {
            throw vs.__error
        }
        return sqlBuilder[vs.__operation](context, vs.__tableOrView)
    },
    __isAllowed(vs) {
        return vs.__allowed
    },
}

/** The name or the alias of a table or view; `rootClass` is ValueSourceRoot, which the factory gives */
export function __newTableOrViewRawFragment(rootClass: ValueSourceConstructor, tableOrView: AnyTableOrView, operation: '_rawFragmentTableName' | '_rawFragmentTableAlias'): TableOrViewRawFragmentValueSource {
    const vs = new rootClass('required') as InCreation<TableOrViewRawFragmentValueSource>
    vs.__node = tableOrViewRawFragmentNode
    vs.__tableOrView = tableOrView
    vs.__operation = operation
    return vs
}

function newAllowWhenTableOrViewRawFragment(guarded: TableOrViewRawFragmentValueSource, allowed: boolean, error: Error): AllowWhenTableOrViewRawFragmentValueSource {
    const vs = new (guarded.constructor as ValueSourceConstructor)('required') as InCreation<AllowWhenTableOrViewRawFragmentValueSource>
    vs.__node = allowWhenTableOrViewRawFragmentNode
    vs.__tableOrView = guarded.__tableOrView
    vs.__operation = guarded.__operation
    vs.__allowed = allowed
    vs.__error = error
    return vs
}

/** Whether the value source is the name or the alias of a table or view, guarded or not */
export function __isTableOrViewRawFragmentNode(vs: NodeValueSource): vs is TableOrViewRawFragmentValueSource {
    return vs.__node === tableOrViewRawFragmentNode || vs.__node === allowWhenTableOrViewRawFragmentNode
}
