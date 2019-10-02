import { AnyDB } from "../databases/AnyDB"

export abstract class IConnection<DB extends AnyDB, NAME> implements AnyDB {
    __AnyDB: 'AnyDB' = 'AnyDB'
    // @ts-ignore
    protected ___database_name: NAME
    // @ts-ignore
    protected ___database: DB
}