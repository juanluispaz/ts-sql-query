// The MySQL / MariaDB engine mapper shared by mysql2, mariadb and Bun SQL: the
// paths a driver reaches when it gives no error number the active catalog knows
// (the SQLSTATE, the symbol, the message), and the numbers both engines reuse.

import type { DatabaseType } from '../../../../src/queryRunners/QueryRunner.js'
import { getMySqlMariaDbEngineErrorReason, isMySqlMariaDbEngineError } from '../../../../src/queryRunners/databaseErrorMappers/MySqlMariaDbErrorMapper.js'
import { describeSyntheticErrors, driverError, type SyntheticErrorMapper } from './syntheticErrors.js'

// SIGNAL SQLSTATE '...' SET MYSQL_ERRNO = 9999: a number outside both catalogs
const signal = 'MySQL / MariaDB SIGNAL ... SET MYSQL_ERRNO'
const sqlStateClass = 'SQLSTATE classes (ISO/IEC 9075)'
// A server error packet that arrives with no command in the queue: the code only, no number nor SQLSTATE
const codeOnly = 'mysql2/lib/base/connection.js (protocolError)'
const mysqlMessages = 'MySQL share/messages_to_clients.txt'
const mariadbMessages = 'MariaDB sql/share/errmsg-utf8.txt'

interface EngineErrorFields {
    errno?: number | undefined
    code?: string | undefined
    sqlState?: string | undefined
}

function engineMapper(database: DatabaseType | undefined): SyntheticErrorMapper {
    return {
        getErrorReason: (error) => {
            const e = error as Error & EngineErrorFields
            return getMySqlMariaDbEngineErrorReason({ database, errno: e.errno, code: e.code, sqlState: e.sqlState, message: e.message })
        },
        isError: isMySqlMariaDbEngineError,
    }
}

const signalled = (sqlState: string, message: string) => () => driverError(message, { errno: 9999, sqlState })
// The general SQLSTATE: it says nothing, so the message decides
const generalError = (message: string) => () => driverError(message, { sqlState: 'HY000' })

describeSyntheticErrors('MySqlMariaDbErrorMapper (mySql)', () => engineMapper('mySql'), [
    { name: 'commands-out-of-sync', source: 'MySQL client errors (CR_COMMANDS_OUT_OF_SYNC)', error: () => driverError("Commands out of sync; you can't run this command now", { errno: 2014, code: 'CR_COMMANDS_OUT_OF_SYNC', sqlState: 'HY000' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode: 'CR_COMMANDS_OUT_OF_SYNC', databaseErrorNumber: 2014 } },
    { name: 'number-as-string-code', source: 'an error number reported as a string code', error: () => driverError("Table 'app.missing' doesn't exist", { code: '1146', sqlState: '42S02' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', databaseErrorCode: 'ER_NO_SUCH_TABLE', databaseErrorNumber: 1146 } },
    { name: 'number-reused-by-mariadb', source: 'MySQL server errors (4025 ER_INNODB_AUTOEXTEND_SIZE_OUT_OF_RANGE)', error: () => driverError('AUTOEXTEND_SIZE value should be between 4M and 4096M', { errno: 4025, sqlState: 'HY000' }), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode: 'ER_INNODB_AUTOEXTEND_SIZE_OUT_OF_RANGE' } },

    { name: 'sqlstate-warning', source: sqlStateClass, error: () => driverError('Unhandled user-defined warning condition', { sqlState: '01000' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorNumber: '01000' } },
    { name: 'sqlstate-feature-not-supported', source: signal, error: signalled('0A000', 'Feature not supported'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorNumber: 9999 } },
    { name: 'sqlstate-resignal-without-handler', source: signal, error: signalled('0K000', 'RESIGNAL when handler not active'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid statement context' } },
    { name: 'sqlstate-case-not-found', source: signal, error: signalled('20000', 'Case not found for CASE statement'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'case not found' } },
    { name: 'sqlstate-string-too-long', source: signal, error: signalled('22001', "Data too long for column 'name'"), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long', columnName: 'name' } },
    { name: 'sqlstate-numeric-out-of-range', source: signal, error: signalled('22003', 'Amount out of range'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'sqlstate-null-indicator', source: signal, error: signalled('22004', "Invalid use of NULL value for 'name'"), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'null not allowed', columnName: 'name' } },
    { name: 'sqlstate-invalid-datetime', source: signal, error: signalled('22007', 'Invalid date'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid format' } },
    { name: 'sqlstate-division-by-zero', source: signal, error: signalled('22012', 'Division by 0'), expected: { reason: 'SQL_DIVISION_BY_ZERO' } },
    { name: 'sqlstate-invalid-json', source: signal, error: signalled('22032', 'Invalid JSON text'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' } },
    { name: 'sqlstate-invalid-parameter-value', source: signal, error: signalled('22023', 'Invalid parameter value'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' } },
    { name: 'sqlstate-integrity-violation', source: signal, error: signalled('23000', 'Order total does not match its lines'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED' } },
    { name: 'sqlstate-invalid-cursor-state', source: signal, error: signalled('24000', 'Cursor is not open'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'cursor', objectStateErrorType: 'invalid state' } },
    { name: 'sqlstate-read-only-transaction', source: signal, error: signalled('25006', 'Cannot execute statement in a READ ONLY transaction.'), expected: { reason: 'SQL_READ_ONLY_VIOLATION' } },
    { name: 'sqlstate-routine-exception', source: signal, error: signalled('2F005', 'FUNCTION f ended without RETURN'), expected: { reason: 'SQL_ROUTINE_ERROR' } },
    { name: 'sqlstate-invalid-condition-number', source: signal, error: signalled('35000', 'Invalid condition number'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index' } },
    { name: 'sqlstate-invalid-catalog-name', source: signal, error: signalled('3D000', "Unknown database 'missing_db'"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: 'missing_db' } },
    { name: 'sqlstate-transaction-rollback', source: signal, error: signalled('40000', 'Transaction rolled back'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' } },
    { name: 'sqlstate-access-rule-violation', source: signal, error: signalled('42000', 'Statement not allowed'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT' } },
    { name: 'sqlstate-table-exists', source: signal, error: signalled('42S01', "Table 'orders' already exists"), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', tableName: 'orders' } },
    { name: 'sqlstate-table-not-found', source: signal, error: signalled('42S02', "Table 'orders' doesn't exist"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', tableName: 'orders' } },
    { name: 'sqlstate-index-not-found', source: signal, error: signalled('42S12', "Can't DROP 'idx_orders'; check that column/key exists"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'index', objectName: 'idx_orders' } },
    { name: 'sqlstate-column-exists', source: signal, error: signalled('42S21', "Duplicate column name 'total'"), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'column', columnName: 'total' } },
    { name: 'sqlstate-column-not-found', source: signal, error: signalled('42S22', "Unknown column 'totl'"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName: 'totl' } },
    { name: 'sqlstate-operation-cancelled', source: signal, error: signalled('70100', 'Query execution was interrupted'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' } },
    { name: 'sqlstate-memory-allocation', source: signal, error: signalled('HY001', 'Out of memory'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'sqlstate-object-not-found', source: signal, error: signalled('SR001', "Object 'srs_1' not found"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectName: 'srs_1' } },
    { name: 'sqlstate-object-exists', source: signal, error: signalled('SR004', "Object 'srs_1' already exists"), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: 'srs_1' } },
    { name: 'sqlstate-dependent-objects', source: signal, error: signalled('SR005', 'Object is in use'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'dependent objects still exist' } },
    { name: 'sqlstate-xa-rolled-back', source: signal, error: signalled('XA100', 'XA_RBROLLBACK: Transaction branch was rolled back'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' } },
    { name: 'sqlstate-xa-deadlock', source: signal, error: signalled('XA102', 'XA_RBDEADLOCK: Transaction branch was rolled back: deadlock was detected'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' } },
    { name: 'sqlstate-xa-timeout', source: signal, error: signalled('XA106', 'XA_RBTIMEOUT: Transaction branch was rolled back: took too long'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'transaction' } },
    { name: 'sqlstate-xa-invalid-state', source: signal, error: signalled('XAE07', 'XAER_RMFAIL: The command cannot be executed when global transaction is in the  ACTIVE state'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state' } },
    { name: 'sqlstate-xa-unknown-xid', source: signal, error: signalled('XAE04', 'XAER_NOTA: Unknown XID'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' } },
    { name: 'sqlstate-connection-class', source: signal, error: signalled('08004', 'Server rejected the connection'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'sqlstate-cardinality-class', source: signal, error: signalled('21S01', 'Column count does not match'), expected: { reason: 'SQL_CARDINALITY_VIOLATION' } },
    { name: 'sqlstate-data-exception-class', source: signal, error: signalled('22027', 'Trim error'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' } },
    { name: 'sqlstate-integrity-class', source: signal, error: signalled('23505', "Duplicate entry 'a@b.c' for key 'users.email'"), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', constraintName: 'email', tableName: 'users' } },
    { name: 'sqlstate-authorization-class', source: signal, error: signalled('28000', 'Access denied'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'sqlstate-syntax-class', source: signal, error: signalled('42S99', 'Statement rejected'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT' } },

    { name: 'constraint-state-foreign-key', source: signal, error: signalled('23000', 'Cannot add or update a child row: a foreign key constraint fails (`app`.`orders`, CONSTRAINT `orders_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`))'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'orders_customer_fk', tableName: 'orders', columnName: 'customer_id' } },
    { name: 'constraint-state-not-null', source: signal, error: signalled('23000', "Column 'name' cannot be null"), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', columnName: 'name' } },
    { name: 'constraint-state-check', source: signal, error: signalled('23000', "Check constraint 'price_positive' is violated."), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'price_positive' } },
    { name: 'constraint-state-ambiguous', source: mysqlMessages + ' (ER_NON_UNIQ_ERROR is SQLSTATE 23000)', error: signalled('23000', "Column 'id' in where clause is ambiguous"), expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierErrorType: 'ambiguous', identifier: 'id' } },
    { name: 'constraint-state-duplicate', source: signal, error: signalled('23000', "Duplicate entry '1' for key 'PRIMARY'"), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', constraintName: 'PRIMARY' } },

    { name: 'symbol-check-constraint', source: codeOnly, error: () => driverError('CONSTRAINT `price_positive` failed for `app`.`products`', { code: 'ER_CONSTRAINT_FAILED' }), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'price_positive', tableName: 'products' } },
    { name: 'symbol-sequence-run-out', source: codeOnly, error: () => driverError('Sequence \'app.order_seq\' has run out', { code: 'ER_SEQUENCE_RUN_OUT' }), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'sequence limit' } },
    { name: 'symbol-not-a-sequence', source: codeOnly, error: () => driverError("'app.orders' is not a SEQUENCE", { code: 'ER_NOT_SEQUENCE' }), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type', objectName: 'app.orders' } },
    { name: 'symbol-out-of-memory', source: codeOnly + ' (a symbol outside the catalog)', error: () => driverError('Out of memory', { code: 'ER_ENGINE_OUT_OF_MEMORY' }), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'symbol-disk-full', source: codeOnly, error: () => driverError('Disk full (/var/lib/mysql/app/orders.ibd); waiting for someone to free some space...', { code: 'ER_DISK_FULL' }), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk' } },
    { name: 'symbol-table-not-found', source: codeOnly, error: () => driverError("Table 'orders' doesn't exist in engine", { code: 'ER_NO_SUCH_TABLE_IN_ENGINE' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', tableName: 'orders' } },
    { name: 'symbol-role-not-found', source: codeOnly, error: () => driverError("Operation DROP ROLE failed for 'reporting'", { code: 'ER_ROLE_DROP_EXISTS' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'role', objectName: 'reporting' } },
    { name: 'symbol-sequence-not-found', source: codeOnly, error: () => driverError("Unknown SEQUENCE: 'order_seq'", { code: 'ER_UNKNOWN_SEQUENCES' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'sequence', objectName: 'order_seq' } },
    { name: 'symbol-column-not-found', source: codeOnly, error: () => driverError("Key column 'customer_id' doesn't exist in table", { code: 'ER_KEY_COLUMN_DOES_NOT_EXIST' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName: 'customer_id' } },
    { name: 'symbol-routine-not-found', source: codeOnly + ' (a symbol outside the catalog)', error: () => driverError("FUNCTION app.total_of does not exist", { code: 'ER_STORED_FUNCTION_NOT_FOUND' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'routine' } },
    { name: 'symbol-index-not-found', source: codeOnly, error: () => driverError("Key 'idx_total' doesn't exist in table 'orders'", { code: 'ER_KEY_DOES_NOT_EXISTS' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'index', objectName: 'idx_total' } },
    { name: 'symbol-database-exists', source: codeOnly + ' (a symbol outside the catalog)', error: () => driverError("Can't create database 'app'; database exists", { code: 'ER_DATABASE_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database', objectName: 'app' } },
    { name: 'symbol-sequence-exists', source: codeOnly + ' (a symbol outside the catalog)', error: () => driverError("Sequence 'order_seq' already exists", { code: 'ER_SEQUENCE_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'sequence', objectName: 'order_seq' } },
    { name: 'symbol-column-exists', source: codeOnly + ' (a symbol outside the catalog)', error: () => driverError("Column 'total' already exists", { code: 'ER_COLUMN_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'column', columnName: 'total' } },
    { name: 'symbol-routine-exists', source: codeOnly + ' (a symbol outside the catalog)', error: () => driverError('PROCEDURE close_month already exists', { code: 'ER_ROUTINE_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'routine' } },
    { name: 'symbol-index-exists', source: codeOnly + ' (a symbol outside the catalog)', error: () => driverError("Index 'idx_total' already exists", { code: 'ER_INDEX_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'index', objectName: 'idx_total' } },
    { name: 'symbol-object-exists', source: codeOnly, error: () => driverError("Connection 'replica_a' already exists", { code: 'ER_CONNECTION_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: 'replica_a' } },

    { name: 'message-duplicate-entry', source: mysqlMessages, error: generalError("Duplicate entry 'a@b.c' for key 'users.email'"), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', constraintName: 'email', tableName: 'users' } },
    { name: 'message-foreign-key', source: mysqlMessages, error: generalError('Cannot delete or update a parent row: a foreign key constraint fails (`app`.`orders`, CONSTRAINT `orders_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`))'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'orders_customer_fk' } },
    { name: 'message-not-null', source: mysqlMessages, error: generalError("Column 'name' cannot be null"), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', columnName: 'name' } },
    { name: 'message-check-constraint', source: mysqlMessages, error: generalError("Check constraint 'price_positive' is violated."), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'price_positive' } },
    { name: 'message-unknown-database', source: mysqlMessages, error: generalError("Unknown database 'missing_db'"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: 'missing_db' } },
    { name: 'message-table-not-found', source: mysqlMessages, error: generalError("Table 'orders' doesn't exist"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', tableName: 'orders' } },
    { name: 'message-unknown-column', source: mysqlMessages, error: generalError("Unknown column 'totl' in 'field list'"), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName: 'totl' } },
    { name: 'message-already-exists', source: mysqlMessages, error: generalError("Table 'orders' already exists"), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: 'orders' } },
    { name: 'message-ambiguous', source: mysqlMessages, error: generalError("Column 'id' in field list is ambiguous"), expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierErrorType: 'ambiguous', identifier: 'id' } },
    { name: 'message-syntax', source: mysqlMessages, error: generalError("You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'form orders' at line 1"), expected: { reason: 'SQL_SYNTAX_ERROR' } },
    { name: 'message-division-by-zero', source: mysqlMessages, error: generalError('Division by 0'), expected: { reason: 'SQL_DIVISION_BY_ZERO' } },
    { name: 'message-out-of-range', source: mysqlMessages, error: generalError("Out of range value for column 'qty' at row 1"), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'message-too-long', source: mysqlMessages, error: generalError("Data too long for column 'name' at row 1"), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long', columnName: 'name' } },
    { name: 'message-invalid-json', source: mysqlMessages, error: generalError('Invalid JSON text: "Invalid value." at position 0 in value for column \'docs.body\'.'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' } },
    { name: 'message-deadlock', source: mysqlMessages, error: generalError('Deadlock found when trying to get lock; try restarting transaction'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' } },
    { name: 'message-lock-wait-timeout', source: mysqlMessages, error: generalError('Lock wait timeout exceeded; try restarting transaction'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' } },
    { name: 'message-interrupted', source: mysqlMessages, error: generalError('Query execution was interrupted'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' } },
    { name: 'message-read-only', source: mysqlMessages, error: generalError('The MySQL server is running with the --read-only option so it cannot execute this statement'), expected: { reason: 'SQL_READ_ONLY_VIOLATION' } },
    { name: 'message-out-of-memory', source: mysqlMessages, error: generalError('Out of memory; restart server and try again (needed 65536 bytes)'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'message-table-full', source: mysqlMessages, error: generalError("The table 'tmp_big' is full"), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk' } },
    { name: 'message-too-many-connections', source: mysqlMessages, error: generalError('Too many connections'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'connections' } },
    { name: 'message-lost-connection', source: mysqlMessages, error: generalError('Lost connection to MySQL server during query'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'message-not-supported', source: mysqlMessages, error: generalError('This command is not supported in the prepared statement protocol yet'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
])

describeSyntheticErrors('MySqlMariaDbErrorMapper (mariaDB)', () => engineMapper('mariaDB'), [
    { name: 'number-reused-by-mysql', source: mariadbMessages + ' (4025 ER_CONSTRAINT_FAILED)', error: () => driverError('CONSTRAINT `price_positive` failed for `app`.`products`', { errno: 4025, sqlState: '23000' }), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'price_positive', tableName: 'products', databaseErrorCode: 'ER_CONSTRAINT_FAILED' } },

    { name: 'client-probe-symbol', source: codeOnly + ' (a MySQL client symbol MariaDB has no number for)', error: () => driverError('Error on SHOW REPLICA STATUS:', { code: 'CR_PROBE_REPLICA_STATUS' }), expected: { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR' } },
    { name: 'client-unknown-error-symbol', source: codeOnly + ' (a MySQL client symbol MariaDB has no number for)', error: () => driverError('Unknown MySQL error', { code: 'CR_UNKNOWN_ERROR' }), expected: { reason: 'SQL_UNKNOWN' } },
    { name: 'client-symbol', source: codeOnly + ' (a MySQL client symbol MariaDB has no number for)', error: () => driverError("Commands out of sync; you can't run this command now", { code: 'CR_COMMANDS_OUT_OF_SYNC' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'mysys-symbol', source: codeOnly + ' (a MySQL mysys symbol MariaDB has no number for)', error: () => driverError('Failed to create timer (errno= 12).', { code: 'EE_FAILED_TO_CREATE_TIMER' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'server-lock-symbol', source: codeOnly + ' (a MySQL server symbol MariaDB has no number for)', error: () => driverError('Statement aborted because lock(s) could not be acquired immediately and NOWAIT is set.', { code: 'ER_LOCK_NOWAIT' }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' } },
    { name: 'symbol-database-not-found', source: codeOnly + ' (a MySQL server symbol MariaDB has no number for)', error: () => driverError("Database 'missing_db' doesn't exist", { code: 'ER_NO_SUCH_DB' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: 'missing_db' } },
    { name: 'symbol-table-exists', source: codeOnly + ' (a MySQL server symbol MariaDB has no number for)', error: () => driverError("Table 'app.orders' already exists.", { code: 'ER_IMP_TABLE_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view' } },
    { name: 'symbol-trigger-exists', source: codeOnly + ' (a MySQL server symbol MariaDB has no number for)', error: () => driverError("Trigger 'orders_audit' for table 'orders' already exists.", { code: 'ER_WARN_TRG_ALREADY_EXISTS' }), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'trigger', objectName: 'orders_audit' } },
])

describeSyntheticErrors('MySqlMariaDbErrorMapper (no database)', () => engineMapper(undefined), [
    { name: 'mysql-number-as-string-code', source: 'an error number reported as a string code', error: () => driverError("Duplicate entry '1' for key 'PRIMARY'", { code: '1062', sqlState: '23000' }), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', databaseErrorCode: 'ER_DUP_ENTRY', databaseErrorNumber: 1062 } },
    { name: 'mariadb-number-as-string-code', source: 'an error number reported as a string code', error: () => driverError("Operation DROP ROLE failed for 'reporting'", { code: '1976', sqlState: 'HY000' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'role', databaseErrorCode: 'ER_ROLE_DROP_EXISTS', databaseErrorNumber: 1976 } },
])
