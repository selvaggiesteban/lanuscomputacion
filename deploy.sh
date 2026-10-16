#!/bin/bash
# Script de despliegue rápido para Lanús Computación

echo "🚀 Iniciando despliegue de Backend a Cloudflare Workers..."

# Verificar si wrangler está instalado
if ! command -v wrangler &> /dev/null && ! command -v npx &> /dev/null
then
    echo "❌ Error: wrangler o npx no están instalados."
    exit 1
fi

# Ejecutar el despliegue
npx wrangler deploy

if [ $? -eq 0 ]; then
    echo "✅ Despliegue completado con éxito."
else
    echo "❌ Error en el despliegue. Revisá los logs de Wrangler."
    exit 1
fi
