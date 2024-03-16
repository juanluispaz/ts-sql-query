import type { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import type { BooleanValueSource, NumberValueSource, StringValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, EqualableValueSource, ComparableValueSource, BigintValueSource, UuidValueSource, ValueType, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource, CustomLocalDateTimeValueSource } from "../expressions/values"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { Sequence } from "../expressions/sequence";
import { AbstractConnection } from "./AbstractConnection"
import { SequenceQueryBuilder } from "../queryBuilders/SequenceQueryBuilder"
import type { NDB, NNoTableOrViewRequired } from "../utils/sourceName"

export abstract class AbstractAdvancedConnection</*in|out*/ DB extends NDB> extends AbstractConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        super(queryRunner, sqlBuilder)
    }

    protected sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'bigint', adapter?: TypeAdapter): Sequence<BigintValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'uuid', adapter?: TypeAdapter): Sequence<UuidValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<LocalDateValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<LocalTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<LocalDateTimeValueSource<NNoTableOrViewRequired<DB>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomIntValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<EqualableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ComparableValueSource<NNoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): Sequence<CustomIntValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): Sequence<CustomDoubleValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): Sequence<CustomUuidValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalDateValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalTimeValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalDateTimeValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): Sequence<ComparableValueSource<NNoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Sequence<any> {
        if (typeof adapter === 'string') {
            return new SequenceQueryBuilder(name, type as ValueType, adapter, adapter2)
        }
        return new SequenceQueryBuilder(name, type as ValueType, type, adapter)
    }
}