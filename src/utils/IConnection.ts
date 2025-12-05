import type { NDB } from './sourceName.js'
import type { connection } from './symbols.js'

export interface IConnection</*in|out*/ DB extends NDB> {
    [connection]: DB
}