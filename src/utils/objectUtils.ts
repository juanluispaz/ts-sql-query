/*
 * Force TS to show the real structure type
 * https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type/57683652#57683652
 * 
 * Recursive version cannot be used because it will cause expand over clases, like Date
 * There is no way to detect class instances: https://github.com/microsoft/TypeScript/issues/29063
 */

export type Expand<T> = T extends object
    ? T extends infer O
      ? { [K in keyof O]: O[K] }
      : never
    : T

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 * Detect optional keys in a object
 * https://gist.github.com/eddiemoore/7873191f366675e520e802a9fb2531d8
 * 
 * This works with exactOptionalPropertyTypes in tsconfig
 * 
 * Only string keys will be returned, non-string keys are not used in ts-sql-query
 */

type Undefined<T> = { [P in keyof T]: P extends undefined ? T[P] : never }

type FilterFlags<Base, Condition> = {
  [Key in keyof Base]: Base[Key] extends Condition ? Key : never
};

type AllowedNames<Base, Condition> =
  FilterFlags<Base, Condition>[keyof Base]

type SubType<Base, Condition> =
  Pick<Base, AllowedNames<Base, Condition>>

export type OptionalKeys<T> = Exclude<keyof T, NonNullable<keyof SubType<Undefined<T>, never>>> & string
export type RequiredKeys<T> = NonNullable<keyof SubType<Undefined<T>, never>> & string
