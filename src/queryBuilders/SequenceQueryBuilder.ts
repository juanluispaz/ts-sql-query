import type { Sequence } from "../expressions/sequence"
import type { TypeAdapter } from "../TypeAdapter"
import { SequenceValueSource } from "../internal/ValueSourceImpl"
import { ValueType } from "../expressions/values"

export class SequenceQueryBuilder implements Sequence<any> {
    __sequenceName: string
    __columnType: ValueType
    __columnTypeName: string
    __typeAdapter: TypeAdapter | undefined

    constructor(sequenceName: string, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined) {
        this.__sequenceName = sequenceName
        this.__columnType = columnType
        this.__columnTypeName = columnTypeName
        this.__typeAdapter = typeAdapter
    }
    nextValue(): any {
        return new SequenceValueSource('_nextSequenceValue', this.__sequenceName, this.__columnType, this.__columnTypeName, 'required', this.__typeAdapter) as any
    }
    currentValue(): any {
        return new SequenceValueSource('_currentSequenceValue', this.__sequenceName, this.__columnType, this.__columnTypeName, 'required', this.__typeAdapter) as any
    }
}