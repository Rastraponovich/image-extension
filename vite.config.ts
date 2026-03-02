import { readFileSync } from "fs";
import path from "path";
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, "src/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

export default defineConfig({
  plugins: [crx({ manifest })],
});
