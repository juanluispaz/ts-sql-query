import type { AbstractConnection } from "./connections/AbstractConnection"
import type { AnyDB, TypeSafeDB, TypeUnsafeDB } from "./databases"
import type { SqlBuilder } from "./sqlBuilders/SqlBuilder"

export type TyeSafeConnection<DB extends AnyDB, NAME> = Connection<DB & TypeSafeDB, NAME> & TypeSafeDB
export type TyeUnsafeConnection<DB extends AnyDB, NAME> = Connection<DB & TypeUnsafeDB, NAME> & TypeUnsafeDB

export type Connection<DB extends AnyDB, NAME> = AbstractConnection<DB, NAME, SqlBuilder>
