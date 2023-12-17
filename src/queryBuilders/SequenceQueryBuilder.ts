import type { Sequence } from "../expressions/sequence"
import type { TypeAdapter } from "../TypeAdapter"
import { SequenceValueSource } from "../internal/ValueSourceImpl"
import { ValueKind } from "../expressions/values"

export class SequenceQueryBuilder implements Sequence<any> {
    __sequenceName: string
    __valueKind: ValueKind
    __columnType: string
    __typeAdapter: TypeAdapter | undefined

    constructor(sequenceName: string, valueKind: ValueKind, columnType: string, typeAdapter: TypeAdapter | undefined) {
        this.__sequenceName = sequenceName
        this.__valueKind = valueKind
        this.__columnType = columnType
        this.__typeAdapter = typeAdapter
    }
    nextValue(): any {
        return new SequenceValueSource('_nextSequenceValue', this.__sequenceName, this.__valueKind, this.__columnType, 'required', this.__typeAdapter) as any
    }
    currentValue(): any {
        return new SequenceValueSource('_currentSequenceValue', this.__sequenceName, this.__valueKind, this.__columnType, 'required', this.__typeAdapter) as any
    }
}