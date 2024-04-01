import type { AnyValueSource, IValueSource, OptionalTypeRequiredOrAny, RemapIValueSourceTypeWithOptionalType } from "../expressions/values"
import type { UsableKeyOf } from '../utils/objectUtils'
import type { NSource } from "../utils/sourceName"

/*
 * Used as type mark in compoundable select, for union, union all, intersect, intersect all, except, except all, minus, minus all;
 * as well in recursive union and recursive union all.
 * 
 * This allows to ensure the types has excatly the same columns.
 */

export type ColumnsForCompound<SOURCE extends NSource, COLUMNS> = COLUMNS extends AnyValueSource 
    ? RemapIValueSourceTypeWithOptionalType<SOURCE, COLUMNS, CompoundColumnOptionalType<COLUMNS>> 
    : ColumnsForCompound1<SOURCE, COLUMNS>

type ColumnsForCompound1<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapIValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], CompoundColumnOptionalType<COLUMNS[K]>> 
        : ColumnsForCompound2<SOURCE, COLUMNS[K]> 
    }

type ColumnsForCompound2<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapIValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], CompoundColumnOptionalType<COLUMNS[K]>> 
        : ColumnsForCompound3<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForCompound3<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapIValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], CompoundColumnOptionalType<COLUMNS[K]>> 
        : ColumnsForCompound4<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForCompound4<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapIValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], CompoundColumnOptionalType<COLUMNS[K]>> 
        : ColumnsForCompound5<SOURCE, COLUMNS[K]> 
    }
    
type ColumnsForCompound5<SOURCE extends NSource, COLUMNS> =
    { [K in UsableKeyOf<COLUMNS>]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapIValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], CompoundColumnOptionalType<COLUMNS[K]>> 
        : COLUMNS[K] // Stop recursion
    }

type CompoundColumnOptionalType<COLUMN> = 
    COLUMN extends IValueSource<any, any, any, infer OPTIONAL_TYPE> 
    ? OptionalTypeRequiredOrAny<OPTIONAL_TYPE>
    : never