/**
 * health 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a healthy payload", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "api"
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });
});
