import type { NDB } from "./sourceName"
import type { connection } from "./symbols"

export interface IConnection</*in|out*/ DB extends NDB> {
    [connection]: DB
}