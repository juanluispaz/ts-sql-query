import type { AnyValueSource, IValueSource, RemapValueSourceTypeWithOptionalType } from "../expressions/values"
import type { UsableKeyOf } from '../utils/objectUtils'
import type { NSource } from "../utils/sourceName"

/*
 * Reasign all columns to in a with view
 */

export type ColumnsForLeftJoin<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForLeftJoin<COLUMNS[K]>> 
        : ColumnsForLeftJoin2<SOURCE, COLUMNS[K]> 
    }

type ColumnsForLeftJoin2<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForLeftJoin<COLUMNS[K]>> 
        : ColumnsForLeftJoin3<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForLeftJoin3<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForLeftJoin<COLUMNS[K]>> 
        : ColumnsForLeftJoin4<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForLeftJoin4<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForLeftJoin<COLUMNS[K]>> 
        : ColumnsForLeftJoin5<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForLeftJoin5<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForLeftJoin<COLUMNS[K]>> 
        : COLUMNS[K] // Stop recursion
    }

type OptionalTypeForLeftJoin<TYPE> = 
    TYPE extends IValueSource<any, any, any, infer OPTIONAL_TYPE> ? (
        'required' extends OPTIONAL_TYPE
        ? 'originallyRequired'
        : OPTIONAL_TYPE
    ) : never