import { __getValueSourcePrivate, isValueSource } from '../expressions/values'
import { QueryColumns, isUsableValue } from '../sqlBuilders/SqlBuilder'

export function __setColumnsForLeftJoin(columns: QueryColumns): void {
  for (const prop in columns) {
      const column = columns[prop]!
      if (!isUsableValue(prop, column, columns)) {
          continue
      }
      if (isValueSource(column)) {
          const columnPrivate = __getValueSourcePrivate(column)
          if (columnPrivate.__optionalType === 'required') {
              columnPrivate.__optionalType = 'originallyRequired'
          }
      } else {
          __setColumnsForLeftJoin(column)
      }
  }
}