import type { AnyValueSource, IValueSource, RemapValueSourceTypeWithOptionalType } from '../expressions/values.js'
import type { Expand, UsableKeyOf } from '../utils/objectUtils.js'
import type { NSource } from '../utils/sourceName.js'

/*
 * Reasign all columns to in a with view
 */

export type ColumnsForWithView<SOURCE extends NSource, COLUMNS> =
    // A one-column select (`selectOneColumn(...)`) carries the column itself as
    // COLUMNS instead of an object of named columns. At runtime it is stored
    // under the `result` key (the same name the inline-value path reads), so the
    // with view exposes a single `result` column — mirror that in the type
    // instead of collapsing to `{}` (which would leave the recursive member with
    // no column to join on).
    COLUMNS extends AnyValueSource
    ? Expand<{ result: RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS, OptionalTypeForWith<COLUMNS>> }>
    : Expand<
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