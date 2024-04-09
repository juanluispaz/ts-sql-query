import type { AnyValueSource, IValueSource, RemapValueSourceTypeWithOptionalType } from "../expressions/values"
import type { Expand, UsableKeyOf } from '../utils/objectUtils'
import type { NSource } from "../utils/sourceName"

/*
 * Reasign all columns to in a with view
 */

export type ColumnsForWithView<SOURCE extends NSource, COLUMNS> = Expand<
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForWith<COLUMNS[K]>> 
        : ColumnsForWithView2<SOURCE, COLUMNS[K]> 
    }
>

type ColumnsForWithView2<SOURCE extends NSource, COLUMNS> = Expand<
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForWith<COLUMNS[K]>> 
        : ColumnsForWithView3<SOURCE, COLUMNS[K]> 
    }
>
    
type ColumnsForWithView3<SOURCE extends NSource, COLUMNS> = Expand<
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForWith<COLUMNS[K]>> 
        : ColumnsForWithView4<SOURCE, COLUMNS[K]> 
    }
>
    
type ColumnsForWithView4<SOURCE extends NSource, COLUMNS> = Expand<
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForWith<COLUMNS[K]>> 
        : ColumnsForWithView5<SOURCE, COLUMNS[K]> 
    }
>
    
type ColumnsForWithView5<SOURCE extends NSource, COLUMNS> = Expand<
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], OptionalTypeForWith<COLUMNS[K]>> 
        : COLUMNS[K] // Stop recursion
    }
>

type OptionalTypeForWith<TYPE> = 
    TYPE extends IValueSource<any, any, any, infer OPTIONAL_TYPE> ? (
        'required' extends OPTIONAL_TYPE
        ? 'required'
        : 'optional'
    ) : never