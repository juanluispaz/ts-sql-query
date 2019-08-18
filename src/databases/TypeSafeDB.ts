import { AnyDB } from "./AnyDB"

export interface TypeSafeDB extends AnyDB {
    __TypeSafe : 'TypeSafe'
}

export type TypeWhenSafeDB<DB extends AnyDB, when, els> = DB extends TypeSafeDB ? when : els