/*
 * Note: 
 * - DB argument is not enforced to make easier to TS process it
 * - Sorces at enforced at the end of the process
 * - Source names always ends in / to easy infering matches
 * 
 * Possible strings (using $ for interponated values)
 * 
 * Connection
 * - NConnection:             $DB_TYPE:$DB_NAME/
 * - NDB (NConnection alias): $DB_TYPE:DB_$NAME/
 * 
 * Source of data:
 * - NTable:                  $DB_TYPE:DB_$NAME/table:$NAME/
 * - NTable (with alias):     $DB_TYPE:DB_$NAME/table:$NAME/alias:$ALIAS/
 * - NView:                   $DB_TYPE:DB_$NAME/view:$NAME/
 * - NView (with alias):      $DB_TYPE:DB_$NAME/view:$NAME/alias:$ALIAS/
 * - NValues:                 $DB_TYPE:DB_$NAME/values:$NAME/
 * - NValues (with alias):    $DB_TYPE:DB_$NAME/values:$NAME/alias:$ALIAS/
 * - NWith:                   $DB_TYPE:DB_$NAME/with:$NAME/
 * - NWith (with alias):      $DB_TYPE:DB_$NAME/with:$NAME/alias:$ALIAS/
 * 
 * Source of data (for left join):
 * - NTable:                  $DB_TYPE:DB_$NAME/leftJoin-table:$NAME/
 * - NTable (with alias):     $DB_TYPE:DB_$NAME/leftJoin-table:$NAME/alias:$ALIAS/
 * - NView:                   $DB_TYPE:DB_$NAME/leftJoin-view:$NAME/
 * - NView (with alias):      $DB_TYPE:DB_$NAME/leftJoin-view:$NAME/alias:$ALIAS/
 * - NValues:                 $DB_TYPE:DB_$NAME/leftJoin-values:$NAME/
 * - NValues (with alias):    $DB_TYPE:DB_$NAME/leftJoin-values:$NAME/alias:$ALIAS/
 * - NWith:                   $DB_TYPE:DB_$NAME/leftJoin-with:$NAME/
 * - NWith (with alias):      $DB_TYPE:DB_$NAME/leftJoin-with:$NAME/alias:$ALIAS/
 * 
 * Special source of data:
 * - NNoTableOrViewRequired:  $DB_TYPE:DB_$NAME/noTableOrViewRequired/
 * - NOldValues:              $DB_TYPE:DB_$NAME/oldValues:$NAME/
 * - NValuesForInsert:        $DB_TYPE:DB_$NAME/valuesForInsert:$NAME/
 * - NRecursive:              $DB_TYPE:DB_$NAME/recursive/
 * - NCompoundable (select):  $DB_TYPE:DB_$NAME/compoundable/
 * 
 * Customized tables or views:
 * The original $NAME will be extended with +customizedAs~$CUSTOMIZATION_NAME
 */
export type NDbType ='mariaDB' | 'mySql' | 'noopDB' | 'oracle' | 'postgreSql' | 'sqlite' | 'sqlServer'
export type NGetDBTypeFrom<SOURCE extends NSource> = SOURCE extends `${infer DB_TYPE extends NDbType}:${any}` ? DB_TYPE : never // Not ended to match any
export type NGetDBNameFrom<SOURCE extends NSource> = SOURCE extends `${NDbType}:${infer DB_NAME}/${any}` ? DB_NAME : never // Not ended to match any
export type NConnection<DB_TYPE extends NDbType, DB_NAME extends string> = `${DB_TYPE}:${DB_NAME}/`
export type NDBWithType<DB_TYPE extends NDbType> = `${DB_TYPE}:${any}` // Not ended to match any
export type NDB = string // NDBConnection<NDbType, string>
export type NGetDBFrom<SOURCE extends NSource> = SOURCE extends `${infer DB_TYPE extends NDbType}:${infer NAME}/${any}` ? NConnection<DB_TYPE, NAME> : never // Not ended to match any
export type NWithDB<DB extends NDB> = `${DB}${any}` // Not ended to match any
export type NWithSameDB<SOURCE extends NSource> = `${NGetDBFrom<SOURCE>}${any}` // Not ended to match any
export type NTable<DB extends string /* IDB */, NAME extends string> = `${DB}table:${NAME}/`
/** deprecated */
export type NTableOf<_DB extends string /* IDB */, _NAME extends string> = string // NTable<_DB, _NAME>
export type NView<DB extends string /* IDB */, NAME extends string> = `${DB}view:${NAME}/`
export type NValues<DB extends string /* IDB */, NAME extends string> = `${DB}values:${NAME}/`
export type NWith<DB extends string /* IDB */, NAME extends string> = `${DB}with:${NAME}/`
export type NWithFrom<SOURCE extends NSource, NAME extends string> = NWith<NGetDBFrom<SOURCE>, NAME>
export type NAlias<SOURCE extends string /* NSource without alias*/, ALIAS extends string> = `${SOURCE}alias:${ALIAS}/`
export type NMaybyAliased<SOURCE extends string /* NSource without alias*/> = `${SOURCE}${any}` // Not ended to match any
export type NNoTableOrViewRequired<DB extends NDB> = `${DB}noTableOrViewRequired/`
export type NAnyNoTableOrViewRequired = `${any}/noTableOrViewRequired/`
export type NNoTableOrViewRequiredFrom<SOURCE extends NSource> = NNoTableOrViewRequired<NGetDBFrom<SOURCE>>
export type NOldValues<DB extends string /* IDB */, NAME extends string> = `${DB}oldValues:${NAME}/`
export type NOldValuesFrom<SOURCE extends NSource> = NOldValues<NGetDBFrom<SOURCE>, NGetNameFrom<SOURCE>>
export type NValuesForInsert<DB extends string /* IDB */, NAME extends string> = `${DB}valuesForInsert:${NAME}/`
export type NValuesForInsertFrom<SOURCE extends NSource> = NValuesForInsert<NGetDBFrom<SOURCE>, NGetNameFrom<SOURCE>>
export type NRecursive<DB extends string /* IDB */> = `${DB}recursive/`
export type NRecursiveFrom<SOURCE extends NSource> = NRecursive<NGetDBFrom<SOURCE>>
export type NCompoundable<DB extends string /* IDB */> = `${DB}compoundable/`
export type NCompoundableFrom<SOURCE extends NSource> = NRecursive<NGetDBFrom<SOURCE>>
export type NSource = string // Combines all source type in table, view, values, etc.
export type NType = 'table' | 'view' | 'values' | 'with' /* Specia types with name: */ | 'oldValues' | 'valuesForInsert'
export type NJoinType = 'leftJoin'
export type NGetNameFrom<SOURCE extends NSource> = 
    SOURCE extends `${NDbType}:${any}/${NType}:${infer NAME}/${any}` 
    ? NAME 
    : SOURCE extends `${NDbType}:${any}/${NJoinType}-${NType}:${infer NAME}/${any}` 
    ? NAME 
    : never
     // Not ended to match any
export type NAsLeftJoin<SOURCE extends NSource> = SOURCE extends `${infer DB_TYPE extends NDbType}:${infer DB_NAME}/${infer REST}` ? `${DB_TYPE}:${DB_NAME}/leftJoin-${REST}` : never // Not ended to match any
export type NAnyLeftJoin = `${any}/leftJoin-${any}` // Not ended to match any
export type NCustomizeAs<SOURCE extends NSource, CUSTOMIZATION_NAME extends string> = 
    SOURCE extends `${infer DB_TYPE extends NDbType}:${infer DB_NAME}/${infer TYPE extends NType}:${infer NAME}/${infer REST}`
    ? `${DB_TYPE}:${DB_NAME}/${TYPE}:${NAME}+customizedAs~${CUSTOMIZATION_NAME}/${REST}`
    : SOURCE extends `${infer DB_TYPE extends NDbType}:${infer DB_NAME}/${infer JOIN_TYPE extends NJoinType}-${infer TYPE extends NType}:${infer NAME}/${infer REST}`
    ? `${DB_TYPE}:${DB_NAME}/${JOIN_TYPE}-${TYPE}:${NAME}+customizedAs~${CUSTOMIZATION_NAME}/${REST}`
    : never
    // Not ended to match any