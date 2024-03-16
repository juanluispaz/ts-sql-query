import type { AbstractConnection } from "./connections/AbstractConnection"
import { NDB } from "./utils/sourceName"

export type Connection<DB extends NDB> = AbstractConnection<DB>
export type { TransactionIsolationLevel } from "./connections/AbstractConnection"
