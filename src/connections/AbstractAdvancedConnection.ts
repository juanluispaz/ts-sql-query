import { AnyDB } from "../databases/AnyDB"
import { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import { AbstractConnection } from "./AbstractConnection"
import { TypeAdapter } from "../TypeAdapter"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { NoTableOrViewRequired } from "../utils/NoTableOrViewRequired"
import { BooleanValueSource, StringIntValueSource, StringNumberValueSource, IntValueSource, NumberValueSource, StringDoubleValueSource, DoubleValueSource, TypeSafeStringValueSource, StringValueSource, LocalDateValueSource, DateValueSource, LocalTimeValueSource, TimeValueSource, LocalDateTimeValueSource, DateTimeValueSource, EqualableValueSource } from "../expressions/values"
import { stringInt, int, stringDouble, double, LocalDate, LocalTime, LocalDateTime } from "ts-extended-types"
import { SequenceQueryBuilder } from "../queryBuilders/SequenceQueryBuilder"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { IConnection } from "../utils/IConnection"
import { Sequence } from "../expressions/sequence";

export abstract class AbstractAdvancedConnection<DB extends AnyDB, NAME, SQL_BUILDER extends SqlBuilder> extends AbstractConnection<DB, NAME, SQL_BUILDER> {

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super(queryRunner, sqlBuilder)
    }

    protected sequence(name: string, type: 'boolean', adapter?: TypeAdapter): Sequence<BooleanValueSource<DB, NoTableOrViewRequired, boolean>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringIntValueSource<DB, NoTableOrViewRequired, stringInt>>
    protected sequence(name: string, type: 'stringInt', adapter?: TypeAdapter): Sequence<StringNumberValueSource<DB, NoTableOrViewRequired, number | string>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'int', adapter?: TypeAdapter): Sequence<IntValueSource<DB, NoTableOrViewRequired, int>>
    protected sequence(name: string, type: 'int', adapter?: TypeAdapter): Sequence<NumberValueSource<DB, NoTableOrViewRequired, number>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringDoubleValueSource<DB, NoTableOrViewRequired, stringDouble>>
    protected sequence(name: string, type: 'stringDouble', adapter?: TypeAdapter): Sequence<StringNumberValueSource<DB, NoTableOrViewRequired, number | string>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'double', adapter?: TypeAdapter): Sequence<DoubleValueSource<DB, NoTableOrViewRequired, double>>
    protected sequence(name: string, type: 'double', adapter?: TypeAdapter): Sequence<NumberValueSource<DB, NoTableOrViewRequired, number>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'string', adapter?: TypeAdapter): Sequence<TypeSafeStringValueSource<DB, NoTableOrViewRequired, string>>
    protected sequence(name: string, type: 'string', adapter?: TypeAdapter): Sequence<StringValueSource<DB, NoTableOrViewRequired, string>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<LocalDateValueSource<DB, NoTableOrViewRequired, LocalDate>>
    protected sequence(name: string, type: 'localDate', adapter?: TypeAdapter): Sequence<DateValueSource<DB, NoTableOrViewRequired, Date>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<LocalTimeValueSource<DB, NoTableOrViewRequired, LocalTime>>
    protected sequence(name: string, type: 'localTime', adapter?: TypeAdapter): Sequence<TimeValueSource<DB, NoTableOrViewRequired, Date>>
    protected sequence(this: IConnection<TypeSafeDB, NAME>, name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<LocalDateTimeValueSource<DB, NoTableOrViewRequired, LocalDateTime>>
    protected sequence(name: string, type: 'localDateTime', adapter?: TypeAdapter): Sequence<DateTimeValueSource<DB, NoTableOrViewRequired, Date>>
    protected sequence<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<DB, NoTableOrViewRequired, T>>
    protected sequence<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): Sequence<EqualableValueSource<DB, NoTableOrViewRequired, T>>
    protected sequence<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Sequence<any> {
        if (typeof adapter === 'string') {
            return new SequenceQueryBuilder(name, adapter, adapter2)
        }
        return new SequenceQueryBuilder(name, type, adapter)
    }
}