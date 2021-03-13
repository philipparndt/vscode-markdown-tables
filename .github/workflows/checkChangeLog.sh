#!/bin/bash
cd "$(dirname "$0")"

version=$(./getVersion.sh)
file="CHANGELOG.md"

if grep -q $version ../../$file; then
    echo "Changelog looks good"
    exit 0
else
    echo "No entry found for version $version in $file"
    exit 1
fi