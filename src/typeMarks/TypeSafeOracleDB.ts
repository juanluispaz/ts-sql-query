import type { Oracle, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends TypeSafeDB, Oracle {
    [databaseName]: NAME
}
