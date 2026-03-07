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

### Windows (PowerShell)

```powershell
# Navigate to project root
cd C:\path\to\ResumeConverter

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

### Windows (PowerShell)

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

All data is automatically persisted via Docker volumes:

| Volume/Path | Container Path | Purpose |
|-------------|----------------|---------|
| `resumeconverter-pgdata` | `/var/lib/postgresql/18/main` | PostgreSQL 18 database |
| `./uploads` | `/app/uploads` | Uploaded resume files |
| `./logs` | `/app/logs` | Application logs |

✅ **PostgreSQL data is persistent**: Data is stored in a named Docker volume `resumeconverter-pgdata`. Your data is preserved even if the container is deleted and recreated.

### Managing PostgreSQL Volume

```bash
# List Docker volumes
docker volume ls

# Inspect the data volume
docker volume inspect resumeconverter-pgdata

# Backup database
docker exec resumeconverter-app pg_dump -U resumeconverter resumeconverter > backup.sql

# Restore database
docker exec -i resumeconverter-app psql -U resumeconverter resumeconverter < backup.sql

# ⚠️ Delete volume (DATA LOSS!)
docker volume rm resumeconverter-pgdata
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

## 🐛 Troubleshooting

### Container won't start

```bash
# Check logs
docker logs resumeconverter-app

# Check if port is in use
netstat -an | grep 3443
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
docker exec resumeconverter-app cat /var/log/supervisor/pdf-server.err.log
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
