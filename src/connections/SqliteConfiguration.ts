export type SqliteDateTimeFormat = 'localdate as text' | 'localdate as text using T separator' 
    | 'UTC as text' | 'UTC as text using T separator' | 'UTC as text using Z timezone' | 'UTC as text using T separator and Z timezone' 
    | 'Julian day as real number' | 'Unix time seconds as integer' | 'Unix time milliseconds as integer'

export type SqliteDateTimeFormatType = 'date' | 'time' | 'dateTime'