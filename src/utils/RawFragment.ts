import type { IRawFragment } from './ITableOrView.js'
import type { NSource } from './sourceName.js'

export interface RawFragment</*in|out*/ SOURCE extends NSource> extends IRawFragment<SOURCE> {
}
