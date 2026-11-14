import type { DefaultTypeAdapter, SqlDataType, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'

export class ProxyTypeAdapter implements TypeAdapter {
    typeAdapter: TypeAdapter

    constructor(typeAdapter: TypeAdapter) {
        this.typeAdapter = typeAdapter
    }

    /** The SQL data type of the adapter it wraps */
    get sqlDataType(): SqlDataType | undefined {
        return this.typeAdapter.sqlDataType
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

// A proxy holds nothing but the adapter it wraps, so one per wrapped adapter is enough, and a caller that keys a cache by
// adapter identity only hits it if the proxy is the same object every time. It is kept in the adapter, hidden (not
// enumerable, under a symbol)
const proxyKey: unique symbol = Symbol('proxyTypeAdapter')

export function proxyTypeAdapterFor(typeAdapter: TypeAdapter): ProxyTypeAdapter {
    const proxy = (typeAdapter as { [proxyKey]?: ProxyTypeAdapter })[proxyKey]
    if (proxy !== undefined) {
        return proxy
    }
    const created = new ProxyTypeAdapter(typeAdapter)
    if (Object.isExtensible(typeAdapter)) {
        Object.defineProperty(typeAdapter, proxyKey, { value: created })
    }
    return created
}
