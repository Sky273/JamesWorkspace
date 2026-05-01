# =============================================================================
# ResumeConverter - Multi-Stage Production Container
# Builder: install JS deps and build frontend
# Runtime: app + PDF server + external PostgreSQL/Redis services
# =============================================================================

FROM ubuntu:22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive

# Some Docker/network environments reject plain HTTP to Ubuntu/PGDG mirrors.
# Normalize apt sources to HTTPS, add retries, and temporarily relax TLS
# verification until ca-certificates is installed in the base image.
RUN sed -i 's|http://archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g; s|http://security.ubuntu.com/ubuntu|https://security.ubuntu.com/ubuntu|g' /etc/apt/sources.list && \
    printf 'Acquire::Retries "5";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' > /etc/apt/apt.conf.d/80-retries && \
    printf 'Acquire::https::Verify-Peer "false";\nAcquire::https::Verify-Host "false";\n' > /etc/apt/apt.conf.d/81-bootstrap-https

RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    lsb-release \
    software-properties-common \
    zstd \
    && rm -f /etc/apt/apt.conf.d/81-bootstrap-https \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*


FROM base AS builder

WORKDIR /app

# Native modules may need a minimal build toolchain during npm ci.
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY client/scripts ./client/scripts/

RUN npm ci --legacy-peer-deps

COPY client ./client
COPY server ./server
COPY pdf-server ./pdf-server
COPY scripts ./scripts
COPY USER_GUIDE.md ./
COPY USER_GUIDE_EN.md ./
COPY CHANGELOG.md ./

ARG VITE_TURNSTILE_SITE_KEY=""
ARG CLOUDFLARE_TURNSTILE_SITE_KEY=""
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
ENV CLOUDFLARE_TURNSTILE_SITE_KEY=${CLOUDFLARE_TURNSTILE_SITE_KEY}

RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps


FROM base AS runtime

# Add PostgreSQL 18 repository
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

RUN apt-get update && apt-get install -y \
    # PostgreSQL client tools used by migrations, readiness checks and backups
    postgresql-client-18 \
    # OCR and document processing
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-eng \
    poppler-utils \
    python3 \
    python3-pip \
    python3-opencv \
    python3-numpy \
    libglib2.0-0 \
    libgl1 \
    # Puppeteer/Chrome dependencies
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    # Process manager
    supervisor \
    # SSL certificate generation
    openssl \
    # Pandoc for HTML to DOCX conversion (high quality, no frames)
    pandoc \
    # LibreOffice for DOCX to DOC conversion (legacy format)
    libreoffice-writer-nogui \
    libreoffice-calc-nogui \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome (stable) for Puppeteer
RUN wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get update \
    && apt-get install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install advanced OCR fallback before copying application sources so Docker can
# reuse this expensive Python layer when only frontend/backend code changes.
COPY docker/ocr-python-requirements.txt /tmp/ocr-python-requirements.txt
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel && \
    python3 -m pip install --no-cache-dir -r /tmp/ocr-python-requirements.txt && \
    rm -f /tmp/ocr-python-requirements.txt

WORKDIR /app

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

COPY server ./server
COPY pdf-server ./pdf-server
COPY scripts ./scripts
COPY USER_GUIDE.md ./
COPY USER_GUIDE_EN.md ./
COPY CHANGELOG.md ./
COPY --from=builder /app/client/dist ./client/dist

RUN ls -la /app/client/dist/ && echo "Frontend build successful!"

COPY docker/schema.sql /docker-entrypoint-initdb.d/
COPY docker/init-db.sql /docker-entrypoint-initdb.d/
COPY docker/migrations /docker-entrypoint-initdb.d/migrations/
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001
ENV HTTPS_PORT=3443
ENV HTTPS_ENABLED=true
ENV PDF_SERVER_PORT=3002
ENV POSTGRES_HOST=postgres
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=resumeconverter
ENV POSTGRES_USER=resumeconverter
ENV POSTGRES_PASSWORD=RcV2026!PgSecure#Db
ENV CACHE_BACKEND=redis
ENV CACHE_REDIS_URL=redis://redis:6379
ENV CACHE_KEY_PREFIX=resumeconverter
ENV DISABLE_INTERNAL_REDIS=true
ENV JWT_SECRET=docker-jwt-secret-change-in-production-min32chars
ENV REFRESH_TOKEN_SECRET=docker-refresh-token-secret-change-in-production-min32chars
ENV CSRF_SECRET=docker-csrf-secret-change-in-production-min32chars
ENV OCR_ADVANCED_BACKEND=paddleocr

RUN mkdir -p /app/logs /app/uploads /app/uploads/logos /var/log/supervisor /app/server/backups /app/server/temp /app/certificates

EXPOSE 3443

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f -k https://localhost:3443/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
