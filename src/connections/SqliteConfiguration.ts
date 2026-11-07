export type SqliteDateTimeFormat = 'localdate seconds as text' | 'localdate milliseconds as text'
    | 'localdate seconds as text using T separator' | 'localdate milliseconds as text using T separator'
    | 'UTC seconds as text' | 'UTC milliseconds as text'
    | 'UTC seconds as text using T separator' | 'UTC milliseconds as text using T separator'
    | 'UTC seconds as text using Z timezone' | 'UTC milliseconds as text using Z timezone'
    | 'UTC seconds as text using T separator and Z timezone' | 'UTC milliseconds as text using T separator and Z timezone'
    | 'Julian day as real number' | 'Unix time seconds as integer' | 'Unix time milliseconds as integer'

export type SqliteDateTimeFormatType = 'date' | 'time' | 'dateTime'