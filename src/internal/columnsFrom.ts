import type { AnyTableOrView, HasIsValue } from '../utils/ITableOrView.js'
import { __getTableOrViewPrivate, __registerTableOrView } from '../utils/ITableOrView.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import { __projectedTypeClassOf } from '../typeSystem/dataTypeClasses.js'
import { CustomBooleanTypeAdapter, type DataTypeClass } from '../TypeAdapter.js'
import type { OptionalType } from '../typeSystem/valueSource.js'
import { __newDBColumn, type DBColumnValueSource } from '../nodes/column.js'
import { __keptClassOf } from '../nodes/adaptedTypeClass.js'
import { type NodeValueSource, type InCreation, __asNodeValueSource, __inCreation, isValueSource, __keepAggregatedArrayShape } from '../nodes/NodeStrategy.js'

/**
 * The class of a column of a with or of a compound select: the value of the expression of the select, with its type
 * adapter as it has it. A boolean of a column with a CustomBooleanTypeAdapter is projected as a boolean of the
 * database (the select writes it so), and has no adapter
 */
export function projectedColumnClassOf(valueSource: NodeValueSource): DataTypeClass {
    const projected = __projectedTypeClassOf(valueSource)
    return valueSource.__typeAdapter instanceof CustomBooleanTypeAdapter ? projected : __keptClassOf(valueSource, projected)
}

// The optionality of a column of a with view, as its type says (see OptionalTypeForWith in
// complexProjections/asWithView.ts): outside the query that builds it, a value is required or optional. Keeping
// 'originallyRequired' / 'requiredInOptionalObject' made the projection rules of the query using the view drop an
// object that mixes that value with others when it is null, while the type says the object is there.
// Keep it in step with OptionalTypeForWith; it is not the place to apply the projection rules (those run again in the
// query that uses the view, over these optionalities).
function withColumnOptionalType(withColumn: InCreation<DBColumnValueSource>, optionalType: OptionalType): void {
    withColumn.__optionalType = optionalType === 'required' ? 'required' : 'optional'
}

// forWithView: the columns of a with view (forUseInQueryAs), typed by OptionalTypeForWith; otherwise the columns of a
// compound select, which keep the optionality the projection rules of its first query give them.
export function createColumnsFrom(sqlBuilder: HasIsValue, columns: QueryColumns, target: QueryColumns, table: AnyTableOrView, forWithView: boolean) {
    for (const property in columns) {
        const column = columns[property]!
        if (isValueSource(column)) {
            const nodeColumn = __asNodeValueSource(column)
            const withColumn = __inCreation(__newDBColumn(projectedColumnClassOf(nodeColumn), table, property))
            if (forWithView) {
                withColumnOptionalType(withColumn, nodeColumn.__optionalType)
            } else {
                withColumn.__optionalType = nodeColumn.__optionalType
            }
            __keepAggregatedArrayShape(withColumn, nodeColumn)
            target[property] = withColumn
        } else {
            const newTarget = {}
            createColumnsFromInnerObject(sqlBuilder, column, newTarget, table, property + '.', forWithView)
            target[property] = newTarget
        }
    }
}

export function createColumnsFromInnerObject(sqlBuilder: HasIsValue, columns: QueryColumns, target: QueryColumns, table: AnyTableOrView, prefix: string, forWithView: boolean) {
    const rule = forWithView ? 0 : getInnerObjetRuleToApply(sqlBuilder, columns)

    for (const property in columns) {
        const column = columns[property]!
        if (isValueSource(column)) {
            const nodeColumn = __asNodeValueSource(column)
            const withColumn = __inCreation(__newDBColumn(projectedColumnClassOf(nodeColumn), table, prefix + property))
            if (forWithView) {
                withColumnOptionalType(withColumn, nodeColumn.__optionalType)
            } else {
                let optionalType = nodeColumn.__optionalType
                // DO NOT CHANGE these rules to fix a result that looks wrong without changing the types first: they are
                // the runtime twin of the projection rules of the types (src/complexProjections/projectionRules.ts and
                // resultWithOptionalsAsNull.ts / resultWithOptionalsAsUndefined.ts, rules 1 to 4), which decide the
                // declared result of a compound select (its columns come from the first query). Runtime and types must
                // keep giving the same optionality; a change here alone makes the result contradict its type. The with
                // view columns (forWithView) follow OptionalTypeForWith instead, see withColumnOptionalType.
                switch(rule) {
                    case 1: // Rule 1, there is requiredInOptionalObject
                        if (optionalType === 'originallyRequired') {
                            optionalType = 'optional'
                        }
                        break
                    case 2: // Rule 2: all from the same left join ignoring inner objects
                        if (optionalType === 'originallyRequired') {
                            optionalType = 'requiredInOptionalObject'
                        }
                        break
                    case 3: // Rule 3: there is a required property
                        if (optionalType !== 'required') {
                            optionalType = 'optional'
                        }
                        break
                    case 4: // Rule 4: the general rule
                        if (optionalType !== 'required') {
                            optionalType = 'optional'
                        }
                        break
                }
                withColumn.__optionalType = optionalType
            }
            __keepAggregatedArrayShape(withColumn, nodeColumn)
            target[property] = withColumn
        } else {
            const newTarget = {}
            createColumnsFromInnerObject(sqlBuilder, column, newTarget, table, prefix + property + '.', forWithView)
            target[property] = newTarget
        }
    }
}

// Runtime twin of the type-level projection rules (src/complexProjections/projectionRules.ts, rules 1 to 4): keep both
// in step; never change one without the other.
export function getInnerObjetRuleToApply(sqlBuilder: HasIsValue, columns: QueryColumns): 1 | 2 | 3 | 4 {
    let containsRequired = false
    let contaisOriginallyRequired = false
    let innerObjectsAreRequired = false

    for (const property in columns) {
        const column = columns[property]!
        if (isValueSource(column)) {
            const nodeColumn = __asNodeValueSource(column)
            const optionalType = nodeColumn.__optionalType

            switch (optionalType) {
            case 'requiredInOptionalObject':
                return 1 // Rule 1, there is requiredInOptionalObject
            case 'required':
                containsRequired = true
                break
            case 'originallyRequired':
                contaisOriginallyRequired = true
                break
            default: //do nothing
            }
        } else {
            if (getInnerObjetRuleToApply(sqlBuilder, column) === 3) {
                // This is the only case where the inner object is required
                innerObjectsAreRequired = true
            }
        }
    }

    if (contaisOriginallyRequired) {
        let firstRequiredTables = new Set<AnyTableOrView>()
        let alwaysSameRequiredTablesSize : undefined | boolean = undefined

        for (const property in columns) {
            const column = columns[property]!
            if (!isValueSource(column)) {
                // ignore inner objects
                continue
            }

            const nodeColumn = __asNodeValueSource(column)
            let valueSourceRequiredTables = new Set<AnyTableOrView>()
            nodeColumn.__registerTableOrView(sqlBuilder, valueSourceRequiredTables)
            if (valueSourceRequiredTables.size <= 0) {
                // A value that doesn't come from a table, like a constant, says nothing about the left join
                continue
            }
            if (alwaysSameRequiredTablesSize === undefined) {
                firstRequiredTables = valueSourceRequiredTables
                alwaysSameRequiredTablesSize = true
            } else if (alwaysSameRequiredTablesSize) {
                const initialSize = firstRequiredTables.size
                if (initialSize !== valueSourceRequiredTables.size) {
                    alwaysSameRequiredTablesSize = false
                } else {
                    for (const table of valueSourceRequiredTables) {
                        firstRequiredTables.add(table)
                    }
                    if (initialSize !== firstRequiredTables.size) {
                        alwaysSameRequiredTablesSize = false
                    }
                }
            }
        }

        // Evaluate rule 2: all from the same left join ignoring inner objects
        let onlyOuterJoin = true
        for (const table of firstRequiredTables) {
            if (!__getTableOrViewPrivate(table).__forUseInLeftJoin) {
                onlyOuterJoin = false
            }
        }
        if (firstRequiredTables.size <= 0) {
            onlyOuterJoin = false
        }
        if (alwaysSameRequiredTablesSize && onlyOuterJoin) {
            return 2 // Rule 2: all from the same left join ignoring inner objects
        }
    }

    if (containsRequired || innerObjectsAreRequired) {
        return 3 // Rule 3: there is a required property
    }

    return 4 // Rule 4: the general rule
}
