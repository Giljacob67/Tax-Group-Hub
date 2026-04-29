import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function importTransformedTs(relativePath, cacheKey) {
  const absolutePath = path.resolve(rootDir, relativePath);
  const source = await readFile(absolutePath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      sourceMap: false,
      inlineSourceMap: false,
      importHelpers: false,
      esModuleInterop: false,
      allowSyntheticDefaultImports: true,
      verbatimModuleSyntax: true,
    },
    fileName: absolutePath,
  });

  const url = `data:text/javascript;base64,${Buffer.from(result.outputText, "utf8").toString("base64")}`;
  return import(`${url}#${cacheKey}`);
}

async function testCrypto() {
  const snapshot = {
    NODE_ENV: process.env.NODE_ENV,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  };

  try {
    process.env.NODE_ENV = "test";
    delete process.env.ENCRYPTION_KEY;

    const devCrypto = await importTransformedTs("src/lib/crypto.ts", "dev");
    assert.equal(devCrypto.encrypt("plain-text"), "plain-text");
    assert.equal(devCrypto.decrypt("plain-text"), "plain-text");

    process.env.NODE_ENV = "production";
    delete process.env.ENCRYPTION_KEY;

    const prodCrypto = await importTransformedTs("src/lib/crypto.ts", "prod");
    assert.throws(() => prodCrypto.encrypt("secret"), /ENCRYPTION_KEY is required in production/);

    console.log("crypto: ok");
  } finally {
    process.env.NODE_ENV = snapshot.NODE_ENV;
    if (snapshot.ENCRYPTION_KEY === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = snapshot.ENCRYPTION_KEY;
    }
  }
}

async function testOutboundUrl() {
  const snapshot = {
    ALLOW_PRIVATE_OLLAMA: process.env.ALLOW_PRIVATE_OLLAMA,
  };

  try {
    delete process.env.ALLOW_PRIVATE_OLLAMA;
    const mod = await importTransformedTs("src/lib/outbound-url.ts", "base");
    assert.equal(mod.normalizeServiceUrl("https://api.example.com/"), "https://api.example.com");
    assert.throws(
      () =>
        mod.normalizeServiceUrl("http://127.0.0.1:11434", {
          allowPrivateEnvVar: "ALLOW_PRIVATE_OLLAMA",
          label: "URL do Ollama",
        }),
      /Seguranca: URLs de rede privada\/local nao sao permitidas/,
    );

    process.env.ALLOW_PRIVATE_OLLAMA = "true";
    const overrideMod = await importTransformedTs("src/lib/outbound-url.ts", "override");
    assert.equal(
      overrideMod.normalizeServiceUrl("http://127.0.0.1:11434/", {
        allowPrivateEnvVar: "ALLOW_PRIVATE_OLLAMA",
        label: "URL do Ollama",
      }),
      "http://127.0.0.1:11434",
    );

    console.log("outbound-url: ok");
  } finally {
    if (snapshot.ALLOW_PRIVATE_OLLAMA === undefined) {
      delete process.env.ALLOW_PRIVATE_OLLAMA;
    } else {
      process.env.ALLOW_PRIVATE_OLLAMA = snapshot.ALLOW_PRIVATE_OLLAMA;
    }
  }
}

await testCrypto();
await testOutboundUrl();
console.log("api-server tests passed");
