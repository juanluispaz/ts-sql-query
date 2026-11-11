// The words that are written quoted when they are an identifier of a query (`_isReservedKeyword` of the SQL builder)

// Source: the keywords of https://www.sqlite.org/lang_keywords.html (147, page of 2022-11-26), each one measured
// unquoted as an identifier in every position where the library writes one (table name in from, joins, insert into,
// update and delete from; table alias after `as`; column bare and qualified, in the select list, where, expressions,
// function arguments, order by, group by, having, insert columns, update set, on conflict target and set, excluded,
// returning; column alias after `as`, and referenced in order by and from a subquery; name and columns of a `with`
// and of values). A word is here when, unquoted, it fails or changes the meaning in at least one of those positions
// on at least one of SQLite 3.51.0 (bun:sqlite, Bun's node:sqlite), 3.53.0 (node:sqlite, Node 26), 3.53.4
// (better-sqlite3) and 3.54.1 (@sqlite.org/sqlite-wasm). The other keywords are accepted as identifiers by SQLite's
// fallback rules in all of them, with the same result as quoted
// TRUE, FALSE and NULL are here on every database, also where it accepts them as a name: quoted, a name is never
// read as the value it looks like
const reservedWords: { [word: string]: boolean | undefined } = {
    ADD: true,
    ALL: true,
    ALTER: true,
    AND: true,
    AS: true,
    AUTOINCREMENT: true,
    BETWEEN: true,
    CASE: true,
    CAST: true,
    CHECK: true,
    COLLATE: true,
    COMMIT: true,
    CONSTRAINT: true,
    CREATE: true,
    CURRENT_DATE: true,
    CURRENT_TIME: true,
    CURRENT_TIMESTAMP: true,
    DEFAULT: true,
    DEFERRABLE: true,
    DELETE: true,
    DISTINCT: true,
    DROP: true,
    ELSE: true,
    ESCAPE: true,
    EXCEPT: true,
    EXISTS: true,
    FALSE: true,
    FOREIGN: true,
    FROM: true,
    GROUP: true,
    HAVING: true,
    IN: true,
    INDEX: true,
    INSERT: true,
    INTERSECT: true,
    INTO: true,
    IS: true,
    ISNULL: true,
    JOIN: true,
    LIMIT: true,
    NOT: true,
    NOTHING: true,
    NOTNULL: true,
    NULL: true,
    ON: true,
    OR: true,
    ORDER: true,
    PRIMARY: true,
    RAISE: true,
    RECURSIVE: true,
    REFERENCES: true,
    RETURNING: true,
    SELECT: true,
    SET: true,
    TABLE: true,
    THEN: true,
    TO: true,
    TRANSACTION: true,
    TRUE: true,
    UNION: true,
    UNIQUE: true,
    UPDATE: true,
    USING: true,
    VALUES: true,
    WHEN: true,
    WHERE: true,
    WINDOW: true,
    WITH: true
}

/** Whether the word, in any case, is quoted when it is an identifier */
export function isSqliteReservedWord(word: string): boolean {
    return word.toUpperCase() in reservedWords
}
