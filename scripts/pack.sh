#!/bin/bash

set -euxo pipefail

npm run prepare-dist

cd dist
npm pack

