import type { Sequence } from '../expressions/sequence.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { __createSequence } from '../typeSystem/valueSourceFactory.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'

export class SequenceQueryBuilder implements Sequence<any> {
    __sequenceName: string
    __typeClass: DataTypeClass
    __typeAdapter: TypeAdapter | undefined

    constructor(sequenceName: string, typeClass: DataTypeClass, typeAdapter: TypeAdapter | undefined) {
        this.__sequenceName = sequenceName
        this.__typeClass = typeClass
        this.__typeAdapter = typeAdapter
    }
    nextValue(): any {
        return __createSequence('_nextSequenceValue', this.__sequenceName, __adaptedTypeClassOf(this.__typeClass, this.__typeAdapter), 'required') as any
    }
    currentValue(): any {
        return __createSequence('_currentSequenceValue', this.__sequenceName, __adaptedTypeClassOf(this.__typeClass, this.__typeAdapter), 'required') as any
    }
}