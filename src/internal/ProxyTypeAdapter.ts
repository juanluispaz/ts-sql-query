import type { DefaultTypeAdapter, TypeAdapter } from '../TypeAdapter.js'

export class ProxyTypeAdapter implements TypeAdapter {
    typeAdapter: TypeAdapter

    constructor(typeAdapter: TypeAdapter) {
        this.typeAdapter = typeAdapter
    }

    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueFromDB(value, type, next)
    }

    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueToDB(value, type, next)
    }

    transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        if (this.typeAdapter.transformPlaceholder) {
            return this.typeAdapter.transformPlaceholder(placeholder, type, forceTypeCast, valueSentToDB, next)
        }
        return next.transformPlaceholder(placeholder, type, forceTypeCast, valueSentToDB)
    }
}

// A proxy holds nothing but the adapter it wraps, so one per wrapped adapter is enough — and a caller that keys a
// cache by adapter IDENTITY only hits it if the proxy is the same object every time.
const proxies = new WeakMap<TypeAdapter, ProxyTypeAdapter>()

export function proxyTypeAdapterFor(typeAdapter: TypeAdapter): ProxyTypeAdapter {
    let proxy = proxies.get(typeAdapter)
    if (!proxy) {
        proxy = new ProxyTypeAdapter(typeAdapter)
        proxies.set(typeAdapter, proxy)
    }
    return proxy
}