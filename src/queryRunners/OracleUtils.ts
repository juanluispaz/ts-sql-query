export function processOutBinds(params: any[], outBinds: any): any[] {
    if (!outBinds) {
        return []
    }
    if (!Array.isArray(outBinds)) {
        throw new Error('Invalid outBinds returned by the database')
    } 

    if (outBinds.length <= 0) {
        return []
    }

    const out = []
    for (let i = 0, length = params.length; i < length; i++) {
        const param = params[i]
        if (param && typeof param === 'object' && param.dir === 3003 /*oracledb.BIND_OUT*/ ) { // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
            out.push(param)
        }
    }

    const rows: any[][] = []
    let current: any[] = []
    rows.push(current)
    for (let i = 0, length = outBinds.length; i < length; i++) {
        const param: any = out[i]
        const name: string = param.as || ''
        const value = outBinds[i]

        if (current.length > 0 && name in current[0]) {
            current = []
            rows.push(current)
        }

        if (!Array.isArray(value)) {
            if (current.length <= 0) {
                current.push({})
            }
            current[0][name] = value
            continue
        }

        for (let j = current.length, length2 = value.length; j < length2; j++) {
            current[j] = {}
        }

        for (let j = 0, length2 = value.length; j < length2; j++) {
            current[j][name] = value[j]
        }
    }

    const result: any[] = []
    rows.forEach(value => {
        result.push(...value)
    })
    return result
}