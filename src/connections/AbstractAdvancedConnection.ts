import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import type { Sequence } from '../expressions/sequence.js'
import { AbstractConnection } from './AbstractConnection.js'
import { SequenceQueryBuilder } from '../queryBuilders/SequenceQueryBuilder.js'
import type { NDB, NNoTableOrViewRequired } from '../utils/sourceName.js'
import type { BuiltInDataType, BuiltInDataTypeValueSources } from '../typeSystem/builtInDataTypes.js'
import type { AnyTypeClass, TypeClass, ValueSource } from '../typeSystem/base.js'
import type { NullableType } from '../typeSystem/nullable.js'

export abstract class AbstractAdvancedConnection</*in|out*/ DB extends NDB> extends AbstractConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        super(queryRunner, sqlBuilder)
    }

    protected sequence<TYPE extends BuiltInDataType>(name: string, type: TYPE, adapter?: TypeAdapter): Sequence<BuiltInDataTypeValueSources<NNoTableOrViewRequired<DB>, 'required'>[TYPE]>
    protected sequence<TYPE extends NullableType<any>>(name: string, type: TypeClass<TYPE>, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, TYPE, 'required'>>
    protected sequence<_T>(name: string, type: string | AnyTypeClass, adapter?: TypeAdapter): Sequence<any> {
        if (typeof type !== 'string') {
            return new SequenceQueryBuilder(name, type.type, type.customType, adapter)
        }
        return new SequenceQueryBuilder(name, type, undefined, adapter)
    }
}