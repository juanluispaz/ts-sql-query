hljs.unregisterLanguage('sql');
hljs.registerAliases('sql', { languageName: 'pgsql' });
hljs.configure({ languages: ['sql', 'ts', 'tsx'] })
hljs.highlightAll();

(function initGoogleSearch() {
    // https://programmablesearchengine.google.com/controlpanel/all
    var searchScript = document.createElement('script');
    searchScript.type = 'text/javascript';
    searchScript.async = true;
    searchScript.src = 'https://cse.google.com/cse.js?cx=665f7e896abe147a5';

    var searchBox = document.createElement('div');
    searchBox.className = 'gcse-search';

    var placeholder = document.createElement('div');
    placeholder.className = 'google-search-placeholder';
    placeholder.appendChild(searchScript);
    placeholder.appendChild(searchBox);

    var search = document.querySelector('.wy-menu.wy-menu-vertical');
    if (search) {
        search.parentElement.insertBefore(placeholder, search);
    }

    var searchInResult = document.querySelector('#mkdocs-search-query');
    if (searchInResult) {
        var openGoogleSearch = document.createElement('a');
        openGoogleSearch.innerText = '>>> Open search using Google';
        openGoogleSearch.href = '#'
        openGoogleSearch.addEventListener('click', function (event) {
            event.preventDefault();
            var input = placeholder.querySelector('input');
            console.log('aa', searchInResult.value, input)
            if (input) {
                input.value = searchInResult.value
            }
            var button = placeholder.querySelector('button');
            if (button) {
                button.click();
            }
        });

        searchInResult.parentElement.appendChild(openGoogleSearch);
    }
})();

document.addEventListener("DOMContentLoaded", function () {
  var banner = document.createElement("div");
  banner.style.cssText = "background-color: #fffae6; padding: 10px; text-align: center; border-bottom: 1px solid #ddd; font-weight: bold;";
  banner.innerHTML = '🚀 The upcoming version 2 of ts-sql-query is cooking! A completely new documentation portal is already available for preview: <a href="https://ts-sql-query.readthedocs.io/en/latest/" target="_blank" rel="noopener">Take a look</a>.';
  document.body.insertBefore(banner, document.body.firstChild);
});