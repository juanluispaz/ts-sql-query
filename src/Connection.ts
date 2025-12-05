import type { AbstractConnection } from './connections/AbstractConnection.js'
import type { NDB } from './utils/sourceName.js'

export type Connection<DB extends NDB> = AbstractConnection<DB>
export type { TransactionIsolationLevel } from './connections/AbstractConnection.js'
