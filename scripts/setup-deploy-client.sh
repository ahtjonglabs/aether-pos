#!/usr/bin/env bash
# setup-deploy-client.sh
# Ensures the deploy client package directory exists with proper package.json
# then generates the Prisma client.

DEPLOY_DIR="node_modules/@aether/prisma-deploy"

mkdir -p "$DEPLOY_DIR"

cat > "$DEPLOY_DIR/package.json" << 'EOF'
{
  "name": "@aether/prisma-deploy",
  "version": "1.0.0",
  "private": true,
  "main": "./index.js",
  "types": "./index.d.ts"
}
EOF

npx prisma generate --schema=prisma/schema.deploy.prisma
