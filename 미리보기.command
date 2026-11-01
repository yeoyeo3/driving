#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 18이 필요합니다. README.md를 확인하세요.'
  read -r -p 'Enter를 눌러 닫기'
  exit 1
fi
node preview.cjs
