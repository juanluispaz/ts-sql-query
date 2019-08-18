import { AnyDB } from "./AnyDB"

export interface TypeUnsafeDB extends AnyDB {
    __TypeUnsafe : 'TypeUnsafe'
}