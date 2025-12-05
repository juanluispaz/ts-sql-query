import { __getValueSourcePrivate, isValueSource } from '../expressions/values.js'
import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import { isUsableValue } from '../sqlBuilders/SqlBuilder.js'

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