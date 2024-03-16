import type { IRawFragment } from "./ITableOrView"
import type { NSource } from "./sourceName"

export interface RawFragment</*in|out*/ SOURCE extends NSource> extends IRawFragment<SOURCE> {
}
