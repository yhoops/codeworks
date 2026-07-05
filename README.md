# Codeworks PSA ERP

面向软件与 IT 外包公司的多租户 SaaS ERP / PSA MVP。

当前版本围绕一条核心主线交付：客户与项目管理、Scrum 执行、资源排期、工时校正、人力成本归集、实时盈亏看板，以及可重复执行的演示数据和单机 ECS 部署基线。

完整产品规格见 [docs/superpowers/specs/2026-07-04-codeworks-psa-erp-design.md](docs/superpowers/specs/2026-07-04-codeworks-psa-erp-design.md)。

## 技术栈

- TypeScript monorepo: pnpm workspace
- API: NestJS, Prisma, PostgreSQL, JWT
- Web: React, Vite
- 测试: Vitest, Playwright
- 部署基线: Docker Compose, Nginx, PostgreSQL, Redis

## 目录结构

```text
apps/api          NestJS API
apps/web          React + Vite Web
packages/shared   共享类型与工具
prisma            Prisma schema、migration、seed
deploy            单机 ECS 生产部署基线
docs              产品规格与过程文档
issues            mission CSV 与验收 review log
tests             workspace 级结构测试
```

## 环境要求

- Node.js >= 26
- pnpm >= 11.9
- PostgreSQL 16+ 或本机 PostgreSQL CLI
- Playwright 浏览器依赖
- 生产部署另需 Docker Engine、Docker Compose plugin、域名、HTTPS 证书和阿里云 ECS 权限

本地脚本默认数据库地址：

```text
postgresql://codeworks@127.0.0.1:55432/codeworks?schema=public
```

## 本地启动

安装依赖：

```bash
pnpm install
```

启动本地 PostgreSQL：

```powershell
.\scripts\db-local.ps1 start
```

设置当前 shell 的数据库地址：

```powershell
$env:DATABASE_URL="postgresql://codeworks@127.0.0.1:55432/codeworks?schema=public"
```

应用迁移、生成 Prisma Client、写入演示数据：

```bash
pnpm db:migrate
pnpm db:generate
pnpm db:seed
```

启动 API：

```bash
pnpm --filter @codeworks/api dev
```

API 默认监听 `http://127.0.0.1:3000`。

启动 Web：

```bash
pnpm --filter @codeworks/web dev --host 127.0.0.1 --port 5173
```

Web 默认访问 `http://127.0.0.1:5173`，开发代理会把 `/api/*` 转发到 API。

## 演示账号

执行 `pnpm db:seed` 后可使用：

```text
tenantSlug: demo
email: demo.pm@codeworks.test
password: CodeworksDemo2026!
```

演示数据包含示例租户、客户、项目、Sprint、任务、员工、排期、工时、成本、预算和 PnL 快照，可支撑从项目执行到实时盈亏看板的主线演示。

## 常用脚本

```bash
pnpm build        # 生成 Prisma Client 并构建 shared/api/web
pnpm lint         # ESLint
pnpm format       # Prettier check
pnpm format:write # Prettier write
pnpm test         # workspace + unit + e2e
pnpm test:e2e     # Playwright 主线 E2E
pnpm db:generate  # prisma generate
pnpm db:migrate   # prisma migrate deploy
pnpm db:seed      # prisma db seed
```

针对 API 数据库测试或 E2E，建议显式设置 `DATABASE_URL`。

## 验收状态

MVP mission 状态源：

- [issues/2026-07-04_19-48-29-codeworks-mvp.csv](issues/2026-07-04_19-48-29-codeworks-mvp.csv)
- [issues/2026-07-04_19-48-29-codeworks-mvp.review.md](issues/2026-07-04_19-48-29-codeworks-mvp.review.md)

当前 CSV 已闭环，最终 review 结论为 `vision_met`。本地已验证的门禁包括：

- `pnpm test`
- `pnpm lint`
- `pnpm build`

注意：ECS、域名、HTTPS 证书和真实备份恢复属于外部环境验收，当前仓库只提供配置、脚本和操作文档，需在真实 ECS 环境执行。

## 生产部署

部署入口在 [deploy/README.md](deploy/README.md)。

基本流程：

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps
curl -fsS https://$SERVER_NAME/health
```

不要提交：

- `deploy/.env`
- `deploy/certs/`
- `deploy/backups/`

## 安全与边界

- 多租户隔离由应用层 tenant-aware Prisma client 与关键表 RLS 共同兜底。
- 跨租户读取、单条写入、批量写入、跨聚合关联写入均有测试覆盖。
- 员工内部成本单价与项目收入口径分离：MVP 使用项目预算作为收入，员工 `costRate` 只用于人力成本计算。
- 生产必须配置强 `JWT_SECRET`，不得使用开发默认值。
