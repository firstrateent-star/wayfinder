import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), "src");
const forbidden = [
  /supabase\s*\.\s*from\s*\(/,
  /\.from\s*\(\s*["'`]wf_/,
  /\.schema\s*\(\s*["'`]wf_/
];

const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    const source = fs.readFileSync(absolute, "utf8");
    forbidden.forEach((pattern) => {
      if (pattern.test(source)) failures.push(`${path.relative(process.cwd(), absolute)} matched ${pattern}`);
    });
  }
}

walk(root);

if (failures.length) {
  console.error("Wayfinder frontend boundary violation:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Wayfinder frontend boundary check: PASS");
