import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3333);

const app = createApp();

app.listen(port, () => {
  console.log(`MingalBank API ouvindo em http://localhost:${port}/api/v1`);
});
