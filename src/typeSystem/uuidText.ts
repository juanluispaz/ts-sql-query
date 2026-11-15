import { StringType } from './strings.js'
import { computedType } from '../utils/symbols.js'

/**
 * The text of a uuid (`asString()`), for the run time only: TypeScript sees a `StringType`. Its SQL is still the uuid
 * (the native uuid of MariaDB, the `uniqueidentifier` of SQL Server): `asString()` writes no conversion, and the SQL
 * builder writes it where the text meets another text, and lowers the text read where the database gives it in upper
 * case. The value sources that keep the SQL of this one (`allowWhen`, `asOptional`, a column of a `with`, a select
 * used as a value, ...) keep this data type; a value computed from it (`concat`, `valueWhenNull`, `max`, ...) is a text.
 */
export abstract class UuidTextType extends StringType {
    /** A value computed from the text of a uuid is a text */
    static readonly [computedType] = StringType
}
