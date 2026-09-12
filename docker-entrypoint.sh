#!/bin/sh
set -eu

# Named Docker volumes are initially owned by root. WhatsApp Web must write its
# persistent LocalAuth session, while the application itself remains unprivileged.
mkdir -p /app/.wwebjs_auth
chown -R node:node /app/.wwebjs_auth

exec gosu node "$@"
