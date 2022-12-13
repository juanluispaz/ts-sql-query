#!/bin/bash

set -euxo pipefail

rm -rf dist/*
tsc --version

# Perform type checking and generate commonjs modules
tsc -p ./tsconfig.cjs.json

babel src --config-file ./babel.esm.config.js \
    --out-dir dist/esm \
    --out-file-extension ".mjs" \
    --extensions ".ts" \
    --ignore "**/*.d.ts"

npm run generate-pkg-manifest

cp LICENSE.md README.md dist 

npm run copy-prisma