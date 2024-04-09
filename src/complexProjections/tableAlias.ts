import type { AnyValueSource, RemapValueSourceType } from "../expressions/values"
import type { UsableKeyOf } from '../utils/objectUtils'
import type { NSource } from "../utils/sourceName"

/*
 * Reasign all columns to a new table/view alias
 */

export type ColumnsForAlias<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceType<SOURCE, COLUMNS[K]> 
        : ColumnsForAlias2<SOURCE, COLUMNS[K]> 
    }

type ColumnsForAlias2<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceType<SOURCE, COLUMNS[K]> 
        : ColumnsForAlias3<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForAlias3<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceType<SOURCE, COLUMNS[K]> 
        : ColumnsForAlias4<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForAlias4<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceType<SOURCE, COLUMNS[K]> 
        : ColumnsForAlias5<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForAlias5<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceType<SOURCE, COLUMNS[K]> 
        : COLUMNS[K] // Stop recursion
    }
