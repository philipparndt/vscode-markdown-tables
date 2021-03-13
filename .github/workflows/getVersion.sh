#!/bin/bash
cd "$(dirname "$0")"

PACKAGE_VERSION=$(node -p -e "require('../../package.json').version")

echo $PACKAGE_VERSION