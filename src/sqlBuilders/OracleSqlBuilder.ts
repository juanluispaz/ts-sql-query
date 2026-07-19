import type { ToSql, InsertData, CompoundOperator, SelectData, QueryColumns, FlatQueryColumns, WithSelectData, WithValuesData, OrderByEntry, SqlOperation } from './SqlBuilder.js'
import { flattenQueryColumns, hasToSql, getQueryColumn, operationOf } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource, __isUuidValueSource, __isBooleanValueSource, __isBooleanValueType, __isUuidValueType } from '../expressions/values.js'
import { isDefault } from '../expressions/Default.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { isColumn, __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import { SqlOperation1ValueSourceIfValueOrIgnore } from '../internal/ValueSourceImpl.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

/**
 * Minimal view of a `_concat` operation node (a `SqlOperation1ValueSource`) so the builder
 * can walk a concat chain down to its atomic operands. Only reached after `operationOf(node)
 * === '_concat'` has confirmed the shape.
 */
interface ConcatNode {
    __valueSource: AnyValueSource
    __value: unknown
}

export class OracleSqlBuilder extends AbstractSqlBuilder {
    oracle: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getTime = true
        // `_getMilliseconds` is overridden below as a self-contained call, so it never
        // needs the wrapping the base's trailing-`% 1000` form asks for.
        this._operationsThatNeedParenthesis._getMilliseconds = false
        this._operationsThatNeedParenthesis._getDay = true
        this._operationsThatNeedParenthesis._negate = true
        // _cot is emitted as the compound expression `1 / tan(x)` (Oracle
        // has no native COT function), so it must be parenthesised when used
        // as an operand of another operation.
        this._operationsThatNeedParenthesis._cot = true
        // `_replaceAll`/`_replaceAllInsensitive` append a trailing `collate USING_NLS_COMP`
        // reset (see those overrides) whenever `replaceCollation`/`insensitiveCollation` forces
        // a collation. That trailing `collate` binds looser than the operators — and than an
        // outer `replace`'s own forced collation — that embed it, so the whole expression must
        // be wrapped when used as an operand. Without this, chaining (`replaceAll().replaceAll()`,
        // `replaceAll().collate()`, `replaceAll().replaceAllInsensitive()`) emits two adjacent
        // `collate` clauses — `... collate USING_NLS_COMP collate BINARY` — which Oracle rejects
        // (`ORA-00907: missing right parenthesis`). A PARENTHESISED double collate is valid, so
        // this is only registered on the dialects that add the reset (Oracle + SQL Server), never
        // on the base (MySQL/MariaDB/PostgreSQL/SQLite emit a bare `replace(...)` with no trailing
        // collate, so wrapping it would only add noise).
        this._operationsThatNeedParenthesis._replaceAll = true
        this._operationsThatNeedParenthesis._replaceAllInsensitive = true
    }

    override _cot(params: any[], valueSource: ToSql): string {
        // Oracle has no COT function (ORA-00904: "COT": invalid identifier).
        // Cotangent is the reciprocal of the tangent; emit 1 / tan(x), which
        // evaluates the argument once (no parameter duplication). Nesting is
        // handled via `_operationsThatNeedParenthesis._cot` set in the
        // constructor.
        return '1 / tan(' + this._appendSql(valueSource, params, false) + ')'
    }

    // Oracle is strict ANSI about GROUP BY: every non-aggregated SELECT
    // column must appear in the GROUP BY clause, otherwise it raises
    // `ORA-00979: not a GROUP BY expression`. PostgreSQL relaxes this via
    // functional dependency when grouping by a primary key. The library
    // could close the gap by overriding `_buildSelectGroupBy` here with a
    // PK-aware auto-expansion, equivalent to the same approach planned
    // for SQL Server. See the commented-out `_buildSelectGroupBy` /
    // `_isAggregateValueSource` block in
    // [src/sqlBuilders/SqlServerSqlBuilder.ts] for the reference
    // implementation and the rationale for not shipping it yet — the
    // chosen path is to require consumers to spell out every
    // non-aggregated column in `.groupBy(...)`, so the same TypeScript
    // works on every dialect without dialect-specific auto-expansion.
    // The hook on `AbstractSqlBuilder._buildSelectGroupBy` is kept so
    // this (and the future `.groupBy()`-no-args ergonomic API) can land
    // later without another refactor.

    override _useInsertSupportWith(): boolean {
        return false
    }
    // Oracle Database 23ai added support for the ANSI `UPDATE … FROM`
    // form (and `DELETE … USING`). Earlier versions reject the clause
    // at the parser. When the library emits the FROM clause and the
    // LHS of a SET assignment refers to a column whose name also
    // exists in one of the FROM-side tables, Oracle raises
    // `ORA-00918: column ambiguously specified` — PostgreSQL / SQL
    // Server / SQLite / MariaDB / MySQL all resolve the bare LHS to
    // the target table, but Oracle requires it to be explicitly
    // qualified. The override below qualifies the SET LHS with the
    // target table (or its alias) whenever a FROM/JOIN is present,
    // matching the `_setSafeTableOrView(params, undefined)` branch in
    // `_buildUpdate`. Plain `UPDATE … SET col = … WHERE …` (no FROM,
    // no JOIN) keeps the unqualified form for backwards compatibility
    // with existing snapshots and to stay close to what users write.
    override _appendColumnNameForUpdate(column: DBColumn, params: any[]) {
        const columnPrivate = __getColumnPrivate(column)
        if (this._getSafeTableOrView(params) === undefined) {
            const tableOrView = columnPrivate.__tableOrView
            const tablePrivate = __getTableOrViewPrivate(tableOrView)
            const qualifier = tablePrivate.__as
                ? this._escape(tablePrivate.__as, true)
                : this._escape(tablePrivate.__name, false)
            return qualifier + '.' + this._escape(columnPrivate.__name, true)
        }
        return this._escape(columnPrivate.__name, true)
    }
    _getUuidStrategy(): 'string' | 'custom-functions' | 'built-in' {
        return this._connectionConfiguration.uuidStrategy as any || 'built-in'
    }
    _uuidUsesRawFunctions(): boolean {
        const strategy = this._getUuidStrategy()
        return strategy === 'custom-functions' || strategy === 'built-in'
    }
    // Oracle's `||` treats NULL as the empty string, so `'x' || null` is `'x'` where every
    // other supported database answers NULL. This surfaces twice — a `concat` that returns a
    // present string where its declared type says optional, and (the worse half) an affix
    // predicate built on a NULL term collapsing to `like '%'`, matching the whole table
    // instead of nothing. `_concat` and the affix patterns are ONE seam on purpose: a
    // `startsWith` that propagates NULL while `concat` does not would only relocate the
    // inconsistency. There are three modes, chosen per call:
    //
    //   - `concatFunction` set → route through the user's null-propagating function
    //     (`_concatSql` emits `f(a, b)`; the affix methods below nest it). It poisons NULL
    //     itself and does not repeat the operand.
    //   - `ignoreNullInConcat` set → keep the bare native `||` (Oracle's own semantics).
    //   - default (neither) → EMULATE NULL propagation with a poison `CASE`, gated by
    //     build-time optionality so a concatenation of required operands is still bare `||`.
    //     `_concat` below builds the flat form (`case when <optional atomic operands> is
    //     null then null else a || b || c end`); the affix methods wrap their pattern the
    //     same way. This matches the other dialects and the declared (optional) type — the
    //     stance min/max already takes for PostgreSQL / SQL Server.
    //
    // The poison repeats each optional operand (once in the null check, once in the value) —
    // free for a column, and the `concatFunction` opt-in exists for the rare expensive
    // receiver. Each appearance is its OWN emission (a fresh append / escape), because the
    // library never reuses a bind placeholder: an operand that carries a parameter is bound
    // once per appearance, exactly as min/max does (e.g. `substr(:8, …, -length(:10), :11)`).
    //
    // `_needParenthesis` keeps `_concat` as needing parenthesis (the native `a || b` and the
    // poison `case … end` are both operators/expressions that must be wrapped when embedded);
    // only the `concatFunction` form is exempt, since `f(a, b)` already stands alone. The
    // decision is made here per call because the connection hands the builder its
    // configuration after the constructor runs; the cost is one property read when unset.
    override _needParenthesis(value: any): boolean {
        if (this._connectionConfiguration.concatFunction && operationOf(value) === '_concat') {
            return false
        }
        return super._needParenthesis(value)
    }
    override _needParenthesisExcluding(value: any, excluding: keyof SqlOperation): boolean {
        if (this._connectionConfiguration.concatFunction && operationOf(value) === '_concat') {
            return false
        }
        return super._needParenthesisExcluding(value, excluding)
    }
    override _concatSql(left: string, right: string): string {
        const concatFunction = this._connectionConfiguration.concatFunction
        if (concatFunction) {
            return concatFunction + '(' + left + ', ' + right + ')'
        }
        return super._concatSql(left, right)
    }
    override _concat(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const configuration = this._connectionConfiguration
        // Function opt-in and native opt-out both go through `_concatSql` (super): the
        // function propagates NULL itself, the native `||` is the deliberate opt-out. Neither
        // needs the poison `CASE`.
        if (configuration.concatFunction || configuration.ignoreNullInConcat) {
            return super._concat(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        // Default: emulate NULL propagation, following the same shape as the base's min/max
        // poisoning (`_minAndMaxValueBetweenTwoValuesPoisoningNull`): `case when <null check>
        // then null else <value> end`, where the value part is built by a SEPARATE method
        // (`_concatChainSql`) that does no null handling. Oracle's `||` reads NULL as '', so
        // `a || b` is NULL only when BOTH are — the whole chain must be null-checked operand by
        // operand. `_appendConcatNullCheck` walks the chain building that `<a> is null or …` check
        // over the build-time-optional leaves and appending their params as it goes (so those
        // params precede the value part's). An empty check means nothing can be NULL at build time
        // — and, by the same token, no param was appended — so the bare native join is emitted with
        // no `CASE`. A concat wrapped in another operation (e.g. `valueWhenNull`) is a single leaf
        // here, so it keeps its own `CASE` (see `_concatChainSql`).
        const nullCheck = this._appendConcatNullCheck(params, valueSource, value)
        if (!nullCheck) {
            return super._concat(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return 'case when ' + nullCheck + ' then null else ' + this._concatChainSql(params, valueSource, value) + ' end'
    }
    // Builds the poison `CASE`'s null check for a concat chain: `<a> is null or <b> is null or …`
    // over the build-time-optional atomic leaves, appending each leaf's params as it goes. It walks
    // the concat operands directly, mirroring `_concatChainSql`: a `_concat` operand is descended
    // into; any other operand is a leaf, checked when it is optional (a nullable column,
    // `optionalConst(null)`, a `valueWhenNull`-wrapped concat, …). Building the check straight from
    // the walk avoids collecting the leaves into an intermediate array first. Returns '' when
    // nothing is optional — and in that case appends NO param, so the caller can fall back to the
    // bare join with the param array untouched.
    private _appendConcatNullCheck(params: any[], valueSource: any, value: any): string {
        let left: string
        if (this._isConcatChainNode(valueSource)) {
            const node = valueSource as unknown as ConcatNode
            left = this._appendConcatNullCheck(params, node.__valueSource, node.__value)
        } else if (this._isOptionalValue(valueSource)) {
            left = this._isNull(params, valueSource)
        } else {
            left = ''
        }
        let right: string
        if (this._isConcatChainNode(value)) {
            const node = value as ConcatNode
            right = this._appendConcatNullCheck(params, node.__valueSource, node.__value)
        } else if (this._isOptionalValue(value)) {
            right = this._isNull(params, value)
        } else {
            right = ''
        }
        if (!left) {
            return right
        }
        if (!right) {
            return left
        }
        return left + ' or ' + right
    }
    // The flat native join of a concat chain with NO null handling — the concat analog of the
    // base's `_minAndMaxValueSelection`, used for the value branch of the poison `CASE` in
    // `_concat`. It walks the concat operands DIRECTLY (recursing on a `_concat` operand rather
    // than dispatching to the public `_concat`), so the whole chain stays ONE flat `a || b || …`
    // instead of a nested `CASE` per `||`. Every non-concat operand goes through the normal
    // append, so a concat wrapped in another operation reaches the public `_concat` and keeps
    // its own `CASE`. Types are threaded exactly as the operation node's `__toSql` does: the
    // right operand is appended with the LEFT operand's value type.
    private _concatChainSql(params: any[], valueSource: ToSql, value: any): string {
        let left: string
        if (this._isConcatChainNode(valueSource)) {
            const node = valueSource as unknown as ConcatNode
            left = this._concatChainSql(params, node.__valueSource as unknown as ToSql, node.__value)
        } else {
            left = this._appendSqlParenthesisExcluding(valueSource, params, '_concat', false)
        }
        let right: string
        if (this._isConcatChainNode(value)) {
            const node = value as ConcatNode
            right = this._concatChainSql(params, node.__valueSource as unknown as ToSql, node.__value)
        } else {
            const leftPrivate = __getValueSourcePrivate(valueSource as unknown as AnyValueSource)
            right = this._appendValueParenthesisExcluding(value, params, leftPrivate.__valueType, leftPrivate.__valueTypeName, leftPrivate.__typeAdapter, '_concat', false)
        }
        return this._concatSql(left, right)
    }
    // Whether a node is a concat-CHAIN node the two walks above descend into, rather than a
    // leaf. Every `_concat` operation node is — EXCEPT a `.concatIfValue()` whose value is
    // ABSENT (`null` / `undefined` / `''` under `allowEmptyString:false`). That node carries
    // `__operation === '_concat'` even when its value is ignored, but it is a NO-OP that renders
    // as just its receiver: its `__toSql` short-circuits to `__valueSource` (see
    // `SqlOperation1ValueSourceIfValueOrIgnore.__toSql`). So the walks must treat it as a LEAF
    // and let `__toSql` drop the dead operand. Descending into it (the pre-fix `operationOf(...)
    // === '_concat'` check did) processed its dead operand, which emitted a spurious bound param
    // for the ignored value and — for an `undefined`/`null` value — crashed `_isNull` on the
    // missing operand. This only surfaced when the `concatIfValue` was NESTED under a further
    // `.concat()`; the outermost case is resolved by `__toSql` before `_concat` runs. Mirrors
    // `_appendMaybeInnerConcat` on MySQL/MariaDB, which skips the ignored operand the same way.
    private _isConcatChainNode(node: any): boolean {
        if (operationOf(node) !== '_concat') {
            return false
        }
        if (node instanceof SqlOperation1ValueSourceIfValueOrIgnore && !this._isValue(node.__value)) {
            return false
        }
        return true
    }
    override _likePatternStartingWith(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const concatFunction = this._connectionConfiguration.concatFunction
        if (concatFunction) {
            const term = this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false)
            const sql = concatFunction + '(' + term + ", '%')"
            return fold ? 'lower(' + sql + ')' : sql
        }
        if (this._connectionConfiguration.ignoreNullInConcat || !this._isOptionalValue(value)) {
            return super._likePatternStartingWith(params, value, columnType, columnTypeName, typeAdapter, fold)
        }
        return this._poisonAffixPattern(params, value, columnType, columnTypeName, typeAdapter, fold, (term) => term + " || '%'")
    }
    override _likePatternEndingWith(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const concatFunction = this._connectionConfiguration.concatFunction
        if (concatFunction) {
            const term = this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false)
            const sql = concatFunction + "('%', " + term + ')'
            return fold ? 'lower(' + sql + ')' : sql
        }
        if (this._connectionConfiguration.ignoreNullInConcat || !this._isOptionalValue(value)) {
            return super._likePatternEndingWith(params, value, columnType, columnTypeName, typeAdapter, fold)
        }
        return this._poisonAffixPattern(params, value, columnType, columnTypeName, typeAdapter, fold, (term) => "'%' || " + term)
    }
    override _likePatternContaining(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const concatFunction = this._connectionConfiguration.concatFunction
        if (concatFunction) {
            // The function is binary, so gluing both wildcards nests: `f(f('%', term), '%')`.
            const term = this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false)
            const sql = concatFunction + '(' + concatFunction + "('%', " + term + "), '%')"
            return fold ? 'lower(' + sql + ')' : sql
        }
        if (this._connectionConfiguration.ignoreNullInConcat || !this._isOptionalValue(value)) {
            return super._likePatternContaining(params, value, columnType, columnTypeName, typeAdapter, fold)
        }
        return this._poisonAffixPattern(params, value, columnType, columnTypeName, typeAdapter, fold, (term) => "'%' || " + term + " || '%'")
    }
    // Default-mode affix pattern for an OPTIONAL term: propagate the NULL Oracle's `||` would
    // swallow, so the predicate matches nothing (as it does on every other dialect) instead of
    // the whole table. `glue` places the wildcards around one escaped term. The term is escaped
    // TWICE — once for the null check, once for the pattern — because it must be re-emitted, not
    // a reused placeholder (see the header comment): `case when <term> is null then null else
    // <glue(term)> end`.
    private _poisonAffixPattern(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean, glue: (term: string) => string): string {
        const check = this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false)
        const term = this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false)
        const sql = 'case when ' + check + ' is null then null else ' + glue(term) + ' end'
        return fold ? 'lower(' + sql + ')' : '(' + sql + ')'
    }
    override _replaceAll(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Oracle's `REPLACE` honours the session collation, so on a database configured
        // case-insensitive (`NLS_COMP=LINGUISTIC` + a CI sort) `replaceAll('abc', 'X')` on
        // `'ABCabc'` matches both cases and corrupts the value. Force `replaceCollation` (the
        // binary/code-point collation the `OracleConnection` defaults to) on the match operands
        // and reset the result to `USING_NLS_COMP` so the forced collation does not leak
        // downstream. An empty (or unset) `replaceCollation` opts out to the native `replace`.
        const collation = this._connectionConfiguration.replaceCollation
        if (!collation) {
            return super._replaceAll(params, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
        }
        return 'replace(' + this._appendSqlParenthesis(valueSource, params, false) + ' collate ' + collation + ', ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation + ', ' + this._appendValue(value2, params, columnType, columnTypeName, typeAdapter, false) + ') collate USING_NLS_COMP'
    }
    override _replaceAllInsensitive(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Oracle's `REPLACE` folds case under a case-insensitive collation. Force a CI collation on
        // the match operands: `insensitiveCollation` when it names one (so a shared language
        // collation carries over), otherwise the configurable `replaceInsensitiveCollation` (which
        // the `OracleConnection` defaults to Oracle's neutral `BINARY_CI`, since its default is
        // case-sensitive). Either config set to `''` opts out to the bare native `replace` (trust
        // the session collation). The result is reset with `USING_NLS_COMP`.
        let collation = this._connectionConfiguration.insensitiveCollation
        if (collation === undefined) {
            collation = this._connectionConfiguration.replaceInsensitiveCollation
        }
        if (!collation) {
            return super._replaceAll(params, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
        }
        return 'replace(' + this._appendSqlParenthesis(valueSource, params, false) + ' collate ' + collation + ', ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation + ', ' + this._appendValue(value2, params, columnType, columnTypeName, typeAdapter, false) + ') collate USING_NLS_COMP'
    }
    override _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    override _nextSequenceValue(_params: any[], sequenceName: string) {
        return this._escape(sequenceName, false) + '.nextval'
    }
    override _currentSequenceValue(_params: any[], sequenceName: string): string {
        return this._escape(sequenceName, false) + '.currval'
    }
    override _fromNoTable() {
        return ' from dual'
    }
    override _supportTableAliasWithAs = false
    override _trueValue = '1'
    override _falseValue = '0'
    override _trueValueForCondition = '(1=1)'
    override _falseValueForCondition = '(0=1)'
    // Oracle's LIKE has no default escape character, so the `\`-escaped wildcards
    // produced by `_escapeLikeWildcard` need an explicit `escape '\'` clause.
    override _likeEscape = " escape '\\'"
    _nullValueForCondition = '(0=null)'
    override _appendSql(value: ToSql | AnyValueSource, params: any[], forceTypeCast: boolean): string {
        if (isValueSource(value) && !isColumn(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return 'case when ' + super._appendConditionSql(value, params, forceTypeCast) + ' then 1 else 0 end'
                } else {
                    return 'case when ' + super._appendConditionSql(value, params, forceTypeCast) + ' then 1 when not ' + super._appendConditionSqlParenthesis(value, params, forceTypeCast) + ' then 0 else null end'
                }
            }
        }
        return super._appendSql(value, params, forceTypeCast)
    }
    override _appendConditionSql(value: ToSql | AnyValueSource, params: any[], forceTypeCast: boolean): string {
        if (isValueSource(value) && !isColumn(value) && hasToSql(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (__isBooleanValueSource(valueSourcePrivate) && !valueSourcePrivate.__isBooleanForCondition) {
                // A boolean value used as a condition is a `1`/`0` number; coerce
                // it to a predicate by appending `= 1` exactly once here. Source
                // the VALUE form (`_appendSql`), not the condition form: a const
                // or param boolean already renders its condition form as
                // `(:0 = 1)`, so reusing it would double-wrap to `((:0 = 1) = 1)`.
                // A literal `true`/`false` keeps the canonical `(1=1)`/`(0=1)`.
                const sql = this._appendSql(value, params, forceTypeCast)
                if (!sql) {
                    return sql
                } else if (sql === this._trueValue) {
                    return this._trueValueForCondition
                } else if (sql === this._falseValue) {
                    return this._falseValueForCondition
                } else {
                    return '(' + sql + ' = 1)'
                }
            }
        }
        return super._appendConditionSql(value, params, forceTypeCast)
    }
    override _appendConditionParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isBooleanValueType(columnType)) {
            if (isColumn(value)) {
                const columnPrivate = __getColumnPrivate(value)
                const typeAdapter = columnPrivate.__typeAdapter
                if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                    return '(' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
                }
            }
            return '(' + this._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ' = 1)'
        }
        return this._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnName(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                if (columnPrivate.__optionalType === 'required') {
                    return 'case when ' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ' then 1 else 0 end'
                } else {
                    return 'case ' + this._appendRawColumnName(column, params) + ' when ' + this._appendLiteralValue(typeAdapter.trueValue, params) +  ' then 1 when ' + this._appendLiteralValue(typeAdapter.falseValue, params) + ' then 0 else null end'
                }
            }
        }

        return this._appendRawColumnName(column, params)
    }
    override _appendColumnNameForCondition(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                return '(' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
            } else {
                return '(' + this._appendRawColumnName(column, params) + ' = 1)'
            }
        }

        return this._appendRawColumnName(column, params)
    }
    override _inlineSelectAsValueForCondition(query: SelectData, params: any[]): string {
        if (query.__oneColumn) {
            const columns = query.__columns
            for (const prop in columns) {
                const column = columns[prop]
                if (isValueSource(column) && __isBooleanValueSource(__getValueSourcePrivate(column))) {
                    return '((' + this._buildInlineSelect(query, params) + ') = 1)'
                } else {
                    return this._buildInlineSelect(query, params)
                }
            }
        } 
        return this._buildInlineSelect(query, params)
    }
    override _appendCustomBooleanRemapForColumnIfRequired(column: DBColumn, value: any, params: any[], forceTypeCast: boolean): string | null {
        const columnPrivate = __getColumnPrivate(column)
        const columnTypeAdapter = columnPrivate.__typeAdapter
        const columnTypeName = columnPrivate.__valueTypeName
        const columnType = columnPrivate.__valueType

        if (!__isBooleanValueSource(columnPrivate)) {
            return null // non-boolean
        }

        if (isDefault(value)) {
            return null // the DEFAULT sentinel is a column-level keyword, not a boolean value — let _appendValue emit it via _default(...)
        }

        if (columnTypeAdapter instanceof CustomBooleanTypeAdapter) {
            if (isColumn(value)) {
                const valuePrivate = __getColumnPrivate(value)
                const valueTypeAdapter = valuePrivate.__typeAdapter

                if (valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    if (columnTypeAdapter.trueValue === valueTypeAdapter.trueValue && columnTypeAdapter.falseValue === valueTypeAdapter.falseValue) {
                        return this._appendRawColumnName(value, params) // same boolean as column
                    }

                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendRawColumnName(value, params) + ' when ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._appendLiteralValue(valueTypeAdapter.falseValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                } else {
                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when not ' + this._appendConditionValueParenthesis(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            } else {
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else if (value === true || value === false) {
                    // remapped
                    return 'case ' + this._appendValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                } else {
                    // remapped
                    // Oracle detects wrongly the value type in this case (when value is null), for this reason a cast in injected
                    return 'case cast(' + this._appendValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' as number) when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    override _buildWithValues(withValues: WithValuesData, params: any[]): string {
        // Mark that we're emitting a multi-row VALUES table constructor so
        // `_appendValueForColumn` casts the NULL cells of numeric/date columns
        // (see that override for the ORA-01790 rationale). The flag is scoped to
        // this build and restored afterwards so a nested VALUES — or any later
        // placeholder in the same query — keeps its own context.
        const previousInValuesConstructor = this._isInValuesConstructor(params)
        this._setInValuesConstructor(params, true)
        try {
            return this._buildWithValuesUntracked(withValues, params)
        } finally {
            this._setInValuesConstructor(params, previousInValuesConstructor)
        }
    }
    private _buildWithValuesUntracked(withValues: WithValuesData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion >= 23_004_000) {
            return super._buildWithValues(withValues, params)
        }
        // Oracle < 23ai has no SQL-standard VALUES table constructor;
        // emulate as `select … from dual union all select … from dual`.
        const tableOrView = withValues.__getTableOrView()
        let columns = ''
        for (var columnName in withValues) {
            const column = __getColumnOfObject(tableOrView, columnName)
            if (!column) {
                continue
            }
            if (columns) {
                columns += ', '
            }
            const columnPrivate = __getColumnPrivate(column)
            columns += this._appendColumnAlias(columnPrivate.__name, params)
        }

        const values = withValues.__values
        let valuesSql = ''
        for (let i = 0, length = values.length; i < length; i++) {
            if (valuesSql) {
                valuesSql += ' union all '
            }
            const value = values[i]!
            let valueSql = ''
            for (var columnName in withValues) {
                const column = __getColumnOfObject(tableOrView, columnName)
                if (!column) {
                    continue
                }
                if (valueSql) {
                    valueSql += ', '
                }
                valueSql += this._appendValueForColumn(column, value[columnName], params, false)
            }
            valuesSql += 'select ' + valueSql + ' from dual'
        }

        return withValues.__name + '(' + columns + ') as (' + valuesSql + ')'
    }
    override _appendValueForColumn(column: DBColumn, value: any, params: any[], forceTypeCast: boolean): string {
        // A multi-row VALUES tuple is a union of row constructors, and Oracle
        // requires every column to share one datatype across all rows. The
        // `oracledb` driver binds a JS `null` as a non-numeric/non-date type, so
        // a nullable numeric or date/timestamp column that mixes a value in one
        // row with a `null` in another row is rejected with
        // `ORA-01790: expression must have same datatype as corresponding
        // expression`. Casting the NULL placeholder to the column's Oracle type
        // pins the datatype; the non-null cells stay bare because `oracledb`
        // already infers their type correctly. This is the mirror image of
        // `PostgreSqlSqlBuilder`, which casts the non-null cells and leaves the
        // NULL bare (PostgreSQL infers the NULL's type from the column).
        //
        // TODO: this belongs in an `OracleConnection.transformPlaceholder`
        // override (as `PostgreSqlConnection` does), but `transformPlaceholder`
        // only receives the type *name* and the runtime value — for a
        // custom-typed NULL (e.g. `optionalColumn<Money>('customDouble',
        // 'Money')`) it sees `type = 'Money'` and `value = null`, with no way to
        // tell it's numeric. The `ValueType` category that disambiguates it
        // (`'customDouble'`) only exists here in the SqlBuilder. Move this to the
        // connection once the `TypeAdapter.transformPlaceholder` signature is
        // redefined to carry the `ValueType` category.
        if ((value === null || value === undefined) && this._isInValuesConstructor(params)) {
            const castType = this._oracleNullCastTypeForValuesConstructor(__getColumnPrivate(column).__valueType)
            if (castType) {
                return 'cast(' + super._appendValueForColumn(column, value, params, forceTypeCast) + ' as ' + castType + ')'
            }
        }
        return super._appendValueForColumn(column, value, params, forceTypeCast)
    }
    private _oracleNullCastTypeForValuesConstructor(valueType: ValueType): string | null {
        switch (valueType) {
            case 'int':
            case 'bigint':
            case 'customInt':
            case 'double':
            case 'customDouble':
                return 'number'
            case 'localDate':
            case 'customLocalDate':
                return 'date'
            case 'localDateTime':
            case 'customLocalDateTime':
                return 'timestamp'
            default:
                // `localTime`/`string`/`uuid`/`enum`/`custom`/… are sent as
                // strings (or otherwise varchar-compatible), so a bare NULL bind
                // shares the varchar datatype across rows and never raises
                // ORA-01790. `boolean` is left out on purpose to avoid touching
                // the `CustomBooleanTypeAdapter` remap path in
                // `_appendValueForColumn`.
                return null
        }
    }
    _isInValuesConstructor(params: any[]): boolean {
        return !!(params as any)._isInValuesConstructor
    }
    _setInValuesConstructor(params: any[], value: boolean): void {
        Object.defineProperty(params, '_isInValuesConstructor', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    override _appendWithColumns(withData: WithSelectData, params: any[]): string {
        if (withData.__selectData.__type === 'plain') {
            return ''
        }
        
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(withData.__selectData.__columns, columns, '')

        let result = ''
        for (const property in columns) {
            if (result) {
                result += ', '
            }
            result += this._appendColumnAlias(property, params)
        }

        return '(' + result + ')'
    }
    override _appendWithKeyword(_recursive: boolean): string {
        // Oracle doesn't uses the recursive keyword
        return 'with'
    }
    override _appendColumnAlias(name: string, params: any[]): string {
        if (!this._isWithGeneratedFinished(params)) {
            // Avoid quote identifiers when the with clause is generated
            return this._escape(name, true)
        }
        if (this._isAggregateArrayWrapped(params)) {
            // Avoid quote identifiers when the aggregate array query wrapper is generated
            return this._escape(name, true)
        }
        // Avoid automatically uppercase identifiers by oracle
        return this._forceAsIdentifier(name)
    }
    override _appendParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isUuidValueType(columnType) && this._uuidUsesRawFunctions()) {
            return 'uuid_to_raw(' + super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnValue(value: AnyValueSource, params: any[], isOutermostQuery: boolean): string {
        if (isOutermostQuery && this._uuidUsesRawFunctions()) {
            if (__isUuidValueSource(__getValueSourcePrivate(value))) {
                return 'raw_to_uuid(' + this._appendSql(value, params, false) + ')'
            }
        }
        return this._appendSql(value, params, false)
    }
    override _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        if (this._getUuidStrategy() === 'string') {
            // No conversion required
            return this._appendSql(valueSource, params, false)
        }
        return 'raw_to_uuid(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _appendCompoundOperator(compoundOperator: CompoundOperator, _params: any[]): string {
        switch(compoundOperator) {
            case 'union':
                return ' union '
            case 'unionAll':
                return ' union all '
            case 'intersect':
                return ' intersect '
            case 'intersectAll':
                return ' intersect all '
            case 'except':
                return ' minus '
            case 'exceptAll':
                return ' minus all '
            case 'minus':
                return ' minus '
            case 'minusAll':
                return ' minus all '
            default:
                throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid compound operator', operator: compoundOperator }, 'Invalid compound operator: ' + compoundOperator)
        }
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, params, columnsForInsert, isOutermostQuery)
        if (query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return 'select * from (' + result + ')'
        }
        return result
    }
    override _buildSelectOrderByForWrapper(query: SelectData, params: any[]): string {
        // The wrapper is a plain `select * from (<compound>)`, so order it the
        // plain way (`lower("col")` / `"col" collate <name>`). The override of
        // `_buildSelectOrderBy` below would otherwise switch a compound query
        // to ordinal positions, which can't carry the case-insensitive term.
        return super._buildSelectOrderBy(query, params)
    }
    override _buildSelectOrderBy(query: SelectData, params: any[]): string {
        if (query.__type === 'plain') {
            return super._buildSelectOrderBy(query, params)
        }

        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
            }

            if (!orderByColumns) {
                return ''
            }
            if (query.__orderingSiblingsOnly) {
                // Oracle recursive
                return ' order siblings by ' + orderByColumns
            } else {
                return ' order by ' + orderByColumns
            }
        }

        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')
        const columnNames = Object.getOwnPropertyNames(columns)
        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendCompoundOrderByColumnAlias(entry, columnNames, query, params)
            } else switch (order) {
                case 'asc':
                case 'desc': 
                case 'asc nulls first':
                case 'asc nulls last':
                case 'desc nulls first':
                case 'desc nulls last' :
                    orderByColumns += this._appendCompoundOrderByColumnAlias(entry, columnNames, query, params) + ' ' + order
                    break
                case 'insensitive':
                case 'asc insensitive':
                case 'desc insensitive':
                case 'asc nulls first insensitive':
                case 'asc nulls last insensitive':
                case 'desc nulls first insensitive':
                case 'desc nulls last insensitive': {
                    let sqlOrder = order.substring(0, order.length - 12)
                    if (sqlOrder) {
                        sqlOrder = ' ' + sqlOrder
                    }
                    orderByColumns += this._appendCompoundOrderByColumnAliasInsensitive(entry, columnNames, query, params) + sqlOrder
                    break
                }
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, params), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
        }

        if (!orderByColumns) {
            return ''
        }
        if (query.__orderingSiblingsOnly) {
            // Oracle recursive
            return ' order siblings by ' + orderByColumns
        } else {
            return ' order by ' + orderByColumns
        }
    }
    _appendCompoundOrderByColumnAlias(entry: OrderByEntry, columnNames: string[], query: SelectData, params: any[]): string {
        const expression = entry.expression
        const columns = query.__columns
        if (typeof expression === 'string') {
            const column = getQueryColumn(columns, expression)
            if (!column) {
                throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
            }
            return (columnNames.indexOf(expression) + 1) + ''
        } else if (isValueSource(expression)) {
            const oldSafeTableOrView = this._getSafeTableOrView(params)
            this._setSafeTableOrView(params, undefined)
            const result = this._appendSql(expression, params, false)
            this._setSafeTableOrView(params, oldSafeTableOrView)
            return result
        } else {
            const oldSafeTableOrView = this._getSafeTableOrView(params)
            this._setSafeTableOrView(params, undefined)
            const result = this._appendRawFragment(expression, params)
            this._setSafeTableOrView(params, oldSafeTableOrView)
            return result
        }
    }
    _appendCompoundOrderByColumnAliasInsensitive(entry: OrderByEntry, columnNames: string[], query: SelectData, params: any[]): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (!stringColumn) {
            // Ignore the insensitive term, it do nothing
            return this._appendCompoundOrderByColumnAlias(entry, columnNames, query, params)
        } else if (collation) {
            return this._appendCompoundOrderByColumnAlias(entry, columnNames, query, params) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendCompoundOrderByColumnAlias(entry, columnNames, query, params)
        } else {
            return 'lower(' + this._appendCompoundOrderByColumnAlias(entry, columnNames, query, params) + ')'
        }
    } 
    override _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = super._buildSelectLimitOffset(query, params)

        if (!result && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) && !this._isCurrentRootQuery(query, params)) {
            // Oracle needs a row-limiting clause to honour an ORDER BY in a subquery, and
            // this noop offset supplies one. Without it the ordering is either ignored — in
            // a CTE body or a derived table — or rejected outright: a scalar subquery in the
            // select list carrying a bare ORDER BY is an ORA-00907. Both follow from the
            // same rule, so the gate is the position (any non-root select), the same one
            // SQL Server uses for its identical workaround.
            result += ' offset 0 rows'
        }
        return result
    }
    override _buildInsertMultiple(query: InsertData, params: any[]): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'expecting insert of multiple values' }, 'Exepected a multiple insert')
        }
        if (multiple.length <= 0) {
            return ''
        }

        this._ensureRootQuery(query, params)
        const table = query.__table
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)
        const customization = query.__customization
        this._setSafeTableOrView(params, table)

        let insertQuery = ''
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'begin '

        const shape = query.__shape
        let columnsInShape: { [columnName: string] : boolean} | undefined
        if (shape) {
            columnsInShape = {}
            for (let property in shape) {
                const colunName = shape[property]
                if (typeof colunName === 'string') {
                    columnsInShape[colunName] = true
                }
            }
        }

        for (let i = 0, length = multiple.length; i < length; i++) {
            if (customization && customization.beforeQuery) {
                insertQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
            }
            insertQuery += 'insert '
            if (customization && customization.afterInsertKeyword) {
                insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
            }
            insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
            insertQuery += 'into '
            insertQuery += this._appendTableOrViewName(table, params)

            const sets = multiple[i]!
            let columns = ''
            const sequences: string[] = []
            for (var columnName in table) {
                if (columnsInShape) {
                    if (columnName in columnsInShape) {
                        continue
                    }
                } else {
                    if (columnName in sets) {
                        continue
                    }
                }
                const column = __getColumnOfObject(table, columnName)
                if (!column) {
                    continue
                }
                const columnPrivate = __getColumnPrivate(column)
                if (!columnPrivate.__sequenceName) {
                    continue
                }
    
                if (columns) {
                    columns += ', '
                }
    
                columns += this._appendSql(column, params, false)
                sequences.push(columnPrivate.__sequenceName)
            }
            if (shape) { // Follow shape order
                const properties = Object.getOwnPropertyNames(shape)
                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i]!
                    const columnName = shape[property]!
                    const column = __getColumnOfObject(table, columnName)
                    if (!column) {
                        // Additional property provided in the value object
                        // Skipped because it is not part of the table
                        // This allows to have more complex objects used in the query
                        continue
                    }
                    if (!(property in sets)) {
                        // No value set for that property in the shape
                        continue
                    }

                    if (columns) {
                        columns += ', '
                    }
                    columns += this._appendRawColumnName(column, params)
                }
            } else { // No shape, follow set order
                const properties = Object.getOwnPropertyNames(sets)
                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i]!
                    const column = __getColumnOfObject(table, property)
                    if (!column) {
                        // Additional property provided in the value object
                        // Skipped because it is not part of the table
                        // This allows to have more complex objects used in the query
                        continue
                    }

                    if (columns) {
                        columns += ', '
                    }
                    columns += this._appendRawColumnName(column, params)
                }
            }

            insertQuery += ' (' + columns + ')'
            insertQuery += this._buildInsertOutput(query, params)

            let values = ''
            for (let i = 0, length = sequences.length; i < length; i++) {
                const sequenceName = sequences[i]!
                if (values) {
                    values += ', '
                }

                values += this._nextSequenceValue(params, sequenceName)
            }
            if (shape) { // Follow shape order
                const properties = Object.getOwnPropertyNames(shape)
                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i]!
                    const columnName = shape[property]!
                    const column = __getColumnOfObject(table, columnName)
                    if (!column) {
                        // Additional property provided in the value object
                        // Skipped because it is not part of the table
                        // This allows to have more complex objects used in the query
                        continue
                    }
                    if (!(property in sets)) {
                        // No value set for that property in the shape
                        continue
                    }

                    if (values) {
                        values += ', '
                    }
                    const value = sets[property]
                    values += this._appendValueForColumn(column, value, params, false)
                }
            } else { // No shape, follow set order
                const properties = Object.getOwnPropertyNames(sets)
                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i]!
                    const column = __getColumnOfObject(table, property)
                    if (!column) {
                        // Additional property provided in the value object
                        // Skipped because it is not part of the table
                        // This allows to have more complex objects used in the query
                        continue
                    }

                    if (values) {
                        values += ', '
                    }
                    const value = sets[property]
                    values += this._appendValueForColumn(column, value, params, false)
                }
            }

            insertQuery += ' values (' + values + ')'
            insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
            insertQuery += this._buildInsertReturning(query, params)
            if (customization && customization.afterQuery) {
                insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
            }
            insertQuery += '; '
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)

        insertQuery += 'end;'

        // The multi-row INSERT is emitted as an anonymous PL/SQL block (one
        // INSERT per provided row), and Oracle drivers don't report rowsAffected
        // for PL/SQL blocks. Record the affected-row count for the query runner:
        // the block inserts exactly one row per provided value (Oracle has no
        // INSERT … ON CONFLICT, so no row is skipped). Only consumed on the
        // non-returning execution route (executeMutation); the returning routes
        // derive the count from the rows they return.
        this._setForcedAffectedRowCount(params, multiple.length)

        return insertQuery
    }
    override _buildInsertDefaultValues(query: InsertData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)

        const table = query.__table
        const customization = query.__customization

        this._setSafeTableOrView(params, table)

        let insertQuery = ''

        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

        let columns = ''
        for (var columnName in table) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, params)
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, params)

        let values = ''
        for (var columnName in table) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }

            if (values) {
                values += ', '
            }

            const columnPrivate = __getColumnPrivate(column)
            if (columnPrivate.__sequenceName) {
                values += this._nextSequenceValue(params, columnPrivate.__sequenceName)
            } else {
                values += 'default'
            }
        }
        
        insertQuery += ' values (' + values + ')'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return insertQuery
    }
    override _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    override _buildInsertReturning(query: InsertData, params: any[]): string {
        const idColumn = query.__idColumn
        if (idColumn) {
            this._setContainsInsertReturningClause(params, true)
            return ' returning ' + this._appendSql(idColumn, params, false) + ' into ' + this._queryRunner.addOutParam(params, '') // Empty name for the out params, no special name is requiered
        }

        const result = this._buildQueryReturning(query.__columns, params)
        this._setContainsInsertReturningClause(params, !!result)
        return result
    }
    override _buildQueryReturning(queryColumns: QueryColumns | undefined, params: any[]): string {
        if (!queryColumns) {
            return ''
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(queryColumns, columns, '')

        let requireComma = false
        let result = ''
        for (const property in columns) {
            if (requireComma) {
                result += ', '
            }
            result += this._appendSql(columns[property]!, params, false)
            requireComma = true
        }
        if (result) {
            result +=  ' into '
        }
        requireComma = false
        for (const property in columns) {
            if (requireComma) {
                result += ', '
            }
            result +=  this._queryRunner.addOutParam(params, property)
            requireComma = true
        }
        if (!result) {
            return ''
        }
        return ' returning ' + result
    }
    override _isNull(params: any[], valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            this._appendRawColumnName(valueSource, params) + ' is null'
        }
        if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._falseValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, params, false) + ' then 0 when not ' + this._appendConditionSqlParenthesis(valueSource, params, false) + ' then 0 else 1 end = 1)'
                }
            }
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is null'
    }
    override _isNotNull(params: any[], valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            this._appendRawColumnName(valueSource, params) + ' is not null'
        }
        if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._trueValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, params, false) + ' then 1 when not ' + this._appendConditionSqlParenthesis(valueSource, params, false) + ' then 1 else 0 end = 1)'
                }
            }
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is not null'
    }
    override _is(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'decode(' + this._appendRawColumnName(valueSource, params) + ', ' + this._appendRawColumnName(value, params) + ', 1, 0 ) = 1'
        }
        return 'decode(' + this._appendSqlParenthesis(valueSource, params, false) + ', ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ', 1, 0 ) = 1'
    }
    override _isNot(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'decode(' + this._appendRawColumnName(valueSource, params) + ', ' + this._appendRawColumnName(value, params) + ', 1, 0 ) = 0'
        }
        return 'decode(' + this._appendSqlParenthesis(valueSource, params, false) + ', ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ', 1, 0 ) = 0'
    }
    override _random(_params: any): string {
        return '(select dbms_random.value from dual)'
    }
    override _pi(_params: any): string {
        // Oracle has no `PI()` function; `ACOS(-1)` yields the mathematical
        // constant π via the inverse cosine identity.
        return 'acos(-1)'
    }
    override _currentDate(_params: any): string {
        return 'trunc(current_timestamp)'
    }
    override _currentTime(_params: any): string {
        // Oracle has no `CURRENT_TIME` keyword. `LOCALTIMESTAMP` is the
        // closest portable equivalent that yields a session-local moment
        // the oracledb driver materialises as a JS `Date`.
        return 'localtimestamp'
    }
    override _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'nvl(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _divide(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Unlike the other dialects, Oracle divides in NUMBER, which is exact to 38
        // significant digits — more precision than the double this operation yields.
        // Casting the operands to float here would *lose* precision instead of
        // preserving it, so the bare division is the correct emission on Oracle.
        return this._appendSqlParenthesis(valueSource, params, false) + ' / ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false)
    }
    override _modulo(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Oracle does not accept `a % b`; the `%` token is a syntax error.
        // Use the built-in MOD(a, b) function instead.
        return 'mod(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    override _appendCastAsDouble(sql: string): string {
        return 'cast(' + sql + ' as float)'
    }
    override _appendCastAsInteger(sql: string): string {
        // Oracle has no bigint; NUMBER(38) is its 64 bits (and wider) integer type.
        return 'cast(' + sql + ' as number(38))'
    }
    override _log10(params: any[], valueSource: ToSql): string {
        // Oracle's LOG signature is LOG(base, value), so the base 10 goes first.
        return 'log(10, ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getDate(params: any[], valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSql(valueSource, params, false) + ')'
    }
    // Oracle counts a negative start from the end like JS, but answers '' once the start runs
    // past the beginning of the string, where JS clamps it and returns the whole string.
    // `greatest(start, -length(x))` is that clamp, and it costs one extra reference to the
    // receiver — the only way to express it here: Oracle has no `right()`, its 2-argument
    // `substr` does not clamp (so the tail cannot be taken first and sliced), and
    // `regexp_substr(x, '.{1,n}$')` — which would reference the receiver once — anchors `$`
    // BEFORE a trailing newline, silently truncating any value that ends in one.
    //
    // A start of -1 needs no clamp at all: an Oracle string that is not NULL has at least one
    // character (the empty string IS NULL here), so `greatest(-1, -length(x))` is always -1.
    private _substrNegativeStart(params: any[], valueSource: ToSql, value: number, typeAdapter: TypeAdapter | undefined): string {
        if (value === -1) {
            return this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false)
        }
        return this._appendSql(valueSource, params, false) + ', greatest(' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) + ', -length(' + this._appendSql(valueSource, params, false) + '))'
    }
    override _substrToEnd(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && value < 0) {
            return 'substr(' + this._substrNegativeStart(params, valueSource, value, typeAdapter) + ')'
        }
        return super._substrToEnd(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _substr(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number' && value < 0) {
            return 'substr(' + this._substrNegativeStart(params, valueSource, value, typeAdapter) + ', ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ')'
        }
        return super._substr(params, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
    }
    override _getTime(params: any[], valueSource: ToSql): string {
        // Date subtraction yields a SIGNED fractional day count, which is what makes this
        // correct below the epoch. The previous form added a signed day count to an
        // always-positive time-of-day, so pre-1970 instants came out a day off and, within
        // the last day before the epoch, with the sign flipped. The sub-second term always
        // adds forward in time, which is correct on both sides of the epoch.
        //
        // Dropping `sys_extract_utc` also makes this session-time-zone independent, but that
        // is a SIDE EFFECT of fixing the range, NOT a timezone fix, and it does NOT make
        // `getTime()` timezone-safe: the dominant drift is that `transformValueFromDB` parses
        // a wall clock in the HOST's zone while the SQL side resolves it in the ENGINE's
        // zone. That affects all six dialects equally and cannot be fixed in SQL — see
        // docs/configuration/time-zones.md.
        return "(cast(" + this._appendSql(valueSource, params, false) + " as date) - date '1970-01-01') * 86400000 + to_number(to_char(" + this._appendSql(valueSource, params, false) + ", 'FF3'))"
    }
    override _getFullYear(params: any[], valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params, false) + ') - 1'
    }
    override _getDay(params: any[], valueSource: ToSql): string {
        // https://riptutorial.com/oracle/example/31649/getting-the-day-of-the-week
        return "mod(trunc(" + this._appendSql(valueSource, params, false) + ") - trunc(" + this._appendSql(valueSource, params, false) + ", 'IW') + 1, 7)"
    }
    override _getHours(params: any[], valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMinutes(params: any[], valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getSeconds(params: any[], valueSource: ToSql): string {
        return 'trunc(extract(second from ' + this._appendSql(valueSource, params, false) + '))'
    }
    override _getMilliseconds(params: any[], valueSource: ToSql): string {
        return "to_number(to_char(" + this._appendSql(valueSource, params, false) + ", 'FF3'))"
    }
    override _buildCallProcedure(params: any[], procedureName: string, procedureParams: AnyValueSource[]): string {
        let result = 'begin ' + this._escape(procedureName, false) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0]!, params, false)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i]!, params, false)
            }
        }

        return result + '); end;'
    }
    override _buildCallFunction(params: any[], functionName: string, functionParams: AnyValueSource[]): string {
        let result = 'select ' + this._escape(functionName, false) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0]!, params, false)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i]!, params, false)
            }
        }

        return result + ') from dual'
    }
    override _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(' + this._appendSql(value, params, false) + ", ',') within group (order by " + this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'listagg(' + this._appendSql(value, params, false) + ') within group (order by ' +  this._appendSql(value, params, false) + ')'
        } else {
            return 'listagg(' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ') within group (order by ' +  this._appendSql(value, params, false) + ')'
        }
    }
    override _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(distinct ' + this._appendSql(value, params, false) + ", ',') within group (order by " +  this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'listagg(distinct ' + this._appendSql(value, params, false) + ') within group (order by ' +  this._appendSql(value, params, false) + ')'
        } else {
            return 'listagg(distinct ' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ') within group (order by ' +  this._appendSql(value, params, false) + ')'
        }
    }
    // Oracle LIKE has no `[...]` character classes; wildcards are escaped with
    // the backslash declared by the `escape '\'` clause every affix predicate
    // below emits. The inherited `_escapeLikeWildcard` produces exactly that
    // backslash escaping (`%`->`\%`, `_`->`\_`, `\`->`\\`), so no override.
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._uuidUsesRawFunctions()) {
                return 'json_arrayagg(' + distict + 'raw_to_uuid(' + this._appendSql(aggregatedArrayColumns, params, false) + '))'
            }
            return 'json_arrayagg(' + distict + this._appendSql(aggregatedArrayColumns, params, false) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "' value "
                const column = columns[prop]!
                if (__isUuidValueSource(__getValueSourcePrivate(column)) && this._uuidUsesRawFunctions()) {
                    result += 'raw_to_uuid(' + this._appendSql(column, params, false) + ')'
                } else {
                    result += this._appendSql(column, params, false)
                }
            }

            return 'json_arrayagg(' + distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._uuidUsesRawFunctions()) {
                return 'json_arrayagg(raw_to_uuid(a_' + aggregateId + '_.result))'
            }
            return 'json_arrayagg(a_' + aggregateId + '_.result)'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "' value "
                const column = columns[prop]!
                if (__isUuidValueSource(__getValueSourcePrivate(column)) && this._uuidUsesRawFunctions()) {
                    result += 'raw_to_uuid(a_' + aggregateId + '_.' + this._escape(prop, true) + ')'
                } else {
                    result += 'a_' + aggregateId + '_.' + this._escape(prop, true)
                }
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
}

/*
 * Source: Combine reserved words from:
 * - Oracle 10g: https://docs.oracle.com/cd/B19306_01/em.102/b40103/app_oracle_reserved_words.htm
 * - Oracle 19: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Oracle-SQL-Reserved-Words.html#GUID-55C49D1E-BE08-4C50-A9DD-8593EB925612
 */
const reservedWords: { [word: string]: boolean | undefined } = {
    ACCOUNT: true,
    ACTIVATE: true,
    ADMIN: true,
    ADVISE: true,
    AFTER: true,
    ALL_ROWS: true,
    ALLOCATE: true,
    ANALYZE: true,
    ARCHIVE: true,
    ARCHIVELOG: true,
    ARRAY: true,
    AT: true,
    AUTHENTICATED: true,
    AUTHORIZATION: true,
    AUTOEXTEND: true,
    AUTOMATIC: true,
    BACKUP: true,
    BECOME: true,
    BEFORE: true,
    BEGIN: true,
    BFILE: true,
    BITMAP: true,
    BLOB: true,
    BLOCK: true,
    BODY: true,
    CACHE: true,
    CACHE_INSTANCES: true,
    CANCEL: true,
    CASCADE: true,
    CAST: true,
    CFILE: true,
    CHAINED: true,
    CHANGE: true,
    CHAR_CS: true,
    CHARACTER: true,
    CHECKPOINT: true,
    CHOOSE: true,
    CHUNK: true,
    CLEAR: true,
    CLOB: true,
    CLONE: true,
    CLOSE: true,
    CLOSE_CACHED_OPEN_CURSORS: true,
    COALESCE: true,
    COLUMNS: true,
    COMMIT: true,
    COMMITTED: true,
    COMPATIBILITY: true,
    COMPILE: true,
    COMPLETE: true,
    COMPOSITE_LIMIT: true,
    COMPUTE: true,
    CONNECT_TIME: true,
    CONSTRAINT: true,
    CONSTRAINTS: true,
    CONTENTS: true,
    CONTINUE: true,
    CONTROLFILE: true,
    CONVERT: true,
    COST: true,
    CPU_PER_CALL: true,
    CPU_PER_SESSION: true,
    CURRENT_SCHEMA: true,
    CURREN_USER: true,
    CURSOR: true,
    CYCLE: true,
    DANGLING: true,
    DATABASE: true,
    DATAFILE: true,
    DATAFILES: true,
    DATAOBJNO: true,
    DBA: true,
    DBHIGH: true,
    DBLOW: true,
    DBMAC: true,
    DEALLOCATE: true,
    DEBUG: true,
    DEC: true,
    DECLARE: true,
    DEFERRABLE: true,
    DEFERRED: true,
    DEGREE: true,
    DEREF: true,
    DIRECTORY: true,
    DISABLE: true,
    DISCONNECT: true,
    DISMOUNT: true,
    DISTRIBUTED: true,
    DML: true,
    DOUBLE: true,
    DUMP: true,
    EACH: true,
    ENABLE: true,
    END: true,
    ENFORCE: true,
    ENTRY: true,
    ESCAPE: true,
    EXCEPT: true,
    EXCEPTIONS: true,
    EXCHANGE: true,
    EXCLUDING: true,
    EXECUTE: true,
    EXPIRE: true,
    EXPLAIN: true,
    EXTENT: true,
    EXTENTS: true,
    EXTERNALLY: true,
    FAILED_LOGIN_ATTEMPTS: true,
    FALSE: true,
    FAST: true,
    FIRST_ROWS: true,
    FLAGGER: true,
    FLOB: true,
    FLUSH: true,
    FORCE: true,
    FOREIGN: true,
    FREELIST: true,
    FREELISTS: true,
    FULL: true,
    FUNCTION: true,
    GLOBAL: true,
    GLOBALLY: true,
    GLOBAL_NAME: true,
    GROUPS: true,
    HASH: true,
    HASHKEYS: true,
    HEADER: true,
    HEAP: true,
    IDGENERATORS: true,
    IDLE_TIME: true,
    IF: true,
    INCLUDING: true,
    INDEXED: true,
    INDEXES: true,
    INDICATOR: true,
    IND_PARTITION: true,
    INITIALLY: true,
    INITRANS: true,
    INSTANCE: true,
    INSTANCES: true,
    INSTEAD: true,
    INT: true,
    INTERMEDIATE: true,
    ISOLATION: true,
    ISOLATION_LEVEL: true,
    KEEP: true,
    KEY: true,
    KILL: true,
    LABEL: true,
    LAYER: true,
    LESS: true,
    LIBRARY: true,
    LIMIT: true,
    LINK: true,
    LIST: true,
    LOB: true,
    LOCAL: true,
    LOCKED: true,
    LOG: true,
    LOGFILE: true,
    LOGGING: true,
    LOGICAL_READS_PER_CALL: true,
    LOGICAL_READS_PER_SESSION: true,
    MANAGE: true,
    MASTER: true,
    MAX: true,
    MAXARCHLOGS: true,
    MAXDATAFILES: true,
    MAXINSTANCES: true,
    MAXLOGFILES: true,
    MAXLOGHISTORY: true,
    MAXLOGMEMBERS: true,
    MAXSIZE: true,
    MAXTRANS: true,
    MAXVALUE: true,
    MIN: true,
    MEMBER: true,
    MINIMUM: true,
    MINEXTENTS: true,
    MINVALUE: true,
    MLS_LABEL_FORMAT: true,
    MOUNT: true,
    MOVE: true,
    MTS_DISPATCHERS: true,
    MULTISET: true,
    NATIONAL: true,
    NCHAR: true,
    NCHAR_CS: true,
    NCLOB: true,
    NEEDED: true,
    NESTED: true,
    NETWORK: true,
    NEW: true,
    NEXT: true,
    NOARCHIVELOG: true,
    NOCACHE: true,
    NOCYCLE: true,
    NOFORCE: true,
    NOLOGGING: true,
    NOMAXVALUE: true,
    NOMINVALUE: true,
    NONE: true,
    NOORDER: true,
    NOOVERRIDE: true,
    NOPARALLEL: true,
    NOREVERSE: true,
    NORMAL: true,
    NOSORT: true,
    NOTHING: true,
    NUMERIC: true,
    NVARCHAR2: true,
    OBJECT: true,
    OBJNO: true,
    OBJNO_REUSE: true,
    OFF: true,
    OID: true,
    OIDINDEX: true,
    OLD: true,
    ONLY: true,
    OPCODE: true,
    OPEN: true,
    OPTIMAL: true,
    OPTIMIZER_GOAL: true,
    ORGANIZATION: true,
    OSLABEL: true,
    OVERFLOW: true,
    OWN: true,
    PACKAGE: true,
    PARALLEL: true,
    PARTITION: true,
    PASSWORD: true,
    PASSWORD_GRACE_TIME: true,
    PASSWORD_LIFE_TIME: true,
    PASSWORD_LOCK_TIME: true,
    PASSWORD_REUSE_MAX: true,
    PASSWORD_REUSE_TIME: true,
    PASSWORD_VERIFY_FUNCTION: true,
    PCTINCREASE: true,
    PCTTHRESHOLD: true,
    PCTUSED: true,
    PCTVERSION: true,
    PERCENT: true,
    PERMANENT: true,
    PLAN: true,
    PLSQL_DEBUG: true,
    POST_TRANSACTION: true,
    PRECISION: true,
    PRESERVE: true,
    PRIMARY: true,
    PRIVATE: true,
    PRIVATE_SGA: true,
    PRIVILEGE: true,
    PRIVILEGES: true,
    PROCEDURE: true,
    PROFILE: true,
    PURGE: true,
    QUEUE: true,
    QUOTA: true,
    RANGE: true,
    RBA: true,
    READ: true,
    READUP: true,
    REAL: true,
    REBUILD: true,
    RECOVER: true,
    RECOVERABLE: true,
    RECOVERY: true,
    REF: true,
    REFERENCES: true,
    REFERENCING: true,
    REFRESH: true,
    REPLACE: true,
    RESET: true,
    RESETLOGS: true,
    RESIZE: true,
    RESTRICTED: true,
    RETURN: true,
    RETURNING: true,
    REUSE: true,
    REVERSE: true,
    ROLE: true,
    ROLES: true,
    ROLLBACK: true,
    RULE: true,
    SAMPLE: true,
    SAVEPOINT: true,
    SB4: true,
    SCAN_INSTANCES: true,
    SCHEMA: true,
    SCN: true,
    SCOPE: true,
    SD_ALL: true,
    SD_INHIBIT: true,
    SD_SHOW: true,
    SEGMENT: true,
    SEG_BLOCK: true,
    SEG_FILE: true,
    SEQUENCE: true,
    SERIALIZABLE: true,
    SESSION_CACHED_CURSORS: true,
    SESSIONS_PER_USER: true,
    SHARED: true,
    SHARED_POOL: true,
    SHRINK: true,
    SKIP: true,
    SKIP_UNUSABLE_INDEXES: true,
    SNAPSHOT: true,
    SOME: true,
    SORT: true,
    SPECIFICATION: true,
    SPLIT: true,
    SQL_TRACE: true,
    STANDBY: true,
    STATEMENT_ID: true,
    STATISTICS: true,
    STOP: true,
    STORAGE: true,
    STORE: true,
    STRUCTURE: true,
    SWITCH: true,
    SYS_OP_ENFORCE_NOT_NULL$: true,
    SYS_OP_NTCIMG$: true,
    SYSDBA: true,
    SYSOPER: true,
    SYSTEM: true,
    TABLES: true,
    TABLESPACE: true,
    TABLESPACE_NO: true,
    TABNO: true,
    TEMPORARY: true,
    THAN: true,
    THE: true,
    THREAD: true,
    TIMESTAMP: true,
    TIME: true,
    TOPLEVEL: true,
    TRACE: true,
    TRACING: true,
    TRANSACTION: true,
    TRANSITIONAL: true,
    TRIGGERS: true,
    TRUE: true,
    TRUNCATE: true,
    TX: true,
    TYPE: true,
    UB2: true,
    UBA: true,
    UNARCHIVED: true,
    UNDO: true,
    UNLIMITED: true,
    UNLOCK: true,
    UNRECOVERABLE: true,
    UNTIL: true,
    UNUSABLE: true,
    UNUSED: true,
    UPDATABLE: true,
    USAGE: true,
    USE: true,
    USING: true,
    VALIDATION: true,
    VALUE: true,
    VARYING: true,
    WHEN: true,
    WITHOUT: true,
    WORK: true,
    WRITE: true,
    WRITEDOWN: true,
    WRITEUP: true,
    XID: true,
    YEAR: true,
    ZONE: true,
    ACCESS: true,
    ADD: true,
    ALL: true,
    ALTER: true,
    AND: true,
    ANY: true,
    AS: true,
    ASC: true,
    AUDIT: true,
    BETWEEN: true,
    BY: true,
    CHAR: true,
    CHECK: true,
    CLUSTER: true,
    COLUMN: true,
    COLUMN_VALUE: true,
    COMMENT: true,
    COMPRESS: true,
    CONNECT: true,
    CREATE: true,
    CURRENT: true,
    DATE: true,
    DECIMAL: true,
    DEFAULT: true,
    DELETE: true,
    DESC: true,
    DISTINCT: true,
    DROP: true,
    ELSE: true,
    EXCLUSIVE: true,
    EXISTS: true,
    FILE: true,
    FLOAT: true,
    FOR: true,
    FROM: true,
    GRANT: true,
    GROUP: true,
    HAVING: true,
    IDENTIFIED: true,
    IMMEDIATE: true,
    IN: true,
    INCREMENT: true,
    INDEX: true,
    INITIAL: true,
    INSERT: true,
    INTEGER: true,
    INTERSECT: true,
    INTO: true,
    IS: true,
    LEVEL: true,
    LIKE: true,
    LOCK: true,
    LONG: true,
    MAXEXTENTS: true,
    MINUS: true,
    MLSLABEL: true,
    MODE: true,
    MODIFY: true,
    NESTED_TABLE_ID: true,
    NOAUDIT: true,
    NOCOMPRESS: true,
    NOT: true,
    NOWAIT: true,
    NULL: true,
    NUMBER: true,
    OF: true,
    OFFLINE: true,
    ON: true,
    ONLINE: true,
    OPTION: true,
    OR: true,
    ORDER: true,
    PCTFREE: true,
    PRIOR: true,
    PUBLIC: true,
    RAW: true,
    RENAME: true,
    RESOURCE: true,
    REVOKE: true,
    ROW: true,
    ROWID: true,
    ROWNUM: true,
    ROWS: true,
    SELECT: true,
    SESSION: true,
    SET: true,
    SHARE: true,
    SIZE: true,
    SMALLINT: true,
    START: true,
    SUCCESSFUL: true,
    SYNONYM: true,
    SYSDATE: true,
    TABLE: true,
    THEN: true,
    TO: true,
    TRIGGER: true,
    UID: true,
    UNION: true,
    UNIQUE: true,
    UPDATE: true,
    USER: true,
    VALIDATE: true,
    VALUES: true,
    VARCHAR: true,
    VARCHAR2: true,
    VIEW: true,
    WHENEVER: true,
    WHERE: true,
    WITH: true
}
