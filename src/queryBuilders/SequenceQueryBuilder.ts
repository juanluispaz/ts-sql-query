import { Sequence } from "../expressions/sequence"
import { TypeAdapter } from "../TypeAdapter"
import { SequenceValueSource } from "../internal/ValueSourceImpl"

export class SequenceQueryBuilder extends Sequence<any> {
    __sequenceName: string
    __columnType: string
    __typeAdapter: TypeAdapter | undefined

    constructor(sequenceName: string, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super()
        this.__sequenceName = sequenceName
        this.__columnType = columnType
        this.__typeAdapter = typeAdapter
    }
    nextValue(): any {
        return new SequenceValueSource('_nextSequenceValue', this.__sequenceName, this.__columnType, this.__typeAdapter) as any
    }
    currentValue(): any {
        return new SequenceValueSource('_currentSequenceValue', this.__sequenceName, this.__columnType, this.__typeAdapter) as any
    }
}