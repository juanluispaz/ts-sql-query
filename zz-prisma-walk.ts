const keys = (o: any) => o ? Reflect.ownKeys(o).map(String).join(', ') : String(o)
const proto = (o: any) => o ? Object.getOwnPropertyNames(Object.getPrototypeOf(o)).join(', ') : ''
async function main() {
    const { PrismaClient } = await import('./src/examples/prisma/generated/sqlite/client.js')
    const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3')
    const p: any = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: '/tmp/zzwalk.db' }) } as any)
    await p.$executeRawUnsafe('select 1')
    const e = p._engine
    console.log('engine ctor:', e.constructor.name, '| own:', keys(e)); console.log('engine proto:', proto(e))
    for (const k of Reflect.ownKeys(e)) { const v = (e as any)[k]; if (v && typeof v === 'object') console.log(' ', String(k), '<' + v.constructor?.name + '>', keys(v).slice(0, 300)) }
    await p.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe('select 1')
        const sym = Reflect.ownKeys(tx).find(k => String(k).includes('scope_context')) as any
        console.log('tx scope_context:', tx[sym] && keys(tx[sym]), JSON.stringify(tx[sym]))
    })
    await p.$disconnect()
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
