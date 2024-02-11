#!/usr/bin/env node
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import tar from "tar";
import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import opaque from "@serenity-kit/opaque";

async function downloadTar(url) {
  const response = await fetch(url);

  if (!response.body) {
    throw new Error(`Failed to download the example: ${url}`);
  }

  return Readable.fromWeb(response.body);
}

async function downloadAndExtractRepository() {
  await pipeline(
    await downloadTar(
      "https://codeload.github.com/serenity-kit/opaque/tar.gz/main"
    ),
    tar.x({ cwd: "./tmp-opaque-repo" })
  );
}

function replaceOpaqueDependency(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    content = content.replace(/"workspace:\*"/g, '"latest"');
    fs.writeFileSync(filePath, content, "utf8");
  } catch (error) {
    console.error(`An error occurred updating ${filePath}:`, error);
    throw error;
  }
}

function replaceEnvPath(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    content = content.replace(
      /dotenv\.config\(\{ path: "\.\.\/\.\.\/\.env" \}\)/,
      "dotenv.config()"
    );
    fs.writeFileSync(filePath, content, "utf8");
  } catch (error) {
    console.error(`An error occurred updating ${filePath}:`, error);
    throw error;
  }
}

const clientOnlyExamples = [
  "client-simple-vite",
  "client-simple-webpack",
  "client-with-password-reset",
];

const serverExamples = ["server-simple", "server-with-password-reset"];

const fullstackExamples = [
  "fullstack-e2e-encrypted-locker-nextjs",
  "fullstack-simple-nextjs",
];

const validExamples = [
  ...clientOnlyExamples,
  ...serverExamples,
  ...fullstackExamples,
];

const example = process.argv[process.argv.length - 1].trim();
if (!validExamples.includes(example)) {
  console.error(
    `Invalid example name. Please provide one of the following: ${validExamples.join(
      ", "
    )}`
  );
  process.exit(1);
}

if (fs.existsSync(example)) {
  console.error(`The directory ${example} already exists.`);
  process.exit(1);
}
if (fs.existsSync(example)) {
  console.error(
    `The directory tmp-opaque-repo already exists. Please remove it before running the script`
  );
  process.exit(1);
}

fs.mkdirSync("./tmp-opaque-repo");
await downloadAndExtractRepository();
fsExtra.copySync(
  `./tmp-opaque-repo/opaque-main/examples/${example}`,
  path.join(`./${example}`)
);
replaceOpaqueDependency(path.join(`./${example}/package.json`));
fsExtra.removeSync("./tmp-opaque-repo");

if (fullstackExamples.includes(example) || serverExamples.includes(example)) {
  await opaque.ready;
  const serverSetup = opaque.server.createSetup();
  const dotEnv = `
# the opaque server setup (private server key)
OPAQUE_SERVER_SETUP=${serverSetup}

# disable filesystem persistence for in-memory db
# DISABLE_FS=true

# use redis database
# ENABLE_REDIS=true

# use a custom redis url
# REDIS_URL=redis://192.168.0.1:6379
`;

  fs.writeFileSync(path.join(`./${example}/.env`), dotEnv);
}
if (fullstackExamples.includes(example)) {
  replaceEnvPath(path.join(`./${example}/app/api/env.ts`));
}
if (serverExamples.includes(example)) {
  replaceEnvPath(path.join(`./${example}/src/server.js`));
}

console.log(
  `"${example}" has been created.\n\nPlease navigate to the "${example}" directory, install\nthe npm dependencies and run the dev command e.g.\n\n- npm install\n- npm run dev\n\nHappy hacking! 🚀`
);
