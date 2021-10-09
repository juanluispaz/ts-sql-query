import { DefaultTypeAdapter, TypeAdapter } from "../TypeAdapter"

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
}