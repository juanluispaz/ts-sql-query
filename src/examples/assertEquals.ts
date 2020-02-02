export function assertEquals(v1: any, v2: any) {
    if (Array.isArray(v1)) {
        if (!Array.isArray(v2)) {
            throw new Error('not equals (not same type array) ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
        }
        if (v1.length !== v2.length) {
            throw new Error('not equals (not same length) ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
        }
        v1.forEach((_v, index) => {
            assertEquals(v1[index], v2[index])
        })
    } else if (v1 instanceof Date) {
        if (!(v2 instanceof Date)) {
            throw new Error('not equals (not same type date) ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
        }
        if ((v2 as any).__type__ === 'localDate' || (v1 as any).__type__ === 'localDate') {
            if (!(v1.getFullYear() === v2.getFullYear() && v1.getMonth() === v2.getMonth() && v1.getDate() === v2.getDate())) {
                throw new Error('not equals (not same localDate) ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
            }
        }
        if ((v2 as any).__type__ === 'localTime' || (v1 as any).__type__ === 'localTime') {
            if (!(v1.getHours() === v2.getHours() && v1.getMinutes() === v2.getMinutes() && v1.getSeconds() === v2.getSeconds() && v1.getMilliseconds() === v2.getMilliseconds())) {
                throw new Error('not equals (not same localTime)' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
            }
        }
        if (v1.getTime() !== v2.getTime()) {
            throw new Error('not equals ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
        }
    } else if (v1 === null || v1 === undefined) {
        if (!(v2 === null || v2 === undefined)) {
            throw new Error('not equals (null or undefined) ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
        }
    } else if (typeof v1 === 'object') {
        if (typeof v2 !== 'object') {
            throw new Error('not equals (not same tipe object) ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
        }
        for (let key in v1) {
            assertEquals(v1[key], v2[key])
        }
        for (let key in v2) {
            assertEquals(v1[key], v2[key])
        }
    } else if (v1 !== v2) {
        throw new Error('not equals ' + JSON.stringify(v1) + ' ' + JSON.stringify(v2))
    }
}