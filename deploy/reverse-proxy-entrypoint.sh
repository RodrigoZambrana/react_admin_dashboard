#!/bin/sh
set -eu

CERT_DIR="${CERT_DIR:-/etc/nginx/certs}"
CERT_FILE="${CERT_FILE:-${CERT_DIR}/fullchain.pem}"
KEY_FILE="${KEY_FILE:-${CERT_DIR}/privkey.pem}"
SERVER_NAME_VALUE="${SERVER_NAME:-localhost}"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  exit 0
fi

mkdir -p "$CERT_DIR"

SAN_VALUE="DNS:${SERVER_NAME_VALUE}"
case "$SERVER_NAME_VALUE" in
  localhost|127.0.0.1)
    SAN_VALUE="DNS:localhost,IP:127.0.0.1"
    ;;
esac

openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/CN=${SERVER_NAME_VALUE}" \
  -addext "subjectAltName=${SAN_VALUE}" >/dev/null 2>&1
