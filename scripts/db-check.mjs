import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const url = env.match(/DATABASE_URL="([^"]+)"/)[1];

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
console.log("TABLES:");
for (const row of rows) console.log(" -", row.table_name);

const counts = await client.query(`SELECT
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "SupplierGroup") AS groups,
  (SELECT count(*) FROM "Category") AS categories,
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "PriceOption") AS options,
  (SELECT count(*) FROM "PriceHistory") AS history`);
console.log("COUNTS:", counts.rows[0]);
await client.end();
