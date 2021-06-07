import { AnyDB } from "../databases"
import { database, rawFragment } from "./symbols"

export class RawFragment<DB extends AnyDB> {
    [rawFragment]: 'rawFragment'
    [database]: DB
}