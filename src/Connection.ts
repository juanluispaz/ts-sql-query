import type { AbstractConnection } from "./connections/AbstractConnection"
import type { AnyDB, TypeSafeDB, TypeUnsafeDB } from "./databases"

/** @deprecated Use Connection instead. This type will be removed in ts-sql-query v2. */
export type TyeSafeConnection<DB extends AnyDB & TypeSafeDB> = Connection<DB>
/** @deprecated Use Connection instead. This type will be removed in ts-sql-query v2. */
export type TyeUnsafeConnection<DB extends AnyDB & TypeUnsafeDB> = Connection<DB>

export type Connection<DB extends AnyDB> = AbstractConnection<DB>
