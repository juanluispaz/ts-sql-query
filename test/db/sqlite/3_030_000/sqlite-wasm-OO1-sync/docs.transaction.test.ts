// Documentation snippets for the Transaction page
// (docs/queries/transaction.md). Demonstrates the `connection.transaction`
// helper: an explicit commit on success, an explicit rollback if the
// body throws.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tAppUser, tProject, tWebhookEvent } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { TsSqlError, TsSqlQueryExecutionError, QueryExecutionSource, TsSqlProcessingError } from '../../../../../src/TsSqlError.js'
import { sync } from '../../../../../src/extras/sync.js'

// The statements the test ran; a transaction managed by the driver doesn't record its begin and commit.
function statementsSql() {
    return ctx.history.map((op) => op.sql).filter((sql) => sql !== 'beginTransaction' && sql !== 'commit')
}

function registerUser(email: string, fullName: string) {
    return sync(ctx.conn.insertInto(tAppUser)
        .set({ email, fullName })
        .returningLastInsertedId()
        .executeInsert())
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:transaction/commit-on-success', async () => {
        ctx.mockNext(99)
        ctx.mockNext(100)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const transactionResult = await connection.transaction(async () => {
                const organizationId = sync(connection.insertInto(tOrganization).set({
                        name: 'Top Organization',
                        plan: 'free',
                    })
                    .returningLastInsertedId()
                    .executeInsert())

                const projectId = sync(connection.insertInto(tProject).set({
                        name:           'Top project',
                        slug:           'top-project',
                        organizationId: organizationId,
                    })
                    .returningLastInsertedId()
                    .executeInsert())

                return { organizationId, projectId }
            })
            // doc-end

            expect(statementsSql()).toMatchInlineSnapshot(`
              [
                "insert into organization (name, plan) values (?1, ?2)",
                "insert into project (name, slug, organization_id) values (?1, ?2, ?3)",
              ]
            `)
            expect(ctx.lastNoTransactionParams.slice(0, 2)).toMatchInlineSnapshot(`
              [
                "Top project",
                "top-project",
              ]
            `)
            expect(ctx.lastNoTransactionParams[2]).toBe(transactionResult.organizationId)
            assertType<Exact<typeof transactionResult, { organizationId: number; projectId: number }>>()
            // The seed reserves the organization ids up to 2 and the project ids up to 4.
            expect(transactionResult.organizationId).toBeGreaterThan(2)
            expect(transactionResult.projectId).toBeGreaterThan(4)
        })
    })

    test('docs-extra:transaction/rollback-on-throw', async () => {
        class SentinelError extends Error {}
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            let caught: unknown = null
            try {
                await connection.transaction(async () => {
                    // Throw before any work; transaction must roll back.
                    throw new SentinelError('aborted')
                })
            } catch (e) {
                caught = e
            }
            // doc-end

            // The mock runner takes any error as a database error and wraps it.
            expect(caught instanceof TsSqlError ? caught.cause : caught).toBeInstanceOf(SentinelError)
        })
    })

    test('docs:transaction/low-level-begin-commit', async () => {
        // Section "Low-level transaction management" — `beginTransaction`,
        // `commit`, `rollback` give explicit control instead of the
        // high-level `.transaction(async () => {...})` helper.
        const connection = ctx.conn

        // A plain `returningLastInsertedId()` requires an id back; mock one so
        // the single-row path resolves it (the real engine returns its own).
        ctx.mockNext(1)
        await ctx.withReseed(async () => {
            // doc-start
            await connection.beginTransaction()
            try {
                sync(connection.insertInto(tOrganization)
                    .values({ name: 'Initech', plan: 'free' })
                    .returningLastInsertedId()
                    .executeInsert())
                await connection.commit()
            } catch (e) {
                await connection.rollback()
                throw e
            }
            // doc-end

            // The history includes the synthetic begin/commit entries
            // plus the actual INSERT (asserted via lastNoTransactionSql
            // since `commit` is the most recent capture).
            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2)"`)
        })
    })

    // TODO[LIMITATION]: see LIMITATIONS.md § Some query runners don't detect a transaction the database rolled back — this query runner reports the statement's own error instead.
    /*
    test('docs:transaction/retried-statement-rejected', async () => {
        // `update or rollback` makes the conflict with the email of the seeded user 2 roll back
        // the whole transaction on a real engine.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(0)
        const connection = ctx.conn
        let raised: unknown

        await ctx.withReseed(async () => {
            try {
                // doc-start
                await connection.transaction(async () => {
                    sync(connection.insertInto(tOrganization).set({ name: 'Top Organization', plan: 'free' }).executeInsert())
                    try {
                        sync(connection.update(tAppUser).set({ email: 'grace@acme.test' }).where(tAppUser.id.equals(1))
                            .customizeQuery({ afterUpdateKeyword: connection.rawFragment`or rollback` })
                            .executeUpdate())
                    } catch {
                        // The database rolled back the whole transaction, the organization included
                        sync(connection.update(tAppUser).set({ email: 'grace@acme.test' }).where(tAppUser.id.equals(1))
                            .customizeQuery({ afterUpdateKeyword: connection.rawFragment`or rollback` })
                            .executeUpdate())
                    }
                })
                // doc-end
            } catch (e) {
                raised = e
            }

            const savedOrganizations = sync(connection.selectFrom(tOrganization)
                .where(tOrganization.name.equals('Top Organization'))
                .selectCountAll()
                .executeSelectOne())

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            expect(savedOrganizations).toBe(0)
        })

        if (ctx.realDbEnabled) {
            expect(raised).toBeInstanceOf(TsSqlError)
            expect(raised instanceof TsSqlError && raised.errorReason).toEqual({
                reason: 'TRANSACTION_ERROR',
                transactionErrorType: 'transaction rolled back',
            })
        } else {
            expect(raised).toBeUndefined()
        }
    })
    */

    test('docs:transaction/running-the-transaction-again', async () => {
        const connection = ctx.conn
        let bodyRuns = 0
        let result = 0

        await ctx.withReseed(async () => {
            // doc-start
            async function transactionWithRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
                for (let attempt = 1; ; attempt++) {
                    try {
                        return await connection.transaction(fn)
                    } catch (error) {
                        const canRetry = error instanceof TsSqlQueryExecutionError
                            && error.errorReason.reason === 'TRANSACTION_ERROR'
                            && (error.errorReason.transactionErrorType === 'deadlock' || error.errorReason.transactionErrorType === 'serialization failure')
                        if (!canRetry || attempt >= attempts) {
                            throw error
                        }
                    }
                }
            }
            // doc-end

            result = await transactionWithRetry(async () => {
                bodyRuns += 1
                if (bodyRuns === 1) {
                    throw new TsSqlQueryExecutionError(new QueryExecutionSource('Query executed at'), { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' }, 'A deadlock')
                }
                return 7
            }, 3)
        })

        assertType<Exact<typeof result, number>>()
        expect(result).toBe(7)
        expect(bodyRuns).toBe(2)
    })

    test('docs-extra:transaction/failures-arrive-through-the-promise', async () => {
        const connection = ctx.conn
        const reasonOf = (e: unknown) => e instanceof TsSqlQueryExecutionError ? e.errorReason.reason : undefined

        // The calls don't throw: without a transaction, each one returns a rejected promise.
        let commitError: unknown
        let rollbackError: unknown
        await connection.commit().catch((e: unknown) => { commitError = e })
        await connection.rollback().catch((e: unknown) => { rollbackError = e })

        expect(reasonOf(commitError)).toBe('NOT_IN_TRANSACTION')
        expect(reasonOf(rollbackError)).toBe('NOT_IN_TRANSACTION')
    })

    test('docs-extra:transaction/what-has-no-promise-throws', async () => {
        const connection = ctx.conn
        let caught: unknown

        try {
            connection.getTransactionMetadata()
        } catch (e) {
            caught = e
        }

        expect(caught).toBeInstanceOf(TsSqlProcessingError)
        expect(caught instanceof TsSqlError && caught.errorReason.reason).toBe('NOT_IN_TRANSACTION')
        expect(connection.isTransactionActive()).toBe(false)
    })

    test('docs-extra:transaction/nested-rejected-outer-goes-on', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        const connection = ctx.conn
        let innerError: unknown

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                sync(connection.insertInto(tOrganization).set({ name: 'Top Organization', plan: 'free' }).executeInsert())
                await connection.transaction(async () => 1).catch((e: unknown) => { innerError = e })
            })

            const savedOrganizations = sync(connection.selectFrom(tOrganization)
                .where(tOrganization.name.equals('Top Organization'))
                .selectCountAll()
                .executeSelectOne())
            expect(savedOrganizations).toBe(1)
        })

        if (ctx.realDbEnabled) {
            expect(innerError).toBeInstanceOf(TsSqlQueryExecutionError)
            expect(innerError instanceof TsSqlError && innerError.errorReason.reason).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
        } else {
            // The mock runner allows a nested transaction.
            expect(innerError).toBeUndefined()
        }
    })

    test('docs:transaction/native-connection', async () => {
        const jobs: Array<{ name: string; hasClient: boolean }> = []
        const jobQueue = {
            async send<CLIENT>(name: string, _data: object, client: CLIENT) {
                jobs.push({ name, hasClient: client !== undefined && client !== null })
            },
        }
        ctx.mockNext(50)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            await connection.transaction(async () => {
                const userId = await registerUser('john@acme.test', 'John Smith')
                const client = connection.queryRunner.getCurrentNativeConnection()
                await jobQueue.send('send-welcome-email', { userId }, client)
            })
            // doc-end

            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2)"`)
            expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
              [
                "john@acme.test",
                "John Smith",
              ]
            `)
        })

        // The mock runner has no driver connection to give.
        expect(jobs).toEqual([{ name: 'send-welcome-email', hasClient: ctx.realDbEnabled }])
    })

    // NOT-APPLICABLE: the page's callback does real asynchronous work, which a transaction running on synchronous promises rejects.
    /*
    test('docs:transaction/execute-with-native-connection', async () => {
        const jobs: Array<{ name: string; hasClient: boolean }> = []
        const jobQueue = {
            async send<CLIENT>(name: string, _data: object, client: CLIENT) {
                jobs.push({ name, hasClient: client !== undefined && client !== null })
            },
        }
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            await connection.transaction(async () => {
                await connection.queryRunner.execute(async (client) => {
                    await jobQueue.send('send-welcome-email', { userId: 10 }, client)
                })
            })
            // doc-end
        })

        // The mock runner has no driver connection to give.
        expect(jobs).toEqual([{ name: 'send-welcome-email', hasClient: ctx.realDbEnabled }])
    })
    */

    // NOT-APPLICABLE: `connection.isolationLevel(...)` is not defined on SqliteConnection — sqlite has no isolation-level support (its only mode is "serializable" implicit). Body kept verbatim for cross-cell diff parity per the symmetry rule.
    /*
    test('docs:transaction/isolation-level', async () => {
        // Section "Transaction isolation": the isolation level AND the access
        // mode can be combined in a single `connection.isolationLevel(level,
        // mode)` argument to `.transaction(...)`. Dialects that support the
        // combination run this test; the rest keep it commented out for
        // symmetry.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const result = await connection.transaction(async () => {
                return sync(connection.selectFromNoTable()
                    .selectOneColumn(connection.const(1, 'int'))
                    .executeSelectOne())
            }, connection.isolationLevel('snapshot', 'read only'))
            // doc-end

            // Both parts are carried through: the combined opts pair, and a
            // real read-only snapshot transaction that actually ran.
            expect(ctx.lastTransactionOpts).toEqual(['snapshot', 'read only'])
            expect(result).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: `connection.isolationLevel(...)` is not defined on SqliteConnection — sqlite has no isolation-level support (its only mode is "serializable" implicit). Body kept verbatim for cross-cell diff parity per the symmetry rule.
    /*
    test('docs:transaction/begin-with-isolation-level', async () => {
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            await connection.beginTransaction(connection.isolationLevel('snapshot', 'read only'))
            // doc-end
            await connection.commit()

            expect(ctx.lastTransactionOpts).toEqual(['snapshot', 'read only'])
        })
    })
    */

    // NOT-APPLICABLE: SQLite has no transaction isolation or access mode to choose, so the connection has no isolationLevel method.
    /*
    test('docs:transaction/access-mode', async () => {
        ctx.mockNext([{ id: 1, name: 'Acme' }, { id: 2, name: 'Globex' }])
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const organizations = await connection.transaction(async () => {
                return sync(connection.selectFrom(tOrganization)
                    .select({ id: tOrganization.id, name: tOrganization.name })
                    .orderBy('id')
                    .executeSelectMany())
            }, connection.isolationLevel('read only'))
            // doc-end

            expect(ctx.lastTransactionOpts).toEqual([undefined, 'read only'])
            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot()
            assertType<Exact<typeof organizations, { id: number; name: string }[]>>()
            expect(organizations).toHaveLength(2)
        })
    })
    */

    // NOT-APPLICABLE: SQLite has no transaction isolation or access mode to choose, so the connection has no isolationLevel method.
    /*
    test('docs-extra:transaction/read-only-rejects-a-write', async () => {
        ctx.mockNext(1)
        const connection = ctx.conn
        let caught: unknown

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                sync(connection.insertInto(tOrganization).set({ name: 'Top Organization', plan: 'free' }).executeInsert())
            }, connection.isolationLevel('read only')).catch((e: unknown) => { caught = e })
        })

        if (ctx.realDbEnabled) {
            expect(caught instanceof TsSqlError && caught.errorReason.reason).toBe('SQL_READ_ONLY_VIOLATION')
        } else {
            expect(caught).toBeUndefined()
        }
    })
    */

    test('docs:transaction/execute-before-next-commit', async () => {
        // Each seeded organization owns two projects, so both checks find one to keep.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        ctx.mockNext(2)
        ctx.mockNext(2)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            async function moveProject(projectId: number, fromOrganizationId: number, toOrganizationId: number) {
                sync(connection.update(tProject)
                    .set({ organizationId: toOrganizationId })
                    .where(tProject.id.equals(projectId))
                    .executeUpdate())

                connection.executeBeforeNextCommit(async () => {
                    const remaining = sync(connection.selectFrom(tProject)
                        .where(tProject.organizationId.equals(fromOrganizationId))
                        .selectCountAll()
                        .executeSelectOne())
                    if (remaining === 0) {
                        throw new Error('The organization ' + fromOrganizationId + ' must keep at least one project')
                    }
                })
            }

            await connection.transaction(async () => {
                await moveProject(1, 1, 2)
                await moveProject(3, 2, 1)
            })
            // doc-end

            expect(statementsSql()).toMatchInlineSnapshot(`
              [
                "update project set organization_id = ?1 where id = ?2",
                "update project set organization_id = ?1 where id = ?2",
                "select count(*) as result from project where organization_id = ?1",
                "select count(*) as result from project where organization_id = ?1",
              ]
            `)

            const organizationOfProject1 = sync(connection.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .selectOneColumn(tProject.organizationId)
                .executeSelectOne())
            expect(organizationOfProject1).toBe(2)
        })
    })

    test('docs-extra:transaction/execute-before-next-commit-rule-rolls-back', async () => {
        // Moving both seeded projects leaves organization 1 with none: the first check fails.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(0)
        ctx.mockNext(1)
        const connection = ctx.conn
        let caught: unknown

        await ctx.withReseed(async () => {
            async function moveProject(projectId: number, fromOrganizationId: number, toOrganizationId: number) {
                sync(connection.update(tProject)
                    .set({ organizationId: toOrganizationId })
                    .where(tProject.id.equals(projectId))
                    .executeUpdate())

                connection.executeBeforeNextCommit(async () => {
                    const remaining = sync(connection.selectFrom(tProject)
                        .where(tProject.organizationId.equals(fromOrganizationId))
                        .selectCountAll()
                        .executeSelectOne())
                    if (remaining === 0) {
                        throw new Error('The organization ' + fromOrganizationId + ' must keep at least one project')
                    }
                })
            }

            try {
                await connection.transaction(async () => {
                    await moveProject(1, 1, 2)
                    await moveProject(2, 1, 2)
                })
            } catch (e) {
                caught = e
            }

            const organizationOfProject1 = sync(connection.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .selectOneColumn(tProject.organizationId)
                .executeSelectOne())
            expect(organizationOfProject1).toBe(1)
        })

        expect(caught).toBeInstanceOf(TsSqlError)
        expect(caught instanceof TsSqlError && caught.errorReason.reason).toBe('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
    })

    test('docs:transaction/execute-after-next-commit', async () => {
        const sentTo: number[] = []
        const emailService = {
            async sendWelcomeEmail(userId: number) {
                sentTo.push(userId)
            },
        }
        const loggedErrors: string[] = []
        const logger = {
            error<ERROR>(message: string, _error: ERROR) {
                loggedErrors.push(message)
            },
        }
        ctx.mockNext(50)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            async function registerUserAndWelcome(email: string, fullName: string) {
                const userId = sync(connection.insertInto(tAppUser)
                    .set({ email, fullName })
                    .returningLastInsertedId()
                    .executeInsert())

                connection.executeAfterNextCommit(async () => {
                    try {
                        await emailService.sendWelcomeEmail(userId)
                    } catch (error) {
                        logger.error('The welcome e-mail could not be sent to the user ' + userId, error)
                    }
                })

                return userId
            }
            // doc-end

            const userId = await connection.transaction(() => registerUserAndWelcome('john@acme.test', 'John Smith'))

            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2)"`)
            expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
              [
                "john@acme.test",
                "John Smith",
              ]
            `)
            assertType<Exact<typeof userId, number>>()
            expect(sentTo).toEqual([userId])
        })

        expect(loggedErrors).toEqual([])
    })

    test('docs:transaction/execute-after-next-rollback', async () => {
        const uploaded: string[] = []
        const deleted: string[] = []
        const fileStorage = {
            async upload(path: string, _content: Uint8Array) {
                uploaded.push(path)
            },
            async delete(path: string) {
                deleted.push(path)
            },
        }
        const laterStepError = new Error('A later step of the transaction failed')
        ctx.mockNext(50)
        const connection = ctx.conn
        let caught: unknown

        await ctx.withReseed(async () => {
            // doc-start
            async function registerUserWithPhoto(email: string, fullName: string, photo: Uint8Array) {
                const userId = sync(connection.insertInto(tAppUser)
                    .set({ email, fullName })
                    .returningLastInsertedId()
                    .executeInsert())

                const photoPath = 'users/' + userId + '.jpg'
                await fileStorage.upload(photoPath, photo)
                connection.executeAfterNextRollback(async () => {
                    await fileStorage.delete(photoPath)
                })

                return userId
            }
            // doc-end

            try {
                await connection.transaction(async () => {
                    await registerUserWithPhoto('john@acme.test', 'John Smith', new Uint8Array([1, 2, 3]))
                    throw laterStepError
                })
            } catch (e) {
                caught = e
            }

            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2)"`)
            expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
              [
                "john@acme.test",
                "John Smith",
              ]
            `)
        })

        // The mock runner takes any error as a database error and wraps it.
        expect(caught instanceof TsSqlError ? caught.cause : caught).toBe(laterStepError)
        expect(uploaded).toHaveLength(1)
        expect(deleted).toEqual(uploaded)
    })

    test('docs:transaction/join-or-begin', async () => {
        ctx.mockNext(50)
        ctx.mockNext(51)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
                if (connection.isTransactionActive()) {
                    return fn()
                }
                return connection.transaction(fn)
            }

            const userId = await inTransaction(async () => registerUser('john@acme.test', 'John Smith'))
            // doc-end

            // Called with a transaction running, it joins it: this connection rejects a nested transaction.
            const otherUserId = await connection.transaction(() => inTransaction(async () => registerUser('jane@acme.test', 'Jane Doe')))

            expect(statementsSql()).toMatchInlineSnapshot(`
              [
                "insert into app_user (email, full_name) values (?1, ?2)",
                "insert into app_user (email, full_name) values (?1, ?2)",
              ]
            `)
            assertType<Exact<typeof userId, number>>()
            assertType<Exact<typeof otherUserId, number>>()
            expect(connection.isTransactionActive()).toBe(false)
        })
    })

    test('docs:transaction/get-transaction-metadata', async () => {
        // Section "Transaction metadata" — `getTransactionMetadata()`
        // returns a `Map<unknown, unknown>` scoped to the current
        // transaction.
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const stored = await connection.transaction(async () => {
                connection.getTransactionMetadata().set('my key', 'my value')
                return connection.getTransactionMetadata().get('my key')
            })
            // doc-end
            expect(stored).toBe('my value')
        })
    })

    test('docs:transaction/once-per-transaction', async () => {
        const invalidated: number[][] = []
        const userCache = {
            invalidate(userIds: Set<number>) {
                invalidated.push([...userIds])
            },
        }
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const changedUsers = Symbol('changedUsers')

            function refreshUserInCacheAfterCommit(userId: number) {
                const metadata = connection.getTransactionMetadata()
                // 1. Look for what this transaction has collected so far
                const collected = metadata.get(changedUsers)
                let userIds = collected instanceof Set ? collected : undefined
                if (!userIds) {
                    // 2. The first time in this transaction: keep the collection in the metadata
                    //    and register the function, which will use it
                    const newUserIds = new Set<number>()
                    metadata.set(changedUsers, newUserIds)
                    connection.executeAfterNextCommit(() => {
                        userCache.invalidate(newUserIds)
                    })
                    userIds = newUserIds
                }
                // 3. Every time: add this user to the collection
                userIds.add(userId)
            }
            // doc-end

            await connection.transaction(async () => {
                refreshUserInCacheAfterCommit(1)
                refreshUserInCacheAfterCommit(2)
                refreshUserInCacheAfterCommit(1)
            })
            expect(invalidated).toEqual([[1, 2]])

            // The next transaction starts with empty metadata, so it registers its own function.
            await connection.transaction(async () => {
                refreshUserInCacheAfterCommit(3)
            })
            expect(invalidated).toEqual([[1, 2], [3]])
        })
    })

    test('docs:transaction/outbox', async () => {
        let wakeUps = 0
        const outboxRelay = {
            wakeUp() {
                wakeUps += 1
            },
        }
        ctx.mockNext(50)
        ctx.mockNext(1)
        ctx.mockNext(1)
        // Seeded issue 1 already has one event.
        ctx.mockNext(3)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const relayWakeUpRegistered = Symbol('relayWakeUpRegistered')

            async function addToOutbox(issueId: number, eventType: 'created' | 'updated') {
                sync(connection.insertInto(tWebhookEvent)
                    .set({ issueId, eventType })
                    .executeInsert())

                const metadata = connection.getTransactionMetadata()
                if (!metadata.get(relayWakeUpRegistered)) {
                    metadata.set(relayWakeUpRegistered, true)
                    connection.executeAfterNextCommit(() => {
                        // Not awaited: the caller doesn't wait for the messages to be sent
                        outboxRelay.wakeUp()
                    })
                }
            }

            await connection.transaction(async () => {
                await registerUser('john@acme.test', 'John Smith')
                await addToOutbox(1, 'created')
                await addToOutbox(1, 'updated')
            })
            // doc-end

            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into webhook_event (issue_id, event_type) values (?1, ?2)"`)
            expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
              [
                1,
                "updated",
              ]
            `)

            const eventsOfIssue1 = sync(connection.selectFrom(tWebhookEvent)
                .where(tWebhookEvent.issueId.equals(1))
                .selectCountAll()
                .executeSelectOne())
            expect(eventsOfIssue1).toBe(3)
        })

        expect(wakeUps).toBe(1)
    })

    test('docs-extra:transaction/hooks-throw-without-transaction', async () => {
        // Registering a function when there is no transaction throws `NOT_IN_TRANSACTION`.
        const connection = ctx.conn

        expect(() => connection.executeBeforeNextCommit(() => { /* */ })).toThrow(/NOT_IN_TRANSACTION/)
        expect(() => connection.executeAfterNextCommit(() => { /* */ })).toThrow(/NOT_IN_TRANSACTION/)
        expect(() => connection.executeAfterNextRollback(() => { /* */ })).toThrow(/NOT_IN_TRANSACTION/)
    })

    test('docs-extra:transaction/hooks-cleared-after-use', async () => {
        // "Note" on the page: hooks are registered for the NEXT
        // transaction event and cleared after use — a subsequent
        // transaction does not re-fire them.
        const connection = ctx.conn
        let count = 0

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeAfterNextCommit(() => { count += 1 })
            })
            await connection.transaction(async () => {
                // no hook registered here — count must stay at 1.
            })
        })

        expect(count).toBe(1)
    })

    test('docs-extra:transaction/before-commit-not-fired-on-rollback', async () => {
        // "Deferring logic" section: the hooks "only run if the transaction
        // reaches a specific outcome (commit or rollback)".
        // `executeBeforeNextCommit` is a commit-only hook — when the body
        // throws and the transaction rolls back, it must NOT fire. The
        // after-rollback hook is the positive control proving the rollback
        // outcome was actually reached.
        const connection = ctx.conn
        let beforeCommitFired = false
        let rollbackFired = false

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeBeforeNextCommit(() => { beforeCommitFired = true })
                    connection.executeAfterNextRollback(() => { rollbackFired = true })
                    throw new Error('roll me back')
                })
            } catch { /* swallow */ }
        })

        expect(rollbackFired).toBe(true)
        expect(beforeCommitFired).toBe(false)
    })

    test('docs-extra:transaction/after-commit-not-fired-on-rollback', async () => {
        // Companion for `executeAfterNextCommit`: a rolled-back transaction
        // never runs the after-commit hook. Again the after-rollback hook is
        // the positive control for the outcome reached.
        const connection = ctx.conn
        let afterCommitFired = false
        let rollbackFired = false

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { afterCommitFired = true })
                    connection.executeAfterNextRollback(() => { rollbackFired = true })
                    throw new Error('roll me back')
                })
            } catch { /* swallow */ }
        })

        expect(rollbackFired).toBe(true)
        expect(afterCommitFired).toBe(false)
    })

    test('docs-extra:transaction/after-rollback-not-fired-on-commit', async () => {
        // The inverse: `executeAfterNextRollback` is a rollback-only hook, so
        // a transaction that commits cleanly must NOT run it. The after-commit
        // hook is the positive control proving the commit outcome was reached.
        const connection = ctx.conn
        let afterRollbackFired = false
        let commitFired = false

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeAfterNextCommit(() => { commitFired = true })
                connection.executeAfterNextRollback(() => { afterRollbackFired = true })
            })
        })

        expect(commitFired).toBe(true)
        expect(afterRollbackFired).toBe(false)
    })

    test('docs-extra:transaction/before-commit-throw-aborts-commit-and-triggers-rollback', async () => {
        // `executeBeforeNextCommit` runs "just before the commit". Because it
        // runs while the transaction is still open, throwing from it aborts
        // the commit: the transaction rolls back instead, the after-rollback
        // hook fires, and the after-commit hook does not. The thrown error
        // surfaces to the caller of `transaction(...)`.
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeBeforeNextCommit(() => {
                        events.push('before-commit')
                        throw new Error('veto the commit')
                    })
                    connection.executeAfterNextCommit(() => { events.push('after-commit') })
                    connection.executeAfterNextRollback(() => { events.push('after-rollback') })
                })
            } catch (e) { caught = e }
        })

        expect((caught as Error).message).toContain('veto the commit')
        // after-commit absent → the commit was aborted; after-rollback present
        // → the transaction rolled back instead.
        expect(events).toEqual(['before-commit', 'after-rollback'])
    })

    test('docs-extra:transaction/async-hooks-are-awaited', async () => {
        // The page: each hook "accepts either a synchronous function (`() =>
        // void`) or an asynchronous one (`() => Promise<void>`)". An async
        // hook's promise is awaited before the surrounding transaction call
        // resolves — so a hook that defers its write across a microtask still
        // completes in time. Covers the before-commit and after-commit hooks
        // on a committing transaction and the after-rollback hook on a
        // rolling-back one.
        const connection = ctx.conn
        const order: string[] = []

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeBeforeNextCommit(async () => {
                    await Promise.resolve()
                    order.push('before-commit')
                })
                connection.executeAfterNextCommit(async () => {
                    await Promise.resolve()
                    order.push('after-commit')
                })
            })

            let rolledBack = false
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(async () => {
                        await Promise.resolve()
                        rolledBack = true
                    })
                    throw new Error('roll me back')
                })
            } catch { /* swallow */ }

            expect(rolledBack).toBe(true)
        })

        expect(order).toEqual(['before-commit', 'after-commit'])
    })

    test('docs-extra:transaction/metadata-throws-without-transaction', async () => {
        // `getTransactionMetadata()` is scoped to the current transaction; with none active
        // it throws `NOT_IN_TRANSACTION`.
        const connection = ctx.conn
        expect(() => connection.getTransactionMetadata()).toThrow(/NOT_IN_TRANSACTION/)
    })

    test('docs-extra:transaction/metadata-not-shared-between-transactions', async () => {
        // The metadata map is per-transaction: a value stored in one
        // transaction is gone in the next (the map is cleared when the
        // transaction closes), mirroring "registered only for the next
        // transaction" for the deferred hooks.
        const connection = ctx.conn
        let secondHasKey = true

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.getTransactionMetadata().set('my key', 'my value')
            })
            await connection.transaction(async () => {
                secondHasKey = connection.getTransactionMetadata().has('my key')
            })
        })

        expect(secondHasKey).toBe(false)
    })

    test('docs-extra:transaction/before-commit-query-commits-with-rest', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                sync(connection.insertInto(tOrganization).set({ name: 'Top Organization', plan: 'free' }).executeInsert())
                connection.executeBeforeNextCommit(async () => {
                    sync(connection.insertInto(tOrganization).set({ name: 'Top Organization', plan: 'pro' }).executeInsert())
                })
            })

            const savedOrganizations = sync(connection.selectFrom(tOrganization)
                .where(tOrganization.name.equals('Top Organization'))
                .selectCountAll()
                .executeSelectOne())

            expect(statementsSql()).toMatchInlineSnapshot(`
              [
                "insert into organization (name, plan) values (?1, ?2)",
                "insert into organization (name, plan) values (?1, ?2)",
                "select count(*) as result from organization where name = ?1",
              ]
            `)
            expect(savedOrganizations).toBe(2)
        })
    })

    test('docs-extra:transaction/after-commit-query-runs-outside', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        const connection = ctx.conn
        let activeInTheFunction = true

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeAfterNextCommit(async () => {
                    activeInTheFunction = connection.isTransactionActive()
                    sync(connection.insertInto(tOrganization).set({ name: 'Top Organization', plan: 'free' }).executeInsert())
                })
            })

            const savedOrganizations = sync(connection.selectFrom(tOrganization)
                .where(tOrganization.name.equals('Top Organization'))
                .selectCountAll()
                .executeSelectOne())

            expect(statementsSql()).toMatchInlineSnapshot(`
              [
                "insert into organization (name, plan) values (?1, ?2)",
                "select count(*) as result from organization where name = ?1",
              ]
            `)
            expect(savedOrganizations).toBe(1)
        })

        expect(activeInTheFunction).toBe(false)
    })

    test('docs-extra:transaction/resolves-after-hooks', async () => {
        const connection = ctx.conn
        let finished = false

        await ctx.withReseed(async () => {
            const result = await connection.transaction(async () => {
                connection.executeAfterNextCommit(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 1))
                    finished = true
                })
                return 'the value of fn'
            })

            assertType<Exact<typeof result, string>>()
            expect(result).toBe('the value of fn')
            expect(finished).toBe(true)
        })
    })

    test('docs-extra:transaction/after-commit-error-keeps-changes', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        const connection = ctx.conn
        const hookError = new Error('The function failed')
        let caught: unknown

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    sync(connection.insertInto(tOrganization).set({ name: 'Top Organization', plan: 'free' }).executeInsert())
                    connection.executeAfterNextCommit(() => {
                        throw hookError
                    })
                })
            } catch (e) {
                caught = e
            }

            const savedOrganizations = sync(connection.selectFrom(tOrganization)
                .where(tOrganization.name.equals('Top Organization'))
                .selectCountAll()
                .executeSelectOne())
            expect(savedOrganizations).toBe(1)
        })

        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(caught instanceof TsSqlError && caught.errorReason.reason).toBe('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
        expect(caught instanceof TsSqlError && caught.cause).toBe(hookError)
    })

    test('docs-extra:transaction/commit-before-hook-failure-rolls-back', async () => {
        const connection = ctx.conn
        const hookError = new Error('The function failed')
        let caught: unknown

        await ctx.withReseed(async () => {
            await connection.beginTransaction()
            connection.executeBeforeNextCommit(() => {
                throw hookError
            })

            try {
                await connection.commit()
            } catch (e) {
                caught = e
            }
            expect(connection.isTransactionActive()).toBe(false)
        })

        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(caught instanceof TsSqlError && caught.errorReason.reason).toBe('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
        expect(caught instanceof TsSqlError && caught.cause).toBe(hookError)
    })

    test('docs-extra:transaction/rollback-hook-error', async () => {
        const connection = ctx.conn
        const hookError = new Error('The function failed')
        let caught: unknown

        await ctx.withReseed(async () => {
            await connection.beginTransaction()
            connection.executeAfterNextRollback(() => {
                throw hookError
            })

            try {
                await connection.rollback()
            } catch (e) {
                caught = e
            }
            expect(connection.isTransactionActive()).toBe(false)
        })

        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(caught instanceof TsSqlError && caught.errorReason.reason).toBe('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
        expect(caught instanceof TsSqlError && caught.cause).toBe(hookError)
    })

    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('docs-extra:transaction/nested-metadata', async () => {
        const connection = ctx.nestedTransactionConn()
        const seen: string[] = []

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.getTransactionMetadata().set('my key', 'outer value')

                await connection.transaction(async () => {
                    seen.push(String(connection.getTransactionMetadata().has('my key')))
                    connection.getTransactionMetadata().set('my key', 'inner value')
                    seen.push(String(connection.getTransactionMetadata().get('my key')))
                })

                seen.push(String(connection.getTransactionMetadata().get('my key')))
            })
        })

        expect(seen).toEqual(['false', 'inner value', 'outer value'])
    })
    */
})
