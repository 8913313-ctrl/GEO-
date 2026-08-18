#!/usr/bin/env bash
# Bind tongzhuo.ink frontend and admin hostnames to the production containers.
#
# Run on the production server after DNS A records for the selected hostnames
# point to this server. It keeps the existing xcjewel/shop project behind the
# shared edge proxy, moves the GEO containers behind internal ports, and lets
# Caddy route the public hostnames without stopping the shop project.
set -Eeuo pipefail
umask 077

ROOT=/opt/tongzhuo-geo/tongzhuo-geo-platform-demo
DEPLOY_DIR="$ROOT/deploy"
CUTOVER_ENV="$DEPLOY_DIR/cutover.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.production.yml"
PROJECT=tongzhuo-geo-production
ADMIN_TLS_CONTAINER=tongzhuo-geo-production-geo-admin-tls-1
ADMIN_APP_CONTAINER=tongzhuo-geo-production-geo-admin-1
SITE_CONTAINER=tongzhuo-geo-production-geo-site-1
EDGE_CONTAINER=tongzhuo-domain-edge
EDGE_DIR=/opt/tongzhuo-geo/domain-edge
HISTORY_DIR=/opt/tongzhuo-geo/domain-binding-history
SHOP_EDGE_CONTAINER=xcjewel-edge
SHOP_EDGE_PORT=18081
SHOP_EDGE_CONFIG=/opt/xcjewel-edge/nginx.http.conf
SHOP_EDGE_ROOT=/var/www/xcjewel.art
SHOP_EDGE_ACME=/opt/xcjewel-edge/acme
GEO_NETWORK=${PROJECT}_default

SITE_DOMAIN="${SITE_DOMAIN:-tongzhuo.ink}"
WWW_DOMAIN="${WWW_DOMAIN:-www.tongzhuo.ink}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.tongzhuo.ink}"
EXPECTED_IP="${EXPECTED_IP:-124.221.70.55}"
SITE_PORT="${SITE_PORT:-19080}"
ADMIN_PORT="${ADMIN_PORT:-18183}"

fail() { printf '[domain-bind] ERROR: %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

for command_name in awk chmod cp curl docker grep mkdir sed ss; do
  have "$command_name" || fail "Missing required command: $command_name"
done
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is unavailable"
docker image inspect caddy:2.8-alpine >/dev/null 2>&1 || docker pull caddy:2.8-alpine >/dev/null
[[ -f "$CUTOVER_ENV" && -f "$COMPOSE_FILE" ]] || fail "Production Compose deployment is missing"

label() { docker inspect --format "{{ index .Config.Labels \"$2\" }}" "$1"; }
[[ "$(label "$ADMIN_TLS_CONTAINER" com.docker.compose.project)" == "$PROJECT" ]] || fail "Admin TLS container project mismatch"
[[ "$(label "$ADMIN_APP_CONTAINER" com.docker.compose.project)" == "$PROJECT" ]] || fail "Admin app container project mismatch"
[[ "$(label "$SITE_CONTAINER" com.docker.compose.project)" == "$PROJECT" ]] || fail "Site container project mismatch"
docker inspect "$SHOP_EDGE_CONTAINER" >/dev/null 2>&1 || fail "Existing shop edge container is missing"
[[ -f "$SHOP_EDGE_CONFIG" && -d "$SHOP_EDGE_ROOT" && -d "$SHOP_EDGE_ACME" ]] || fail "Existing shop edge files are missing"

resolve_host() {
  local host="$1"
  if have getent; then
    getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u
  fi
}

for host in "$SITE_DOMAIN" "$WWW_DOMAIN" "$ADMIN_DOMAIN"; do
  resolved="$(resolve_host "$host" | tr '\n' ' ')"
  [[ "$resolved" == *"$EXPECTED_IP"* ]] || fail "$host does not resolve to $EXPECTED_IP yet; resolved=[$resolved]"
done

mkdir -p "$HISTORY_DIR" "$EDGE_DIR"
chmod 700 "$HISTORY_DIR" "$EDGE_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CONFIG_BACKUP="$HISTORY_DIR/cutover-before-domain-bind-$STAMP.env"
CADDY_BACKUP="$HISTORY_DIR/Caddyfile-before-domain-bind-$STAMP"
cp -p "$CUTOVER_ENV" "$CONFIG_BACKUP"
[[ -f "$EDGE_DIR/Caddyfile" ]] && cp -p "$EDGE_DIR/Caddyfile" "$CADDY_BACKUP" || true
chmod 600 "$CONFIG_BACKUP" "$CADDY_BACKUP" 2>/dev/null || true

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^$key=" "$CUTOVER_ENV"; then
    sed -i "s#^$key=.*#$key=$value#" "$CUTOVER_ENV"
  else
    printf '%s=%s\n' "$key" "$value" >> "$CUTOVER_ENV"
  fi
}

set_env TZ_PRODUCTION_SITE_BASE_URL "https://$SITE_DOMAIN"
set_env TZ_PRODUCTION_SITE_BIND_ADDRESS 127.0.0.1
set_env TZ_PRODUCTION_SITE_PORT "$SITE_PORT"
set_env TZ_PRODUCTION_ADMIN_BIND_ADDRESS 127.0.0.1
set_env TZ_PRODUCTION_ADMIN_PORT "$ADMIN_PORT"
set_env TZ_PRODUCTION_TRUST_PROXY 1
set_env TZ_PRODUCTION_COOKIE_SECURE 1
chmod 600 "$CUTOVER_ENV"

docker compose --env-file "$CUTOVER_ENV" -f "$COMPOSE_FILE" config >/dev/null
docker compose --env-file "$CUTOVER_ENV" -f "$COMPOSE_FILE" up -d --no-deps --force-recreate geo-admin-tls geo-site

if [[ "$(docker port "$ADMIN_TLS_CONTAINER" 8443/tcp)" != "127.0.0.1:$ADMIN_PORT" ]]; then
  fail "Admin TLS proxy is not bound to 127.0.0.1:$ADMIN_PORT"
fi
if [[ "$(docker port "$SITE_CONTAINER" 19080/tcp)" != "127.0.0.1:$SITE_PORT" ]]; then
  fail "Site proxy is not bound to 127.0.0.1:$SITE_PORT"
fi

if ss -ltnp 2>/dev/null | grep -Eq ':(443)[[:space:]]'; then
  if docker ps --format '{{.Names}}' | grep -qx "$EDGE_CONTAINER"; then
    docker rm -f "$EDGE_CONTAINER" >/dev/null
  fi
fi

SHOP_CONFIG_BACKUP="$HISTORY_DIR/nginx.http.conf-before-domain-bind-$STAMP"
cp -p "$SHOP_EDGE_CONFIG" "$SHOP_CONFIG_BACKUP"
docker rm -f "$SHOP_EDGE_CONTAINER" >/dev/null
docker run -d \
  --name "$SHOP_EDGE_CONTAINER" \
  --restart unless-stopped \
  -p 127.0.0.1:$SHOP_EDGE_PORT:80 \
  -v "$SHOP_EDGE_ROOT:/srv/xcjewel:ro" \
  -v "$SHOP_EDGE_ACME:/var/www/acme" \
  -v "$SHOP_EDGE_CONFIG:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine >/dev/null

if [[ "$(docker port "$SHOP_EDGE_CONTAINER" 80/tcp)" != "127.0.0.1:$SHOP_EDGE_PORT"* ]]; then
  fail "Shop edge was not moved to 127.0.0.1:$SHOP_EDGE_PORT"
fi
if ss -ltnp 2>/dev/null | grep -Eq ':(443)[[:space:]]'; then
  fail "TCP 443 is still occupied after moving the admin TLS proxy to localhost:$ADMIN_PORT"
fi

deadline=$((SECONDS + 180))
until curl -fsS --connect-timeout 3 --max-time 10 "http://127.0.0.1:$SITE_PORT/health/ready" | grep -q '"ok":true'; do
  (( SECONDS < deadline )) || fail "Site did not become ready on localhost:$SITE_PORT"
  sleep 2
done
deadline=$((SECONDS + 180))
until curl -kfsS --connect-timeout 3 --max-time 10 "https://127.0.0.1:$ADMIN_PORT/health/ready" | grep -q '"ok":true'; do
  (( SECONDS < deadline )) || fail "Admin did not become ready on localhost:$ADMIN_PORT"
  sleep 2
done

cat > "$EDGE_DIR/Caddyfile" <<EOF
http://$SITE_DOMAIN http://$WWW_DOMAIN http://$ADMIN_DOMAIN {
  redir https://{host}{uri} permanent
}

:80 {
  reverse_proxy host.docker.internal:$SHOP_EDGE_PORT
}

https://$SITE_DOMAIN {
  encode zstd gzip
  reverse_proxy $SITE_CONTAINER:19080
}

https://$WWW_DOMAIN {
  redir https://$SITE_DOMAIN{uri} permanent
}

https://$ADMIN_DOMAIN {
  encode zstd gzip
  reverse_proxy https://$ADMIN_TLS_CONTAINER:8443 {
    transport http {
      tls_insecure_skip_verify
    }
    header_up Host {host}
    header_up X-Forwarded-Proto https
  }
}
EOF
chmod 600 "$EDGE_DIR/Caddyfile"

docker rm -f "$EDGE_CONTAINER" >/dev/null 2>&1 || true
docker run -d \
  --name "$EDGE_CONTAINER" \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 80:80 \
  -p 443:443 \
  -v "$EDGE_DIR/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v tongzhuo-domain-edge-data:/data \
  -v tongzhuo-domain-edge-config:/config \
  caddy:2.8-alpine >/dev/null
docker network connect "$GEO_NETWORK" "$EDGE_CONTAINER" 2>/dev/null || true

deadline=$((SECONDS + 240))
until curl -fsS --resolve "$SITE_DOMAIN:443:127.0.0.1" --connect-timeout 3 --max-time 12 "https://$SITE_DOMAIN/health/ready" | grep -q '"ok":true'; do
  (( SECONDS < deadline )) || fail "Public site HTTPS did not become ready"
  sleep 3
done
deadline=$((SECONDS + 240))
until curl -fsS --resolve "$ADMIN_DOMAIN:443:127.0.0.1" --connect-timeout 3 --max-time 12 "https://$ADMIN_DOMAIN/health/ready" | grep -q '"ok":true'; do
  (( SECONDS < deadline )) || fail "Public admin HTTPS did not become ready"
  sleep 3
done

printf 'DOMAIN_BINDING_READY=1\n'
printf 'site_url=https://%s/\n' "$SITE_DOMAIN"
printf 'www_redirect=https://%s/ -> https://%s/\n' "$WWW_DOMAIN" "$SITE_DOMAIN"
printf 'admin_url=https://%s/\n' "$ADMIN_DOMAIN"
printf 'config_backup=%s\n' "$CONFIG_BACKUP"
printf 'shop_config_backup=%s\n' "$SHOP_CONFIG_BACKUP"
