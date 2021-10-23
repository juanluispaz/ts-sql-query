hljs.unregisterLanguage('sql');
hljs.registerAliases('sql', { languageName: 'pgsql' });
hljs.configure({ languages: ['sql', 'ts', 'tsx'] })
hljs.highlightAll();