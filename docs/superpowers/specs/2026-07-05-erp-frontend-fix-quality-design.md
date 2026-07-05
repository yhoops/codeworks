<!--
  设计文档 · ERP 前端修复 + 代码质量收敛（下一阶段）
  记录经 brainstorming 确认的范围、阶段划分、前端视觉基线（方向 A）、后端与 prisma 拆分策略、
  文件规范与验证门禁。作为后续 writing-plans 生成实施计划的唯一依据。
  日期：2026-07-05 · 状态：待用户复核
-->

# ERP 前端修复 + 代码质量收敛设计

**日期**：2026-07-05
**上游规格**：[2026-07-04-codeworks-psa-erp-design.md](2026-07-04-codeworks-psa-erp-design.md)
**目标读者**：实现者（Claude / Codex）与复核者

## 1. 背景与目标

MVP 已闭环（mission `vision_met`，`pnpm test/lint/build` 绿）。但存在两类欠账：

1. **前端未经浏览器验证**：此前未装 Playwright，前端仅有单元测试，实际布局在真实浏览器下有缺陷；且整个前端集中在单文件 `App.tsx`（601 行）。
2. **代码质量约定未落地**：新约定要求每个源文件 ≤300 行、顶部带多行职责注释；当前有 7 个文件超标。

本阶段目标（**不做新业务功能**）：

- 修复前端真实布局缺陷，并做**适度视觉提质**，落地 ERP 企业工作台设计语言（方向 A）。
- 将所有超 300 行文件按关注点拆分至达标。
- 全仓库源文件补齐多行头注释。
- 写码前用 **Context7** 校准各库当前规范。
- 每阶段维持 `lint/build/test`（前端另加 e2e）全绿，独立可提交。

### 非目标（YAGNI）

- 不新增业务模块或页面路由（保留现有 4 路由：登录 / 经营中枢 / 项目 / 盈亏）。
- 不改变信息架构与后端行为（纯物理搬迁 + 视觉，不做语义级重构 / 去重）。
- 不引入重型 UI 框架或状态库；沿用 React + Vite + 手写轻量结构。

## 2. 现状盘点

**前端**（`apps/web/src/`）：`App.tsx` 601、`styles.css` 473、`api-client.ts` 264、`main.tsx` 16，外加三份 `*.spec.tsx`。单个 `App()` 函数内聚合了全部 state、路由 effect、业务 handler（login/verifySession/moveTask/correctTime/scheduleAllocation/loadDashboard 等）与 4 个内联路由视图 + `ShellRail`。

**超 300 行文件**：

| 文件 | 行数 | 阶段 |
| --- | --- | --- |
| `apps/api/src/platform/database/prisma.client.ts` | 2581 | P3 |
| `apps/web/src/App.tsx` | 601 | P1 |
| `apps/api/test/tenant-prisma.spec.ts` | 552 | P3 |
| `prisma/seed.ts` | 523 | P2 |
| `apps/api/src/modules/iam/auth/auth.service.ts` | 366 | P2 |
| `apps/api/src/modules/projects/sprint.service.ts` | 347 | P2 |
| `apps/api/src/modules/core/core-workflow.controller.ts` | 325 | P2 |

## 3. 阶段结构与顺序

策略：**前端优先 → 质量收敛**。最高价值、用户可见的前端最早落地；风险最高的 `prisma.client.ts` 拆分隔离到后期，有 552 行租户测试兜底。每阶段结束 `lint/build/test`（前端另加 e2e）必须绿，形成一个干净逻辑提交。

| 阶段 | 内容 | 产出提交 |
| --- | --- | --- |
| **P0 侦察与基线** | Context7 拉 React/NestJS/Prisma/Playwright 规范要点成附录；起 API+Web，用 Playwright 驱动 Chrome 对 4 路由在桌面(1440)+移动(390)两档截图，编目实际布局缺陷 | `📃 docs` 基线缺陷清单 |
| **P1 前端拆分+修复+提质** | 拆 `App.tsx`→页面/组件/hooks；落地方向 A 视觉基线；修 P0 编目缺陷；适配单元测试；Playwright 逐页回归+截图 | `🦄 refactor(web)` + `🐞 fix(web)` |
| **P2 后端业务代码拆分** | 拆 `auth.service`/`sprint.service`/`core-workflow.controller`/`seed`；补头注释 | `🦄 refactor(api)` |
| **P3 prisma.client 拆分** | 拆 `prisma.client.ts`→过滤器/守卫/系统客户端/按域扩展/薄组合；客户端拆完后再按用例拆 552 行 `tenant-prisma.spec.ts`；租户测试全程兜底 | `🦄 refactor(db)` |
| **P4 全仓头注释扫尾 + 验收** | 剩余源文件补头注释；全量门禁 + e2e；更新 review log | `📃 docs` + `🧪 test` |

## 4. 前端设计（P1）

### 4.1 目标结构（每文件 ≤300 行 + 头注释）

```text
apps/web/src/
  main.tsx                      入口（保留）
  App.tsx                       仅 session 判定 + 路由装配（~80 行）
  api/
    types.ts                    AuthSession/CoreWorkspace/DashboardData/BoardColumn 等类型
    client.ts                   createApiClient + session 存取（persist/read/clear）
  hooks/
    useSession.ts               session 状态 + persist/clear + relogin 跳转
    useWorkspace.ts             /projects 数据加载 + moveTask/correctTime/scheduleAllocation
    useDashboard.ts             /dashboard 数据加载 + 刷新
  pages/
    LoginPage.tsx               登录合成页（唯一带品牌感界面）
    WorkspacePage.tsx           经营中枢
    ProjectsPage.tsx            项目作战台（看板 + 工时 + 排期）
    DashboardPage.tsx           实时盈亏
  components/
    AppShell.tsx                左栏导航 + 顶栏外壳，内容渲染进 outlet
    ShellRail.tsx               主导航栏
    Board.tsx                   Scrum 看板列 + 拖拽卡
    MetricRow.tsx / BulletChart.tsx  盈亏页图元
  styles/
    tokens.css                  CSS 变量（色板/字体/间距/阴影/圆角）
    layout.css                  外壳与栅格
    components.css              组件级样式
```

**职责边界**：`App.tsx` 只做「session gate → 路由 → 渲染 page」；page 只负责视图与事件绑定；数据与业务动作收进 hooks；外壳（左栏+顶栏）由 `AppShell` 统一承载，page 渲染进内容区而非各自 `<main>`。每个单元可独立理解与测试。

### 4.2 视觉基线 —— 方向 A「Clarity · 明亮企业蓝」

企业工作台设计语言（非营销页；我的落地页硬规则对生产力应用豁免）：

- **持久应用外壳**：左栏（240px，品牌 + 模块导航 + 用户）+ 顶栏（面包屑 + 搜索 + 租户 chip + 通知 + 头像）。内容区在外壳内切换。
- **信息密度优先**：数据表格 + KPI 卡 + 行内状态 chip；**数字用 tabular-nums / 等宽**对齐。
- **卡片在 ERP 合法**：作为指标面板 / 数据容器 / 交互容器使用（与落地页"禁卡片"相反）。
- **色板（tokens.css）**：中性白/浅灰表面 + 专业蓝主色 `#1E40AF` + 语义色（健康绿 / 关注橙 / 超预算红）。避免紫底白字。预留暗色扩展位。
- **字体**：IBM Plex Sans 界面字 + IBM Plex Mono 数字。不用表达性 display 字体（那是营销需求）。
- **动效**：仅路由切换、数据加载骨架、状态变更等功能性过渡（150–300ms），尊重 `prefers-reduced-motion`。
- **无障碍**：文本对比 ≥4.5:1；图标按钮 `aria-label`；可见 focus；`label[for]`；纯 SVG 图标不用 emoji。

方向 A 的静态基线见 `.tmp/mockups/a-clarity.html`（选型产物，非产品代码；P1 将其设计语言迁移进真实组件与 `tokens.css`）。

### 4.3 前端验证

- 现有 `App.spec.tsx` / `CorePages.spec.tsx` / `Dashboard.spec.tsx` 随拆分同步适配，保持绿。
- Playwright 驱动 Chrome 逐页跑桌面(1440×1024)+移动(390×844)截图，对照 P0 基线确认缺陷消除、无新回归。

## 5. 后端业务代码拆分（P2）

原则：**按关注点提取纯函数 / DTO，不改行为**，靠现有单元 + e2e 测试兜底。

| 文件 | 拆分方式 |
| --- | --- |
| `auth.service.ts` (366) | 认证编排留 service；抽 `token.util.ts`（JWT 签发/校验）、`password.util.ts`（哈希/校验）、`session.util.ts`（会话组装） |
| `sprint.service.ts` (347) | Sprint 生命周期留 `sprint.service`；看板/任务流转抽到 `board.service.ts` 或 `task-board.util.ts` |
| `core-workflow.controller.ts` (325) | 入参 DTO/类型抽到 `core-workflow.dto.ts`；控制器只留路由与委派 |
| `prisma/seed.ts` (523) | 拆成 `prisma/seed/` 下按域模块（tenant/crm/projects/resourcing/costing/pnl）+ `seed/index.ts` 编排入口 |

> 具体函数归属在 writing-plans 阶段结合源码定稿；本设计确定拆分方向与边界。

## 6. `prisma.client.ts` 拆分（P3，最高风险）

现状构成：过滤器助手（`applyNotDeleted` / `applyTenantOnlyFilter` / 软删过滤 + `ForbiddenTenantAccessError`）+ 逐模型批量租户守卫 + `createSystemPrismaClient` + `createPrismaClient`（逐模型 `$extends` query 钩子）。

目标结构：

```text
apps/api/src/platform/database/
  tenant-filters.ts        过滤器助手 + ForbiddenTenantAccessError
  tenant-guards.ts         逐模型批量租户校验助手（verifyXxxTenant）
  system-prisma.client.ts  createSystemPrismaClient
  extensions/
    crm.extension.ts       customer / contact
    projects.extension.ts  project / milestone / sprint / task
    resourcing.extension.ts employee / skill / capacity / allocation
    costing.extension.ts   budget / cost / pnl / timeEntry / attachment
  prisma.client.ts         组合扩展导出 createPrismaClient（薄）
```

**保行为手段**：每抽出一组即跑 `apps/api/test/tenant-prisma.spec.ts`（552 行租户隔离）+ 相关 e2e，全绿才继续。**只做物理搬迁 + 头注释**，不做「工厂函数合并重复」等语义级重构；若搬迁后测试仍绿且有明显安全的去重机会，另行单独评估，不纳入本阶段默认范围。

`createPrismaClient` 拆分并全绿后，再把这份 552 行测试自身按用例拆分（跨租户读 / 单条写 / 批量写 / 跨聚合关联写等分组文件），拆分过程保持每组测试可运行且绿。

## 7. 规范、Context7 与验证门禁

### 7.1 文件头注释规范（全仓统一）

```ts
/**
 * <模块职责一句话>
 * <关键设计/边界/依赖，2-4 行；为什么这样组织>
 * 依赖：<上游> · 被用于：<下游>
 */
```

- 每源文件 ≤300 行。例外：生成物（Prisma Client 输出）、lock 文件、纯数据快照。
- P4 对剩余未触碰的源文件统一补齐头注释。

### 7.2 Context7 用法

每阶段动手前拉对应库当前规范要点，落成设计文档附录，避免凭记忆写过时用法：

- P0：Playwright 截图 / 断言 / viewport API
- P1：React 19 组件与 hooks 模式、Vite
- P2：NestJS provider / controller / DTO
- P3：Prisma `$extends` client extensions（query 钩子）

### 7.3 验证门禁

- 每阶段 + 收尾：`pnpm lint`、`pnpm build`、`pnpm test` 全绿。
- 前端阶段另跑 `pnpm test:e2e` + Playwright 桌面/移动逐页截图作为回归证据。
- P4 收尾更新 `issues/*.review.md`，如实记录门禁证据。
- 不虚构命令 / 退出码 / 结果；缺证据不声称"通过"。

### 7.4 提交约定

每阶段一个逻辑提交，遵循仓库 emoji 约定（`🦄 refactor` / `🐞 fix` / `📃 docs` / `🧪 test`），正文含 `Why` / `Why this works` / `Remaining`。

## 8. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| `prisma.client.ts` 拆分破坏租户隔离 | 分组小步搬迁，每步跑 552 行租户测试 + e2e；隔离在 P3、仅物理搬迁 |
| 前端拆分引入回归 | 同步适配单元测试；Playwright 逐页截图对照 P0 基线 |
| 视觉提质偏离 ERP 语言 | 以已选定方向 A + tokens 为唯一基线；保留信息架构与 4 路由 |
| 头注释流于形式 | 统一模板，要求写"为什么这样组织"而非复述代码 |

## 9. 验收标准

- 全仓无 >300 行源文件（除既定例外）。
- 全仓源文件均有符合模板的头注释。
- 前端 4 路由在桌面 + 移动下布局正确，Playwright 截图为证；单元 + e2e 绿。
- 方向 A 视觉基线在真实组件中落地（外壳 / 色板 tokens / tabular 数字 / 语义状态）。
- `pnpm lint/build/test` + `pnpm test:e2e` 全绿；review log 更新。
