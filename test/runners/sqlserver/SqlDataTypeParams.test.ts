// A text compared with a varchar column that its SQL data type says isn't national (withSqlDataType) goes as a varchar:
// as a nvarchar, SQL Server converts the column, and with a SQL collation it reads its whole index. A text with a
// character outside ASCII still goes as a nvarchar, which keeps it. The type of the parameter and the plan are read
// from the plan cache.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { Table } from '../../../src/Table.js'
import { withSqlDataType } from '../../../src/TypeAdapter.js'
import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'

class DBConnection extends SqlServerConnection<'DBConnection'> { }
class TCode extends Table<DBConnection, 'TCode'> {
    id = this.primaryKey('id', 'int')
    code = this.column('code', 'string', withSqlDataType({ family: 'character string', length: 50, national: false }))
    plain = this.column('plain', 'string')
    constructor() {
        super('rt_sql_type_code')
    }
}
const tCode = new TCode()
class TUtf8 extends Table<DBConnection, 'TUtf8'> {
    id = this.primaryKey('id', 'int')
    code = this.column('code', 'string', withSqlDataType({ family: 'character string', length: 50, national: false, collation: 'Latin1_General_100_CI_AS_SC_UTF8' }))
    constructor() {
        super('rt_sql_type_utf8')
    }
}
const tUtf8 = new TUtf8()
// The types of the database, read from their names
const typesConnection = new DBConnection(new NoExecutionQueryRunner())
class TMoment extends Table<DBConnection, 'TMoment'> {
    id = this.primaryKey('id', 'int')
    at = this.column('at', 'localDateTime', withSqlDataType(typesConnection.sqlDataTypeFrom('datetime')))
    plain = this.column('plain', 'localDateTime')
    constructor() {
        super('rt_sql_type_moment')
    }
}
const tMoment = new TMoment()

describe.skipIf(!isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'))('SQL Server: a text of a column that is not national', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let pool: import('mssql').ConnectionPool | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        pool = await new db.mssql.ConnectionPool({ ...db.config, pool: { max: 2, min: 0 } }).connect()
        await pool.request().query(`drop table if exists rt_sql_type_code;
            create table rt_sql_type_code (id int primary key, code varchar(50) collate SQL_Latin1_General_CP1_CI_AS not null, plain varchar(50) collate SQL_Latin1_General_CP1_CI_AS not null);
            create index rt_sql_type_code_code on rt_sql_type_code (code);
            create index rt_sql_type_code_plain on rt_sql_type_code (plain);
            insert into rt_sql_type_code select top 5000 row_number() over (order by (select 1)), concat('c', row_number() over (order by (select 1))), concat('c', row_number() over (order by (select 1))) from sys.all_objects a cross join sys.all_objects b;
            insert into rt_sql_type_code values (0, 'ñu', 'ñu');
            update statistics rt_sql_type_code`)
    }, 300_000)
    afterAll(async () => {
        await pool?.request().query('drop table if exists rt_sql_type_code')
        await pool?.close()
        await db?.release()
    }, 300_000)

    /** The declaration of the parameters and the operators of the plan of the cached query that has that text */
    async function cached(sqlText: string): Promise<{ declaration: string, operators: string[] }> {
        const rows = (await pool!.request().input('text', db!.mssql.NVarChar, '%' + sqlText + '%').query(`select st.text as text, cast(qp.query_plan as nvarchar(max)) as plan_xml
            from sys.dm_exec_query_stats qs cross apply sys.dm_exec_sql_text(qs.sql_handle) st cross apply sys.dm_exec_query_plan(qs.plan_handle) qp
            where st.text like @text and st.text not like '%dm_exec_query_stats%'`)).recordset
        const row = rows[0]
        return {
            // The text of the query sent with sp_executesql starts with the declaration of its parameters
            declaration: String(row?.text ?? '').replace(/\s*select .*$/is, ''),
            operators: [...String(row?.plan_xml ?? '').matchAll(/PhysicalOp="([^"]+)"/g)].map(m => m[1]!).filter((op, i, all) => all.indexOf(op) === i),
        }
    }

    test('a-text-goes-as-a-varchar-and-the-index-is-sought', async () => {
        await pool!.request().query('dbcc freeproccache')
        const conn = new DBConnection(new MssqlPoolQueryRunner(pool!))
        expect(await conn.selectFrom(tCode).where(tCode.code.equals('c123')).selectOneColumn(tCode.id).executeSelectMany()).toEqual([123])
        expect(await conn.selectFrom(tCode).where(tCode.plain.equals('c124')).selectOneColumn(tCode.id).executeSelectMany()).toEqual([124])
        const declared = await cached('where code = @0')
        expect(declared.declaration).toBe('(@0 varchar(50))')
        expect(declared.operators).toContain('Index Seek')
        expect(declared.operators).not.toContain('Index Scan')
        // Without a SQL data type, a nvarchar: the column is converted and its index scanned
        const plain = await cached('where plain = @0')
        expect(plain.declaration).toMatch(/^\(@0 nvarchar\(\d+\)\)$/)
        expect(plain.operators).toContain('Index Scan')
    })

    test('a-text-outside-ascii-goes-as-a-nvarchar', async () => {
        await pool!.request().query('dbcc freeproccache')
        const conn = new DBConnection(new MssqlPoolQueryRunner(pool!))
        expect(await conn.selectFrom(tCode).where(tCode.code.equals('ñu')).selectOneColumn(tCode.id).executeSelectMany()).toEqual([0])
        expect((await cached('where code = @0')).declaration).toMatch(/^\(@0 nvarchar\(\d+\)\)$/)
    })

    test('a-text-longer-than-the-column-goes-as-a-varchar-max', async () => {
        await pool!.request().query('dbcc freeproccache')
        const conn = new DBConnection(new MssqlPoolQueryRunner(pool!))
        expect(await conn.selectFrom(tCode).where(tCode.code.equals('x'.repeat(60))).selectOneColumn(tCode.id).executeSelectMany()).toEqual([])
        expect((await cached('where code = @0')).declaration).toBe('(@0 varchar(max))')
    })
    test('a-text-outside-ascii-is-kept-also-in-a-column-of-a-utf8-collation', async () => {
        // As a varchar, tedious would write it in the code page of the database: '中文' would be stored as '??'
        await pool!.request().query('drop table if exists rt_sql_type_utf8; create table rt_sql_type_utf8 (id int primary key, code varchar(50) collate Latin1_General_100_CI_AS_SC_UTF8)')
        try {
            const conn = new DBConnection(new MssqlPoolQueryRunner(pool!))
            await conn.insertInto(tUtf8).set({ id: 1, code: '中文ñ€' }).executeInsert()
            expect((await pool!.request().query('select code from rt_sql_type_utf8')).recordset).toEqual([{ code: '中文ñ€' }])
        } finally {
            await pool!.request().query('drop table if exists rt_sql_type_utf8')
        }
    })
    test('a-date-and-time-of-a-datetime-column-goes-as-a-datetime', async () => {
        // As a datetime2, SQL Server compares the column with its exact fraction of 1/300 of a second, and an equality
        // doesn't find a value with milliseconds
        await pool!.request().query(`drop table if exists rt_sql_type_moment; create table rt_sql_type_moment (id int primary key, at datetime not null, plain datetime not null);
            insert into rt_sql_type_moment values (1, '2024-01-01T10:00:00.003', '2024-01-01T10:00:00.003'), (2, '2024-01-01T10:00:00.123', '2024-01-01T10:00:00.123')`)
        try {
            const conn = new DBConnection(new MssqlPoolQueryRunner(pool!))
            for (const [id, ms] of [[1, '003'], [2, '123']] as const) {
                const value = new Date(`2024-01-01T10:00:00.${ms}Z`)
                expect(await conn.selectFrom(tMoment).where(tMoment.at.equals(value)).selectOneColumn(tMoment.id).executeSelectMany()).toEqual([id])
                // Without its SQL data type, the limit: sent as a datetime2, not found
                expect(await conn.selectFrom(tMoment).where(tMoment.plain.equals(value)).selectOneColumn(tMoment.id).executeSelectMany()).toEqual([])
            }
        } finally {
            await pool!.request().query('drop table if exists rt_sql_type_moment')
        }
    })
})
