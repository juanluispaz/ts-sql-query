import type { AnyDB, TypeSafeDB } from "../databases"
import type { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import type { BooleanValueSource, StringIntValueSource, StringNumberValueSource, IntValueSource, NumberValueSource, StringDoubleValueSource, DoubleValueSource, TypeSafeStringValueSource, StringValueSource, LocalDateValueSource, DateValueSource, LocalTimeValueSource, TimeValueSource, LocalDateTimeValueSource, DateTimeValueSource, EqualableValueSource, ComparableValueSource } from "../expressions/values"
import type { stringInt, int, stringDouble, double, LocalDate, LocalTime, LocalDateTime } from "ts-extended-types"
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

    protected sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource<NoTableOrViewRequired<DB>, boolean>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringIntValueSource<NoTableOrViewRequired<DB>, stringInt>>
    protected sequence(name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringNumberValueSource<NoTableOrViewRequired<DB>, number | string>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): Sequence<IntValueSource<NoTableOrViewRequired<DB>, int>>
    protected sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource<NoTableOrViewRequired<DB>, number>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringDoubleValueSource<NoTableOrViewRequired<DB>, stringDouble>>
    protected sequence(name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringNumberValueSource<NoTableOrViewRequired<DB>, number | string>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): Sequence<DoubleValueSource<NoTableOrViewRequired<DB>, double>>
    protected sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource<NoTableOrViewRequired<DB>, number>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): Sequence<TypeSafeStringValueSource<NoTableOrViewRequired<DB>, string>>
    protected sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource<NoTableOrViewRequired<DB>, string>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<LocalDateValueSource<NoTableOrViewRequired<DB>, LocalDate>>
    protected sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<DateValueSource<NoTableOrViewRequired<DB>, Date>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<LocalTimeValueSource<NoTableOrViewRequired<DB>, LocalTime>>
    protected sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<TimeValueSource<NoTableOrViewRequired<DB>, Date>>
    protected sequence(this: IConnection<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<LocalDateTimeValueSource<NoTableOrViewRequired<DB>, LocalDateTime>>
    protected sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<DateTimeValueSource<NoTableOrViewRequired<DB>, Date>>
    protected sequence<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<NoTableOrViewRequired<DB>, T>>
    protected sequence<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<NoTableOrViewRequired<DB>, T>>
    protected sequence<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): Sequence<ComparableValueSource<NoTableOrViewRequired<DB>, T>>
    protected sequence<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Sequence<any> {
        if (typeof adapter === 'string') {
            return new SequenceQueryBuilder(name, adapter, adapter2)
        }
        return new SequenceQueryBuilder(name, type, adapter)
    }
}