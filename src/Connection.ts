import { AnyDB } from "./databases/AnyDB"
import { TypeSafeDB } from "./databases/TypeSafeDB"
import { TypeUnsafeDB } from "./databases/TypeUnsafeDB"
import { AbstractConnection } from "./connections/AbstractConnection"
import { SqlBuilder } from "./sqlBuilders/SqlBuilder"

export type TyeSafeConnection<DB extends AnyDB, NAME> = Connection<DB & TypeSafeDB, NAME> & TypeSafeDB
export type TyeUnsafeConnection<DB extends AnyDB, NAME> = Connection<DB & TypeUnsafeDB, NAME> & TypeUnsafeDB

export type Connection<DB extends AnyDB, NAME> = AbstractConnection<DB, NAME, SqlBuilder>
