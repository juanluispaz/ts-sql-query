// Hand-written SQL, per database, for the query-runner tests in test/runners/.
//
// The runner tests call every QueryRunner method directly, so they write the
// SQL themselves — the same statement shapes the SqlBuilders emit for that
// database (placeholders come from the runner's own `addParam`/`addOutParam`,
// so each runner gets the placeholder style it expects). Two probe tables, a
// probe function and a probe procedure are created by `setup`:
//
//   rt_probe (id int primary key, name varchar(50) not null, amount int)
//   rt_auto  (id <database-generated> primary key, name varchar(50) not null)
//   rt_answer()  -> 42          (not on SQLite: no SQL-defined functions)
//   rt_touch()   does nothing   (not on SQLite: no procedures)

import type { DatabaseType, QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { addOutParam, addParam } from './params.js'

export interface RunnerDialect {
    readonly database: DatabaseType
    /** DDL run, in order, with executeDatabaseSchemaModification. */
    readonly setup: readonly string[]
    /** Suffix that makes a select without a table valid (` from dual` on Oracle). */
    readonly fromNoTable: string
    /** A selected column under its own lower-case name (Oracle upper-cases an unquoted one). */
    column(name: string): string
    /** A harmless session setting for executeConnectionConfiguration. */
    readonly connectionConfiguration: string
    /** `executeInsertReturningLastInsertedId` SQL inserting one rt_auto row. */
    insertReturningId(runner: QueryRunner, params: any[], name: string): string
    /** `executeInsertReturningMultipleLastInsertedId` SQL inserting several rt_auto rows; absent when the database can't. */
    readonly insertReturningIds?: (runner: QueryRunner, params: any[], names: readonly string[]) => string
    /** rt_probe mutations returning `id` and `name`; absent when the database has no RETURNING. */
    readonly insertReturningRow?: (runner: QueryRunner, params: any[], id: number, name: string) => string
    readonly updateReturningRow?: (runner: QueryRunner, params: any[], name: string, minId: number) => string
    readonly deleteReturningRow?: (runner: QueryRunner, params: any[], minId: number) => string
    /** One-column variants: returning `id` only. */
    readonly updateReturningId?: (runner: QueryRunner, params: any[], name: string, minId: number) => string
    readonly deleteReturningId?: (runner: QueryRunner, params: any[], minId: number) => string
    /** rt_probe rows inserted returning `id` and `name`. */
    readonly insertReturningRows?: (runner: QueryRunner, params: any[], rows: readonly { id: number, name: string }[]) => string
    /** `executeInsertReturningLastInsertedId` SQL that reads the id with a RETURNING clause, where the runner also has another way. */
    readonly insertReturningIdWithClause?: (runner: QueryRunner, params: any[], name: string) => string
    /** An rt_auto insert of an existing id that inserts nothing. */
    readonly insertNothing?: (runner: QueryRunner, params: any[], id: number) => string
    readonly procedureCall?: string
    readonly functionCall?: string
    /** Isolation levels the database offers through `connection.isolationLevel`. */
    readonly isolationLevels: readonly ('read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable')[]
    /** Offered levels the test database isn't configured for: the engine refuses the transaction once it reads a table. */
    readonly levelsNotEnabled?: readonly ('read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable')[]
    /** Whether `begin` takes a level together with an access mode. */
    readonly levelWithAccessMode: boolean
    /** Whether `begin` takes an access mode alone. */
    readonly accessModeAlone: boolean
    /** A statement that takes two seconds, for a driver's own timeout. */
    readonly sleep?: string
    /** A statement whose failure makes the database roll back the whole transaction it runs in, by itself. */
    readonly statementThatRollsBackTheTransaction?: string
    /**
     * A script of several statements for one executeDatabaseSchemaModification call, whose last statement creates the
     * table rt_script_b, and the statements that remove what it creates (they may fail when it doesn't exist).
     */
    readonly schemaScript: { readonly script: string, readonly cleanup: readonly string[] }
}

function returningClause(names: readonly string[]) {
    return ' returning ' + names.join(', ')
}

const sqliteLike = {
    insertReturningId: (r: QueryRunner, p: any[], name: string) => `insert into rt_auto (name) values (${addParam(r, p, name, 'string', undefined, false)})`,
}

export const postgresDialect: RunnerDialect = {
    database: 'postgreSql',
    setup: [
        'drop table if exists rt_probe',
        'drop table if exists rt_auto',
        'create table rt_probe (id integer primary key, name varchar(50) not null, amount integer)',
        'create table rt_auto (id integer generated by default as identity primary key, name varchar(50) not null)',
        'create or replace function rt_answer() returns integer language sql as $$ select 42 $$',
        'create or replace procedure rt_touch() language plpgsql as $$ begin null; end; $$',
    ],
    fromNoTable: '',
    column: (name) => name,
    connectionConfiguration: "set application_name = 'rt_probe'",
    schemaScript: {
        script: 'create table rt_script_a (id integer);\ncreate or replace function rt_script_f() returns integer language plpgsql as $$ begin return 1; end; $$;\ncreate table rt_script_b (id integer)',
        cleanup: ['drop table if exists rt_script_a', 'drop table if exists rt_script_b', 'drop function if exists rt_script_f'],
    },
    sleep: 'select pg_sleep(2)',
    insertReturningId: (r, p, name) => `insert into rt_auto (name) values (${addParam(r, p, name, 'string', undefined, false)}) returning id`,
    insertReturningIds: (r, p, names) => `insert into rt_auto (name) values ${names.map(n => '(' + addParam(r, p, n, 'string', undefined, false) + ')').join(', ')} returning id`,
    insertReturningRow: (r, p, id, name) => `insert into rt_probe (id, name) values (${addParam(r, p, id, 'int', undefined, false)}, ${addParam(r, p, name, 'string', undefined, false)})` + returningClause(['id', 'name']),
    updateReturningRow: (r, p, name, minId) => `update rt_probe set name = ${addParam(r, p, name, 'string', undefined, false)} where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + returningClause(['id', 'name']),
    deleteReturningRow: (r, p, minId) => `delete from rt_probe where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + returningClause(['id', 'name']),
    updateReturningId: (r, p, name, minId) => `update rt_probe set name = ${addParam(r, p, name, 'string', undefined, false)} where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + returningClause(['id']),
    deleteReturningId: (r, p, minId) => `delete from rt_probe where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + returningClause(['id']),
    insertReturningRows: (r, p, rows) => `insert into rt_probe (id, name) values ${rows.map(row => '(' + addParam(r, p, row.id, 'int', undefined, false) + ', ' + addParam(r, p, row.name, 'string', undefined, false) + ')').join(', ')}` + returningClause(['id', 'name']),
    procedureCall: 'call rt_touch()',
    functionCall: 'select rt_answer()',
    isolationLevels: ['read committed', 'snapshot', 'serializable'],
    levelWithAccessMode: true,
    accessModeAlone: true,
}

export const sqliteDialect: RunnerDialect = {
    database: 'sqlite',
    statementThatRollsBackTheTransaction: `insert or rollback into rt_probe (id, name) values (1, 'dup')`,
    setup: [
        'drop table if exists rt_probe',
        'drop table if exists rt_auto',
        'create table rt_probe (id integer primary key, name varchar(50) not null, amount integer)',
        'create table rt_auto (id integer primary key autoincrement, name varchar(50) not null)',
    ],
    fromNoTable: '',
    column: (name) => name,
    connectionConfiguration: 'pragma foreign_keys = on',
    schemaScript: {
        script: 'create table rt_script_a (id integer);\ncreate trigger rt_script_t after insert on rt_script_a begin select 1; end;\ncreate table rt_script_b (id integer)',
        cleanup: ['drop table if exists rt_script_a', 'drop table if exists rt_script_b'],
    },
    ...sqliteLike,
    insertReturningIds: (r, p, names) => `insert into rt_auto (name) values ${names.map(n => '(' + addParam(r, p, n, 'string', undefined, false) + ')').join(', ')} returning id`,
    insertReturningRow: postgresDialect.insertReturningRow!,
    updateReturningRow: postgresDialect.updateReturningRow!,
    deleteReturningRow: postgresDialect.deleteReturningRow!,
    updateReturningId: postgresDialect.updateReturningId!,
    deleteReturningId: postgresDialect.deleteReturningId!,
    insertReturningRows: postgresDialect.insertReturningRows!,
    insertReturningIdWithClause: (r, p, name) => `insert into rt_auto (name) values (${addParam(r, p, name, 'string', undefined, false)}) returning id`,
    insertNothing: (r, p, id) => `insert into rt_auto (id, name) values (${addParam(r, p, id, 'int', undefined, false)}, ${addParam(r, p, 'again', 'string', undefined, false)}) on conflict do nothing`,
    isolationLevels: [],
    levelWithAccessMode: false,
    accessModeAlone: false,
}

const mysqlSetup = [
    'drop table if exists rt_probe',
    'drop table if exists rt_auto',
    'create table rt_probe (id int primary key, name varchar(50) not null, amount int)',
    'create table rt_auto (id int auto_increment primary key, name varchar(50) not null)',
    'drop function if exists rt_answer',
    'create function rt_answer() returns int deterministic return 42',
    'drop procedure if exists rt_touch',
    'create procedure rt_touch() begin end',
]

export const mysqlDialect: RunnerDialect = {
    database: 'mySql',
    setup: mysqlSetup,
    fromNoTable: '',
    column: (name) => name,
    connectionConfiguration: 'set @rt_probe = 1',
    schemaScript: {
        script: 'create table rt_script_a (id int);\ncreate table rt_script_b (id int)',
        cleanup: ['drop table if exists rt_script_a', 'drop table if exists rt_script_b'],
    },
    ...sqliteLike,
    procedureCall: 'call rt_touch()',
    functionCall: 'select rt_answer()',
    insertNothing: (r, p, id) => `insert ignore into rt_auto (id, name) values (${addParam(r, p, id, 'int', undefined, false)}, ${addParam(r, p, 'again', 'string', undefined, false)})`,
    isolationLevels: ['read uncommitted', 'read committed', 'snapshot', 'serializable'],
    levelWithAccessMode: true,
    accessModeAlone: true,
}

export const mariadbDialect: RunnerDialect = {
    ...mysqlDialect,
    database: 'mariaDB',
    insertReturningIds: postgresDialect.insertReturningIds!,
    insertReturningRow: postgresDialect.insertReturningRow!,
    updateReturningRow: postgresDialect.updateReturningRow!,
    deleteReturningRow: postgresDialect.deleteReturningRow!,
    updateReturningId: postgresDialect.updateReturningId!,
    deleteReturningId: postgresDialect.deleteReturningId!,
    insertReturningRows: postgresDialect.insertReturningRows!,
    insertReturningIdWithClause: (r, p, name) => `insert into rt_auto (name) values (${addParam(r, p, name, 'string', undefined, false)}) returning id`,
}

function oracleReturningInto(r: QueryRunner, p: any[], names: readonly string[]) {
    return ' returning ' + names.join(', ') + ' into ' + names.map(n => addOutParam(r, p, n, '', undefined, false)).join(', ')
}

export const oracleDialect: RunnerDialect = {
    database: 'oracle',
    setup: [
        "begin execute immediate 'drop table rt_probe'; exception when others then if sqlcode != -942 then raise; end if; end;",
        "begin execute immediate 'drop table rt_auto'; exception when others then if sqlcode != -942 then raise; end if; end;",
        'create table rt_probe (id number(10) primary key, name varchar2(50) not null, amount number(10))',
        'create table rt_auto (id number(10) generated by default as identity primary key, name varchar2(50) not null)',
        'create or replace function rt_answer return number as begin return 42; end;',
        'create or replace procedure rt_touch as begin null; end;',
    ],
    fromNoTable: ' from dual',
    column: (name) => name + ' as "' + name + '"',
    connectionConfiguration: "alter session set nls_date_format = 'YYYY-MM-DD'",
    // Oracle runs one statement per call: a script is a PL/SQL block
    schemaScript: {
        script: "begin execute immediate 'create table rt_script_a (id number(10))'; execute immediate 'create table rt_script_b (id number(10))'; end;",
        cleanup: ['drop table rt_script_a', 'drop table rt_script_b'],
    },
    sleep: 'begin dbms_session.sleep(2); end;',
    insertReturningId: (r, p, name) => `insert into rt_auto (name) values (${addParam(r, p, name, 'string', undefined, false)}) returning id into ${addOutParam(r, p, '', 'int', undefined, false)}`,
    insertReturningRow: (r, p, id, name) => `insert into rt_probe (id, name) values (${addParam(r, p, id, 'int', undefined, false)}, ${addParam(r, p, name, 'string', undefined, false)})` + oracleReturningInto(r, p, ['id', 'name']),
    updateReturningRow: (r, p, name, minId) => `update rt_probe set name = ${addParam(r, p, name, 'string', undefined, false)} where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + oracleReturningInto(r, p, ['id', 'name']),
    deleteReturningRow: (r, p, minId) => `delete from rt_probe where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + oracleReturningInto(r, p, ['id', 'name']),
    updateReturningId: (r, p, name, minId) => `update rt_probe set name = ${addParam(r, p, name, 'string', undefined, false)} where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + oracleReturningInto(r, p, ['id']),
    deleteReturningId: (r, p, minId) => `delete from rt_probe where id >= ${addParam(r, p, minId, 'int', undefined, false)}` + oracleReturningInto(r, p, ['id']),
    procedureCall: 'begin rt_touch(); end;',
    functionCall: 'select rt_answer() from dual',
    isolationLevels: ['read committed', 'snapshot'],
    levelWithAccessMode: false,
    accessModeAlone: true,
}

function mssqlOutput(prefix: 'inserted' | 'deleted', names: readonly string[]) {
    return ' output ' + names.map(n => prefix + '.' + n).join(', ')
}

export const sqlServerDialect: RunnerDialect = {
    database: 'sqlServer',
    statementThatRollsBackTheTransaction: `insert into rt_probe (id, name) values (cast('a' as int), 'conversion')`,
    setup: [
        'drop table if exists rt_probe',
        'drop table if exists rt_auto',
        'create table rt_probe (id int primary key, name nvarchar(50) not null, amount int)',
        'create table rt_auto (id int identity(1,1) primary key, name nvarchar(50) not null)',
        'create or alter function dbo.rt_answer() returns int as begin return 42 end',
        'create or alter procedure rt_touch as begin return end',
    ],
    fromNoTable: '',
    column: (name) => name,
    connectionConfiguration: 'set nocount off',
    schemaScript: {
        script: 'create table rt_script_a (id int);\ncreate table rt_script_b (id int)',
        cleanup: ['drop table if exists rt_script_a', 'drop table if exists rt_script_b'],
    },
    sleep: "waitfor delay '00:00:02'",
    insertReturningId: (r, p, name) => `insert into rt_auto (name)${mssqlOutput('inserted', ['id'])} values (${addParam(r, p, name, 'string', undefined, false)})`,
    insertReturningIds: (r, p, names) => `insert into rt_auto (name)${mssqlOutput('inserted', ['id'])} values ${names.map(n => '(' + addParam(r, p, n, 'string', undefined, false) + ')').join(', ')}`,
    insertReturningRow: (r, p, id, name) => `insert into rt_probe (id, name)${mssqlOutput('inserted', ['id', 'name'])} values (${addParam(r, p, id, 'int', undefined, false)}, ${addParam(r, p, name, 'string', undefined, false)})`,
    updateReturningRow: (r, p, name, minId) => `update rt_probe set name = ${addParam(r, p, name, 'string', undefined, false)}${mssqlOutput('inserted', ['id', 'name'])} where id >= ${addParam(r, p, minId, 'int', undefined, false)}`,
    deleteReturningRow: (r, p, minId) => `delete from rt_probe${mssqlOutput('deleted', ['id', 'name'])} where id >= ${addParam(r, p, minId, 'int', undefined, false)}`,
    updateReturningId: (r, p, name, minId) => `update rt_probe set name = ${addParam(r, p, name, 'string', undefined, false)}${mssqlOutput('inserted', ['id'])} where id >= ${addParam(r, p, minId, 'int', undefined, false)}`,
    deleteReturningId: (r, p, minId) => `delete from rt_probe${mssqlOutput('deleted', ['id'])} where id >= ${addParam(r, p, minId, 'int', undefined, false)}`,
    insertReturningRows: (r, p, rows) => `insert into rt_probe (id, name)${mssqlOutput('inserted', ['id', 'name'])} values ${rows.map(row => '(' + addParam(r, p, row.id, 'int', undefined, false) + ', ' + addParam(r, p, row.name, 'string', undefined, false) + ')').join(', ')}`,
    procedureCall: 'exec rt_touch',
    functionCall: 'select dbo.rt_answer()',
    isolationLevels: ['read uncommitted', 'read committed', 'repeatable read', 'snapshot', 'serializable'],
    // The test database runs without ALLOW_SNAPSHOT_ISOLATION (see test/LIMITATIONS.md).
    levelsNotEnabled: ['snapshot'],
    levelWithAccessMode: false,
    accessModeAlone: false,
}
