import "reflect-metadata";

import { createApp } from "./app.js";

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  await app.listen(port);
}

void bootstrap();
