#!/usr/bin/env bash
# =============================================================================
# deploy.sh -- Shajarname Deployment (Ubuntu, Caddy + PM2 + MongoDB, no Docker)
# Monorepo: shajarname-back + shajarname-front (+ optional shajarname-bot)
#
# Run:   sudo ./deploy.sh [options]
# Help:  sudo ./deploy.sh --help
#
# Config is saved under /root/.shajarname-deploy.conf so --update does not
# re-ask for the GitHub repo URL (or token) every time.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}>> $*${NC}"; }

# =============================================================================
# Defaults
# =============================================================================
DEPLOY_DIR="/opt/shajarname"
REPO_URL="https://github.com/alimortazavi-pr/shajarname.git"
BRANCH="main"

BACK_PORT=7781
FRONT_PORT=7782
MONGO_DB="khandan_najaf"

# Override with --front-url= / --back-url= (or edit after first save in deploy conf)
BACK_DOMAIN="api.shajarname.example.com"
FRONT_DOMAIN="shajarname.example.com"

NODE_VERSION="22"
MONGO_MAJOR="8.0"
MONGO_KERNEL_SAFE_VERSION="8.0.4"

# pnpm package names (≠ folder names)
PKG_BACK="khandan-najaf-back"
PKG_FRONT="shajarnameh"
PKG_BOT="khandan-najaf-bot"

GH_TOKEN=""
MONGO_USER=""
MONGO_PASS=""
BOT_TOKEN=""

CADDY_SSL_DIR="/etc/caddy/ssl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEPLOY_CONF="/root/.shajarname-deploy.conf"
GH_TOKEN_FILE="/root/.shajarname-gh-token"
MONGO_CREDS_FILE="/root/.shajarname-mongo-creds"
BOT_TOKEN_FILE="/root/.shajarname-bot-token"

SHOW_HELP=false
SKIP_DEPS=false
SKIP_PULL=false
SKIP_CADDY=false
SKIP_MONGO=false
SKIP_BUILD=false
ENV_ONLY=false
FORCE_ENV=false
UPDATE_MODE=false
SEED_DATA=false
AUTO_HTTPS=false
BACK_ONLY=false
FRONT_ONLY=false
WITH_BOT=false
SKIP_BOT=true
REPO_URL_FROM_CLI=false

for arg in "$@"; do
  case $arg in
    -h|--help)       SHOW_HELP=true ;;
    --skip-deps)     SKIP_DEPS=true ;;
    --skip-pull)     SKIP_PULL=true ;;
    --skip-caddy)    SKIP_CADDY=true ;;
    --skip-mongo)    SKIP_MONGO=true ;;
    --skip-build)    SKIP_BUILD=true ;;
    --env-only)      ENV_ONLY=true ;;
    --force-env)     FORCE_ENV=true ;;
    --update)        UPDATE_MODE=true; SKIP_DEPS=true ;;
    --seed)          SEED_DATA=true ;;
    --auto-https)    AUTO_HTTPS=true ;;
    --back-only)     BACK_ONLY=true ;;
    --front-only)    FRONT_ONLY=true ;;
    --with-bot)      WITH_BOT=true; SKIP_BOT=false ;;
    --skip-bot)      SKIP_BOT=true; WITH_BOT=false ;;
    --back-url=*)    BACK_DOMAIN="${arg#--back-url=}" ;;
    --front-url=*)   FRONT_DOMAIN="${arg#--front-url=}" ;;
    --repo=*)        REPO_URL="${arg#--repo=}"; REPO_URL_FROM_CLI=true ;;
    --branch=*)      BRANCH="${arg#--branch=}" ;;
    --deploy-dir=*)  DEPLOY_DIR="${arg#--deploy-dir=}" ;;
    *) warn "Unknown flag ignored: ${arg}" ;;
  esac
done

DO_BACK=true
DO_FRONT=true
DO_BOT=false
if $BACK_ONLY  && ! $FRONT_ONLY; then DO_FRONT=false; fi
if $FRONT_ONLY && ! $BACK_ONLY;  then DO_BACK=false;  fi
if $WITH_BOT && ! $SKIP_BOT; then DO_BOT=true; fi

BACK_DIR="${DEPLOY_DIR}/shajarname-back"
FRONT_DIR="${DEPLOY_DIR}/shajarname-front"
BOT_DIR="${DEPLOY_DIR}/shajarname-bot"

show_help() {
  cat <<HELP

  Shajarname Deploy Script
  ------------------------
  Usage: sudo ./deploy.sh [options]

  Domains (defaults — change them):
    Frontend : https://${FRONT_DOMAIN}
    Backend  : https://${BACK_DOMAIN}

  Saved config (so --update does not re-ask):
    ${DEPLOY_CONF}
    ${GH_TOKEN_FILE}   (optional PAT)

  Quick recipes:
    # First install (manual SSL in ssl/):
    sudo ./deploy.sh --front-url=YOUR.DOMAIN --back-url=api.YOUR.DOMAIN

    # Let's Encrypt (needs PUBLIC DNS A/AAAA for both domains):
    sudo ./deploy.sh --auto-https --front-url=YOUR.DOMAIN --back-url=api.YOUR.DOMAIN

    # Private LAN / existing certs in ssl/ — do NOT use --auto-https:
    sudo ./deploy.sh --skip-pull

    # Code already on server (rsync / scp):
    sudo ./deploy.sh --skip-pull

    # Routine update (uses saved repo URL + token):
    sudo ./deploy.sh --update

    # Also deploy Telegram bot:
    sudo ./deploy.sh --with-bot

    # Recreate env files:
    sudo ./deploy.sh --skip-deps --skip-pull --skip-caddy --force-env --env-only

  Flags:
    --repo=<url>          Monorepo git URL (saved after first use)
    --branch=<name>       Git branch (default: main)
    --deploy-dir=<path>   Install path (default: /opt/shajarname)
    --back-url=<domain>   API domain
    --front-url=<domain>  Front domain
    --auto-https          Let's Encrypt ACME (public DNS required; ignored if ssl/*.pem exist)
    --force-env           Overwrite existing .env files
    --update              Pull + build + restart (implies --skip-deps)
    --seed                Note: demo data auto-seeds on first Nest boot (no CLI seed)
    --with-bot            Build + start Telegram bot (prompts for BOT_TOKEN)
    --skip-bot            Do not deploy bot (default)
    --skip-deps|--skip-pull|--skip-caddy|--skip-mongo|--skip-build
    --back-only|--front-only|--env-only

  SSL (manual mode):
    Place certs next to this script:
      ssl/fullchain.pem
      ssl/privkey.pem
    Cert must cover BOTH ${FRONT_DOMAIN} and ${BACK_DOMAIN}.

  Notes:
    - Backend env file is .env.production (NODE_ENV=production)
    - Frontend bakes NEXT_PUBLIC_API_URL + NEXT_PUBLIC_WS_URL at build time
    - Uploads live under shajarname-back/public/ (preserved across updates)
    - Filter names: ${PKG_BACK} / ${PKG_FRONT} / ${PKG_BOT}

HELP
  exit 0
}

$SHOW_HELP && show_help
[[ $EUID -ne 0 ]] && error "Run with sudo: sudo ./deploy.sh"

# =============================================================================
# Persist deploy settings (repo URL etc.) so updates do not re-prompt
# =============================================================================
strip_git_token() {
  local url=$1
  echo "$url" | sed -E 's#https://[^@/]+@#https://#'
}

urlencode_mongo_pass() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

is_placeholder_repo() {
  [[ -z "${REPO_URL:-}" || "$REPO_URL" == *"YOUR_ORG"* ]]
}

is_placeholder_domain() {
  [[ "$FRONT_DOMAIN" == *"example.com"* || "$BACK_DOMAIN" == *"example.com"* ]]
}

save_deploy_conf() {
  mkdir -p "$(dirname "$DEPLOY_CONF")"
  cat > "$DEPLOY_CONF" <<EOF
# Shajarname -- deploy settings (auto-saved by deploy.sh)
# Re-run with --repo=... to change the saved URL.
REPO_URL=$(strip_git_token "$REPO_URL")
BRANCH=${BRANCH}
DEPLOY_DIR=${DEPLOY_DIR}
BACK_DOMAIN=${BACK_DOMAIN}
FRONT_DOMAIN=${FRONT_DOMAIN}
BACK_PORT=${BACK_PORT}
FRONT_PORT=${FRONT_PORT}
MONGO_DB=${MONGO_DB}
AUTO_HTTPS=${AUTO_HTTPS}
WITH_BOT=${WITH_BOT}
EOF
  chmod 600 "$DEPLOY_CONF"
  success "Deploy config saved -> ${DEPLOY_CONF}"
}

load_deploy_conf() {
  [[ -f "$DEPLOY_CONF" ]] || return 0
  # shellcheck disable=SC1090
  source "$DEPLOY_CONF"
  info "Loaded deploy config from ${DEPLOY_CONF}"
}

load_repo_from_git() {
  local remote=""
  if [[ -d "${DEPLOY_DIR}/.git" ]]; then
    remote=$(git -C "$DEPLOY_DIR" remote get-url origin 2>/dev/null || true)
  elif [[ -d "${SCRIPT_DIR}/.git" ]]; then
    remote=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null || true)
  fi
  [[ -n "$remote" ]] || return 0
  REPO_URL=$(strip_git_token "$remote")
  info "Repo URL from git remote -> ${REPO_URL}"
}

save_github_token() {
  [[ -n "$GH_TOKEN" ]] || return 0
  printf '%s' "$GH_TOKEN" > "$GH_TOKEN_FILE"
  chmod 600 "$GH_TOKEN_FILE"
  success "GitHub token saved -> ${GH_TOKEN_FILE}"
}

load_github_token() {
  [[ -z "$GH_TOKEN" && -f "$GH_TOKEN_FILE" ]] || return 0
  GH_TOKEN=$(tr -d '\r\n' < "$GH_TOKEN_FILE")
  [[ -n "$GH_TOKEN" ]] && info "Using saved GitHub token (${GH_TOKEN_FILE})"
}

save_bot_token() {
  [[ -n "$BOT_TOKEN" ]] || return 0
  printf '%s' "$BOT_TOKEN" > "$BOT_TOKEN_FILE"
  chmod 600 "$BOT_TOKEN_FILE"
}

load_bot_token() {
  [[ -z "$BOT_TOKEN" && -f "$BOT_TOKEN_FILE" ]] || return 0
  BOT_TOKEN=$(tr -d '\r\n' < "$BOT_TOKEN_FILE")
}

_load_saved_settings() {
  local cli_repo="" cli_branch="" cli_dir="" cli_back="" cli_front=""
  local cli_auto_https=false cli_with_bot=false
  $REPO_URL_FROM_CLI && cli_repo="$REPO_URL"
  for arg in "$@"; do
    case $arg in
      --branch=*)      cli_branch="${arg#--branch=}" ;;
      --deploy-dir=*)  cli_dir="${arg#--deploy-dir=}" ;;
      --back-url=*)    cli_back="${arg#--back-url=}" ;;
      --front-url=*)   cli_front="${arg#--front-url=}" ;;
      --auto-https)    cli_auto_https=true ;;
      --with-bot)      cli_with_bot=true ;;
    esac
  done

  load_deploy_conf
  load_github_token
  load_bot_token

  [[ -n "$cli_repo" ]] && REPO_URL="$cli_repo"
  [[ -n "$cli_branch" ]] && BRANCH="$cli_branch"
  [[ -n "$cli_dir" ]] && DEPLOY_DIR="$cli_dir"
  [[ -n "$cli_back" ]] && BACK_DOMAIN="$cli_back"
  [[ -n "$cli_front" ]] && FRONT_DOMAIN="$cli_front"
  $cli_auto_https && AUTO_HTTPS=true
  if $cli_with_bot; then WITH_BOT=true; SKIP_BOT=false; DO_BOT=true; fi
  if [[ "${WITH_BOT:-false}" == "true" ]]; then DO_BOT=true; SKIP_BOT=false; fi

  BACK_DIR="${DEPLOY_DIR}/shajarname-back"
  FRONT_DIR="${DEPLOY_DIR}/shajarname-front"
  BOT_DIR="${DEPLOY_DIR}/shajarname-bot"
}
_load_saved_settings "$@"

# =============================================================================
# Mongo helpers
# =============================================================================
kernel_ge_6_19() {
  local kernel
  kernel=$(uname -r | sed 's/-.*//')
  [[ "$(printf '%s\n' '6.19' "$kernel" | sort -V | head -1)" == '6.19' ]]
}

mongo_installed_version() {
  mongod --version 2>/dev/null | sed -n 's/.*db version v\([0-9.]*\).*/\1/p' | head -1
}

mongo_ubuntu_codename() {
  local ubuntu_codename
  ubuntu_codename=$(lsb_release -sc 2>/dev/null || echo "noble")
  case "$ubuntu_codename" in
    focal|jammy|noble) echo "$ubuntu_codename" ;;
    *) echo "noble" ;;
  esac
}

repair_malformed_mongodb_apt_source() {
  local list_file="/etc/apt/sources.list.d/mongodb-org-${MONGO_MAJOR}.list"
  [[ -f "$list_file" ]] || return 0
  if grep -qE '^https://' "$list_file" 2>/dev/null; then
    warn "Fixing malformed MongoDB apt source list..."
    write_mongodb_apt_repo
  fi
}

write_mongodb_apt_repo() {
  local codename
  codename=$(mongo_ubuntu_codename)
  cat > "/etc/apt/sources.list.d/mongodb-org-${MONGO_MAJOR}.list" <<EOF
deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg ] https://repo.mongodb.org/apt/ubuntu ${codename}/mongodb-org/${MONGO_MAJOR} multiverse
EOF
}

hold_mongodb_packages() {
  for pkg in mongodb-org mongodb-org-database mongodb-org-server \
              mongodb-mongosh mongodb-org-mongos mongodb-org-tools \
              mongodb-org-database-tools-extra; do
    echo "${pkg} hold" | dpkg --set-selections 2>/dev/null || true
  done
}

install_mongodb_packages() {
  local version=$1
  if [[ -n "$version" ]]; then
    apt-get install -y -qq --allow-downgrades \
      "mongodb-org=${version}" \
      "mongodb-org-database=${version}" \
      "mongodb-org-server=${version}" \
      mongodb-mongosh \
      "mongodb-org-mongos=${version}" \
      "mongodb-org-tools=${version}" \
      "mongodb-org-database-tools-extra=${version}" > /dev/null
    hold_mongodb_packages
  else
    apt-get install -y -qq mongodb-org > /dev/null
  fi
}

install_mongodb() {
  local target_version=""
  if kernel_ge_6_19; then
    target_version="$MONGO_KERNEL_SAFE_VERSION"
    warn "Kernel $(uname -r) >= 6.19 -- pinning MongoDB to ${target_version}"
  fi
  curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_MAJOR}.asc" | \
    gpg --batch --yes -o "/usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg" --dearmor
  write_mongodb_apt_repo
  apt-get update -qq
  if ! command -v mongod &>/dev/null; then
    info "Installing MongoDB ${target_version:-latest ${MONGO_MAJOR}}..."
    install_mongodb_packages "$target_version"
    success "MongoDB $(mongod --version | head -1) installed"
    return
  fi
  local installed_version
  installed_version=$(mongo_installed_version)
  if [[ -n "$target_version" && "$installed_version" != "$target_version" ]]; then
    info "Replacing MongoDB ${installed_version:-unknown} with ${target_version}..."
    install_mongodb_packages "$target_version"
  fi
  success "MongoDB $(mongod --version | head -1) ready"
}

configure_mongod_for_kernel() {
  kernel_ge_6_19 || return 0
  mkdir -p /etc/systemd/system/mongod.service.d
  cat > /etc/systemd/system/mongod.service.d/kernel-6.19.conf <<'EOF'
[Service]
Environment="GLIBC_TUNABLES=glibc.pthread.rseq=1"
EOF
}

mongod_failure_details() {
  echo ""
  echo -e "${RED}[ERR]${NC}   MongoDB failed to start. Recent journal:"
  journalctl -u mongod -n 30 --no-pager 2>/dev/null || true
  exit 1
}

start_mongod() {
  command -v mongod &>/dev/null || return 0
  if ! grep -q avx /proc/cpuinfo 2>/dev/null; then
    error "CPU does not support AVX -- MongoDB 8 cannot run on this server."
  fi
  mkdir -p /var/lib/mongodb /var/log/mongodb /run/mongodb
  chown -R mongodb:mongodb /var/lib/mongodb /var/log/mongodb /run/mongodb 2>/dev/null || true
  if [[ -f /var/lib/mongodb/mongod.lock ]] && ! pgrep -x mongod &>/dev/null; then
    rm -f /var/lib/mongodb/mongod.lock
  fi
  configure_mongod_for_kernel
  if systemctl is-active --quiet mongod 2>/dev/null; then
    success "MongoDB service is running"
    return
  fi
  systemctl daemon-reload
  systemctl enable mongod --quiet
  systemctl start mongod
  sleep 3
  systemctl is-active --quiet mongod && success "MongoDB started" || mongod_failure_details
}

# =============================================================================
# Caddy
# =============================================================================
install_caddy() {
  if command -v caddy &>/dev/null; then
    success "Caddy $(caddy version) already installed"
    return
  fi
  info "Installing Caddy..."
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq caddy > /dev/null
  success "Caddy $(caddy version) installed"
}

# reverse_proxy supports WebSocket (Socket.IO) by default
caddy_backend_handles() {
  cat <<EOF
  encode gzip
  reverse_proxy 127.0.0.1:${BACK_PORT} {
    header_up X-Real-IP {remote_host}
    header_up Host {host}
  }

  header {
    X-Content-Type-Options nosniff
    -Server
  }
EOF
}

caddy_front_handles() {
  cat <<EOF
  encode gzip
  reverse_proxy 127.0.0.1:${FRONT_PORT} {
    header_up X-Real-IP {remote_host}
  }

  header {
    X-Content-Type-Options nosniff
    X-Frame-Options SAMEORIGIN
    -Server
  }
EOF
}

generate_caddyfile() {
  local dest="/etc/caddy/Caddyfile"
  local backend_block front_block
  backend_block=$(caddy_backend_handles)
  front_block=$(caddy_front_handles)

  if $AUTO_HTTPS; then
    cat > "$dest" <<EOF
# Generated by Shajarname deploy.sh -- auto-https
{
  log {
    output file /var/log/caddy/caddy.log {
      roll_size 50mb
      roll_keep 5
    }
  }
}

${FRONT_DOMAIN} {
${front_block}
}

${BACK_DOMAIN} {
${backend_block}
}
EOF
  else
    cat > "$dest" <<EOF
# Generated by Shajarname deploy.sh -- manual certs
{
  auto_https off
  log {
    output file /var/log/caddy/caddy.log {
      roll_size 50mb
      roll_keep 5
    }
  }
}

http://${FRONT_DOMAIN} {
  redir https://{host}{uri} permanent
}
http://${BACK_DOMAIN} {
  redir https://{host}{uri} permanent
}

https://${FRONT_DOMAIN} {
  tls ${CADDY_SSL_DIR}/fullchain.pem ${CADDY_SSL_DIR}/privkey.pem
${front_block}
}

https://${BACK_DOMAIN} {
  tls ${CADDY_SSL_DIR}/fullchain.pem ${CADDY_SSL_DIR}/privkey.pem
${backend_block}
}
EOF
  fi
  success "Caddyfile written to ${dest}"
}

setup_caddy() {
  step "Configuring Caddy + SSL"
  install_caddy
  local ssl_src="${SCRIPT_DIR}/ssl"
  if $AUTO_HTTPS && [[ -f "${ssl_src}/fullchain.pem" && -f "${ssl_src}/privkey.pem" ]]; then
    warn "--auto-https ignored: found ${ssl_src}/fullchain.pem + privkey.pem — using manual certs"
    AUTO_HTTPS=false
  fi
  if ! $AUTO_HTTPS; then
    if [[ ! -f "${ssl_src}/fullchain.pem" || ! -f "${ssl_src}/privkey.pem" ]]; then
      error "SSL files not found.\nPlace:\n  ${ssl_src}/fullchain.pem\n  ${ssl_src}/privkey.pem\nOr use --auto-https (requires public DNS)"
    fi
    mkdir -p "$CADDY_SSL_DIR"
    cp "${ssl_src}/fullchain.pem" "${CADDY_SSL_DIR}/fullchain.pem"
    cp "${ssl_src}/privkey.pem"   "${CADDY_SSL_DIR}/privkey.pem"
    chown -R caddy:caddy "$CADDY_SSL_DIR"
    chmod 755 "$CADDY_SSL_DIR"
    chmod 644 "${CADDY_SSL_DIR}/fullchain.pem"
    chmod 640 "${CADDY_SSL_DIR}/privkey.pem"
    if ! sudo -u caddy test -r "${CADDY_SSL_DIR}/privkey.pem"; then
      error "caddy user cannot read ${CADDY_SSL_DIR}/privkey.pem"
    fi
    if ! sudo -u caddy test -r "${CADDY_SSL_DIR}/fullchain.pem"; then
      error "caddy user cannot read ${CADDY_SSL_DIR}/fullchain.pem"
    fi
    if ! openssl x509 -in "${CADDY_SSL_DIR}/fullchain.pem" -noout >/dev/null 2>&1; then
      error "fullchain.pem is not a valid certificate"
    fi
    if ! openssl pkey -in "${CADDY_SSL_DIR}/privkey.pem" -noout >/dev/null 2>&1 \
      && ! openssl rsa -in "${CADDY_SSL_DIR}/privkey.pem" -check -noout >/dev/null 2>&1; then
      error "privkey.pem is invalid or password-protected.\nExport an unencrypted private key."
    fi
    local cert_mod key_mod
    cert_mod=$(openssl x509 -noout -modulus -in "${CADDY_SSL_DIR}/fullchain.pem" 2>/dev/null | openssl md5 2>/dev/null || true)
    key_mod=$(openssl rsa -noout -modulus -in "${CADDY_SSL_DIR}/privkey.pem" 2>/dev/null | openssl md5 2>/dev/null || true)
    if [[ -n "$cert_mod" && -n "$key_mod" && "$cert_mod" != "$key_mod" ]]; then
      error "SSL mismatch: fullchain.pem and privkey.pem are NOT a matching pair."
    fi
    info "Certificate subject:"
    openssl x509 -in "${CADDY_SSL_DIR}/fullchain.pem" -noout -subject -dates -ext subjectAltName 2>/dev/null || true
    success "SSL files copied and verified"
  else
    info "Auto-HTTPS -- ${FRONT_DOMAIN} and ${BACK_DOMAIN} must resolve in PUBLIC DNS to this server"
  fi
  generate_caddyfile
  caddy fmt --overwrite /etc/caddy/Caddyfile 2>/dev/null || true
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
    || error "Caddyfile validation failed"
  mkdir -p /var/log/caddy
  chown caddy:caddy /var/log/caddy 2>/dev/null || true

  systemctl enable caddy --quiet
  systemctl stop caddy 2>/dev/null || true
  pkill -x caddy 2>/dev/null || true
  sleep 1

  if ss -tlnp 2>/dev/null | grep -qE ':80 |:443 '; then
    warn "Port 80/443 already in use:"
    ss -tlnp | grep -E ':80 |:443 ' || true
  fi

  mkdir -p /var/log/caddy
  chown -R caddy:caddy /var/log/caddy
  chmod 755 /var/log/caddy

  if ! systemctl start caddy; then
    echo ""
    warn "systemctl start failed. Journal:"
    journalctl -u caddy -n 50 --no-pager 2>/dev/null || true
    echo ""
    warn "Manual run output:"
    timeout 3 caddy run --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 || true
    error "Caddy start failed — see above"
  fi

  local i
  for i in 1 2 3 4 5; do
    if systemctl is-active --quiet caddy; then
      success "Caddy ready"
      return
    fi
    sleep 1
  done

  echo ""
  warn "Caddy exited right after start. Journal:"
  journalctl -u caddy -n 60 --no-pager 2>/dev/null || true
  echo ""
  warn "Ports:"
  ss -tlnp | grep -E ':80 |:443 ' || true
  echo ""
  warn "Manual foreground run (shows real error):"
  timeout 4 caddy run --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 || true
  error "Caddy is not active after start — see journal / manual run above"
}

# =============================================================================
# System deps
# =============================================================================
install_puppeteer_deps() {
  info "Installing Chromium/Puppeteer OS libraries (PDF export)..."
  apt-get install -y -qq \
    ca-certificates fonts-liberation fonts-noto-core fonts-noto-color-emoji \
    libasound2t64 libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils \
    libxshmfence1 libxss1 libpangocairo-1.0-0 libpango-1.0-0 \
    2>/dev/null \
    || apt-get install -y -qq \
      ca-certificates fonts-liberation \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
      libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
      libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils \
      2>/dev/null \
    || warn "Some Puppeteer libs could not be installed — PDF export may fail"
}

install_deps() {
  step "Installing system dependencies"
  repair_malformed_mongodb_apt_source
  apt-get update -qq
  apt-get install -y -qq \
    curl git ca-certificates gnupg build-essential rsync python3 \
    debian-keyring debian-archive-keyring apt-transport-https \
    lsb-release openssl > /dev/null

  install_puppeteer_deps

  if ! node --version 2>/dev/null | grep -q "^v${NODE_VERSION}"; then
    info "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null
  fi
  success "Node.js $(node --version)"

  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  export CI=1

  if ! command -v pnpm &>/dev/null; then
    info "Installing pnpm..."
    npm install -g pnpm@9 > /dev/null 2>&1 \
      || npm install -g pnpm > /dev/null 2>&1 \
      || {
        corepack enable
        corepack prepare pnpm@9.15.9 --activate
      }
  fi
  success "pnpm $(pnpm --version)"

  if ! command -v pm2 &>/dev/null; then
    npm install -g pm2 > /dev/null 2>&1
  fi
  success "PM2 $(pm2 --version)"

  if ! $SKIP_MONGO; then
    install_mongodb
    start_mongod
  fi
  install_caddy
}

# =============================================================================
# Git (monorepo)
# =============================================================================
prompt_domains_if_placeholder() {
  if ! is_placeholder_domain; then
    info "Domains: front=${FRONT_DOMAIN}  api=${BACK_DOMAIN}"
    return
  fi
  echo ""
  echo -e "${BOLD}${CYAN}  --- Domains ----------------------------------------${NC}"
  echo -e "  Defaults still use example.com — set real hostnames."
  read -rp "  Frontend domain [${FRONT_DOMAIN}]: " _fd
  [[ -n "${_fd:-}" ]] && FRONT_DOMAIN="$_fd"
  read -rp "  API domain [${BACK_DOMAIN}]: " _bd
  [[ -n "${_bd:-}" ]] && BACK_DOMAIN="$_bd"
  success "Front -> https://${FRONT_DOMAIN}"
  success "API   -> https://${BACK_DOMAIN}"
  save_deploy_conf
  echo ""
}

prompt_repo_url() {
  if ! is_placeholder_repo; then
    info "Repo URL: ${REPO_URL}"
    return
  fi
  load_repo_from_git
  if ! is_placeholder_repo; then
    save_deploy_conf
    return
  fi
  echo ""
  echo -e "${BOLD}${CYAN}  --- GitHub Monorepo ---------------------------------${NC}"
  echo -e "  (saved to ${DEPLOY_CONF} — will not ask again on --update)"
  read -rp "  Monorepo git URL: " REPO_URL
  [[ -z "$REPO_URL" ]] && error "Repository URL is required."
  REPO_URL=$(strip_git_token "$REPO_URL")
  success "Repo -> ${REPO_URL}"
  save_deploy_conf
  echo ""
}

prompt_github_token() {
  if [[ -n "$GH_TOKEN" ]]; then
    info "GitHub token already available (saved or previously entered)"
    return
  fi
  echo ""
  echo -e "${BOLD}${CYAN}  --- GitHub Authentication ---------------------------${NC}"
  echo -e "  Private repo: paste a PAT (saved for next updates)."
  echo -e "  Public repo: press Enter."
  echo ""
  read -rsp "  GitHub Token (Enter to skip): " GH_TOKEN
  echo ""
  if [[ -n "$GH_TOKEN" ]]; then
    save_github_token
  else
    info "No token -- treating repo as public"
  fi
  echo ""
}

prompt_bot_token() {
  $DO_BOT || return 0
  if [[ -n "$BOT_TOKEN" ]]; then
    info "Bot token already available"
    return
  fi
  echo ""
  echo -e "${BOLD}${CYAN}  --- Telegram Bot ------------------------------------${NC}"
  read -rsp "  BOT_TOKEN: " BOT_TOKEN
  echo ""
  [[ -z "$BOT_TOKEN" ]] && error "BOT_TOKEN is required when using --with-bot"
  save_bot_token
  echo ""
}

auth_url() {
  local url=$1
  if [[ -z "$GH_TOKEN" ]]; then
    echo "$url"
    return
  fi
  echo "${url/https:\/\//https:\/\/${GH_TOKEN}@}"
}

setup_monorepo() {
  local authed_url
  authed_url=$(auth_url "$REPO_URL")

  if [[ -d "${DEPLOY_DIR}/.git" ]]; then
    info "git pull monorepo..."
    git -C "$DEPLOY_DIR" remote set-url origin "$authed_url"
    git -C "$DEPLOY_DIR" fetch origin
    git -C "$DEPLOY_DIR" checkout "$BRANCH"
    git -C "$DEPLOY_DIR" pull origin "$BRANCH"
    git -C "$DEPLOY_DIR" remote set-url origin "$(strip_git_token "$REPO_URL")"
    success "Monorepo updated"
  elif [[ -d "$BACK_DIR" && -d "$FRONT_DIR" && -f "${BACK_DIR}/package.json" && -f "${FRONT_DIR}/package.json" ]]; then
    warn "${DEPLOY_DIR} has project files without .git -- keeping (use --skip-pull next time)"
  else
    info "git clone monorepo into ${DEPLOY_DIR}..."
    local tmp="${DEPLOY_DIR}.clone-tmp.$$"
    rm -rf "$tmp"
    mkdir -p "$(dirname "$DEPLOY_DIR")"
    git clone --branch "$BRANCH" "$authed_url" "$tmp" \
      || error "git clone failed -- check URL / token / branch (${BRANCH})"
    git -C "$tmp" remote set-url origin "$(strip_git_token "$REPO_URL")"

    mkdir -p "$DEPLOY_DIR"
    rsync -a \
      --exclude 'ssl/fullchain.pem' \
      --exclude 'ssl/privkey.pem' \
      --exclude 'shajarname-back/.env' \
      --exclude 'shajarname-back/.env.production' \
      --exclude 'shajarname-front/.env.local' \
      --exclude 'shajarname-bot/.env' \
      --exclude 'shajarname-back/public/avatars' \
      --exclude 'shajarname-back/public/gallery' \
      --exclude 'node_modules' \
      --exclude '.next' \
      --exclude 'dist' \
      "${tmp}/" "${DEPLOY_DIR}/"
    rm -rf "$tmp"
    success "Monorepo ready at ${DEPLOY_DIR}"
  fi

  [[ -d "$BACK_DIR" && -d "$FRONT_DIR" && -f "${BACK_DIR}/package.json" ]] \
    || error "Expected shajarname-back and shajarname-front under ${DEPLOY_DIR}\nClone failed or incomplete tree."

  save_deploy_conf
}

ensure_code_present() {
  if [[ -d "${SCRIPT_DIR}/shajarname-back" && -d "${SCRIPT_DIR}/shajarname-front" ]]; then
    if [[ "$SCRIPT_DIR" != "$DEPLOY_DIR" ]]; then
      info "Syncing local tree ${SCRIPT_DIR} -> ${DEPLOY_DIR}"
      mkdir -p "$DEPLOY_DIR"
      rsync -a \
        --exclude node_modules --exclude .next --exclude dist \
        --exclude .git \
        --exclude 'ssl/fullchain.pem' --exclude 'ssl/privkey.pem' \
        --exclude 'shajarname-back/.env' \
        --exclude 'shajarname-back/.env.production' \
        --exclude 'shajarname-front/.env.local' \
        --exclude 'shajarname-bot/.env' \
        --exclude 'shajarname-back/public/avatars' \
        --exclude 'shajarname-back/public/gallery' \
        "${SCRIPT_DIR}/" "${DEPLOY_DIR}/"
    fi
  fi
  [[ -d "$BACK_DIR" && -d "$FRONT_DIR" ]] \
    || error "shajarname-back / shajarname-front not found under ${DEPLOY_DIR}"
}

# =============================================================================
# Mongo auth
# =============================================================================
needs_mongo_setup() {
  $SKIP_MONGO && return 1
  local mongod_conf="/etc/mongod.conf"
  if grep -q "authorization: enabled" "$mongod_conf" 2>/dev/null; then
    if [[ -f "$MONGO_CREDS_FILE" || -f "${BACK_DIR}/.env.production" ]]; then
      return 1
    fi
  fi
  return 0
}

prompt_mongo_credentials() {
  echo ""
  echo -e "${BOLD}${CYAN}  --- MongoDB Authentication --------------------------${NC}"
  read -rp "  MongoDB username [shajarname]: " MONGO_USER
  MONGO_USER="${MONGO_USER:-shajarname}"
  local pass1 pass2
  while [[ -z "$MONGO_PASS" ]]; do
    read -rsp "  MongoDB password: " pass1; echo ""
    [[ -z "$pass1" ]] && { warn "Password cannot be empty."; continue; }
    read -rsp "  Confirm password: " pass2; echo ""
    if [[ "$pass1" != "$pass2" ]]; then
      warn "Passwords do not match."
    else
      MONGO_PASS="$pass1"
    fi
  done
  echo ""
}

load_mongo_creds_if_any() {
  if [[ -f "$MONGO_CREDS_FILE" && -z "$MONGO_USER" ]]; then
    # shellcheck disable=SC1090
    source "$MONGO_CREDS_FILE"
  fi
  if [[ -z "$MONGO_USER" && -f "${BACK_DIR}/.env.production" ]]; then
    local db_url
    db_url=$(grep -m1 '^DATABASE_URL=' "${BACK_DIR}/.env.production" | cut -d= -f2-)
    if [[ "$db_url" =~ mongodb://([^:]+):([^@]+)@ ]]; then
      MONGO_USER="${BASH_REMATCH[1]}"
      MONGO_PASS="${BASH_REMATCH[2]}"
    fi
  fi
}

setup_mongo_auth() {
  step "Configuring MongoDB users"
  local mongod_conf="/etc/mongod.conf"

  mongosh --quiet --eval "
    db = db.getSiblingDB('admin');
    if (!db.getUser('${MONGO_USER}_admin')) {
      db.createUser({
        user: '${MONGO_USER}_admin',
        pwd:  '${MONGO_PASS}',
        roles: [ { role: 'userAdminAnyDatabase', db: 'admin' }, { role: 'readWriteAnyDatabase', db: 'admin' } ]
      });
      print('admin user created');
    }
    db = db.getSiblingDB('${MONGO_DB}');
    if (!db.getUser('${MONGO_USER}')) {
      db.createUser({
        user: '${MONGO_USER}',
        pwd:  '${MONGO_PASS}',
        roles: [{ role: 'dbOwner', db: '${MONGO_DB}' }]
      });
      print('app user created');
    }
  " || error "Failed to create MongoDB users"

  if ! grep -q "^security:" "$mongod_conf" 2>/dev/null; then
    cat >> "$mongod_conf" <<'MONGOCNF'

# Added by Shajarname deploy.sh
security:
  authorization: enabled
MONGOCNF
  else
    sed -i '/^security:/,/^[^ ]/ s/.*authorization.*/  authorization: enabled/' "$mongod_conf"
  fi

  systemctl daemon-reload
  systemctl restart mongod
  sleep 3
  systemctl is-active --quiet mongod || error "MongoDB failed after enabling auth"

  local mongo_pass_enc
  mongo_pass_enc=$(urlencode_mongo_pass "$MONGO_PASS")
  mongosh \
    "mongodb://${MONGO_USER}:${mongo_pass_enc}@127.0.0.1:27017/${MONGO_DB}?authSource=${MONGO_DB}" \
    --quiet --eval "db.adminCommand({ ping: 1 })" \
    || error "Mongo connection test failed"

  cat > "$MONGO_CREDS_FILE" <<EOF
# Shajarname -- MongoDB Credentials
MONGO_USER=${MONGO_USER}
MONGO_PASS=${MONGO_PASS}
MONGO_DB=${MONGO_DB}
CONNECTION_STRING=mongodb://${MONGO_USER}:${mongo_pass_enc}@127.0.0.1:27017/${MONGO_DB}?authSource=${MONGO_DB}
EOF
  chmod 600 "$MONGO_CREDS_FILE"
  success "Mongo auth ready (creds: ${MONGO_CREDS_FILE})"
}

# =============================================================================
# Env files
# =============================================================================
create_env_back() {
  # Nest ConfigModule loads ONLY .env.${NODE_ENV} — must be .env.production
  local env_file="${BACK_DIR}/.env.production"
  [[ -d "$BACK_DIR" ]] || error "Backend dir missing: ${BACK_DIR}\nRe-run deploy without skipping pull, or copy the full project."
  if [[ -f "$env_file" && ! $FORCE_ENV ]]; then
    warn "Backend .env.production exists -- skipping (use --force-env to overwrite)"
    return
  fi

  load_mongo_creds_if_any
  local jwt_secret
  jwt_secret=$(openssl rand -hex 32 2>/dev/null || echo "CHANGE_ME_$(date +%s)_shajarname")

  local db_url mongo_pass_enc
  if [[ -n "${MONGO_USER:-}" && -n "${MONGO_PASS:-}" ]]; then
    mongo_pass_enc=$(urlencode_mongo_pass "$MONGO_PASS")
    db_url="mongodb://${MONGO_USER}:${mongo_pass_enc}@127.0.0.1:27017/${MONGO_DB}?authSource=${MONGO_DB}"
  else
    db_url="mongodb://USERNAME:PASSWORD@127.0.0.1:27017/${MONGO_DB}?authSource=${MONGO_DB}"
    warn "Mongo credentials missing -- edit DATABASE_URL in ${env_file}"
  fi

  cat > "$env_file" <<EOF
NODE_ENV=production
PORT=${BACK_PORT}
DATABASE_URL=${db_url}
FRONTEND_ORIGINS=https://${FRONT_DOMAIN}
JWT_SECRET=${jwt_secret}
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_DAYS=30
# REDIS_URL=redis://127.0.0.1:6379
EOF
  chmod 600 "$env_file"
  success "Backend .env.production created"
}

create_env_front() {
  local env_file="${FRONT_DIR}/.env.local"
  [[ -d "$FRONT_DIR" ]] || error "Frontend dir missing: ${FRONT_DIR}\nRe-run deploy without skipping pull, or copy the full project."
  if [[ -f "$env_file" && ! $FORCE_ENV ]]; then
    warn "Frontend .env.local exists -- skipping (use --force-env to overwrite)"
    return
  fi

  cat > "$env_file" <<EOF
# Baked into Next.js at build time.
# Change URL: sudo ./deploy.sh --skip-deps --skip-pull --force-env --env-only
# then rebuild front.
NEXT_PUBLIC_API_URL=https://${BACK_DOMAIN}/v1
NEXT_PUBLIC_WS_URL=https://${BACK_DOMAIN}
EOF
  success "Frontend .env.local created"
}

create_env_bot() {
  $DO_BOT || return 0
  local env_file="${BOT_DIR}/.env"
  [[ -d "$BOT_DIR" ]] || error "Bot dir missing: ${BOT_DIR}"
  if [[ -f "$env_file" && ! $FORCE_ENV ]]; then
    warn "Bot .env exists -- skipping (use --force-env to overwrite)"
    return
  fi
  load_bot_token
  [[ -n "$BOT_TOKEN" ]] || error "BOT_TOKEN missing — re-run with --with-bot"

  cat > "$env_file" <<EOF
BOT_TOKEN=${BOT_TOKEN}
API_BASE_URL=https://${BACK_DOMAIN}/v1
BOT_MOBILE=09120000000
BOT_PASSWORD=najaf123
CRON_TZ=Asia/Tehran
EOF
  chmod 600 "$env_file"
  success "Bot .env created"
  warn "Change BOT_MOBILE / BOT_PASSWORD in ${env_file} after rotating demo admin creds"
}

# =============================================================================
# Build + PM2
# =============================================================================
back_entry_file() {
  if   [[ -f "${BACK_DIR}/dist/main.js"     ]]; then echo "${BACK_DIR}/dist/main.js"
  elif [[ -f "${BACK_DIR}/dist/src/main.js" ]]; then echo "${BACK_DIR}/dist/src/main.js"
  else error "Backend entry not found. Run without --skip-build."
  fi
}

bot_entry_file() {
  if [[ -f "${BOT_DIR}/dist/index.js" ]]; then echo "${BOT_DIR}/dist/index.js"
  else error "Bot entry not found. Run without --skip-build."
  fi
}

build_back() {
  step "Building backend (NestJS — ${PKG_BACK})"
  cd "$DEPLOY_DIR"
  info "pnpm install (workspace)..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  info "nest build..."
  pnpm --filter "$PKG_BACK" run build
  local entry
  entry=$(back_entry_file)
  success "Backend built -- ${entry}"
}

build_front() {
  step "Building frontend (Next.js — ${PKG_FRONT})"
  cd "$DEPLOY_DIR"
  info "pnpm install (workspace)..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install

  local api_url ws_url
  api_url=$(grep -m1 '^NEXT_PUBLIC_API_URL=' "${FRONT_DIR}/.env.local" 2>/dev/null | cut -d= -f2- || true)
  ws_url=$(grep -m1 '^NEXT_PUBLIC_WS_URL=' "${FRONT_DIR}/.env.local" 2>/dev/null | cut -d= -f2- || true)

  [[ -z "$api_url" ]] && api_url="https://${BACK_DOMAIN}/v1"
  [[ -z "$ws_url" ]] && ws_url="https://${BACK_DOMAIN}"

  info "next build..."
  NEXT_PUBLIC_API_URL="$api_url" \
  NEXT_PUBLIC_WS_URL="$ws_url" \
  PORT="$FRONT_PORT" \
    pnpm --filter "$PKG_FRONT" run build
  success "Frontend built"
}

build_bot() {
  $DO_BOT || return 0
  step "Building Telegram bot (${PKG_BOT})"
  cd "$DEPLOY_DIR"
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  pnpm --filter "$PKG_BOT" run build
  bot_entry_file >/dev/null
  success "Bot built"
}

start_backend_pm2() {
  local back_entry
  back_entry=$(back_entry_file)
  if pm2 describe shajarname-back > /dev/null 2>&1; then
    pm2 delete shajarname-back > /dev/null 2>&1 || true
  fi
  # dotenv file is .env.production — Nest loads it when NODE_ENV=production
  NODE_ENV=production pm2 start "$back_entry" \
    --name shajarname-back \
    --cwd  "$BACK_DIR" \
    --log  /var/log/shajarname-back.log \
    --time
  success "shajarname-back started"
}

start_frontend_pm2() {
  if pm2 describe shajarname-front > /dev/null 2>&1; then
    pm2 delete shajarname-front > /dev/null 2>&1 || true
  fi
  NODE_ENV=production PORT="$FRONT_PORT" pm2 start pnpm \
    --name shajarname-front \
    --cwd  "$FRONT_DIR" \
    --log  /var/log/shajarname-front.log \
    --time \
    -- start
  success "shajarname-front started"
}

start_bot_pm2() {
  $DO_BOT || return 0
  local bot_entry
  bot_entry=$(bot_entry_file)
  if pm2 describe shajarname-bot > /dev/null 2>&1; then
    pm2 delete shajarname-bot > /dev/null 2>&1 || true
  fi
  pm2 start "$bot_entry" \
    --name shajarname-bot \
    --cwd  "$BOT_DIR" \
    --log  /var/log/shajarname-bot.log \
    --time
  success "shajarname-bot started"
}

start_with_pm2() {
  step "Starting services with PM2"
  $DO_BACK  && start_backend_pm2
  $DO_FRONT && start_frontend_pm2
  $DO_BOT   && start_bot_pm2
  pm2 save
  pm2 startup 2>/dev/null | grep -E '^sudo' | bash || true
}

seed_database() {
  step "Seed note"
  info "Shajarname has no CLI db:seed — Nest SeedService runs on boot:"
  info "  empty DB  -> demo family + admin 09120000000 / najaf123"
  info "  existing  -> ensureDemoLogin only"
  if $DO_BACK; then
    info "Restarting backend so seed hooks run..."
    start_backend_pm2
  fi
  success "Seed handled by app bootstrap"
}

print_status() {
  echo ""
  echo -e "${GREEN}${BOLD}===================================================${NC}"
  echo -e "${GREEN}${BOLD}  Shajarname deployed successfully${NC}"
  echo -e "${GREEN}${BOLD}===================================================${NC}"
  echo ""
  echo -e "  ${BOLD}Frontend${NC} : ${CYAN}https://${FRONT_DOMAIN}${NC}"
  echo -e "  ${BOLD}Backend ${NC} : ${CYAN}https://${BACK_DOMAIN}${NC}"
  echo -e "  ${BOLD}API v1  ${NC} : ${CYAN}https://${BACK_DOMAIN}/v1${NC}"
  echo -e "  ${BOLD}WS      ${NC} : ${CYAN}https://${BACK_DOMAIN}${NC}  (Socket.IO)"
  if $DO_BOT; then
    echo -e "  ${BOLD}Bot     ${NC} : ${CYAN}PM2 shajarname-bot${NC}"
  fi
  echo ""
  echo -e "  Internal: back :${BACK_PORT}  front :${FRONT_PORT}"
  echo ""
  echo -e "  ${BOLD}Saved config:${NC}  ${DEPLOY_CONF}"
  echo -e "  ${BOLD}PM2:${NC}"
  pm2 list
  echo ""
  echo -e "  ${BOLD}Next update:${NC}  sudo ./deploy.sh --update"
  echo -e "  ${BOLD}With bot:${NC}     sudo ./deploy.sh --update --with-bot"
  echo -e "  ${BOLD}Force env:${NC}    sudo ./deploy.sh --skip-deps --skip-pull --force-env --env-only"
  echo ""
  echo -e "  Default login: ${CYAN}09120000000 / najaf123${NC}  (change after first login)"
  echo ""
}

# =============================================================================
# main
# =============================================================================
main() {
  echo ""
  echo -e "${BOLD}${CYAN}===================================================${NC}"
  echo -e "${BOLD}${CYAN}  Shajarname Deploy${NC}"
  echo -e "${BOLD}${CYAN}  Front : https://${FRONT_DOMAIN}${NC}"
  echo -e "${BOLD}${CYAN}  API   : https://${BACK_DOMAIN}${NC}"
  if $UPDATE_MODE; then
    echo -e "${BOLD}${CYAN}  Mode  : update${NC}"
  fi
  if $DO_BOT; then
    echo -e "${BOLD}${CYAN}  Bot   : enabled${NC}"
  fi
  echo -e "${BOLD}${CYAN}===================================================${NC}"
  echo ""

  repair_malformed_mongodb_apt_source
  $SKIP_DEPS || install_deps

  prompt_domains_if_placeholder

  if ! $SKIP_PULL; then
    prompt_repo_url
    prompt_github_token
    step "Fetching monorepo"
    setup_monorepo
  else
    step "Using local / existing code"
    if [[ -d "${SCRIPT_DIR}/shajarname-back" ]]; then
      DEPLOY_DIR="$SCRIPT_DIR"
      BACK_DIR="${DEPLOY_DIR}/shajarname-back"
      FRONT_DIR="${DEPLOY_DIR}/shajarname-front"
      BOT_DIR="${DEPLOY_DIR}/shajarname-bot"
      info "DEPLOY_DIR = ${DEPLOY_DIR} (script location)"
    fi
    ensure_code_present
  fi

  prompt_bot_token

  if needs_mongo_setup; then
    prompt_mongo_credentials
    setup_mongo_auth
  else
    info "MongoDB auth already configured -- skipping"
    load_mongo_creds_if_any
  fi

  create_env_back
  create_env_front
  create_env_bot
  $ENV_ONLY && { success ".env files ready"; exit 0; }

  $SKIP_CADDY || setup_caddy

  if $DO_BACK && ! $SKIP_BUILD; then
    build_back
  fi

  if $SEED_DATA; then
    seed_database
  fi

  if $DO_FRONT && ! $SKIP_BUILD; then
    build_front
  fi

  if $DO_BOT && ! $SKIP_BUILD; then
    build_bot
  fi

  start_with_pm2
  print_status
}

main
