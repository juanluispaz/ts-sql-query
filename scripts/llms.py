#!/usr/bin/env python3
"""The documentation for AI agents: llms.txt and one llms-*.txt per area, so an agent pays only for the area it needs.

Writing queries comes in one file per database: a query shown for six databases costs a third of what an agent
reads, and it only needs one. Used by the website (scripts/mkdocs-llms.py, which adds them to the site) and by the
package (`python3 scripts/llms.py --package dist`, which writes the pages to docs/ and the files to llms/).

A page that belongs to no area stops the build, and so does a link of docs/AGENTS.md to a page that doesn't exist,
or an area that docs/AGENTS.md or docs/about/ai-agents.md doesn't name.
"""
import glob
import os
import posixpath
import re
import sys

DATABASES = {
    'MariaDB': 'mariadb',
    'MySQL': 'mysql',
    'Oracle': 'oracle',
    'PostgreSQL': 'postgresql',
    'SQLite': 'sqlite',
    'SQL Server': 'sqlserver',
}

# (file, title, what it's for, patterns, one file per database)
AREAS = [
    ('queries', 'Writing queries', 'select, insert, update, delete, transactions, projections, fragments and dynamic queries: start here', [
        'queries/*.md', 'dynamic/building-blocks.md', 'dynamic/three-valued-booleans.md', 'about/limitations.md', 'about/faqs.md',
    ], True),
    ('extreme-dynamic', 'Extreme dynamic queries', 'queries whose columns, filters and order come from the caller, typed from the database or from a business model', [
        'queries/extreme-dynamic-queries.md', 'dynamic/from-*.md', 'dynamic/utilities/*.md', 'advanced/deep-utilities.md', 'advanced/tables-views-as-parameter.md',
    ], True),
    ('types', 'Types of tables and rows', 'the types of a row of a table and the columns extracted from an object', [
        'advanced/utility-types.md', 'advanced/columns-from-object.md',
    ], False),
    ('configuration', 'Mapping and configuration', 'the connection, tables and views, column types, time zones, collations and each database', [
        'configuration/*.md', 'configuration/supported-databases/*.md', 'advanced/custom-booleans-values.md',
    ], False),
    ('query-runners', 'Query runners', 'connecting each driver, wrapping the runner, and what it can read of each query', [
        'configuration/query-runners/**', 'advanced/query-execution-metadata.md',
    ], False),
    ('api', 'API reference', 'every method, to look up', ['api/*.md'], False),
    ('errors', 'Errors', 'the errors the library raises and their reasons', ['api/error-management/*.md'], False),
]

# Linked one by one: a single topic, or not worth reading ahead
PAGES = [
    ('Synchronous query runners', 'advanced/synchronous-query-runners.md', 'running queries without promises'),
    ('ID manipulation', 'advanced/id-manipulation.md', 'encrypting the ids that leave the backend'),
]
OPTIONAL = [
    ('native-mappings', 'api/error-management/native-mappings/*.md', 'how a native error of each database maps to a reason, one page per database'),
    ('Changelog', 'CHANGELOG.md', 'what changed in each version; its breaking changes are the migration guide from v1'),
    ('keywords', 'keywords/*.md', 'the SQL keywords, and what writes each one'),
    ('Philosophy', 'about/philosophy.md', 'why the library is the way it is'),
    ('For AI agents', 'about/ai-agents.md', 'which of these files to use'),
    ('Examples', 'about/examples.md', 'runnable examples'),
    ('Home', 'index.md', 'installation and a first look'),
]

TAB = re.compile(r'^( *)===\+? "(.+)"\s*$')
FRONT_MATTER = re.compile(r'\A---\n.*?\n---\n+', re.S)
DOC_CODE_COMMENT = re.compile(r'^<!-- doc-code-snippet-template:.*?-->\n', re.M)
LINK = re.compile(r'(\]\()(?!https?:|#|mailto:)([^)\s]+?\.md)(#[^)\s]*)?(\))')


def _matches(page, pattern):
    """`*` stays inside a folder and `**` goes through them"""
    regex = re.escape(pattern).replace(r'\*\*', '.+').replace(r'\*', '[^/]+')
    return re.fullmatch(regex, page) is not None


def _clean(text):
    return DOC_CODE_COMMENT.sub('', FRONT_MATTER.sub('', text))


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


def _bundle(title, summary, pages, read, base, database=None):
    parts = [f'# ts-sql-query: {title}' + (f' ({database})' if database else ''), '', f'> {summary}', '']
    for page in pages:
        text = _rebased_links(read(page), page, base)
        if database:
            text = _only_database(text, database)
        parts += ['---', '', f'Source: {base}{page}', '', text.strip(), '']
    return '\n'.join(parts)


def _size(text):
    return f'about {max(1, round(len(text) / 4000))}k tokens'


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
            return _clean(file.read())

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
        # The extreme page is the only one of queries/ that leaves that area
        matches = [area[0] for area in AREAS if any(_matches(page, pattern) for pattern in area[3])]
        if 'extreme-dynamic' in matches:
            matches = ['extreme-dynamic']
        if matches:
            area_of[matches[0]].append(page)

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
                text = _bundle(title, summary, pages_of_area, read, base, database)
                write(llms_dir, name, text)
                index.append(f'- [{database}]({files_prefix}{name}): {_size(text)}')
        else:
            name = f'llms-{area}.txt'
            text = _bundle(title, summary, pages_of_area, read, base)
            write(llms_dir, name, text)
            index.append(f'- [All of it]({files_prefix}{name}): {_size(text)}')
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


def _agents_for_the_package(text):
    """docs/AGENTS.md links its folder and the website; in the package it sits next to docs/ and llms/."""
    text = re.sub(r'\]\(https://ts-sql-query\.readthedocs\.io/(llms[\w.-]*\.txt)\)', r'](llms/\1)', text)
    return re.sub(r'\]\((?!https?:|#|mailto:|llms/)([^)\s]+)\)', r'](docs/\1)', text)


def main():
    if len(sys.argv) != 3 or sys.argv[1] != '--package':
        sys.exit('usage: llms.py --package <dist folder>')
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dist = sys.argv[2]
    with open(os.path.join(root, 'docs', 'AGENTS.md'), encoding='utf-8') as file:
        agents = file.read()
    agents = _agents_for_the_package(agents)
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
