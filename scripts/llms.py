#!/usr/bin/env python3
"""The documentation for AI agents: llms.txt and one llms-*.txt per area, so an agent pays only for the area it needs.

The areas with queries come in one file per database: a query shown for six databases costs a third of what an agent
reads, and it usually only needs one. They also come with all the databases, for an agent that compares them or moves
code between them. Used by the website (scripts/mkdocs-llms.py, which adds them to the site) and by the
package (`python3 scripts/llms.py --package dist`, which writes the pages to docs/ and the files to llms/).

A page that belongs to no area stops the build, and so does a page with a code fence or an HTML comment left open,
a link of docs/AGENTS.md to a page that doesn't exist, or an area that docs/AGENTS.md or docs/about/ai-agents.md
doesn't name.
"""
import glob
import os
import posixpath
import re
import sys
import tempfile

DATABASES = {
    'MariaDB': 'mariadb',
    'MySQL': 'mysql',
    'Oracle': 'oracle',
    'PostgreSQL': 'postgresql',
    'SQLite': 'sqlite',
    'SQL Server': 'sqlserver',
}

# (file, title, what it's for, patterns, one file per database).
# A page can be in several areas. Those with one file per database also have one with all of them.
AREAS = [
    ('general', 'General', 'what the library is, its philosophy, how it is tested, frequent questions and limitations', [
        'index.md', 'about/philosophy.md', 'about/testing.md', 'about/faqs.md', 'about/limitations.md',
    ], False),
    ('queries', 'Queries', 'reading data: select, joins, pages, projections and dynamic queries: start here', [
        'queries/basic-query-structure.md', 'queries/select.md', 'queries/select-page.md', 'queries/complex-projections.md',
        'queries/aggregate-as-object-array.md', 'queries/dynamic-queries.md', 'dynamic/building-blocks.md',
    ], True),
    ('queries-advanced', 'Queries combining selects', 'common table expressions (with) and subqueries, compound selects (union, intersect, except) and recursive selects', [
        'queries/cte-subqueries.md', 'queries/compound-select.md', 'queries/recursive-select.md',
    ], True),
    ('aggregates', 'Aggregates', 'aggregate functions, group by and having', [
        'queries/aggregate-and-group-by.md',
    ], True),
    ('mutations', 'Mutations', 'writing data: insert, insert on conflict, update and delete', [
        'queries/insert.md', 'queries/insert-on-conflict.md', 'queries/update.md', 'queries/delete.md',
    ], True),
    ('transactions', 'Transactions', 'transactions, what happens on an error, isolation levels and work deferred to the end of a transaction', [
        'queries/transaction.md',
    ], False),
    ('extending', 'Extending the library', 'going beyond what it offers: your own SQL with fragments, and your own column types', [
        'queries/sql-fragments.md', 'configuration/column-types.md',
    ], True),
    ('dynamic', 'Optional parts of a query', 'the detail of dynamic queries: the order and the page from a request, optional joins, booleans and null, and conditions built with your own ifs', [
        'dynamic/optional-parts/*.md', 'dynamic/going-further/*.md',
    ], True),
    ('extreme-dynamic', 'Extreme dynamic queries', 'queries whose columns, filters and order come from the caller, a table or a query API driven by a request, values the user can not see, and writing values with a shape', [
        'queries/extreme-dynamic-queries.md', 'dynamic/caller-decides/*.md', 'queries/shapes.md',
    ], True),
    ('dynamic-functions', 'Functions that return a dynamic select', 'a function of your own where the caller chooses the columns, the filter and the order, typed from the database or from a business model, and the helper types', [
        'dynamic/own-function/*.md', 'dynamic/helper-types/*.md', 'advanced/deep-utilities.md', 'advanced/tables-views-as-parameter.md',
    ], True),
    ('types', 'Types of tables and rows', 'the types of a row of a table and the columns extracted from an object', [
        'advanced/utility-types.md', 'advanced/columns-from-object.md',
    ], False),
    ('configuration', 'Mapping and configuration', 'the connection, tables and views, column types, time zones, collations and each database', [
        'configuration/*.md', 'configuration/supported-databases/*.md', 'advanced/custom-booleans-values.md',
    ], True),
    ('query-runners', 'Query runners', 'connecting each driver, wrapping the runner, and what it can read of each query', [
        'configuration/query-runners/**', 'advanced/query-execution-metadata.md',
    ], False),
    ('api', 'API reference', 'every method, to look up', ['api/*.md'], False),
    ('errors', 'Errors', 'the errors the library raises and their reasons', ['api/error-management/*.md'], False),
    ('keywords', 'Keywords', 'a quick index: each SQL keyword, and what writes it in the library', ['keywords/*.md'], False),
    ('changelog-v2', 'Change log of v2', 'what changed in each version of v2', ['about/changelog/v2.md'], False),
    ('changelog-v1', 'Change log of v1', 'what changed in each version of v1', ['about/changelog/v1.md'], False),
    ('migrating-from-v1', 'Migrating from v1', 'what to change in an application on ts-sql-query v1', ['about/changelog/migrating-from-v1.md'], False),
]

# What the first line of each file says about the others
ELSEWHERE = {
    'queries': 'select, joins, pages, projections, dynamic queries',
    'queries-advanced': 'with, subqueries, union, recursive',
    'aggregates': 'aggregate functions, group by, having',
    'mutations': 'insert, update, delete',
    'transactions': 'transactions',
    'extending': 'your own SQL and column types',
    'dynamic': 'optional parts of a query in detail: order and page, optional joins, null, conditions built with ifs',
    'extreme-dynamic': 'columns and filters from the caller, a table or an API driven by a request, restricted values, shapes',
    'dynamic-functions': 'functions that return a dynamic select, typing them, helper types',
    'types': 'types of a row',
    'configuration': 'connection, tables',
    'query-runners': 'drivers',
    'api': 'every method',
    'errors': 'errors',
    'keywords': 'what writes a SQL keyword',
}

# Linked one by one: a single topic, or not worth reading ahead
PAGES = [
    ('Synchronous query runners', 'advanced/synchronous-query-runners.md', 'running queries without promises'),
    ('ID manipulation', 'advanced/id-manipulation.md', 'encrypting the ids that leave the backend'),
]
OPTIONAL = [
    ('native-mappings', 'api/error-management/native-mappings/*.md', 'how a native error of each database maps to a reason, one page per database'),
    ('For AI agents', 'about/ai-agents.md', 'which of these files to use'),
]

TAB = re.compile(r'^( *)===\+? "(.+)"\s*$')
FRONT_MATTER = re.compile(r'\A---\n.*?\n---\n+', re.S)
FENCE = re.compile(r'^ *(`{3,}|~{3,})(.*)$')
CODE_SPAN_OR_COMMENT = re.compile(r'(?<!`)(`+)(?!`).+?(?<!`)\1(?!`)|<!--')
WIDTH_SPAN = re.compile(r'<span class="min-width-[^"]*">(.*?)</span>')
LINK = re.compile(r'(\]\()(?!https?:|#|mailto:)([^)\s]+?\.md)(#[^)\s]*)?(\))')


def _matches(page, pattern):
    """`*` stays inside a folder and `**` goes through them"""
    regex = re.escape(pattern).replace(r'\*\*', '.+').replace(r'\*', '[^/]+')
    return re.fullmatch(regex, page) is not None


def _fence_line(line, fence):
    """What a line does to the open fence: (the marker of the fence open after it, whether it is a fence line of its own).

    As in Markdown, a fence is closed by a line with only as many of its character or more, so anything else is code.
    """
    match = FENCE.match(line)
    if not match or (fence is None and match.group(1)[0] == '`' and '`' in match.group(2)):
        return fence, False
    marker, rest = match.groups()
    if fence is None:
        return marker, True
    if marker[0] == fence[0] and len(marker) >= len(fence) and not rest.strip():
        return None, True
    return fence, False


def _prose_line(line, in_comment):
    """A line out of a fence without its comments and width helpers: (the line, whether a comment stays open after it).

    A code span keeps what it shows.
    """
    out = ''
    position = 0
    while True:
        if in_comment:
            end = line.find('-->', position)
            if end < 0:
                return out, True
            position = end + len('-->')
            in_comment = False
        match = CODE_SPAN_OR_COMMENT.search(line, position)
        if not match:
            return out + WIDTH_SPAN.sub(r'\1', line[position:]), False
        out += WIDTH_SPAN.sub(r'\1', line[position:match.start()])
        position = match.end()
        if match.group(0) == '<!--':
            in_comment = True
        else:
            out += match.group(0)


def _clean(text, page):
    """The page without what only the website or its maintainers need: front matter, HTML comments and width helpers.

    What a fence holds is never touched.
    """
    out = []
    fence = None
    in_comment = False
    after_comment = False  # a comment alone on its lines goes, and a blank line next to it goes with it
    for line in FRONT_MATTER.sub('', text).split('\n'):
        if not in_comment:
            was_open = fence is not None
            fence, is_fence = _fence_line(line, fence)
            if was_open or is_fence:
                out.append(line)
                after_comment = False
                continue
        had_comment = in_comment or '<!--' in line
        prose, in_comment = _prose_line(line, in_comment)
        if had_comment and not prose.strip():
            after_comment = True
            continue
        if after_comment and not prose.strip() and (not out or not out[-1].strip()):
            after_comment = False
            continue
        after_comment = False
        out.append(prose)
    if in_comment:
        raise ValueError(f'scripts/llms.py: docs/{page} has an HTML comment that is never closed')
    return '\n'.join(out)


def _check_fences(text, page):
    """A fence left open turns the rest of the page into code and, in a bundle, inverts every page after it."""
    lines = text.split('\n')
    fence = None
    opened = 0
    for number, line in enumerate(lines):
        match = FENCE.match(line)
        if match and match.group(1) == fence and match.group(2).strip():
            break  # a new fence starts where the open one should have ended
        was_open = fence is not None
        fence, is_fence = _fence_line(line, fence)
        if is_fence and not was_open:
            opened = number
    else:
        if fence is None:
            return
    code = next((line.strip() for line in lines[opened + 1:] if line.strip()), '')
    raise ValueError(f'scripts/llms.py: docs/{page} has a code fence that is never closed: the {lines[opened].strip()} before "{code}"')


def _rebased_links(text, page, base):
    def replace(match):
        target = posixpath.normpath(posixpath.join(posixpath.dirname(page), match.group(2)))
        return f'{match.group(1)}{base}{target}{match.group(3) or ""}{match.group(4)}'
    return LINK.sub(replace, text)


def _only_database(text, database):
    """Keeps the tab of one database, as plain text."""
    out = []
    tab_indent = None  # the indentation of the tab being read, kept or skipped
    keeping = False
    for line in text.split('\n'):
        match = TAB.match(line)
        if match and match.group(2) in DATABASES:
            tab_indent = len(match.group(1))
            keeping = match.group(2) == database
            continue
        if tab_indent is not None:
            inside = not line.strip() or len(line) - len(line.lstrip(' ')) >= tab_indent + 4
            if inside:
                if keeping:
                    out.append(line[tab_indent + 4:] if line.strip() else '')
                continue
            tab_indent = None
        out.append(line)
    return '\n'.join(out)


def _of_database(page, slug):
    """A page about one database only goes in the files of that database"""
    match = re.fullmatch(r'configuration/supported-databases/(\w+)\.md', page)
    return not match or match.group(1) == slug


def _others(area, slug):
    """Where the rest is, so what isn't in a file isn't taken for what the library doesn't have"""
    names = []
    for other, _title, _summary, _patterns, per_database in AREAS:
        if other != area and other in ELSEWHERE:
            names.append(f'`llms-{other}{"-" + slug if per_database else ""}.txt` ({ELSEWHERE[other]})')
    return 'If it is not here, it may be in another file: ' + ', '.join(names) + '.'


def _bundle(title, summary, pages, read, base, database=None, others=None):
    parts = [f'# ts-sql-query: {title}' + (f' ({database})' if database else ''), '', f'> {summary}', '']
    if others:
        parts += [others, '']
    for page in pages:
        text = _rebased_links(read(page), page, base)
        if database:
            text = _only_database(text, database)
        _check_fences(text, page)
        parts += ['---', '', f'Source: {base}{page}', '', text.strip(), '']
    return '\n'.join(parts)


def _size(text, base):
    """Without the base of the links, which is longer on the website: the figure is the same in the package and there"""
    return f'about {max(1, round(len(text.replace(base, "") if base else text) / 4000))}k tokens'


def _menu_order(root):
    """The pages in the order of the site's menu: it starts with the basics"""
    with open(os.path.join(root, 'mkdocs.yml'), encoding='utf-8') as file:
        nav = file.read().split('\nnav:\n', 1)[1]
    return re.findall(r'^\s*- (?:[^\n]*?: )?"?([\w./-]+\.md)"?\s*$', nav, re.M)


def generate(root, llms_dir, pages_dir, base, files_prefix, intro):
    """Writes the files to llms_dir and a clean copy of each page to pages_dir.

    base is what goes before a page in a link, and files_prefix before a llms-*.txt.
    """
    docs_dir = os.path.join(root, 'docs')
    excluded = {'README.md', 'AGENTS.md'}
    pages = sorted(
        os.path.relpath(path, docs_dir).replace(os.sep, '/')
        for path in glob.glob(os.path.join(docs_dir, '**', '*.md'), recursive=True)
        if not os.path.relpath(path, docs_dir).startswith('overrides')
    )
    pages = [page for page in pages if page not in excluded]

    def read(page):
        with open(os.path.join(docs_dir, page), encoding='utf-8') as file:
            text = _clean(file.read(), page)
        _check_fences(text, page)
        return text

    def write(folder, name, text):
        path = os.path.join(folder, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(text)

    for page in pages:
        write(pages_dir, page, read(page))

    menu = _menu_order(root)
    ordered = [page for page in menu if page in pages] + [page for page in pages if page not in menu]

    area_of = {area[0]: [] for area in AREAS}
    for page in ordered:
        for area in AREAS:
            if any(_matches(page, pattern) for pattern in area[3]):
                area_of[area[0]].append(page)

    listed = {page for area in area_of.values() for page in area}
    listed |= {page for _, page, _ in PAGES}
    for _, pattern, _ in OPTIONAL:
        listed |= {page for page in pages if _matches(page, pattern)}
    missing = [page for page in pages if page not in listed]
    if missing:
        raise ValueError(f'scripts/llms.py: pages in no area of llms.txt: {missing}')

    with open(os.path.join(docs_dir, 'AGENTS.md'), encoding='utf-8') as file:
        agents = file.read()
    relative = [link for link in re.findall(r'\]\(([^)#\s]+)', agents) if not link.startswith('http')]
    broken = [link for link in relative if not os.path.exists(os.path.join(docs_dir, link))]
    if broken:
        raise ValueError(f'docs/AGENTS.md links to pages that do not exist: {broken}')

    guide = read('about/ai-agents.md')
    unnamed = [area[0] for area in AREAS if f'llms-{area[0]}' not in guide]
    if unnamed:
        raise ValueError(f'docs/about/ai-agents.md does not name the areas: {unnamed}')
    unnamed = [area[0] for area in AREAS if f'llms-{area[0]}' not in agents]
    if unnamed:
        raise ValueError(f'docs/AGENTS.md does not name the areas: {unnamed}')

    index = [
        '# ts-sql-query',
        '',
        '> Type-safe SQL query builder for TypeScript (not an ORM), for MariaDB, MySQL, Oracle, PostgreSQL, SQLite and SQL Server, on Node.js and Bun.',
        '',
        intro,
        '',
    ]
    for area, title, summary, _patterns, per_database in AREAS:
        pages_of_area = area_of[area]
        index += [f'## {title}', '', f'{summary[0].upper()}{summary[1:]}.', '']
        if per_database:
            for database, slug in DATABASES.items():
                name = f'llms-{area}-{slug}.txt'
                pages_of_database = [page for page in pages_of_area if _of_database(page, slug)]
                text = _bundle(title, summary, pages_of_database, read, base, database, _others(area, slug))
                write(llms_dir, name, text)
                index.append(f'- [{database}]({files_prefix}{name}): {_size(text, base)}')
            name = f'llms-{area}-all.txt'
            text = _bundle(title, summary, pages_of_area, read, base, others=_others(area, 'all'))
            write(llms_dir, name, text)
            index.append(f'- [All the databases, to compare them or move code between them]({files_prefix}{name}): {_size(text, base)}')
        else:
            name = f'llms-{area}.txt'
            text = _bundle(title, summary, pages_of_area, read, base, others=_others(area, '<database>'))
            write(llms_dir, name, text)
            index.append(f'- [All of it]({files_prefix}{name}): {_size(text, base)}')
            if area == 'query-runners':
                # Usually one page is what's needed
                index += ['', 'Or only the page of your driver:', '']
                for page in pages_of_area:
                    index.append(f'- [{posixpath.basename(page)[:-3]}]({base}{page})')
        index.append('')
    index += ['## One topic', '']
    for title, page, summary in PAGES:
        index.append(f'- [{title}]({base}{page}): {summary}')
    index += ['', '## Optional', '']
    for title, pattern, summary in OPTIONAL:
        for page in [page for page in pages if _matches(page, pattern)]:
            name = title if '*' not in pattern else f'{title}: {posixpath.basename(page)[:-3]}'
            index.append(f'- [{name}]({base}{page}): {summary}')
    write(llms_dir, 'llms.txt', '\n'.join(index) + '\n')
    _check_agents_figures(agents, '\n'.join(index))


AGENTS_ROW = re.compile(r'(llms-[\w-]+?)\.txt\)[^|\n]*\| (\d+)k \|$', re.M)


def _figures(index):
    return {name: int(size) for name, size in re.findall(r'(llms-[\w-]+)\.txt\): about (\d+)k tokens', index)}


def _check_agents_figures(agents, index):
    """The figures of docs/AGENTS.md are read by the agents to choose: a small change is fine, a wrong figure isn't"""
    figures = _figures(index)
    stale = [
        f'{name}: {written}k, and it is {figures[name]}k'
        for name, written in ((match.group(1), int(match.group(2))) for match in AGENTS_ROW.finditer(agents))
        if name in figures and abs(figures[name] - written) > max(1, figures[name] * 0.1)
    ]
    if stale:
        raise ValueError(f'docs/AGENTS.md has wrong sizes, run python3 scripts/llms.py --update-agents: {stale}')


def _update_agents(root):
    """Writes in docs/AGENTS.md the sizes of the files it names"""
    with tempfile.TemporaryDirectory() as folder:
        with open(os.path.join(root, 'docs', 'AGENTS.md'), encoding='utf-8') as file:
            agents = file.read()
        generate_without_check = _check_agents_figures
        globals()['_check_agents_figures'] = lambda *_: None
        try:
            generate(root, folder, folder, '', '', '')
        finally:
            globals()['_check_agents_figures'] = generate_without_check
        with open(os.path.join(folder, 'llms.txt'), encoding='utf-8') as file:
            figures = _figures(file.read())
    updated = AGENTS_ROW.sub(lambda match: match.group(0).replace(f'| {match.group(2)}k |', f'| {figures[match.group(1)]}k |'), agents)
    with open(os.path.join(root, 'docs', 'AGENTS.md'), 'w', encoding='utf-8') as file:
        file.write(updated)


def _agents_for_the_package(text):
    """docs/AGENTS.md links its folder and the website; in the package it sits next to docs/ and llms/."""
    text = re.sub(r'\]\(https://ts-sql-query\.readthedocs\.io/(?:en/latest/)?(llms[\w.-]*\.txt)\)', r'](llms/\1)', text)
    return re.sub(r'\]\((?!https?:|#|mailto:|llms/)([^)\s]+)\)', r'](docs/\1)', text)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if sys.argv[1:] == ['--update-agents']:
        _update_agents(root)
        return
    if len(sys.argv) != 3 or sys.argv[1] != '--package':
        sys.exit('usage: llms.py --package <dist folder> | --update-agents')
    dist = sys.argv[2]
    with open(os.path.join(root, 'docs', 'AGENTS.md'), encoding='utf-8') as file:
        agents = _agents_for_the_package(_clean(file.read(), 'AGENTS.md'))
    with open(os.path.join(dist, 'AGENTS.md'), 'w', encoding='utf-8') as file:
        file.write(agents)
    generate(
        root,
        os.path.join(dist, 'llms'),
        os.path.join(dist, 'docs'),
        '../docs/',
        '',
        'Read only the area of the task, and for writing queries only the file of your database. This is the documentation of the installed version.',
    )
    links = re.findall(r'\]\(([^)#\s]+)', agents)
    broken = [link for link in links if link.startswith('http') or not os.path.exists(os.path.join(dist, link))]
    if broken:
        sys.exit(f'AGENTS.md of the package has links out of it, or broken: {broken}')


if __name__ == '__main__':
    main()
