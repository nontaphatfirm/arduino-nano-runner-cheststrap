import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";

const certDir = resolve(".vite");
const keyPath = resolve(certDir, "formwings-key.pem");
const certPath = resolve(certDir, "formwings-cert.pem");
const ipPath = resolve(certDir, "formwings-cert-ip.txt");

function getLanIp() {
  if (process.env.FORMSENSE_LAN_IP) return process.env.FORMSENSE_LAN_IP;

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }

  return "127.0.0.1";
}

function ensureCertificate(lanIp) {
  const certIp = existsSync(ipPath) ? readFileSync(ipPath, "utf8").trim() : null;
  if (existsSync(keyPath) && existsSync(certPath) && certIp === lanIp) return;

  mkdirSync(dirname(keyPath), { recursive: true });

  const result = spawnSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-sha256",
    "-days",
    "365",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-subj",
    `/CN=${lanIp}`,
    "-addext",
    `subjectAltName=IP:${lanIp},DNS:localhost,IP:127.0.0.1`,
  ], { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  writeFileSync(ipPath, `${lanIp}\n`);
}

const lanIp = getLanIp();
ensureCertificate(lanIp);

console.log(`\nFormwings HTTPS dev server will be available at https://${lanIp}:5173/`);
console.log("On Android Chrome, accept the local certificate warning before connecting BLE.\n");

const vite = spawn("npx", ["vite", "--host", "0.0.0.0"], {
  stdio: "inherit",
  env: {
    ...process.env,
    FORMSENSE_HTTPS: "1",
    FORMSENSE_SSL_KEY: keyPath,
    FORMSENSE_SSL_CERT: certPath,
  },
});

vite.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
