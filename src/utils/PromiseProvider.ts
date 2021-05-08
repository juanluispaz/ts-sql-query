export type PromiseProvider = PromiseConstructorLike & {
    resolve: typeof Promise.resolve,
    reject: typeof Promise.reject,
    /* Not all providers have compatible interface, by example:
     * synchronous-promise doesn't provide an definition so detailed like the ones included in the standar library
     */
    // all: typeof Promise.all, 
    all(values: any[]): Promise<any[]>, 
    /* Not all providers support it, by example: 
     * synchronous-promise doesn't provide an implementation of it
     */
    // race: typeof Promise.race, 
    /* So new, introduced in ES2020. Not all providers have compatible interface, by example:
     * synchronous-promise doesn't provide an definition compatible with the ones included in the standar library
     */
    // allSettled: typeof Promise.allSettled
}

export type UnwrapPromise<P extends any> = P extends Promise<infer R> ? R : P
export type UnwrapPromiseTuple<Tuple extends any[]> = {
  [K in keyof Tuple]: UnwrapPromise<Tuple[K]>
}