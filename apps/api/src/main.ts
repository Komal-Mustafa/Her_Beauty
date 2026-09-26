import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap';

const app = await createApp();
const port = Number(process.env.API_PORT ?? 4000);
await app.listen(port);
new Logger('Bootstrap').log(`Her Beauty API listening on http://localhost:${port}/v1`);
