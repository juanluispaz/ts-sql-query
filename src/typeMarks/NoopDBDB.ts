import type { NoopDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends NoopDB {
    [databaseName]: NAME
}
