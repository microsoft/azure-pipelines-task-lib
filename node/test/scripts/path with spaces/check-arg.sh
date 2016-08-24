#!/bin/sh

echo $1

# Exit with code 0 only if there is exactly one argument
if test $# -eq 1; then
  exit 0
else
  exit 1
fi
