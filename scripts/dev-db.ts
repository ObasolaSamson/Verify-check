import { existsSync } from "fs";
import path from "path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = path.resolve(process.cwd(), ".data/postgres");
const fresh = !existsSync(path.join(databaseDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir,
  port: 54329,
  user: "titlecheck",
  password: "titlecheck",
  persistent: true,
  onLog: () => {},
});

async function main() {
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("titlecheck");
  console.info("Postgres is listening on 127.0.0.1:54329 (database titlecheck). Ctrl+C stops it.");
}

async function shutdown() {
  await pg.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  console.error(error);
  await pg.stop().catch(() => {});
  process.exit(1);
});
