# Codeworks ECS production deployment

This folder is the single-node Alibaba Cloud ECS deployment baseline for the MVP.

## Prerequisites

- Alibaba Cloud ECS with Docker Engine and Docker Compose plugin installed.
- Domain DNS A record pointing to the ECS public IP.
- ICP filing completed before mainland China public access.
- HTTPS certificate prepared as either Alibaba Cloud SSL or Let's Encrypt files.

## Configure

1. Copy the environment template and replace every placeholder:

   ```bash
   cp deploy/.env.example deploy/.env
   openssl rand -base64 48
   ```

2. Put certificate files in this layout:

   ```text
   deploy/certs/live/$SERVER_NAME/fullchain.pem
   deploy/certs/live/$SERVER_NAME/privkey.pem
   ```

3. Do not commit `deploy/.env`, `deploy/certs/`, or `deploy/backups/`.

## Start

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps
curl -fsS https://$SERVER_NAME/health
```

The app container runs `pnpm db:migrate` before starting the Nest API. Nginx serves the built React app and proxies `/api/*` plus `/health` to the API container.

## Backup

Run a one-shot PostgreSQL custom-format dump:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env --profile backup run --rm backup
ls -lh deploy/backups
```

Restore drill:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" deploy/backups/codeworks_<timestamp>.dump
```

## Operations Notes

- Secrets live only in `deploy/.env` or ECS secret management, never in git.
- For RDS migration later, replace `DATABASE_URL` and remove the local `postgres` service dependency.
- For OSS migration later, keep `STORAGE_LOCAL_ROOT` behind the storage abstraction and swap the provider config.
- Schedule backups with ECS cron, then sync `deploy/backups` to OSS if required.
