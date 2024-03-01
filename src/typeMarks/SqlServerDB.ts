import type { SqlServer } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends SqlServer {
    [databaseName]: NAME
}
