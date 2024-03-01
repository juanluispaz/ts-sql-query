import type { AbstractConnection } from "./connections/AbstractConnection"
import type { AnyDB } from "./databases"

export type Connection<DB extends AnyDB> = AbstractConnection<DB>
