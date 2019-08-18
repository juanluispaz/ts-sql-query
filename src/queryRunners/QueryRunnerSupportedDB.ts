export interface QueryRunnerSupportedDB {
    readonly mariaDB?: true
    readonly mySql?: true
    readonly noopDB?: true
    readonly oracle?: true
    readonly postgreSql?: true
    readonly sqlite?: true
    readonly sqlServer?: true
}