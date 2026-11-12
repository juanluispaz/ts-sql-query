import type { AnyTableOrView } from '../utils/ITableOrView.js'
import type { AnyValueSource } from '../expressions/values.js'
import type { SelectColumnSql } from '../sqlBuilders/AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'

/**
 * The state of the construction of the SQL of one query: the params the query runner receives, and what the SQL builder
 * keeps while it writes the query (where it is, what it already wrote, what the enclosing part asked of the inner one).
 * One per rendering of a query; nothing of it but the params reaches the query runner.
 */
export class SqlBuildContext {
    /** The params of the query, which the query runner receives with the metadata hung on them (metadataSymbols.ts) */
    readonly params: any[]

    /** The table or view whose columns are written without its name (the only one of the from) */
    safeTableOrView: AnyTableOrView | undefined = undefined
    /**
     * The safe table or view the select clause wrote its columns against, kept while the order by is written: the order
     * by writes its terms qualified, but a term that resolves an alias of the select to its column is written as that
     * column appears in the select clause (bare on a select of one table), so a lower(...) or a collate around it refers
     * to a real column
     */
    orderBySafeTableOrView: AnyTableOrView | undefined = undefined
    /** The SQL of each column of the select being written, for the clauses that refer to them */
    selectColumnsSql: Map<AnyValueSource, SelectColumnSql> | undefined = undefined
    /**
     * The columns of the select being written are converted by the query that wraps it (_needsResultConversionWrap), so
     * this select writes them as they are
     */
    resultConversionDeferred: boolean = false
    /** The alias of the query that wraps a select to convert its columns, while its order by is written */
    resultConversionWrapperAlias: string | undefined = undefined
    /**
     * The query that wraps a select to convert its columns also passes on every other column of it (wrapper.*), the ones
     * a customization adds included: the columns it converts have another alias in the wrapped select
     */
    resultConversionWithAllColumns: boolean = false
    /** The order by is written on the select that wraps the one being written */
    orderByOnWrapper: boolean = false
    /** The table or view written with the alias forceAliasAs */
    forceAliasFor: AnyTableOrView | undefined = undefined
    /** The alias the table or view forceAliasFor is written with */
    forceAliasAs: string | undefined = undefined
    /** The tables and views whose names are written as they are in the query, not as their aliases */
    fakeNamesOf: Set<AnyTableOrView> | undefined = undefined
    /** The withs of an inner query are written in the outer query */
    generateExternalWith: boolean = false
    /** The with clause is already written */
    withGenerated: boolean = false
    /** The with clause is already written, and no inner query may write it again */
    withGeneratedFinished: boolean = false
    /** The select being written is wrapped to be used as an aggregated array */
    aggregateArrayWrapped: boolean = false
    /** The logical operation the condition being written ends up in, to know when it needs parenthesis */
    resultingOperation: '_and' | '_or' | undefined = undefined
    /** The outermost query being written */
    rootQuery: object | undefined = undefined
    /**
     * A value is being assigned to a column of a table (the values of an insert, the set of an update): it takes the type
     * of the column; a value elsewhere has the type its parameter gives
     */
    assigningValueToColumn: boolean = false
    /**
     * MySQL, MariaDB: the columns of the table being updated that the set reads with the value they had before the
     * update (the database gives the value an earlier assignment of the same set already wrote)
     */
    updateOldRowColumns: Set<DBColumn> | undefined = undefined
    /** SQLite: a decimal of the order by is ordered as a real */
    orderByDecimalAsReal: boolean = false

    /** The last number given by generateUnique */
    private unique = 0
    /** The name in this query of each generated name (generatedNameOf) */
    private generatedNames: Map<string, string> | undefined = undefined

    constructor(params: any[] = []) {
        this.params = params
    }

    /** A number not given before in this query, to compose a unique name */
    generateUnique(): number {
        return ++this.unique
    }

    /**
     * The name in this query of a name the library generated when the query was defined (a recursive select,
     * recursive_select_<n>, unique among all the queries): the same prefix with a number of this query, given the first
     * time it is written, so the SQL doesn't depend on the queries defined before
     */
    generatedNameOf(generatedName: string): string {
        let names = this.generatedNames
        if (!names) {
            names = new Map()
            this.generatedNames = names
        }
        let result = names.get(generatedName)
        if (result === undefined) {
            result = generatedName.replace(/\d+$/, '') + this.generateUnique()
            names.set(generatedName, result)
        }
        return result
    }
}
