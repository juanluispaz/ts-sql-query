import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'

export class ProxyTypeAdapter implements TypeAdapter {
    typeAdapter: TypeAdapter

    constructor(typeAdapter: TypeAdapter) {
        this.typeAdapter = typeAdapter
    }

    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueFromDB(value, context, next)
    }

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueToDB(value, context, next)
    }

    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        if (this.typeAdapter.transformPlaceholder) {
            return this.typeAdapter.transformPlaceholder(placeholder, context, next)
        }
        return next.transformPlaceholder(placeholder, context)
    }

    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (this.typeAdapter.transformProjection) {
            return this.typeAdapter.transformProjection(sql, context, next)
        }
        return next.transformProjection(sql, context)
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