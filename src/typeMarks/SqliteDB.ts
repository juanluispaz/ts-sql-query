import type { Sqlite } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends Sqlite {
    [databaseName]: NAME
}
