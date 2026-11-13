#!/bin/sh
# Avvolge app.html (il corpo della pagina) in un index.html autonomo, apribile da qualunque hosting statico.
set -e
cd "$(dirname "$0")"
{
  printf '%s' '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><style>:root{color-scheme:light;box-sizing:border-box;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  cat app.html
  printf '%s\n' '</body></html>'
} > index.html
echo "index.html pronto"
