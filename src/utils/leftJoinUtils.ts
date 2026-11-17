import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import { isUsableValue } from '../sqlBuilders/SqlBuilder.js'
import { __asNodeValueSource, isValueSource } from '../typeSystem/valueSourceFactory.js'

export function __setColumnsForLeftJoin(columns: QueryColumns): void {
  for (const prop in columns) {
      const column = columns[prop]!
      if (!isUsableValue(prop, column, columns)) {
          continue
      }
      if (isValueSource(column)) {
          const nodeColumn = __asNodeValueSource(column)
          if (nodeColumn.__optionalType === 'required') {
              nodeColumn.__optionalType = 'originallyRequired'
          }
      } else {
          __setColumnsForLeftJoin(column)
      }
  }
}