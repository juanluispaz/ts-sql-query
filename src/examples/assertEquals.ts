export function assertEquals(first: any, second: any) {
    const result = verifyEquals(first, second, '')
    if (result) {
        throw new Error(result)
    }
}

function verifyEquals(first: any, second: any, path: string = '') : string | undefined {
    if (Array.isArray(first)) {
        if (!Array.isArray(second)) {
            return 'not equals (not same type array)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
        }
        if (first.length !== second.length) {
            return 'not equals (not same length)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
        }
        for (let index = 0, length = first.length; index < length; index++) {
            const result = verifyEquals(first[index], second[index], path + '[' + index + ']')
            if (result) {
                return result
            }
        }
    } else if (first instanceof Date) {
        if (!(second instanceof Date)) {
            return 'not equals (not same type date)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
        }
        if ((second as any).___type___ === 'localDate' || (first as any).___type___ === 'localDate') {
            if (!(first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate())) {
                return 'not equals (not same localDate)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
            }
        } else if ((second as any).___type___ === 'localTime' || (first as any).___type___ === 'localTime') {
            if (!(first.getHours() === second.getHours() && first.getMinutes() === second.getMinutes() && first.getSeconds() === second.getSeconds() && first.getMilliseconds() === second.getMilliseconds())) {
                return 'not equals (not same localTime)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
            }
        } else if (first.getTime() !== second.getTime()) {
            return 'not equals (date)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
        }
    } else if (first === null || first === undefined) {
        if (!(second === null || second === undefined)) {
            return 'not equals (null or undefined)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
        }
    } else if (typeof first === 'object') {
        if (typeof second !== 'object') {
            return 'not equals (not same object type)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
        }
        for (let key in first) {
            const result = verifyEquals(first[key], second[key], path + '.' + key)
            if (result) {
                return result
            }
        }
        for (let key in second) {
            const result = verifyEquals(first[key], second[key], path + '.' + key)
            if (result) {
                return result
            }
        }
    } else if (first !== second) {
        if (typeof first === 'string') {
            if (typeof second === 'string') {
                return 'not equals (===)\nFirst:  ' + first + '\nSecond: ' + second + '\nPath: ' + path
            } else {
                return 'not equals (===)\nFirst:  ' + first + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
            }
        } else {
            if (typeof second === 'string') {
                return 'not equals (===)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + second + '\nPath: ' + path
            } else {
                return 'not equals (===)\nFirst:  ' + JSON.stringify(first) + '\nSecond: ' + JSON.stringify(second) + '\nPath: ' + path
            }
        }
    }
    return undefined
}