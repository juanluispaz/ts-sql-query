// The zone the configuration of a PostgreSQL connection gives the session, read without a query (see processTimeZone.ts)

/**
 * The zone a `TimeZone` setting in the `options` of a PostgreSQL connection gives the session (the command-line
 * options of the server: `-c TimeZone=…` or `--TimeZone=…`, separated by spaces, a `\` escaping the next character;
 * the name of the setting in any case; the last one wins, as in the server), or undefined when it sets none.
 */
export function postgreSqlOptionsTimeZone(options: unknown): string | undefined {
    if (typeof options !== 'string') {
        return undefined
    }
    const words: string[] = []
    let word = ''
    let inWord = false
    for (let i = 0; i < options.length; i++) {
        const c = options[i]!
        if (c === '\\' && i + 1 < options.length) {
            word += options[++i]
            inWord = true
        } else if (/\s/.test(c)) {
            if (inWord) {
                words.push(word)
            }
            word = ''
            inWord = false
        } else {
            word += c
            inWord = true
        }
    }
    if (inWord) {
        words.push(word)
    }
    let timeZone: string | undefined
    for (let i = 0; i < words.length; i++) {
        let setting: string | undefined
        const w = words[i]!
        if (w === '-c') {
            setting = words[++i]
        } else if (w.startsWith('-c')) {
            setting = w.slice(2)
        } else if (w.startsWith('--')) {
            setting = w.slice(2)
        }
        if (setting === undefined) {
            continue
        }
        const equals = setting.indexOf('=')
        if (equals >= 0 && setting.slice(0, equals).replace(/-/g, '_').toLowerCase() === 'timezone') {
            timeZone = setting.slice(equals + 1)
        }
    }
    return timeZone
}
