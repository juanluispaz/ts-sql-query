// The queries the review runs against the uuid and decimal extensions, and how their results are printed.

export const probeQueries = [
    "select sqlite_version() v",
    "select length(uuid()) len, uuid_str(uuid_blob('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) s, uuid_str('{a0eebc99-9c0b4ef8-bb6d-6bb9bd380a11}') braces",
    "select decimal_add('0.1','0.2') a, decimal_mul('1.50','2.00') m, decimal_mul('1.10','3') m2, decimal_sub('1.50','1.5') s, decimal_cmp('1.50','1.5') c, decimal_cmp('10','9') c2",
    "select decimal_add('123456789012345678901234567890','0.0000000001') big",
    // Bugs of the released decimal.c (fixed on SQLite's development branch after 3.54.1): -1 and "out of memory"
    "select decimal_cmp('.5','2.5E-2') exponent",
    "select decimal_add(null,'1') nullAdd",
    // SQLite's own behaviour, not a bug: '0'
    "with t(v) as (values (null),(null)) select decimal_sum(v) allNullSum from t",
    "with t(v) as (values ('1.50'),('-10'),('9'),('10.00'),('0.1'),('1.5')) select group_concat(v, ' ') ordered from (select v from t order by v collate decimal)",
]

export function run(name: string, get: (sql: string) => unknown): void {
    for (const sql of probeQueries) {
        try {
            console.log(name, JSON.stringify(get(sql)))
        } catch (e) {
            console.log(name, 'ERROR', sql.slice(0, 40), e instanceof Error ? e.message : e)
        }
    }
}

