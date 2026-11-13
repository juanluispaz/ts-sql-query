import type { Sequence } from '../expressions/sequence.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { SequenceValueSource } from '../internal/ValueSourceImpl.js'
import type { CustomType } from '../TypeAdapter.js'

export class SequenceQueryBuilder implements Sequence<any> {
    __sequenceName: string
    __type: string
    __customType: CustomType | undefined
    __typeAdapter: TypeAdapter | undefined

    constructor(sequenceName: string, type: string, customType: CustomType | undefined, typeAdapter: TypeAdapter | undefined) {
        this.__sequenceName = sequenceName
        this.__type = type
        this.__customType = customType
        this.__typeAdapter = typeAdapter
    }
    nextValue(): any {
        return new SequenceValueSource('_nextSequenceValue', this.__sequenceName, this.__type, this.__customType, 'required', this.__typeAdapter) as any
    }
    currentValue(): any {
        return new SequenceValueSource('_currentSequenceValue', this.__sequenceName, this.__type, this.__customType, 'required', this.__typeAdapter) as any
    }
}