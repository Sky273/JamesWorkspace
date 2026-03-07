# =============================================================================
# ResumeConverter - All-in-One Production Container
# Includes: PostgreSQL + Node.js + Puppeteer + 3 servers (proxy, pdf, frontend)
# =============================================================================

FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# =============================================================================
# System Dependencies
# =============================================================================
# Install prerequisites first (curl, gpg needed for adding repos)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Add PostgreSQL 18 repository
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

RUN apt-get update && apt-get install -y \
    # PostgreSQL 18
    postgresql-18 \
    postgresql-contrib-18 \
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
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome (stable) for Puppeteer
RUN wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get update \
    && apt-get install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use Google Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# =============================================================================
# Application Setup
# =============================================================================
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY client/scripts ./client/scripts/

# Install all dependencies (--legacy-peer-deps for ESLint compatibility)
RUN npm ci --legacy-peer-deps

# Copy application source
COPY client ./client
COPY server ./server
COPY pdf-server ./pdf-server
COPY scripts ./scripts

# Copy markdown files imported by frontend components
COPY USER_GUIDE.md ./
COPY USER_GUIDE_EN.md ./
COPY CHANGELOG.md ./

# Copy Docker environment file as .env
COPY .env.docker ./.env

# Create certificates directory (certificates will be generated at runtime or mounted)
RUN mkdir -p /app/certificates

# Build frontend (creates client/dist with static assets)
RUN npm run build

# Verify frontend build exists
RUN ls -la /app/client/dist/ && echo "Frontend build successful!"

# =============================================================================
# PostgreSQL Configuration
# =============================================================================
USER postgres

# Initialize PostgreSQL 18 cluster and create database
RUN /etc/init.d/postgresql start && \
    psql --command "CREATE USER resumeconverter WITH SUPERUSER PASSWORD 'resumeconverter';" && \
    createdb -O resumeconverter resumeconverter && \
    /etc/init.d/postgresql stop

# Allow connections from localhost and external (for pgAdmin access)
RUN echo "host all all 127.0.0.1/32 md5" >> /etc/postgresql/18/main/pg_hba.conf && \
    echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/18/main/pg_hba.conf && \
    echo "listen_addresses='*'" >> /etc/postgresql/18/main/postgresql.conf

USER root

# =============================================================================
# Database Schema Initialization Script and Migrations
# =============================================================================
COPY docker/init-db.sql /docker-entrypoint-initdb.d/
COPY docker/migrations /docker-entrypoint-initdb.d/migrations/

# =============================================================================
# Supervisor Configuration (Process Manager)
# =============================================================================
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# =============================================================================
# Startup Script
# =============================================================================
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# =============================================================================
# Environment Variables (defaults, can be overridden)
# =============================================================================
ENV NODE_ENV=production
ENV PORT=3001
ENV HTTPS_PORT=3443
ENV HTTPS_ENABLED=true
ENV PDF_SERVER_PORT=3002
ENV POSTGRES_HOST=127.0.0.1
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=resumeconverter
ENV POSTGRES_USER=resumeconverter
ENV POSTGRES_PASSWORD=resumeconverter
ENV JWT_SECRET=docker-jwt-secret-change-in-production-min32chars
ENV JWT_REFRESH_SECRET=docker-jwt-refresh-secret-change-in-production-min32chars
ENV REFRESH_TOKEN_SECRET=docker-refresh-token-secret-change-in-production-min32chars
ENV CSRF_SECRET=docker-csrf-secret-change-in-production-min32chars
ENV SKIP_ENV_VALIDATION=true

# Create required directories
RUN mkdir -p /app/logs /app/uploads /app/data /var/log/supervisor

# =============================================================================
# Expose Ports
# =============================================================================
# 3001 = Proxy Server HTTP (internal)
# 3443 = Proxy Server HTTPS (main app)
# 3002 = PDF Server
# 5432 = PostgreSQL (internal only)
EXPOSE 3443

# =============================================================================
# Health Check
# =============================================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f -k https://localhost:3443/health || exit 1

# =============================================================================
# Entrypoint
# =============================================================================
ENTRYPOINT ["/entrypoint.sh"]
