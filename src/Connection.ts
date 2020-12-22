import type { AbstractConnection } from "./connections/AbstractConnection"
import type { AnyDB, TypeSafeDB, TypeUnsafeDB } from "./databases"

export type TyeSafeConnection<DB extends AnyDB & TypeSafeDB> = Connection<DB>
export type TyeUnsafeConnection<DB extends AnyDB & TypeUnsafeDB> = Connection<DB>

export type Connection<DB extends AnyDB> = AbstractConnection<DB>
