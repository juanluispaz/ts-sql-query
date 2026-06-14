/*
 * Injects a small version indicator/switcher into the header, right before the
 * light/dark palette toggle. It shows that the reader is on the v2 (alpha) docs
 * and links to the stable v1 documentation.
 *
 * Done in JS on purpose: mkdocs-material offers no declarative hook to place a
 * custom control next to the palette toggle, and overriding partials/header.html
 * would fork an auto-generated template that drifts on every Material upgrade.
 */
(function () {
    var V1_URL = 'https://ts-sql-query.readthedocs.io/en/v1';

    function insertVersionSwitcher() {
        // Guard against duplicates (e.g. instant navigation re-runs).
        if (document.querySelector('.ts-version-switcher')) {
            return;
        }

        var header = document.querySelector('.md-header__inner');
        if (!header) {
            return;
        }

        var link = document.createElement('a');
        link.className = 'ts-version-switcher';
        link.href = V1_URL;
        link.title =
            'You are viewing the v2 (alpha) documentation. ' +
            'Click to switch to the stable v1 documentation.';
        link.innerHTML =
            '<span class="ts-version-switcher__current">v2 alpha</span>' +
            '<span class="ts-version-switcher__switch">Switch to v1</span>';

        var palette = header.querySelector('[data-md-component="palette"]');
        if (palette) {
            header.insertBefore(link, palette);
        } else {
            header.appendChild(link);
        }
    }

    // `document$` is mkdocs-material's document observable: it emits on the
    // initial load and after every instant-navigation swap. Fall back to a
    // plain DOMContentLoaded listener if it is not available.
    if (typeof document$ !== 'undefined' && document$ && document$.subscribe) {
        document$.subscribe(insertVersionSwitcher);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insertVersionSwitcher);
    } else {
        insertVersionSwitcher();
    }
})();
