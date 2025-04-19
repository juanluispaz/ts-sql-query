---
search:
  boost: 3
---
# Recursive select

This page explains how to build recursive SQL queries using the fluent API in `ts-sql-query`. It supports both standard recursive CTEs (`WITH RECURSIVE`) and Oracle's proprietary `CONNECT BY` syntax. These queries are useful for traversing hierarchical data structures such as organizational trees or category trees.

## Recursive select looking for parents

```ts
const recursiveParentCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnion((child) => { // Or: recursiveUnionAll
        return connection.selectFrom(tCompany)
        .join(child).on(child.parentId.equals(tCompany.id))
        .select({
            id: tCompany.id,
            name: tCompany.name,
            parentId: tCompany.parentId
        })
    }).executeSelectMany()
```

If the recursive query uses the same `SELECT` and `FROM` clauses as the outer query, you can simplify it by specifying only the `JOIN ON` condition:

```ts
const recursiveParentCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionOn((child) => { // Or: recursiveUnionAllOn
        return child.parentId.equals(tCompany.id)
    }).executeSelectMany()
```

The executed query is:
```sql
with recursive 
    recursive_select_1 as (
        select id as id, name as name, parent_id as parentId 
        from company where id = $1 
        
        union 
        
        select company.id as id, company.name as name, company.parent_id as parentId 
        from company join recursive_select_1 on recursive_select_1.parentId = company.id
    )
select id as id, name as name, parentId as parentId
from recursive_select_1
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const recursiveParentCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
}[]>
```

## Recursive select looking for children

```ts
const recursiveChildrenCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionAll((parent) => { // Or: recursiveUnion
        return connection.selectFrom(tCompany)
        .join(parent).on(parent.id.equals(tCompany.parentId))
        .select({
            id: tCompany.id,
            name: tCompany.name,
            parentId: tCompany.parentId
        })
    }).executeSelectMany()
```

If the recursive query uses the same `SELECT` and `FROM` clauses as the outer query, you can simplify it by specifying only the `JOIN ON` condition:

```ts
const recursiveChildrenCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionAllOn((parent) => { // Or: recursiveUnionOn
        return parent.id.equals(tCompany.parentId)
    }).executeSelectMany()
```

The executed query is:
```sql
with recursive 
    recursive_select_1 as (
        select id as id, name as name, parent_id as parentId 
        from company 
        where id = $1 
        
        union all 
        
        select company.id as id, company.name as name, company.parent_id as parentId 
        from company join recursive_select_1 on recursive_select_1.id = company.parent_id
    ) 
select id as id, name as name, parentId as parentId
from recursive_select_1
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const recursiveChildrenCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
}[]>
```

## Recursive connect by

`Oracle` database supports an alternative syntax (additional to the previously mentioned) that can be more performant in some situations using the `start with` and `connect by` (or `connect by nocycle`) clauses.

```ts
const recursiveChildrenCompany = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    })
    .startWith(tCompany.id.equals(10)) // Optional: restricts the starting node
    .connectBy((prior) => { // You can use connectByNoCycle instead
        return prior(tCompany.id).equals(tCompany.parentId)
    })
    .orderBy('name')
    .orderingSiblingsOnly() // Optional: disables deep ordering
    .executeSelectMany()
```

The executed query is:
```sql
select id as "id", name as "name", parent_id as "parentId" 
from company 
start with id = :0 
connect by prior id = parent_id 
order siblings by "name"
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const recursiveParentCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
}[]>
```
