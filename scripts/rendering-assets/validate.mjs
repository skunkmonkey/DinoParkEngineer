import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectPng, validateRuntimeBundle } from "../../src/rendering-assets/public.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const bundle = JSON.parse(await readFile(resolve(root, "public/assets/mvp-park/atlas.json"), "utf8"));
const layout = JSON.parse(await readFile(resolve(root, "assets/manifests/fixture-layout.json"), "utf8"));
const atlasBytes = await readFile(resolve(root, "public/assets/mvp-park/atlas.png")); const png = inspectPng(atlasBytes);
if (png === undefined || !png.hasAlpha || png.width !== bundle.atlas.width || png.height !== bundle.atlas.height) throw new Error("Runtime atlas PNG dimensions or alpha do not match the manifest.");
const validation = validateRuntimeBundle(bundle, { production: true, expectedAssetIds: layout.assets.map((asset) => asset.assetId), expectedSourceHash: layout.sourceHash });
if (!validation.ok) throw new Error(JSON.stringify(validation.diagnostics));
const publicFiles = await readdir(resolve(root, "public/assets/mvp-park"));
if (publicFiles.some((name) => !["atlas.json", "atlas.png", "platform-comparison.json"].includes(name))) throw new Error("Runtime asset directory contains orphaned output.");
const shippedText = `${await readFile(resolve(root, "public/assets/mvp-park/atlas.json"), "utf8")}\n${await readFile(resolve(root, "public/assets/mvp-park/platform-comparison.json"), "utf8")}`;
if (/(?:openai|prompt|api[-_]?key|authorization|bearer|secret|token)/iu.test(shippedText)) throw new Error("Runtime bundle exposes generation tooling, prompts, or secret-bearing fields.");
console.log(`Validated production runtime atlas with ${bundle.assets.length} exact assets and no placeholders, orphans, generation metadata, or secrets.`);
