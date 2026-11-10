import type { DefaultTypeAdapter, ProjectionComparison, ProjectionOutput, TypeAdapter, TypeCategory } from '../TypeAdapter.js'

export class ProxyTypeAdapter implements TypeAdapter {
    typeAdapter: TypeAdapter

    constructor(typeAdapter: TypeAdapter) {
        this.typeAdapter = typeAdapter
    }

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueFromDB(value, type, typeCategory, next)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return this.typeAdapter.transformValueToDB(value, type, typeCategory, next)
    }

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        if (this.typeAdapter.transformPlaceholder) {
            return this.typeAdapter.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB, next)
        }
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB)
    }

    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean, next: DefaultTypeAdapter): boolean {
        if (this.typeAdapter.forceTypeCast) {
            return this.typeAdapter.forceTypeCast(type, typeCategory, valueSentToDB, forceTypeCast, next)
        }
        return next.forceTypeCast(type, typeCategory, valueSentToDB, forceTypeCast)
    }

    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (this.typeAdapter.transformProjection) {
            return this.typeAdapter.transformProjection(sql, type, typeCategory, output, next)
        }
        return next.transformProjection(sql, type, typeCategory, output)
    }

    projectionComparison(type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): ProjectionComparison {
        if (this.typeAdapter.projectionComparison) {
            return this.typeAdapter.projectionComparison(type, typeCategory, output, next)
        }
        return next.projectionComparison(type, typeCategory, output)
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