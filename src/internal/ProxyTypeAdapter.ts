import type { DefaultTypeAdapter, ProjectionOutput, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, TypeCategory } from '../TypeAdapter.js'

export class ProxyTypeAdapter implements TypeAdapter {
    typeAdapter: TypeAdapter

    constructor(typeAdapter: TypeAdapter) {
        this.typeAdapter = typeAdapter
    }

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueFromDB(value, type, typeCategory, context, next)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueToDB(value, type, typeCategory, context, next)
    }

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        if (this.typeAdapter.transformPlaceholder) {
            return this.typeAdapter.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB, context, next)
        }
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB, context)
    }

    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (this.typeAdapter.transformProjection) {
            return this.typeAdapter.transformProjection(sql, type, typeCategory, output, context, next)
        }
        return next.transformProjection(sql, type, typeCategory, output, context)
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