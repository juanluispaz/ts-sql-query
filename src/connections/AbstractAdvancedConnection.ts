import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import type { Sequence } from '../expressions/sequence.js'
import { AbstractConnection } from './AbstractConnection.js'
import { SequenceQueryBuilder } from '../queryBuilders/SequenceQueryBuilder.js'
import type { NDB, NNoTableOrViewRequired } from '../utils/sourceName.js'
import type { CustomType } from '../TypeAdapter.js'
import type { BuiltInDataType, BuiltInDataTypeValueSources } from '../typeSystem/builtInDataTypes.js'
import type { ValueSource } from '../typeSystem/base.js'
import type { CustomComparableType } from '../typeSystem/comparable.js'
import type { CustomEqualableType, EnumType } from '../typeSystem/equalable.js'
import type { CustomLocalDateTimeType, CustomLocalDateType, CustomLocalTimeType } from '../typeSystem/localDates.js'
import type { CustomBigintType, CustomDecimalType, CustomDoubleType, CustomIntType } from '../typeSystem/numbers.js'
import type { CustomUuidType } from '../typeSystem/uuids.js'

export abstract class AbstractAdvancedConnection</*in|out*/ DB extends NDB> extends AbstractConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        super(queryRunner, sqlBuilder)
    }

    protected sequence<TYPE extends BuiltInDataType>(name: string, type: TYPE, adapter?: TypeAdapter): Sequence<BuiltInDataTypeValueSources<NNoTableOrViewRequired<DB>, 'required'>[TYPE]>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomIntType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomBigintType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomDoubleType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomDecimalType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomUuidType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomLocalDateType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomLocalTimeType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomLocalDateTimeType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, EnumType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomEqualableType<T, TYPE_NAME>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ValueSource<NNoTableOrViewRequired<DB>, CustomComparableType<T, TYPE_NAME>, 'required'>>
    protected sequence<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Sequence<any> {
        if (typeof adapter === 'string') {
            return new SequenceQueryBuilder(name, adapter, type as CustomType, adapter2)
        }
        return new SequenceQueryBuilder(name, type, undefined, adapter)
    }
}