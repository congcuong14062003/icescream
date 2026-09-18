import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listJavaScriptFiles(path);
      return entry.name.endsWith(".js") ? [path] : [];
    }),
  );
  return nested.flat();
}

const files = [
  ...(await listJavaScriptFiles(fileURLToPath(new URL("../src", import.meta.url)))),
  ...(await listJavaScriptFiles(fileURLToPath(new URL("../prisma", import.meta.url)))),
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Đã kiểm tra cú pháp ${files.length} tệp JavaScript.`);



