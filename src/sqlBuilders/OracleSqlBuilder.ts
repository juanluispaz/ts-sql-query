import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import { oracleOperationsThatNeedParenthesis } from '../utils/oracle/oracleOperationsThatNeedParenthesis.js'
import type { ToSql, InsertData, CompoundOperator, SelectData, QueryColumns, FlatQueryColumns, WithSelectData, WithValuesData, OrderByEntry, SqlOperation } from './SqlBuilder.js'
import { flattenQueryColumns, hasToSql, getQueryColumn, operationOf } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter, OracleDateAsTimestampTypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource, __isUuidValueSource, __isBooleanValueSource, __isBooleanValueType, __isUuidValueType, __isLocalDateTimeValueSource, __isLocalTimeValueSource } from '../expressions/values.js'
import { isDefault } from '../expressions/Default.js'
import { AbstractSqlBuilder, type SelectColumnSql } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { __columnPathsOf } from '../utils/columnPaths.js'
import { isColumn, __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import { SqlOperation1ValueSource, SqlOperation1ValueSourceIfValueOrIgnore } from '../internal/ValueSourceImpl.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __conversionType, __typeCategoryOf } from '../utils/typeCategory.js'
import { isOracleReservedWord } from '../utils/oracle/oracleReservedWords.js'

export class OracleSqlBuilder extends AbstractSqlBuilder {
    oracle: true = true
    override _operationsThatNeedParenthesis = oracleOperationsThatNeedParenthesis

    override _cot(context: SqlBuildContext, valueSource: ToSql): string {
        // Oracle has no COT function (ORA-00904: "COT": invalid identifier).
        // Cotangent is the reciprocal of the tangent; emit 1 / tan(x), which
        // evaluates the argument once (no parameter duplication). Nesting is
        // handled via `_cot` in `oracleOperationsThatNeedParenthesis`.
        return '1 / tan(' + this._appendSql(valueSource, context, false) + ')'
    }

    override _appendGroupBySelectColumn(_entry: AnyValueSource, selectColumn: SelectColumnSql, _context: SqlBuildContext, _isOutermostQuery: boolean): string {
        // Neither the alias (resolved against the columns of the from first) nor the position (it needs
        // group_by_position_enabled) are safe: the same SQL as the select list, with the same placeholders (bound by
        // name, every occurrence takes the same value), is the same expression for Oracle
        return selectColumn.sql
    }
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
    override _appendColumnNameForUpdate(column: DBColumn, context: SqlBuildContext) {
        const columnPrivate = __getColumnPrivate(column)
        if (context.safeTableOrView === undefined) {
            const tableOrView = columnPrivate.__tableOrView
            const tablePrivate = __getTableOrViewPrivate(tableOrView)
            const qualifier = tablePrivate.__as
                ? this._escape(tablePrivate.__as, true)
                : this._escape(this._tableOrViewName(tablePrivate, context), false)
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
    override _concat(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const configuration = this._connectionConfiguration
        // Function opt-in and native opt-out both go through `_concatSql` (super): the
        // function propagates NULL itself, the native `||` is the deliberate opt-out. Neither
        // needs the poison `CASE`.
        if (configuration.concatFunction || configuration.ignoreNullInConcat) {
            return super._concat(context, valueSource, value, columnType, columnTypeName, typeAdapter)
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
        if (this._concatChainIsNull(valueSource, value, false)) {
            // The chain already holds the NULL the `CASE` below exists to propagate, so the
            // concatenation cannot produce anything else: neither the check nor the operands
            // feeding it are worth emitting.
            return this._asNullValue(context, columnType, columnTypeName, typeAdapter)
        }
        const nullCheck = this._appendConcatNullCheck(context, valueSource, value, false)
        if (!nullCheck) {
            return super._concat(context, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return 'case when ' + nullCheck + ' then null else ' + this._concatChainSql(context, valueSource, value, false) + ' end'
    }
    // Whether the chain already holds a NULL operand, which poisons the whole concatenation.
    // Mirrors the descent of the two walks below — a `_concat` operand is descended into, a
    // dropped `.concatIfValue()` operand does not participate — but appends NO param: it only
    // asks what the chain is already carrying.
    private _concatChainIsNull(valueSource: any, value: any, dropValue: boolean): boolean {
        if (this._isConcatChainNode(valueSource)) {
            if (this._concatChainIsNull(valueSource.__valueSource, valueSource.__value, this._concatChainDropsValue(valueSource))) {
                return true
            }
        } else if (this._isNullValue(valueSource)) {
            return true
        }
        if (dropValue) {
            return false
        }
        if (this._isConcatChainNode(value)) {
            return this._concatChainIsNull(value.__valueSource, value.__value, this._concatChainDropsValue(value))
        }
        return this._isNullValue(value)
    }
    // Builds the poison `CASE`'s null check for a concat chain: `<a> is null or <b> is null or …`
    // over the atomic leaves the DATABASE decides the null state of, appending each leaf's params as
    // it goes. A leaf carrying its own value is not checked: `_concat` settled it already. It walks
    // the concat operands directly, mirroring `_concatChainSql`: a `_concat` operand is descended
    // into; any other operand is a leaf, checked when it is optional (a nullable column,
    // a `valueWhenNull`-wrapped concat, …). Building the check straight from the walk avoids
    // collecting the leaves into an intermediate array first. Returns '' when nothing can be NULL
    // — and in that case appends NO param, so the caller can fall back to the bare join with the
    // param array untouched.
    private _appendConcatNullCheck(context: SqlBuildContext, valueSource: any, value: any, dropValue: boolean): string {
        let left: string
        if (this._isConcatChainNode(valueSource)) {
            left = this._appendConcatNullCheck(context, valueSource.__valueSource, valueSource.__value, this._concatChainDropsValue(valueSource))
        } else if (this._canBeNullWhenTheQueryRuns(valueSource)) {
            left = this._isNull(context, valueSource)
        } else {
            left = ''
        }
        if (dropValue) {
            return left
        }
        let right: string
        if (this._isConcatChainNode(value)) {
            right = this._appendConcatNullCheck(context, value.__valueSource, value.__value, this._concatChainDropsValue(value))
        } else if (this._canBeNullWhenTheQueryRuns(value)) {
            right = this._isNull(context, value)
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
    private _concatChainSql(context: SqlBuildContext, valueSource: ToSql, value: any, dropValue: boolean): string {
        let left: string
        if (this._isConcatChainNode(valueSource)) {
            left = this._concatChainSql(context, valueSource.__valueSource, valueSource.__value, this._concatChainDropsValue(valueSource))
        } else {
            left = this._appendSqlParenthesisExcluding(valueSource, context, '_concat', false)
        }
        if (dropValue) {
            return left
        }
        let right: string
        if (this._isConcatChainNode(value)) {
            right = this._concatChainSql(context, value.__valueSource, value.__value, this._concatChainDropsValue(value))
        } else {
            const leftPrivate = __getValueSourcePrivate(valueSource as unknown as AnyValueSource)
            right = this._appendValueParenthesisExcluding(value, context, leftPrivate.__valueType, leftPrivate.__valueTypeName, leftPrivate.__typeAdapter, '_concat', false)
        }
        return this._concatSql(left, right)
    }
    // Whether a node is a link of the `_concat` chain the two walks above descend into, rather than
    // a leaf. Same rule as the MySQL/MariaDB walk, deliberately: a `.concatIfValue()` IS a link even
    // when its value is absent — what it loses then is only its operand, which `_concatChainDropsValue`
    // says. Treating it as a leaf instead would hand it back to the public `_concat` via its own
    // `__toSql`, and a receiver that is itself a concat would come back wearing its own poison `CASE`
    // — a `CASE` this level then emits TWICE, once per branch, doubling the whole subchain per link.
    private _isConcatChainNode(node: unknown): node is SqlOperation1ValueSource | SqlOperation1ValueSourceIfValueOrIgnore {
        if (!(node instanceof SqlOperation1ValueSource) && !(node instanceof SqlOperation1ValueSourceIfValueOrIgnore)) {
            return false
        }
        return node.__operation === '_concat'
    }
    // A `.concatIfValue()` whose value is ABSENT (`null` / `undefined` / `''` under
    // `allowEmptyString:false`) renders as just its receiver, so the chain skips its operand: emitting
    // it would bind a param for the ignored value and feed `undefined` to `_isNull`.
    private _concatChainDropsValue(node: SqlOperation1ValueSource | SqlOperation1ValueSourceIfValueOrIgnore): boolean {
        return node instanceof SqlOperation1ValueSourceIfValueOrIgnore && !this._isValue(node.__value)
    }
    /**
     * Oracle's `||` already reads a NULL operand as the empty string — what `_concat` above has to
     * emulate AWAY — so it is the base form without the `coalesce`, a no-op here anyway since ''
     * IS NULL. `concatFunction` / `ignoreNullInConcat` are not consulted: both choose how `concat`
     * PROPAGATES NULL, which this operation never asks.
     */
    override _appendConcatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false) + ' || ' + this._appendValueParenthesisExcluding(value, context, columnType, columnTypeName, typeAdapter, '_concatIgnoringNull', false)
    }
    override _likePatternStartingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const concatFunction = this._connectionConfiguration.concatFunction
        if (concatFunction) {
            const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
            const sql = concatFunction + '(' + term + ", '%')"
            return fold ? 'lower(' + sql + ')' : sql
        }
        if (this._connectionConfiguration.ignoreNullInConcat || !this._isOptionalValue(value)) {
            return super._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, fold)
        }
        return this._poisonAffixPattern(context, value, columnType, columnTypeName, typeAdapter, fold, (term) => term + " || '%'")
    }
    override _likePatternEndingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const concatFunction = this._connectionConfiguration.concatFunction
        if (concatFunction) {
            const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
            const sql = concatFunction + "('%', " + term + ')'
            return fold ? 'lower(' + sql + ')' : sql
        }
        if (this._connectionConfiguration.ignoreNullInConcat || !this._isOptionalValue(value)) {
            return super._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, fold)
        }
        return this._poisonAffixPattern(context, value, columnType, columnTypeName, typeAdapter, fold, (term) => "'%' || " + term)
    }
    override _likePatternContaining(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const concatFunction = this._connectionConfiguration.concatFunction
        if (concatFunction) {
            // The function is binary, so gluing both wildcards nests: `f(f('%', term), '%')`.
            const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
            const sql = concatFunction + '(' + concatFunction + "('%', " + term + "), '%')"
            return fold ? 'lower(' + sql + ')' : sql
        }
        if (this._connectionConfiguration.ignoreNullInConcat || !this._isOptionalValue(value)) {
            return super._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, fold)
        }
        return this._poisonAffixPattern(context, value, columnType, columnTypeName, typeAdapter, fold, (term) => "'%' || " + term + " || '%'")
    }
    // Default-mode affix pattern for an OPTIONAL term: propagate the NULL Oracle's `||` would
    // swallow, so the predicate matches nothing (as it does on every other dialect) instead of
    // the whole table. `glue` places the wildcards around one escaped term. The term is escaped
    // TWICE — once for the null check, once for the pattern — because it must be re-emitted, not
    // a reused placeholder (see the header comment): `case when <term> is null then null else
    // <glue(term)> end`.
    private _poisonAffixPattern(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean, glue: (term: string) => string): string {
        const check = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        const sql = 'case when ' + check + ' is null then null else ' + glue(term) + ' end'
        return fold ? 'lower(' + sql + ')' : '(' + sql + ')'
    }
    override _replaceAll(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Oracle's `REPLACE` honours the session collation, so on a database configured
        // case-insensitive (`NLS_COMP=LINGUISTIC` + a CI sort) `replaceAll('abc', 'X')` on
        // `'ABCabc'` matches both cases and corrupts the value. Force `replaceCollation` (the
        // binary/code-point collation the `OracleConnection` defaults to) on the match operands
        // and reset the result to `USING_NLS_COMP` so the forced collation does not leak
        // downstream. An empty (or unset) `replaceCollation` opts out to the native `replace`.
        const collation = this._connectionConfiguration.replaceCollation
        if (!collation) {
            return super._replaceAll(context, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
        }
        return 'replace(' + this._appendSqlParenthesis(valueSource, context, false) + ' collate ' + collation + ', ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation + ', ' + this._appendValue(value2, context, columnType, columnTypeName, typeAdapter, false) + ') collate USING_NLS_COMP'
    }
    override _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
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
            return super._replaceAll(context, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
        }
        return 'replace(' + this._appendSqlParenthesis(valueSource, context, false) + ' collate ' + collation + ', ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation + ', ' + this._appendValue(value2, context, columnType, columnTypeName, typeAdapter, false) + ') collate USING_NLS_COMP'
    }
    override _isReservedKeyword(word: string): boolean {
        return isOracleReservedWord(word)
    }
    override _nextSequenceValue(_context: SqlBuildContext, sequenceName: string, _columnType: ValueType) {
        return this._escape(sequenceName, false) + '.nextval'
    }
    override _currentSequenceValue(_context: SqlBuildContext, sequenceName: string, _columnType: ValueType): string {
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
    /**
     * The booleans are stored as Oracle's BOOLEAN (`booleanStorage: 'boolean'`, Oracle 23ai): they are written as in the
     * SQL standard, like the base builder does; otherwise a boolean is a number 1 / 0
     */
    _nativeBoolean(): boolean {
        return this._connectionConfiguration.booleanStorage === 'boolean'
    }
    override _true(context: SqlBuildContext): string {
        return this._nativeBoolean() ? 'true' : super._true(context)
    }
    override _false(context: SqlBuildContext): string {
        return this._nativeBoolean() ? 'false' : super._false(context)
    }
    override _appendSql(value: ToSql | AnyValueSource, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!this._nativeBoolean() && isValueSource(value) && !isColumn(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return 'case when ' + super._appendConditionSql(value, context, forceTypeCast) + ' then 1 else 0 end'
                } else {
                    return 'case when ' + super._appendConditionSql(value, context, forceTypeCast) + ' then 1 when not ' + super._appendConditionSqlParenthesis(value, context, forceTypeCast) + ' then 0 else null end'
                }
            }
        }
        return super._appendSql(value, context, forceTypeCast)
    }
    override _appendSelectColumnReferenceForCondition(column: AnyValueSource, context: SqlBuildContext): string {
        if (this._nativeBoolean()) {
            if (isColumn(column) && !(__getColumnPrivate(column).__typeAdapter instanceof CustomBooleanTypeAdapter)) {
                // A BOOLEAN column of the table is a condition by itself
                return super._appendSelectColumnReferenceForCondition(column, context)
            }
            // A boolean expression of the select (a custom boolean column is one too) is read by Oracle in the having
            // as a condition over the columns it uses, which aren't grouped (ORA-00979): compared with true it is the
            // grouped value
            return '((' + this._appendSelectColumnReference(column, context) + ') = true)'
        }
        // The select list writes a boolean as a value (1 / 0), and the having must refer to that same expression
        // (the grouped one): it is compared with 1 to make it a condition, like _appendConditionSql does with a
        // boolean value. Only a reference to a column gets here: _appendConditionSql handles the other ones
        return '(' + this._appendSelectColumnReference(column, context) + ' = 1)'
    }
    override _appendConditionSql(value: ToSql | AnyValueSource, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!this._nativeBoolean() && isValueSource(value) && !isColumn(value) && hasToSql(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (__isBooleanValueSource(valueSourcePrivate) && !valueSourcePrivate.__isBooleanForCondition) {
                // A boolean value used as a condition is a `1`/`0` number; coerce
                // it to a predicate by appending `= 1` exactly once here. Source
                // the VALUE form (`_appendSql`), not the condition form: a const
                // or param boolean already renders its condition form as
                // `(:0 = 1)`, so reusing it would double-wrap to `((:0 = 1) = 1)`.
                // A literal `true`/`false` keeps the canonical `(1=1)`/`(0=1)`.
                const sql = this._appendSql(value, context, forceTypeCast)
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
        return super._appendConditionSql(value, context, forceTypeCast)
    }
    override _appendConditionParam(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (this._nativeBoolean()) {
            return super._appendConditionParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        }
        if (__isBooleanValueType(columnType)) {
            if (isColumn(value)) {
                const columnPrivate = __getColumnPrivate(value)
                const typeAdapter = columnPrivate.__typeAdapter
                if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                    return '(' + this._appendRawColumnName(value, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ')'
                }
            }
            return '(' + this._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ' = 1)'
        }
        return this._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnName(column: DBColumn, context: SqlBuildContext): string {
        if (this._nativeBoolean()) {
            return super._appendColumnName(column, context)
        }
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                if (columnPrivate.__optionalType === 'required') {
                    return 'case when ' + this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ' then 1 else 0 end'
                } else {
                    return 'case ' + this._appendRawColumnName(column, context) + ' when ' + this._appendLiteralValue(typeAdapter.trueValue, context) +  ' then 1 when ' + this._appendLiteralValue(typeAdapter.falseValue, context) + ' then 0 else null end'
                }
            }
        }

        return this._appendRawColumnName(column, context)
    }
    override _appendColumnNameForCondition(column: DBColumn, context: SqlBuildContext): string {
        if (this._nativeBoolean()) {
            return super._appendColumnNameForCondition(column, context)
        }
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                return '(' + this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ')'
            } else {
                return '(' + this._appendRawColumnName(column, context) + ' = 1)'
            }
        }

        return this._appendRawColumnName(column, context)
    }
    override _inlineSelectAsValueForCondition(query: SelectData, context: SqlBuildContext): string {
        if (this._nativeBoolean()) {
            return super._inlineSelectAsValueForCondition(query, context)
        }
        if (query.__oneColumn) {
            const columns = query.__columns
            for (const prop in columns) {
                const column = columns[prop]
                if (isValueSource(column) && __isBooleanValueSource(__getValueSourcePrivate(column))) {
                    return '((' + this._buildInlineSelect(query, context) + ') = 1)'
                } else {
                    return this._buildInlineSelect(query, context)
                }
            }
        } 
        return this._buildInlineSelect(query, context)
    }
    override _appendCustomBooleanRemapForColumnIfRequired(column: DBColumn, value: any, context: SqlBuildContext, forceTypeCast: boolean): string | null {
        if (this._nativeBoolean()) {
            return super._appendCustomBooleanRemapForColumnIfRequired(column, value, context, forceTypeCast)
        }
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
                        return this._appendRawColumnName(value, context) // same boolean as column
                    }

                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, context) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendRawColumnName(value, context) + ' when ' + this._appendLiteralValue(valueTypeAdapter.trueValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._appendLiteralValue(valueTypeAdapter.falseValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                    }
                } else {
                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when not ' + this._appendConditionValueParenthesis(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                }
            } else {
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else if (value === true || value === false) {
                    // remapped
                    return 'case ' + this._appendValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                } else {
                    // remapped
                    // A null here is bound with the type of a number by the query runner, so Oracle can compare it with 1
                    return 'case ' + this._appendValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                }
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    override _buildWithValues(withValues: WithValuesData, context: SqlBuildContext): string {
        if (this._connectionConfiguration.compatibilityVersion >= 23_004_000) {
            return super._buildWithValues(withValues, context)
        }
        // Oracle < 23ai has no SQL-standard VALUES table constructor;
        // emulate as `select … from dual union all select … from dual`.
        const tableOrView = withValues.__getTableOrView()
        let columns = ''
        for (const columnName of __columnPathsOf(withValues.__getTableOrView())) {
            const column = __getColumnOfObject(tableOrView, columnName)
            if (!column) {
                continue
            }
            if (columns) {
                columns += ', '
            }
            const columnPrivate = __getColumnPrivate(column)
            columns += this._appendColumnAlias(columnPrivate.__name, context)
        }

        const values = withValues.__values
        let valuesSql = ''
        for (let i = 0, length = values.length; i < length; i++) {
            if (valuesSql) {
                valuesSql += ' union all '
            }
            const value = values[i]!
            let valueSql = ''
            for (const columnName of __columnPathsOf(withValues.__getTableOrView())) {
                const column = __getColumnOfObject(tableOrView, columnName)
                if (!column) {
                    continue
                }
                if (valueSql) {
                    valueSql += ', '
                }
                valueSql += this._appendSetValue(columnName, i, column, value[columnName], context)
            }
            valuesSql += 'select ' + valueSql + ' from dual'
        }

        return this._escape(withValues.__name, false) + '(' + columns + ') as (' + valuesSql + ')'
    }
    override _appendWithColumns(withData: WithSelectData, context: SqlBuildContext): string {
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
            result += this._appendColumnAlias(property, context)
        }

        return '(' + result + ')'
    }
    override _appendWithKeyword(_recursive: boolean): string {
        // Oracle doesn't uses the recursive keyword
        return 'with'
    }
    override _appendColumnAlias(name: string, context: SqlBuildContext): string {
        if (this._isQuotedIdentifier(name)) {
            // Already quoted by the user, the way the database quotes one
            return name
        }
        if (!context.withGeneratedFinished) {
            // Avoid quote identifiers when the with clause is generated
            return this._escape(name, true)
        }
        if (context.aggregateArrayWrapped) {
            // Avoid quote identifiers when the aggregate array query wrapper is generated
            return this._escape(name, true)
        }
        // Avoid automatically uppercase identifiers by oracle
        return this._forceAsIdentifier(name)
    }
    override _appendParam(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isUuidValueType(columnType) && this._uuidUsesRawFunctions()) {
            return 'uuid_to_raw(' + super._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return super._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnValue(value: AnyValueSource, context: SqlBuildContext, isOutermostQuery: boolean): string {
        if (isOutermostQuery && this._uuidUsesRawFunctions()) {
            if (__isUuidValueSource(__getValueSourcePrivate(value))) {
                return 'raw_to_uuid(' + this._appendSql(value, context, false) + ')'
            }
        }
        return this._appendSql(value, context, false)
    }
    override _asString(context: SqlBuildContext, valueSource: ToSql): string {
        // Transform an uuid to string
        if (this._getUuidStrategy() === 'string') {
            // No conversion required
            return this._appendSql(valueSource, context, false)
        }
        return 'raw_to_uuid(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _appendCompoundOperator(compoundOperator: CompoundOperator, _context: SqlBuildContext): string {
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
    override _compoundIntersectHasPrecedence(): boolean {
        // Reads a chain of compound operators from left to right
        return false
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean, needsGrouping: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, context, columnsForInsert, isOutermostQuery)
        if (needsGrouping || query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return 'select * from (' + result + ')'
        }
        return result
    }
    override _buildSelectOrderByForWrapper(query: SelectData, context: SqlBuildContext): string {
        // The wrapper is a plain `select * from (<compound>)`, so order it the
        // plain way (`lower("col")` / `"col" collate <name>`). The override of
        // `_buildSelectOrderBy` below would otherwise switch a compound query
        // to ordinal positions, which can't carry the case-insensitive term.
        return super._buildSelectOrderBy(query, context)
    }
    override _buildSelectOrderBy(query: SelectData, context: SqlBuildContext): string {
        if (query.__type === 'plain') {
            return super._buildSelectOrderBy(query, context)
        }

        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
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
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
        }

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendCompoundOrderByColumnAlias(entry, columnNames, query, context)
            } else switch (order) {
                case 'asc':
                case 'desc': 
                case 'asc nulls first':
                case 'asc nulls last':
                case 'desc nulls first':
                case 'desc nulls last' :
                    orderByColumns += this._appendCompoundOrderByColumnAlias(entry, columnNames, query, context) + ' ' + order
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
                    orderByColumns += this._appendCompoundOrderByColumnAliasInsensitive(entry, columnNames, query, context) + sqlOrder
                    break
                }
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, context), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
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
    _appendCompoundOrderByColumnAlias(entry: OrderByEntry, columnNames: string[], query: SelectData, context: SqlBuildContext): string {
        const expression = entry.expression
        const columns = query.__columns
        if (typeof expression === 'string') {
            const column = getQueryColumn(columns, expression)
            if (!column) {
                throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
            }
            if (this._hasCustomizedColumns(query)) {
                // The columns a customization adds come before, and move the position of every column
                return this._appendColumnAlias(expression, context)
            }
            return (columnNames.indexOf(expression) + 1) + ''
        } else if (isValueSource(expression)) {
            const oldSafeTableOrView = context.safeTableOrView
            this._setSafeTableOrView(context, undefined)
            const result = this._appendSql(expression, context, false)
            this._setSafeTableOrView(context, oldSafeTableOrView)
            return result
        } else {
            const oldSafeTableOrView = context.safeTableOrView
            this._setSafeTableOrView(context, undefined)
            const result = this._appendRawFragment(expression, context)
            this._setSafeTableOrView(context, oldSafeTableOrView)
            return result
        }
    }
    _appendCompoundOrderByColumnAliasInsensitive(entry: OrderByEntry, columnNames: string[], query: SelectData, context: SqlBuildContext): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (!stringColumn) {
            // Ignore the insensitive term, it do nothing
            return this._appendCompoundOrderByColumnAlias(entry, columnNames, query, context)
        } else if (collation) {
            return this._appendCompoundOrderByColumnAlias(entry, columnNames, query, context) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendCompoundOrderByColumnAlias(entry, columnNames, query, context)
        } else {
            return 'lower(' + this._appendCompoundOrderByColumnAlias(entry, columnNames, query, context) + ')'
        }
    } 
    override _buildSelectLimitOffset(query: SelectData, context: SqlBuildContext): string {
        let result = super._buildSelectLimitOffset(query, context)

        if (!result && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) && !this._isCurrentRootQuery(query, context)) {
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
    override _buildInsertMultiple(query: InsertData, context: SqlBuildContext): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'expecting insert of multiple values' }, 'Exepected a multiple insert')
        }
        if (multiple.length <= 0) {
            return ''
        }

        this._ensureRootQuery(query, context)
        const table = query.__table
        const oldSafeTableOrView = context.safeTableOrView
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined
        const customization = query.__customization
        this._setSafeTableOrView(context, table)

        let insertQuery = ''
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, context)
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
                insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
            }
            insertQuery += 'insert '
            if (customization && customization.afterInsertKeyword) {
                insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
            }
            insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
            insertQuery += 'into '
            insertQuery += this._appendTableOrViewName(table, context)

            const rowIndex = i
            const sets = multiple[i]!
            let columns = ''
            const sequences: Array<{ name: string, valueType: ValueType }> = []
            for (const columnName of __columnPathsOf(table)) {
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
    
                columns += this._appendSql(column, context, false)
                sequences.push({ name: columnPrivate.__sequenceName, valueType: columnPrivate.__valueType })
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
                    columns += this._appendRawColumnName(column, context)
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
                    columns += this._appendRawColumnName(column, context)
                }
            }

            insertQuery += ' (' + columns + ')'
            insertQuery += this._buildInsertOutput(query, context)

            let values = ''
            for (let i = 0, length = sequences.length; i < length; i++) {
                const sequence = sequences[i]!
                if (values) {
                    values += ', '
                }

                values += this._nextSequenceValue(context, sequence.name, sequence.valueType)
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
                    values += this._appendSetValue(property, rowIndex, column, value, context)
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
                    values += this._appendSetValue(property, rowIndex, column, value, context)
                }
            }

            insertQuery += ' values (' + values + ')'
            insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
            insertQuery += this._buildInsertReturning(query, context)
            if (customization && customization.afterQuery) {
                insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
            }
            insertQuery += '; '
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)

        insertQuery += 'end;'

        // The multi-row INSERT is emitted as an anonymous PL/SQL block (one
        // INSERT per provided row), and Oracle drivers don't report rowsAffected
        // for PL/SQL blocks. Record the affected-row count for the query runner:
        // the block inserts exactly one row per provided value (Oracle has no
        // INSERT … ON CONFLICT, so no row is skipped). Only consumed on the
        // non-returning execution route (executeMutation); the returning routes
        // derive the count from the rows they return.
        this._setForcedAffectedRowCount(context, multiple.length)

        return insertQuery
    }
    override _buildInsertDefaultValues(query: InsertData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const oldSafeTableOrView = context.safeTableOrView
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined

        const table = query.__table
        const customization = query.__customization

        this._setSafeTableOrView(context, table)

        let insertQuery = ''

        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, context)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, context)

        let columns = ''
        for (const columnName of __columnPathsOf(table)) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, context)
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, context)

        let values = ''
        for (const columnName of __columnPathsOf(table)) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }

            if (values) {
                values += ', '
            }

            const columnPrivate = __getColumnPrivate(column)
            if (columnPrivate.__sequenceName) {
                values += this._nextSequenceValue(context, columnPrivate.__sequenceName, columnPrivate.__valueType)
            } else {
                values += 'default'
            }
        }
        
        insertQuery += ' values (' + values + ')'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
        insertQuery += this._buildInsertReturning(query, context)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)
        return insertQuery
    }
    override _buildInsertOutput(_query: InsertData, _context: SqlBuildContext): string {
        return ''
    }
    override _buildInsertReturning(query: InsertData, context: SqlBuildContext): string {
        const idColumn = query.__idColumn
        if (idColumn) {
            this._setContainsInsertReturningClause(context, true)
            const idColumnSql = this._appendSql(idColumn, context, false)
            const idColumnPrivate = __getValueSourcePrivate(idColumn)
            const placeholder = this._queryRunner.addOutParam(context.params, '', idColumnPrivate.__valueTypeName, __typeCategoryOf(idColumnPrivate.__valueType), false) // Empty name for the out params, no special name is requiered
            return ' returning ' + idColumnSql + ' into ' + placeholder
        }

        const result = this._buildQueryReturning(query.__columns, context)
        this._setContainsInsertReturningClause(context, !!result)
        return result
    }
    override _buildQueryReturning(queryColumns: QueryColumns | undefined, context: SqlBuildContext): string {
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
            const column = columns[property]!
            // A localDateTime of a database outside UTC goes as it is: its TIMESTAMP WITH TIME ZONE OUT bind already
            // receives the instant Oracle completes with its session
            const sql = this._appendSql(column, context, false)
            result += this._isZonedReturningColumn(column) && __isLocalDateTimeValueSource(__getValueSourcePrivate(column)) ? sql : this._appendResultColumnProjection(column, sql, context)
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
            const column = columns[property]!
            let placeholder
            if (!this._isZonedReturningColumn(column) && this._isConvertedResultColumn(column, context)) {
                // The value is returned as the SQL its transformProjection writes, which is not of the type of the
                // column: it is received as a text
                placeholder = this._queryRunner.addOutParam(context.params, property, 'string', 'string', false)
            } else {
                const columnPrivate = __getValueSourcePrivate(column)
                placeholder = this._queryRunner.addOutParam(context.params, property, columnPrivate.__valueTypeName, __typeCategoryOf(columnPrivate.__valueType), false)
            }
            result += placeholder
            requireComma = true
        }
        if (!result) {
            return ''
        }
        return ' returning ' + result
    }
    /**
     * A localDateTime or a localTime of a database outside UTC whose only conversion is the one of the connection: it is
     * returned in an OUT bind of its type, a TIMESTAMP WITH TIME ZONE, not as a text
     */
    _isZonedReturningColumn(column: AnyValueSource): boolean {
        if (!this._isDatabaseOutsideUtc() || !isValueSource(column)) {
            return false
        }
        const columnPrivate = __getValueSourcePrivate(column)
        if (columnPrivate.__typeAdapter?.transformProjection) {
            return false
        }
        return __isLocalDateTimeValueSource(columnPrivate) || __isLocalTimeValueSource(columnPrivate)
    }
    override _isNull(context: SqlBuildContext, valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            // The null state lives in the stored column, not in the 0/1 expression a
            // CustomBooleanTypeAdapter column remaps to (which is never null for a
            // required adapter), so the null check must read the raw column name.
            return this._appendRawColumnName(valueSource, context) + ' is null'
        } else if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition && !this._nativeBoolean()) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._falseValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, context, false) + ' then 0 when not ' + this._appendConditionSqlParenthesis(valueSource, context, false) + ' then 0 else 1 end = 1)'
                }
            }
        }
        return super._isNull(context, valueSource)
    }
    override _isNotNull(context: SqlBuildContext, valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            return this._appendRawColumnName(valueSource, context) + ' is not null'
        } else if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition && !this._nativeBoolean()) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._trueValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, context, false) + ' then 1 when not ' + this._appendConditionSqlParenthesis(valueSource, context, false) + ' then 1 else 0 end = 1)'
                }
            }
        }
        return super._isNotNull(context, valueSource)
    }
    /**
     * A localDateTime or a localTime that Oracle holds in a DATE: a column declared with an
     * OracleDateAsTimestampTypeAdapter, or a value made from it that keeps the adapter (max, min, nullIfValue, an
     * inline select). A DATE holds the time, but `extract` reads it as a date without time (ORA-30076) and `to_char`
     * has no fraction of a second for it (ORA-01821): only the getters of the time need it as a timestamp, and
     * valueWhenNull, which turns it into one. Everywhere else it is written as it is, read the same as a TIMESTAMP.
     */
    _isDateReadAsTimestamp(value: unknown): boolean {
        if (!isValueSource(value)) {
            return false
        }
        const valueSourcePrivate = __getValueSourcePrivate(value)
        return valueSourcePrivate.__typeAdapter instanceof OracleDateAsTimestampTypeAdapter
            && (__isLocalDateTimeValueSource(valueSourcePrivate) || __isLocalTimeValueSource(valueSourcePrivate))
    }
    override _is(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'decode(' + this._appendRawColumnName(valueSource, context) + ', ' + this._appendRawColumnName(value, context) + ', 1, 0 ) = 1'
        }
        return 'decode(' + this._appendSqlParenthesis(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ', 1, 0 ) = 1'
    }
    override _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'decode(' + this._appendRawColumnName(valueSource, context) + ', ' + this._appendRawColumnName(value, context) + ', 1, 0 ) = 0'
        }
        return 'decode(' + this._appendSqlParenthesis(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ', 1, 0 ) = 0'
    }
    override _random(_context: SqlBuildContext): string {
        return '(select dbms_random.value from dual)'
    }
    override _pi(_context: SqlBuildContext): string {
        // Oracle has no `PI()` function; `ACOS(-1)` yields the mathematical
        // constant π via the inverse cosine identity.
        return 'acos(-1)'
    }
    override _currentDate(_context: SqlBuildContext): string {
        return 'trunc(current_timestamp)'
    }
    override _currentTime(_context: SqlBuildContext): string {
        // Oracle has no `CURRENT_TIME` keyword. `LOCALTIMESTAMP` is the
        // closest portable equivalent that yields a session-local moment
        // the oracledb driver materialises as a JS `Date`.
        return 'localtimestamp'
    }
    override _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isDateReadAsTimestamp(valueSource) && !this._isDateReadAsTimestamp(value)) {
            // nvl has the type of its first operand: a DATE read as a timestamp with something else makes it a
            // TIMESTAMP, so the result needs nothing more (it doesn't keep the adapter). A first operand of another
            // type already decides it, and two of them stay a DATE that keeps the adapter
            return 'nvl(cast(' + this._appendSql(valueSource, context, false) + ' as timestamp), ' + this._appendValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
        }
        return 'nvl(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _divide(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Unlike the other dialects, Oracle divides in NUMBER, which is exact to 38
        // significant digits — more precision than the double this operation yields.
        // Casting the operands to float here would *lose* precision instead of
        // preserving it, so the bare division is the correct emission on Oracle.
        return this._appendSqlParenthesis(valueSource, context, false) + ' / ' + this._appendValueParenthesis(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    override _modulo(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Oracle does not accept `a % b`; the `%` token is a syntax error.
        // Use the built-in MOD(a, b) function instead.
        return 'mod(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _appendCastAsDouble(sql: string): string {
        return 'cast(' + sql + ' as float)'
    }
    override _appendCastAsInteger(sql: string): string {
        // Oracle has no bigint; NUMBER(38) is its 64 bits (and wider) integer type.
        return 'cast(' + sql + ' as number(38))'
    }
    override _log10(context: SqlBuildContext, valueSource: ToSql): string {
        // Oracle's LOG signature is LOG(base, value), so the base 10 goes first.
        return 'log(10, ' + this._appendSql(valueSource, context, false) + ')'
    }
    override _getDate(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(day from ' + (this._appendZonedUtcTimestamp(context, valueSource) ?? this._appendSql(valueSource, context, false)) + ')'
    }
    override _supportDatabaseOutsideUtc(): boolean {
        return true
    }
    /**
     * With a databaseTimeZone other than UTC, a localDateTime or a localTime for the date functions: a TIMESTAMP with the
     * digits of the UTC of its instant, which the database completes with its session (see oracleZonedValueSql), so they
     * keep giving the parts in UTC. Undefined in UTC, or for a value of another type
     */
    _appendZonedUtcTimestamp(context: SqlBuildContext, valueSource: ToSql): string | undefined {
        if (!this._isDatabaseOutsideUtc() || !isValueSource(valueSource)) {
            return undefined
        }
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const zoned = oracleZonedValueSql(this._appendSql(valueSource, context, false), __conversionType(valueSourcePrivate.__valueTypeName, __typeCategoryOf(valueSourcePrivate.__valueType)), this._connectionConfiguration.localTimeReferenceDate)
        return zoned ? 'sys_extract_utc(' + zoned + ')' : undefined
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
    private _substrNegativeStart(context: SqlBuildContext, valueSource: ToSql, value: number, typeAdapter: TypeAdapter | undefined): string {
        if (value === -1) {
            return this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, 'int', 'int', typeAdapter, false)
        }
        return this._appendSql(valueSource, context, false) + ', greatest(' + this._appendValue(value, context, 'int', 'int', typeAdapter, false) + ', -length(' + this._appendSql(valueSource, context, false) + '))'
    }
    override _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && value < 0) {
            return 'substr(' + this._substrNegativeStart(context, valueSource, value, typeAdapter) + ')'
        }
        return super._substrToEnd(context, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number' && value < 0) {
            return 'substr(' + this._substrNegativeStart(context, valueSource, value, typeAdapter) + ', ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
        }
        return super._substr(context, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
    }
    override _getTime(context: SqlBuildContext, valueSource: ToSql): string {
        const zoned = this._appendZonedUtcTimestamp(context, valueSource)
        if (zoned) {
            return "(trunc(" + zoned + ") - date '1970-01-01') * 86400000 + to_number(to_char(" + zoned + ", 'SSSSSFF3'))"
        }
        if (this._isDateReadAsTimestamp(valueSource)) {
            // A DATE has no fraction of a second: the day count is the whole time. A value made from the column may
            // not be a DATE (nullif with a timestamp gives a TIMESTAMP, and a TIMESTAMP minus a DATE is an interval)
            // The difference of two DATEs is a decimal number of days, inexact for a second (1/86400): rounded to seconds
            const date = isColumn(valueSource) ? this._appendSql(valueSource, context, false) : 'cast(' + this._appendSql(valueSource, context, false) + ' as date)'
            return "round((" + date + " - date '1970-01-01') * 86400) * 1000"
        }
        // Whole days from trunc, the seconds since midnight and the milliseconds from 'SSSSSFF3' (FF3 truncates, like a
        // Date): the time of day is always forward, so it is exact before 1970 too
        const utc = this._appendUtcTimestamp(context, valueSource)
        return "(trunc(" + utc + ") - date '1970-01-01') * 86400000 + to_number(to_char(" + utc + ", 'SSSSSFF3'))"
    }
    override _getFullYear(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(year from ' + (this._appendZonedUtcTimestamp(context, valueSource) ?? this._appendSql(valueSource, context, false)) + ')'
    }
    override _getMonth(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(month from ' + (this._appendZonedUtcTimestamp(context, valueSource) ?? this._appendSql(valueSource, context, false)) + ') - 1'
    }
    override _getDay(context: SqlBuildContext, valueSource: ToSql): string {
        // https://riptutorial.com/oracle/example/31649/getting-the-day-of-the-week
        // trunc of a value with zone gives the day of the zone it was stored with: a localDateTime is taken to the
        // UTC digits of its instant first. A localDate, and a DATE read as a timestamp, have no zone
        const day = this._appendZonedUtcTimestamp(context, valueSource) ?? (isValueSource(valueSource) && __isLocalDateTimeValueSource(__getValueSourcePrivate(valueSource)) && !this._isDateReadAsTimestamp(valueSource)
            ? this._appendUtcTimestamp(context, valueSource)
            : this._appendSql(valueSource, context, false))
        return "mod(trunc(" + day + ") - trunc(" + day + ", 'IW') + 1, 7)"
    }
    /**
     * The value as a TIMESTAMP with the UTC digits of its instant: the epoch without zone plus the interval from it. A
     * DATE or a TIMESTAMP has no zone and none takes part; a value with zone (an offset, a region, or a local time zone)
     * is compared with the epoch in the session zone, the zone of the database (see oracleSessionTimeZone), which gives its instant
     */
    _appendUtcTimestamp(context: SqlBuildContext, valueSource: ToSql): string {
        return "timestamp '1970-01-01 00:00:00' + (" + this._appendSql(valueSource, context, false) + " - timestamp '1970-01-01 00:00:00')"
    }
    override _getHours(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendTimestampForTimeGetter(context, valueSource) + ')'
    }
    override _getMinutes(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendTimestampForTimeGetter(context, valueSource) + ')'
    }
    override _getSeconds(context: SqlBuildContext, valueSource: ToSql): string {
        const zoned = this._appendZonedUtcTimestamp(context, valueSource)
        if (zoned) {
            return 'trunc(extract(second from ' + zoned + '))'
        }
        if (this._isDateReadAsTimestamp(valueSource)) {
            // A DATE has no fraction of a second to truncate
            return 'extract(second from ' + this._appendTimestampForTimeGetter(context, valueSource) + ')'
        }
        return 'trunc(extract(second from ' + this._appendSql(valueSource, context, false) + '))'
    }
    override _getMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        return "to_number(to_char(" + this._appendTimestampForTimeGetter(context, valueSource) + ", 'FF3'))"
    }
    /** The value for `extract` of the time or `to_char` of the fraction: a DATE column read as a timestamp is cast */
    _appendTimestampForTimeGetter(context: SqlBuildContext, valueSource: ToSql): string {
        const zoned = this._appendZonedUtcTimestamp(context, valueSource)
        if (zoned) {
            return zoned
        }
        if (this._isDateReadAsTimestamp(valueSource)) {
            return 'cast(' + this._appendSql(valueSource, context, false) + ' as timestamp)'
        }
        return this._appendSql(valueSource, context, false)
    }
    override _buildCallProcedure(context: SqlBuildContext, procedureName: string, procedureParams: AnyValueSource[]): string {
        let result = 'begin ' + this._escape(procedureName, false, true) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0]!, context, false)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i]!, context, false)
            }
        }

        return result + '); end;'
    }
    override _buildCallFunction(context: SqlBuildContext, functionCall: AnyValueSource): string {
        return super._buildCallFunction(context, functionCall) + ' from dual'
    }
    override _stringConcat(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(' + this._appendSql(value, context, false) + ", ',') within group (order by " + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'listagg(' + this._appendSql(value, context, false) + ') within group (order by ' +  this._appendSql(value, context, false) + ')'
        } else {
            return 'listagg(' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, 'string', 'string', undefined, false) + ') within group (order by ' +  this._appendSql(value, context, false) + ')'
        }
    }
    override _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(distinct ' + this._appendSql(value, context, false) + ", ',') within group (order by " +  this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'listagg(distinct ' + this._appendSql(value, context, false) + ') within group (order by ' +  this._appendSql(value, context, false) + ')'
        } else {
            return 'listagg(distinct ' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, 'string', 'string', undefined, false) + ') within group (order by ' +  this._appendSql(value, context, false) + ')'
        }
    }
    // Oracle LIKE has no `[...]` character classes; wildcards are escaped with
    // the backslash declared by the `escape '\'` clause every affix predicate
    // below emits. The inherited `_escapeLikeWildcard` produces exactly that
    // backslash escaping (`%`->`\%`, `_`->`\_`, `\`->`\\`), so no override.
    override _appendAggregateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._uuidUsesRawFunctions()) {
                return 'json_arrayagg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'raw_to_uuid(' + this._appendSql(aggregatedArrayColumns, context, false) + ')') + ')'
            }
            return 'json_arrayagg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, context, false)) + ')'
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
                    result += this._appendAggregatedArrayValueProjection(column, 'raw_to_uuid(' + this._appendSql(column, context, false) + ')')
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, this._appendSql(column, context, false))
                }
            }

            return 'json_arrayagg(' + distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggregateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _context: SqlBuildContext, aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._uuidUsesRawFunctions()) {
                return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'raw_to_uuid(a_' + aggregateId + '_.result)') + ')'
            }
            return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result') + ')'
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
                    result += this._appendAggregatedArrayValueProjection(column, 'raw_to_uuid(a_' + aggregateId + '_.' + this._escape(prop, true) + ')')
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, 'a_' + aggregateId + '_.' + this._escape(prop, true))
                }
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
}

/**
 * The instant of a localDateTime or a localTime of a database outside UTC, as a timestamp with time zone the database
 * completes with the zone of its session (the zone of the database): `cast(<sql> as timestamp with time zone)`; a
 * localTime on the day of the localTimeReferenceDate, replacing the day it is stored with (Oracle has no type of a
 * time alone): `cast(timestamp '1970-01-01 00:00:00' + (<sql> - trunc(<sql>)) as timestamp with time zone)`, or the
 * current date of the session for `'today'`. A wall clock the zone skips gives ORA-01878. Undefined for any other type.
 */
export function oracleZonedValueSql(sql: string, conversionType: string, localTimeReferenceDate: string | undefined): string | undefined {
    if (conversionType === 'localDateTime') {
        return 'cast(' + sql + ' as timestamp with time zone)'
    }
    if (conversionType === 'localTime') {
        const day = localTimeReferenceDate === 'today' ? 'cast(trunc(localtimestamp) as timestamp)' : "timestamp '" + (localTimeReferenceDate ?? '1970-01-01') + " 00:00:00'"
        return 'cast(' + day + ' + (' + sql + ' - trunc(' + sql + ')) as timestamp with time zone)'
    }
    return undefined
}
