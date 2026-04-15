# ResumeConverter - Docker Deployment

## Overview

This Docker setup starts the application stack with:

- PostgreSQL 18
- Redis
- Node.js 20
- Google Chrome for PDF generation
- Tesseract OCR, Poppler, PaddleOCR fallback
- Proxy server on `3443`
- PDF server on `3002`
- Pre-built React frontend

## Environment Files

There are three environment files at the project root:

- `/.env.docker`: Docker build and Docker runtime
- `/.env`: local non-Docker execution
- `/.env.example`: sanitized template

For Docker, `/.env.docker` is the only reference file.

Important:

- Docker helper scripts read `/.env.docker`
- `docker-compose.redis.yml` loads `/.env.docker`
- the React frontend reads public variables at image build time
- changing a frontend public variable requires rebuilding the image

## Required File

The file `/.env.docker` must exist before building or starting the Docker stack.

Minimum expected categories:

- PostgreSQL connection and password
- JWT, refresh, and CSRF secrets
- default admin credentials
- optional LLM provider keys
- optional OAuth keys
- optional Turnstile keys

Example variables:

```env
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=resumeconverter
POSTGRES_PASSWORD=replace-with-a-strong-postgres-password

CACHE_BACKEND=redis
CACHE_REDIS_URL=redis://redis:6379
CACHE_KEY_PREFIX=resumeconverter

JWT_SECRET=replace-with-a-long-random-secret
REFRESH_TOKEN_SECRET=replace-with-a-long-random-secret
CSRF_SECRET=replace-with-a-long-random-secret
MAIL_TOKEN_ENCRYPTION_KEY=replace-with-a-64-hex-key

DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-admin-password

NODE_ENV=production
HTTPS_ENABLED=true
HTTPS_PORT=3443
```

Without `/.env.docker`, Docker helper scripts fail early.

## Turnstile

Turnstile uses:

- frontend public key:
  - `VITE_TURNSTILE_SITE_KEY`
  - or `CLOUDFLARE_TURNSTILE_SITE_KEY`
- backend secret key:
  - `TURNSTILE_SECRET_KEY`
  - or `CLOUDFLARE_TURNSTILE_SECRET_KEY`

Recommended configuration in `/.env.docker`:

```env
VITE_TURNSTILE_SITE_KEY=your-site-key
CLOUDFLARE_TURNSTILE_SITE_KEY=your-site-key

TURNSTILE_SECRET_KEY=your-secret-key
CLOUDFLARE_TURNSTILE_SECRET_KEY=your-secret-key
```

Important:

- the site key is embedded in the frontend bundle at `docker build` time
- changing the site key requires a Docker rebuild
- changing only the secret key usually only requires a container restart

## Quick Start

### Windows

```bat
git clone https://github.com/votre-repo/ResumeConverter.git
cd ResumeConverter
git checkout develop

docker-build.bat
docker-run.bat
```

`docker-run.bat` should be started from an Administrator terminal if you need the `netsh interface portproxy` rule for external exposure on port `443`.

### PowerShell

```powershell
cd C:\path\to\ResumeConverter
git checkout develop

.\docker\docker-build.ps1 -Build
.\docker\docker-build.ps1 -Run
```

### Linux / macOS

```bash
cd /path/to/ResumeConverter
git checkout develop

chmod +x docker/docker-build.sh
./docker/docker-build.sh build
./docker/docker-build.sh run
```

## Available Commands

### Windows helper scripts

- `docker-build.bat`: build image, then start the stack
- `docker-run.bat`: start the stack
- `docker-stop.bat`: stop the stack
- `docker-logs.bat`: proxy server logs
- `docker-logs-pdf.bat`: PDF server logs
- `docker-shell.bat`: shell in the container

### PowerShell

- `.\docker\docker-build.ps1 -Build`
- `.\docker\docker-build.ps1 -Run`
- `.\docker\docker-build.ps1 -Stop`
- `.\docker\docker-build.ps1 -Logs`
- `.\docker\docker-build.ps1 -Shell`
- `.\docker\docker-build.ps1 -Clean`

### Linux / macOS

- `./docker/docker-build.sh build`
- `./docker/docker-build.sh run`
- `./docker/docker-build.sh stop`
- `./docker/docker-build.sh logs`
- `./docker/docker-build.sh shell`
- `./docker/docker-build.sh clean`

## Default Credentials

After startup:

- URL: `https://localhost:3443`
- email: value of `DEFAULT_ADMIN_EMAIL`
- password: value of `DEFAULT_ADMIN_PASSWORD`

If the admin account does not exist yet, Docker initialization creates it automatically.

Use a strong `DEFAULT_ADMIN_PASSWORD`. Startup fails if it is missing, too short, or left on an obvious placeholder.

## OCR Pipeline

For PDF uploads and batch imports, the extraction order is:

1. native PDF text extraction
2. OCR fallback for scanned or image pages
3. `pdftoppm` render
4. `tesseract` CLI with `fra+eng`
5. `PaddleOCR` fallback when needed

Included packages:

- `tesseract-ocr`
- `tesseract-ocr-fra`
- `tesseract-ocr-eng`
- `poppler-utils`
- `python3`
- `python3-opencv`
- `python3-numpy`
- `paddlepaddle`
- `paddleocr`

Useful checks:

```bash
docker exec -it resumeconverter-app tesseract --version
docker exec -it resumeconverter-app pdftoppm -v
```

## Data and Ports

Published ports:

- `443 -> 3443`
- `3443 -> 3443`
- `5433 -> 5432`
- `6379 -> 6379`

Mounted directories:

- `./data/postgresql`
- `./data/redis`
- `./uploads`
- `./logs`

PostgreSQL is exposed on host port `5433`.

Example:

```bash
psql -h localhost -p 5433 -U resumeconverter -d resumeconverter
```

## Logs

Quick commands:

```bash
docker logs -f resumeconverter-app
docker exec -it resumeconverter-app tail -f /var/log/supervisor/proxy-server.out.log /var/log/supervisor/proxy-server.err.log
docker exec -it resumeconverter-app tail -f /var/log/supervisor/pdf-server.out.log /var/log/supervisor/pdf-server.err.log
```

Log files inside the container:

- `/var/log/supervisor/proxy-server.out.log`
- `/var/log/supervisor/proxy-server.err.log`
- `/var/log/supervisor/pdf-server.out.log`
- `/var/log/supervisor/pdf-server.err.log`
- `/var/log/supervisor/supervisord.log`

## Troubleshooting

### Container will not start

```bash
docker logs resumeconverter-app
docker ps
```

### Application errors

```bash
docker exec -it resumeconverter-app tail -100 /var/log/supervisor/proxy-server.err.log
```

### Database issues

```bash
docker exec -it resumeconverter-app /bin/bash
psql -U resumeconverter -d resumeconverter
```

### PDF generation issues

```bash
docker exec -it resumeconverter-app google-chrome-stable --version
docker exec -it resumeconverter-app tail -100 /var/log/supervisor/pdf-server.err.log
```

### Turnstile does not appear

Check in this order:

1. the correct keys are present in `/.env.docker`
2. the image was rebuilt after changing the site key
3. the browser cache was cleared or bypassed
4. the page tested is `/register`

## Update Workflow

```bash
docker compose -f docker-compose.redis.yml down
docker-build.bat
docker-run.bat
```

## License

See the main project license file.
