import type { Sqlite, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends TypeUnsafeDB, Sqlite {
    [databaseName]: NAME
}
