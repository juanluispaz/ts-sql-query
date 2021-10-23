# Recursive select

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

If the union query have the same select and from that the external one you can specify only the join on clause:

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

If the union query have the same select and from that the external one you can specify only the join on clause:

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