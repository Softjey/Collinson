import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const run = (args, url) =>
  execFileSync('npx', ['prisma', ...args], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });

// TypedSQL asks a live database to infer query types, so generation needs one with the migrations applied.
if (process.env.DATABASE_URL) {
  run(['generate', '--sql'], process.env.DATABASE_URL);
} else {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  try {
    const url = container.getConnectionUri();
    run(['migrate', 'deploy'], url);
    run(['generate', '--sql'], url);
  } finally {
    await container.stop();
  }
}
