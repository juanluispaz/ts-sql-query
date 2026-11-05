"""MkDocs hook: publishes the documentation for AI agents next to the site (see scripts/llms.py)."""
import os
import sys

from mkdocs.exceptions import PluginError

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from llms import generate


def on_post_build(config, **_):
    site_url = config['site_url'] or ''
    if not site_url.endswith('/'):
        site_url += '/'
    try:
        generate(
            os.path.dirname(config['config_file_path']),
            config['site_dir'],
            config['site_dir'],
            site_url,
            site_url,
            'Read only the area of the task, and for writing queries only the file of your database. In a project with the package installed, `node_modules/ts-sql-query/AGENTS.md` and `node_modules/ts-sql-query/llms/` are the same documentation for the installed version: prefer them.',
        )
    except ValueError as error:
        raise PluginError(str(error))
