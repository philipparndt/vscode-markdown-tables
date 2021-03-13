#!/bin/bash
cd "$(dirname "$0")"

version=$(./getVersion.sh)
file="CHANGELOG.md"

awk '/# 1.1.1/{flag=1;next}/#/{flag=0}flag' ../../$file