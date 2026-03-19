# ResumeConverter - Docker Deployment

## 🐳 Overview

This Docker setup creates a **single, fully autonomous container** that includes:

- **PostgreSQL 18** - Database server
- **Node.js 20** - Runtime environment
- **Google Chrome** - For PDF generation (Puppeteer)
- **Proxy Server** (port 3443 HTTPS) - Main application server
- **PDF Server** (port 3002) - PDF generation service
- **Frontend** - Pre-built React application

## 📋 Prerequisites

- Docker installed and running
- (Optional) OpenAI API key for AI features
- (Optional) Anthropic API key for Claude integration

## 🚀 Quick Start

> **Important**: The active development branch is `develop`. After cloning, run `git checkout develop`.

### Windows - .bat scripts (recommended)

Simple batch scripts are available at the project root:

```batch
git clone https://github.com/votre-repo/ResumeConverter.git
cd ResumeConverter
git checkout develop

docker-build.bat   # Build the Docker image
docker-run.bat     # Start the container (⚠️ requires Administrator terminal)
```

> ⚠️ **Administrator terminal required**: `docker-run.bat` automatically configures a port forwarding rule (`netsh interface portproxy`) for external access via Cloudflare (port 443 → localhost:3443). This `netsh` command requires Administrator privileges.
>
> **To open an Administrator terminal:**
> - Right-click **CMD** or **PowerShell** → **Run as administrator**
> - Or: Windows key → type `cmd` → `Ctrl+Shift+Enter`
>
> If run without admin rights, the container will start normally but port forwarding for external access (internet/Cloudflare) will not be configured. Local access via `https://localhost:3443` will work regardless.

### Windows (PowerShell - advanced)

```powershell
# Navigate to project root
cd C:\path\to\ResumeConverter
git checkout develop

# Build and run
.\docker\docker-build.ps1 -Run

# Or step by step:
.\docker\docker-build.ps1 -Build
.\docker\docker-build.ps1 -Run
```

### Linux/Mac

```bash
# Navigate to project root
cd /path/to/ResumeConverter
git checkout develop

# Make script executable
chmod +x docker/docker-build.sh

# Build and run
./docker/docker-build.sh run

# Or step by step:
./docker/docker-build.sh build
./docker/docker-build.sh run
```

## 🔑 Default Credentials

After starting the container:

- **URL**: https://localhost:3443
- **Email**: `admin@resumeconverter.local`
- **Password**: `admin123`

⚠️ **Change these credentials immediately in production!**

## 📝 Available Commands

### Windows - .bat scripts (simple)

| Script | Description |
|--------|-------------|
| `docker-build.bat` | Build the Docker image |
| `docker-run.bat` | Start the container (⚠️ Admin terminal) |
| `docker-stop.bat` | Stop and remove the container |
| `docker-logs.bat` | View logs in real-time |
| `docker-shell.bat` | Open a shell in the container |

### Windows (PowerShell - advanced)

| Command | Description |
|---------|-------------|
| `.\docker\docker-build.ps1 -Build` | Build the Docker image |
| `.\docker\docker-build.ps1 -Run` | Start the container |
| `.\docker\docker-build.ps1 -Stop` | Stop the container |
| `.\docker\docker-build.ps1 -Logs` | View container logs |
| `.\docker\docker-build.ps1 -Shell` | Open bash shell in container |
| `.\docker\docker-build.ps1 -Clean` | Remove container and image |

### Linux/Mac

| Command | Description |
|---------|-------------|
| `./docker/docker-build.sh build` | Build the Docker image |
| `./docker/docker-build.sh run` | Start the container |
| `./docker/docker-build.sh stop` | Stop the container |
| `./docker/docker-build.sh logs` | View container logs |
| `./docker/docker-build.sh shell` | Open bash shell in container |
| `./docker/docker-build.sh clean` | Remove container and image |

## 🔧 Configuration

### Environment Variables

Pass API keys when running:

```powershell
# Windows
$env:OPENAI_API_KEY = "sk-..."
$env:ANTHROPIC_API_KEY = "sk-ant-..."
.\docker\docker-build.ps1 -Run
```

```bash
# Linux/Mac
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
./docker/docker-build.sh run
```

### Manual Docker Run

For more control, run Docker directly:

```bash
docker run -d \
    --name resumeconverter-app \
    -p 3443:3443 \
    -p 5433:5432 \
    -e OPENAI_API_KEY="your-key" \
    -e ANTHROPIC_API_KEY="your-key" \
    -e JWT_SECRET="your-secret-min-32-chars" \
    -e REFRESH_TOKEN_SECRET="your-refresh-secret-min-32-chars" \
    -v ./uploads:/app/uploads \
    -v ./logs:/app/logs \
    --restart unless-stopped \
    resumeconverter:latest
```

## 📁 Persistent Data

All data is automatically persisted in **local directories** (not Docker volumes):

| Local Path | Container Path | Purpose |
|------------|----------------|---------|
| `./data/postgresql` | `/var/lib/postgresql/18/main` | PostgreSQL 18 database |
| `./uploads` | `/app/uploads` | Uploaded resume files |
| `./logs` | `/app/logs` | Application logs |

✅ **PostgreSQL data is persistent**: Data is stored in `./data/postgresql/` directory. Your data is preserved even if:
- The container is deleted and recreated
- The Docker image is rebuilt
- Docker is restarted

### Connecting to PostgreSQL

#### From inside the container (shell)

```bash
# Open a shell in the container
docker exec -it resumeconverter-app bash

# Connect to PostgreSQL
psql -U resumeconverter -d resumeconverter
```

#### Direct psql connection (one command)

```bash
# Windows (PowerShell/CMD)
docker exec -it resumeconverter-app psql -U resumeconverter -d resumeconverter

# Linux/Mac
docker exec -it resumeconverter-app psql -U resumeconverter -d resumeconverter
```

#### From host machine (external connection)

PostgreSQL is exposed on port **5433** (to avoid conflicts with local PostgreSQL):

```bash
# Using psql client installed on host
psql -h localhost -p 5433 -U resumeconverter -d resumeconverter
# Password: see POSTGRES_PASSWORD in Dockerfile

# Using pgAdmin or DBeaver
# Host: localhost
# Port: 5433
# Database: resumeconverter
# User: resumeconverter
# Password: see POSTGRES_PASSWORD in Dockerfile
```

#### Common SQL commands

```sql
-- List all tables
\dt

-- Describe a table
\d users

-- Count records
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM resumes;

-- View current connections
SELECT * FROM pg_stat_activity;

-- Exit psql
\q
```

### Managing PostgreSQL Data

```bash
# Backup database
docker exec resumeconverter-app pg_dump -U resumeconverter resumeconverter > backup.sql

# Restore database
docker exec -i resumeconverter-app psql -U resumeconverter resumeconverter < backup.sql

# View data directory size (Linux/Mac)
du -sh ./data/postgresql

# View data directory size (Windows PowerShell)
(Get-ChildItem -Recurse ./data/postgresql | Measure-Object -Property Length -Sum).Sum / 1MB

# ⚠️ Delete data (DATA LOSS!) - Linux/Mac
rm -rf ./data/postgresql

# ⚠️ Delete data (DATA LOSS!) - Windows
rmdir /s /q data\postgresql
```

### Migrating from Docker Volume

If you previously used a Docker volume (`resumeconverter-pgdata`), you can migrate:

```bash
# 1. Stop container
docker stop resumeconverter-app

# 2. Copy data from volume to local directory
docker run --rm -v resumeconverter-pgdata:/source -v $(pwd)/data/postgresql:/dest alpine cp -a /source/. /dest/

# 3. Remove old volume (optional)
docker volume rm resumeconverter-pgdata

# 4. Restart with new local mount
docker-run.bat  # or ./docker/docker-build.sh run
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Container                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  Supervisor                      │   │
│  │  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │ Proxy Server │  │  PDF Server  │            │   │
│  │  │   :3443      │  │    :3002     │            │   │
│  │  └──────────────┘  └──────────────┘            │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              PostgreSQL :5432                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                    Port 3443 (HTTPS) exposed
                           │
                    ┌──────▼──────┐
                    │   Browser   │
                    └─────────────┘
```

## 🔒 Security Notes

1. **Change default credentials** after first login
2. **Use strong JWT secrets** in production (auto-generated by scripts)
3. **API keys** are passed as environment variables (not stored in image)
4. **HTTPS** should be configured via reverse proxy (nginx, traefik) in production

## � Viewing Logs

The container runs two services via Supervisor. Use these scripts to view logs:

### Quick Scripts (from project root)

| Script | Description |
|--------|-------------|
| `docker-logs.bat` | View **Proxy Server** logs (main backend) |
| `docker-logs-pdf.bat` | View **PDF Server** logs |

### Manual Log Commands

```bash
# Proxy Server logs (main application)
docker exec -it resumeconverter-app tail -f /var/log/supervisor/proxy-server.out.log /var/log/supervisor/proxy-server.err.log

# PDF Server logs
docker exec -it resumeconverter-app tail -f /var/log/supervisor/pdf-server.out.log /var/log/supervisor/pdf-server.err.log

# Supervisor logs (service manager)
docker exec -it resumeconverter-app tail -f /var/log/supervisor/supervisord.log

# All container output (less detailed)
docker logs -f resumeconverter-app
```

### Log File Locations (inside container)

| Log File | Purpose |
|----------|---------|
| `/var/log/supervisor/proxy-server.out.log` | Proxy server stdout |
| `/var/log/supervisor/proxy-server.err.log` | Proxy server stderr |
| `/var/log/supervisor/pdf-server.out.log` | PDF server stdout |
| `/var/log/supervisor/pdf-server.err.log` | PDF server stderr |
| `/var/log/supervisor/supervisord.log` | Supervisor manager |

## �🐛 Troubleshooting

### Container won't start

```bash
# Check container logs
docker logs resumeconverter-app

# Check if port is in use
netstat -an | grep 3443
```

### Application errors

```bash
# View proxy server logs (main backend)
docker exec -it resumeconverter-app tail -100 /var/log/supervisor/proxy-server.err.log

# Or use the quick script
docker-logs.bat
```

### Database issues

```bash
# Access container shell
docker exec -it resumeconverter-app /bin/bash

# Check PostgreSQL status
service postgresql status

# Access PostgreSQL
psql -U resumeconverter -d resumeconverter
```

### PDF generation fails

```bash
# Check if Google Chrome is working
docker exec -it resumeconverter-app google-chrome-stable --version

# Check PDF server logs
docker exec -it resumeconverter-app tail -100 /var/log/supervisor/pdf-server.err.log

# Or use the quick script
docker-logs-pdf.bat
```

## 📊 Resource Requirements

- **Disk**: ~2GB for image
- **RAM**: Minimum 2GB, recommended 4GB
- **CPU**: 2+ cores recommended

## 🔄 Updating

```bash
# Stop current container
./docker/docker-build.sh stop

# Rebuild with latest code
./docker/docker-build.sh build

# Start new container
./docker/docker-build.sh run
```

## 📜 License

See main project LICENSE file.
