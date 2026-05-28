import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";

const https =
  process.env.FORMSENSE_HTTPS === "1"
    ? {
        key: fs.readFileSync(process.env.FORMSENSE_SSL_KEY),
        cert: fs.readFileSync(process.env.FORMSENSE_SSL_CERT),
      }
    : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, https },
});
