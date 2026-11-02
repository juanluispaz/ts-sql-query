// The SQL Server engine mapper, called with what the mssql connector hands it
// for a server error (code EREQUEST plus the error number), for the numbers
// below 13000 a test can neither provoke nor raise: I/O, corruption, disk,
// linked servers, availability groups, DTC, and the parameter / statement
// groups the catalog lists. Where the message text is not reproduced, the
// message only says what the error is about: the mapper decides by number.

import { getSqlServerEngineErrorReason } from '../../../../src/queryRunners/databaseErrorMappers/SqlServerErrorMapper.js'
import type { SqlServerEngineError } from '../../../../src/queryRunners/databaseErrorMappers/SqlServerErrorMapper.js'
import { describeSyntheticErrors } from './syntheticErrors.js'

const engine = 'SQL Server Database Engine events and errors'

function engineError(number: number, message: string): SqlServerEngineError {
    return { number, code: 'EREQUEST', message }
}

function caseFor(name: string, number: number, message: string, expected: { reason: string, [field: string]: unknown }) {
    return { name, source: engine + ' (' + number + ')', error: () => engineError(number, message), expected: { ...expected, databaseErrorCode: 'EREQUEST', databaseErrorNumber: number } }
}

describeSyntheticErrors('sqlserver engine', () => ({ getErrorReason: error => getSqlServerEngineErrorReason(error as SqlServerEngineError), isError: () => true }), [
    caseFor('identity-range-check', 548, 'The insert failed. It conflicted with an identity range check constraint in database \'shop\', replicated table \'dbo.orders\', column \'id\'. If the identity column is automatically managed by replication, update the range as follows: for the Publisher, execute sp_adjustpublisheridentityrange; for the Subscriber, run the Distribution Agent or the Merge Agent.', { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', tableName: 'dbo.orders' }),
    caseFor('constraint-of-unnamed-type', 547, 'The statement conflicted with a constraint.', { reason: 'SQL_CONSTRAINT_VIOLATED' }),
    caseFor('function-not-recognized', 261, '\'TRIM\' is not a recognized function.', { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'routine', objectName: 'TRIM' }),
    caseFor('index-disabled', 315, 'Index "ix_orders_date" on table "dbo.orders" (specified in the FROM clause) is disabled or resides in a filegroup which is not online.', { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state', objectType: 'index', objectName: 'ix_orders_date' }),
    caseFor('database-in-use', 3101, 'Exclusive access could not be obtained because the database is in use.', { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'object in use', objectType: 'database' }),
    caseFor('ambiguous-multi-part-identifier', 326, 'Multi-part identifier \'o.id\' is ambiguous. Both columns \'o.id\' and \'o.id\' exist.', { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column', identifier: 'o.id' }),
    caseFor('ambiguous-function-call', 327, 'Function call \'dbo.area\' is ambiguous: both a user-defined function and a method call with this name exist.', { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'routine', identifier: 'dbo.area' }),
    caseFor('distributed-transaction-cancelled', 1206, 'The Microsoft Distributed Transaction Coordinator (MS DTC) has cancelled the distributed transaction.', { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' }),
    caseFor('snapshot-update-conflict', 3960, 'Snapshot isolation transaction aborted due to update conflict. You cannot use snapshot isolation to access table \'dbo.orders\' directly or indirectly in database \'shop\' to update, delete, or insert the row that has been modified or deleted by another transaction. Retry the transaction or change the isolation level for the update/delete statement.', { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure' }),
    caseFor('database-not-accessible-for-the-login', 916, 'The server principal "app" is not able to access the database "shop" under the current security context.', { reason: 'SQL_AUTHORIZATION_ERROR' }),

    caseFor('function-parameters-not-supplied', 216, 'Parameters were not supplied for the function \'dbo.area\'.', { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' }),
    caseFor('too-many-parameters-in-a-declaration', 180, 'There are too many parameters in this CREATE PROCEDURE statement. The maximum number is 2100.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters', limit: 2100 }),
    caseFor('request-with-too-many-parameters', 6206, 'Request submitted with too many parameters.  The maximum number is 2100.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters', limit: 2100 }),
    caseFor('too-many-table-names', 106, 'Too many table names in the query. The maximum allowable is 256.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: 256 }),
    caseFor('select-list-too-long', 1056, 'The number of elements in the select list exceeds the maximum allowed number of 4096 elements.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: 4096 }),
    caseFor('too-many-tables-with-views', 4408, 'Too many tables. The query and the views or functions in it exceed the limit of 260 tables. Revise the query to reduce the number of tables.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: 260 }),
    caseFor('too-many-tables-resolving-views', 4414, 'Could not allocate ancillary table for view or function resolution. The maximum number of tables in a query (260) was exceeded.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: 260 }),
    caseFor('case-nested-too-deeply', 125, 'Case expressions may only be nested to level 10.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement complexity', limit: 10 }),
    caseFor('statement-nested-too-deeply', 191, 'Some part of your SQL statement is nested too deeply. Rewrite the query or break it up into smaller queries.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement complexity' }),
    caseFor('query-processor-without-a-plan', 8623, 'The query processor ran out of internal resources and could not produce a query plan. This is a rare event and only expected for extremely complex queries or queries that reference a very large number of tables or partitions. Please simplify the query. If you believe you have received this message in error, contact Customer Support Services for more information.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement complexity' }),
    caseFor('expression-services-limit', 8632, 'Internal error: An expression services limit has been reached. Please look for potentially complex expressions in your query, and try to simplify them.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement complexity' }),
    caseFor('sp-execute-parameter-count', 8008, 'The number of params passed to sp_execute is not equal to the number of params used when the handle was prepared (2).', { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count' }),
    caseFor('procedure-has-no-such-parameter', 349, 'The procedure "dbo.place_order" has no parameter named "@qty".', { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: '@qty' }),
    caseFor('rpc-value-not-of-its-type', 8023, 'The incoming tabular data stream (TDS) remote procedure call (RPC) protocol stream is incorrect. Parameter 3 ("@P2"): The supplied value is not a valid instance of data type float. Check the source data for invalid values. An example of an invalid value is data of numeric type with scale greater than precision.', { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', typeName: 'float' }),
    caseFor('rpc-value-length', 8028, 'The incoming tabular data stream (TDS) remote procedure call (RPC) protocol stream is incorrect. Parameter 1 ("@P0"): The supplied length is not valid for data type nvarchar.', { reason: 'SQL_INVALID_VALUE', errorType: 'too long', typeName: 'nvarchar' }),
    caseFor('table-hint-without-with', 1018, 'Incorrect syntax near \'NOLOCK\'. If this is intended as a part of a table hint, A WITH keyword and parenthesis are now required. See SQL Server Books Online for proper syntax.', { reason: 'SQL_SYNTAX_ERROR' }),
    caseFor('query-inside-waitfor', 101, 'Query not allowed in Waitfor.', { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid statement context' }),

    caseFor('page-checksum-changed', 832, 'A page that should have been constant has changed (expected checksum: 1a2b3c4d, actual checksum: 4d3c2b1a, database 5, file \'D:\\data\\shop.mdf\', page (1:1234)). This usually indicates a memory failure or other hardware or OS corruption.', { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'checksum' }),
    caseFor('physical-file-access-denied', 5120, 'Unable to open the physical file "D:\\data\\shop.mdf". Operating system error 5: "5(Access is denied.)".', { reason: 'SQL_IO_ERROR', ioErrorType: 'access' }),
    caseFor('backup-read-failed', 3203, 'Read on "D:\\backup\\shop.bak" failed: 23(Data error (cyclic redundancy check).)', { reason: 'SQL_IO_ERROR', ioErrorType: 'read' }),
    caseFor('backup-write-failed', 3202, 'Write on "D:\\backup\\shop.bak" failed: 112(There is not enough space on the disk.)', { reason: 'SQL_IO_ERROR', ioErrorType: 'write' }),
    caseFor('directory-lookup-failed', 5133, 'Directory lookup for the file "E:\\data\\shop.mdf" failed with the operating system error 3(The system cannot find the path specified.).', { reason: 'SQL_IO_ERROR', ioErrorType: 'path' }),
    caseFor('operating-system-io-error', 823, 'The operating system returned error 21(The device is not ready.) to SQL Server during a read at offset 0x00000000012000 in file \'D:\\data\\shop.mdf\'.', { reason: 'SQL_IO_ERROR', ioErrorType: 'unknown' }),
    caseFor('linked-server-provider-not-initialized', 7303, 'Cannot initialize the data source object of OLE DB provider "MSOLEDBSQL" for linked server "REMOTE".', { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR' }),
    caseFor('out-of-disk', 3911, 'Not enough disk space to complete the operation.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk' }),
    caseFor('out-of-temp-space', 1138, 'Not enough space in tempdb to complete the operation.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'temp space' }),
    caseFor('cpu-limit', 10961, 'The CPU limit of the resource pool has been reached.', { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'cpu' }),
    caseFor('network-read-failed', 4014, 'A fatal error occurred while reading the input stream from the network. The session will be terminated (input error: 64, output error: 0).', { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' }),
    caseFor('availability-replica-not-readable', 976, 'The target database, \'shop\', is participating in an availability group and is currently not accessible for queries. Either data movement is suspended or the availability replica is not enabled for read access.', { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable' }),
    caseFor('database-principal-not-a-member', 1202, 'The database-principal \'app\' does not exist or user is not a member.', { reason: 'SQL_AUTHORIZATION_ERROR' }),
    caseFor('xml-too-long', 6907, 'XML: the value is longer than the XML type allows.', { reason: 'SQL_INVALID_VALUE', errorType: 'too long' }),
    caseFor('xml-invalid', 6901, 'XML Validation: the XML instance is not valid.', { reason: 'SQL_INVALID_VALUE', errorType: 'invalid xml' }),

    // A DELETE or UPDATE of a referenced row names the foreign key as a REFERENCE constraint.
    caseFor('referenced-row-deleted', 547, 'The DELETE statement conflicted with the REFERENCE constraint "fk_order_customer". The conflict occurred in database "shop", table "dbo.orders", column \'customer_id\'.', { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'fk_order_customer' }),
])
