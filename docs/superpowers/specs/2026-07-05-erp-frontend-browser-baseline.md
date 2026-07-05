<!--
  浏览器基线与规范附录：记录 SPEC-01 的真实运行证据。
  本文只描述当前状态和缺陷，不修复实现；后续前端拆分和视觉修复以此作为回归基线。
  依赖：issues/2026-07-05_14-04-37-erp-frontend-fix-quality.csv。
-->

# ERP 前端浏览器基线与规范附录

日期：2026-07-05
CSV：`issues/2026-07-05_14-04-37-erp-frontend-fix-quality.csv`
环境：API `http://127.0.0.1:3101`，Web `http://127.0.0.1:5174`，PostgreSQL `127.0.0.1:55432`

## 运行证据

- 数据库：执行 `scripts/db-local.ps1 start` 后，`pnpm db:migrate`、`pnpm db:generate`、`pnpm db:seed` 无错误返回。
- API：`GET http://127.0.0.1:3101/health` 返回 `{"service":"api","status":"ok"}`。
- 登录：`POST http://127.0.0.1:3101/auth/login` 使用 demo 凭据返回 access token、refresh token、user、tenant。
- Web 单测：`pnpm --filter @codeworks/web test`，3 个测试文件、7 个测试通过。
- Playwright：使用 Chromium 对 4 路由在 1440x1024 与 390x844 两个视口截图，全部路由可访问，未发现页面 JS error 或 console error。

截图与机器报告位于：

| 路由 | 桌面截图 | 移动截图 |
| --- | --- | --- |
| 登录 `/login` | `assets/2026-07-05-erp-frontend-baseline/desktop-login.png` | `assets/2026-07-05-erp-frontend-baseline/mobile-login.png` |
| 经营中枢 `/workspace` | `assets/2026-07-05-erp-frontend-baseline/desktop-workspace.png` | `assets/2026-07-05-erp-frontend-baseline/mobile-workspace.png` |
| 项目 `/projects` | `assets/2026-07-05-erp-frontend-baseline/desktop-projects.png` | `assets/2026-07-05-erp-frontend-baseline/mobile-projects.png` |
| 盈亏 `/dashboard` | `assets/2026-07-05-erp-frontend-baseline/desktop-dashboard.png` | `assets/2026-07-05-erp-frontend-baseline/mobile-dashboard.png` |

机器结果：`assets/2026-07-05-erp-frontend-baseline/baseline-results.json`

## 布局缺陷清单

1. `FIN-01` 刷新按钮与财务面板贴边/重叠
   - 路由：`/dashboard`
   - 视口：1440x1024、390x844
   - 证据：`desktop-dashboard.png`、`mobile-dashboard.png`
   - 定位：`apps/web/src/App.tsx:500` 的 `refresh-action` 位于 `finance-canvas` 前，`apps/web/src/styles.css:253` 只设置 `justify-self`，`apps/web/src/styles.css:257` 开始的财务面板没有为按钮预留垂直间距。
   - 影响：主操作按钮压到黑色财务面板上缘，视觉层级和点击目标边界不清晰。

2. `FIN-02` 产能利用率条形图宽度可越出容器
   - 路由：`/dashboard`
   - 视口：1440x1024
   - 证据：`baseline-results.json` 中 `desktop/dashboard` 的 `visibleOffscreen[0]`，`span` 右边界为 `1469`，超过视口 `1440`。
   - 定位：`apps/web/src/App.tsx:480` 将利用率宽度上限设为 `140%`，`apps/web/src/App.tsx:538` 写入内联宽度；`apps/web/src/styles.css:296` 和 `apps/web/src/styles.css:303` 未裁剪超出部分。
   - 影响：当前截图没有横向滚动条，但可见元素几何已经越出视口，后续内容或浏览器差异可能暴露为水平溢出。

3. `BASE-01` 页面标题文本存在编码异常
   - 路由：所有路由的 HTML title
   - 视口：不限定
   - 证据：`apps/web/index.html:5` 标题当前为乱码；Playwright 报告中的 `document.title` 和 `innerText` 中文也呈现 mojibake。
   - 定位：`apps/web/index.html:5`
   - 影响：截图中文字渲染正常，但自动化文本证据、浏览器标签页标题和可访问性辅助信息不稳定。

4. `UX-01` 当前视觉方向偏“米金/黑色营销页”，未达到已批准的方向 A 明亮企业蓝工作台
   - 路由：四个路由
   - 视口：1440x1024、390x844
   - 证据：所有截图均以米色背景、金色强调、黑色按钮/面板为主。
   - 定位：`apps/web/src/styles.css:1` 的 token 与背景定义。
   - 影响：这不是可访问阻断，但与设计文档中“方向 A：明亮企业蓝、ERP 企业工作台、tabular 数字、语义状态色”的后续目标不一致，应在 SPEC-05 修复。

## Context7 附录

### Playwright `/microsoft/playwright`

- 对浏览器基线应使用确定性 viewport。Context7 指出 browser context 的 `viewport` 默认会模拟固定尺寸；设为 `null` 会依赖宿主窗口，导致测试不确定。
- `page.setViewportSize()` 应在导航前调用；本次直接用 `browser.newContext({ viewport })`，符合桌面/移动双视口基线需要。
- 截图可用 `page.screenshot({ path })` 产出文件；本次每个路由和视口都落盘。
- 需要深度排查时可启用 context tracing，记录截图、DOM snapshot 和网络活动；本次 SPEC-01 没有发现阻断性运行错误，未额外保存 trace。

### React `/reactjs/react.dev`

- 状态应靠近使用它的组件，复杂状态逻辑可抽到 reducer 或自定义 hook；后续 SPEC-03 拆 `useSession`、`useWorkspace`、`useDashboard` 与此一致。
- 表单输入使用受控组件模式，`value` 与 `onChange` 同步；当前登录表单、工时和排期输入已经是受控输入。
- 不需要 effect 的派生逻辑应避免放进 effect；路由、数据加载和事件处理拆分时应保持 effect 只处理外部同步。
- React 19 可用 `useEffectEvent` 读取 effect 内的非响应式值，避免不必要重连或重复请求；后续 hooks 拆分时只在确有这类需求时引入。

### NestJS `/nestjs/docs.nestjs.com`

- Controller 负责路由、参数、请求体绑定，业务逻辑应委派给 provider/service；后续 SPEC-08 将 DTO 与控制器拆分，目标是让控制器保持薄路由层。
- Provider 通过模块注册和依赖注入复用，适合承载认证、Sprint、工时、排期、PnL 等业务服务。
- ValidationPipe 可通过 `APP_PIPE` 注册为全局 pipe 并保留 DI 能力；后续 DTO 抽出时应避免绕过现有校验边界。
- 测试应通过 `@nestjs/testing` 组装 testing module，验证 controller/service 边界；后端拆分任务应继续跑对应 Vitest/Nest 测试。

### Prisma `/prisma/prisma/6.19.2`

- schema 或 client 配置变化后应重新运行 `prisma generate`；本次基线启动前已执行 `pnpm db:generate`。
- Prisma Client query extension 回调可接收 `model`、`operation`、`args`、`query`，适合在租户过滤与软删过滤中包装查询参数。
- `$allModels` 等 extensions 可在 `$transaction` callback 中保留扩展方法；后续 SPEC-10 拆分 tenant-aware client 时要保持 transaction 行为不变。
- Query extension 可包装返回结果，例如敏感字段脱敏；租户隔离相关扩展应保持只做过滤/守卫，不引入与本阶段无关的语义重构。

## MCP 说明

- `playwright`：已通过本地 `@playwright/test` 的 Chromium 实际运行并产出 8 张截图与 JSON 报告。
- `chrome-devtools`：当前工具列表未提供 chrome-devtools MCP 命名空间；本次以 Playwright Chromium、截图、DOM 几何检查和人工截图复核作为替代证据。
