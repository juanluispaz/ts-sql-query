import type { QueryColumns } from '../sqlBuilders/SqlBuilder.js'
import { isUsableValue } from '../sqlBuilders/SqlBuilder.js'
import { __asNodeValueSource, __inCreation, isValueSource } from '../typeSystem/valueSourceFactory.js'

export function __setColumnsForLeftJoin(columns: QueryColumns): void {
  for (const prop in columns) {
      const column = columns[prop]!
      if (!isUsableValue(prop, column, columns)) {
          continue
      }
      if (isValueSource(column)) {
          const nodeColumn = __asNodeValueSource(column)
          if (nodeColumn.__optionalType === 'required') {
              // The columns of a copy of the table being created
              __inCreation(nodeColumn).__optionalType = 'originallyRequired'
          }
      } else {
          __setColumnsForLeftJoin(column)
      }
  }
}