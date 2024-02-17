import type { AnyDB, TypeSafeDB } from "../databases"
import type { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import type { BooleanValueSource, StringIntValueSource, StringNumberValueSource, IntValueSource, NumberValueSource, StringDoubleValueSource, DoubleValueSource, TypeSafeStringValueSource, StringValueSource, LocalDateValueSource, DateValueSource, LocalTimeValueSource, TimeValueSource, LocalDateTimeValueSource, DateTimeValueSource, EqualableValueSource, ComparableValueSource, BigintValueSource, TypeSafeBigintValueSource, TypeSafeUuidValueSource, UuidValueSource, ValueType, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource, CustomLocalDateTimeValueSource } from "../expressions/values"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { IConnection } from "../utils/IConnection"
import type { Sequence } from "../expressions/sequence";
import type { NoTableOrViewRequired } from "../utils/ITableOrView"
import { AbstractConnection } from "./AbstractConnection"
import { SequenceQueryBuilder } from "../queryBuilders/SequenceQueryBuilder"

export abstract class AbstractAdvancedConnection<DB extends AnyDB> extends AbstractConnection<DB> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        super(queryRunner, sqlBuilder)
    }

    protected sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringIntValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringNumberValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): Sequence<IntValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'bigint', adapter?: TypeAdapter): Sequence<TypeSafeBigintValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'bigint', adapter?: TypeAdapter): Sequence<BigintValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringDoubleValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringNumberValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): Sequence<DoubleValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): Sequence<TypeSafeStringValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'uuid', adapter?: TypeAdapter): Sequence<TypeSafeUuidValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'uuid', adapter?: TypeAdapter): Sequence<UuidValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<LocalDateValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<DateValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<LocalTimeValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<TimeValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<LocalDateTimeValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<DateTimeValueSource<NoTableOrViewRequired<DB>, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomIntValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomDoubleValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomUuidValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalDateValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalTimeValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<CustomLocalDateTimeValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<EqualableValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<EqualableValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): Sequence<ComparableValueSource<NoTableOrViewRequired<DB>, T, TYPE_NAME, 'required'>>
    protected sequence<T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): Sequence<CustomIntValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): Sequence<CustomDoubleValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): Sequence<CustomUuidValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalDateValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalTimeValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): Sequence<CustomLocalDateTimeValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): Sequence<ComparableValueSource<NoTableOrViewRequired<DB>, T, T, 'required'>>
    protected sequence<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Sequence<any> {
        if (typeof adapter === 'string') {
            return new SequenceQueryBuilder(name, type as ValueType, adapter, adapter2)
        }
        return new SequenceQueryBuilder(name, type as ValueType, type, adapter)
    }
}