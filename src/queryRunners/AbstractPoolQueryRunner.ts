import type { QueryRunner, DatabaseType } from "./QueryRunner"

export abstract class AbstractPoolQueryRunner implements QueryRunner {
    private currentQueryRunner?: QueryRunner
    private transactionLevel = 0
    abstract readonly database: DatabaseType

    abstract useDatabase(database: DatabaseType): void
    abstract getNativeRunner(): unknown

    async execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.execute(fn)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeSelectOneRow(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeSelectManyRows(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeSelectOneColumnOneRow(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeSelectOneColumnManyRows(query: string, params: any[] =[]): Promise<any[]> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeSelectOneColumnManyRows(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeInsert(query: string, params: any[] = []): Promise<number> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeInsert(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeInsertReturningLastInsertedId(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any[]> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeUpdate(query: string, params: any[] = []): Promise<number> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeUpdate(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeDelete(query: string, params: any[] = []): Promise<number> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeDelete(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeProcedure(query: string, params: any[] = []): Promise<void> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeProcedure(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeFunction(query: string, params: any[] = []): Promise<any> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeFunction(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    async executeBeginTransaction(): Promise<void> {
        if (this.transactionLevel <= 0) {
            this.transactionLevel = 1
        } else {
            const queryRunner = await this.getQueryRunner()
            await queryRunner.executeBeginTransaction()
            this.transactionLevel++
        }
    }
    async executeCommit(): Promise<void> {
        if (this.transactionLevel <= 0) {
            throw new Error('You are not in a transaction')
        } else if (this.currentQueryRunner) {
            this.transactionLevel--
            try {
                await this.currentQueryRunner.executeCommit()
            } finally {
                this.releaseIfNeeded()
            }
        }
    }
    async executeRollback(): Promise<void> {
        if (this.transactionLevel <= 0) {
            throw new Error('You are not in a transaction')
        } else if (this.currentQueryRunner) {
            this.transactionLevel--
            try {
                await this.currentQueryRunner.executeRollback()
            } finally {
                this.releaseIfNeeded()
            }
        }
    }
    async executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        try {
            const queryRunner = await this.getQueryRunner()
            return await queryRunner.executeDatabaseSchemaModification(query, params)
        } finally {
            this.releaseIfNeeded()
        }
    }
    abstract addParam(params: any[], value: any): string
    abstract addOutParam(params: any[], name: string): string

    private async getQueryRunner(): Promise<QueryRunner> {
        if (!this.currentQueryRunner) {
            this.currentQueryRunner = await this.createQueryRunner()
            if (this.transactionLevel > 0) {
                await this.currentQueryRunner.executeBeginTransaction()
            }
        }
        return this.currentQueryRunner
    }
    private releaseIfNeeded() {
        if (this.transactionLevel <= 0 && this.currentQueryRunner) {
            this.releaseQueryRunner(this.currentQueryRunner)
            this.currentQueryRunner = undefined
        }
    }

    protected abstract createQueryRunner(): Promise<QueryRunner>
    protected abstract releaseQueryRunner(queryRunner: QueryRunner): void
}