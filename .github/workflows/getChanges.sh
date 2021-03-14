#!/bin/bash
cd "$(dirname "$0")"

CHANGES=$(node ./getChanges.js)
echo "$CHANGES"
