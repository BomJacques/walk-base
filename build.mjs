// Builds WalkBase.html, the whole app in one file with no server, no network and no book content.
// Usage: node walkbase/build.mjs [folder whose node_modules holds esbuild]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeDir = process.argv[2] ?? process.env.ESBUILD_DIR ?? here;
const esbuild = createRequire(path.join(nodeDir, 'x.js'))('esbuild');

const js = (await esbuild.build({
  entryPoints: [path.join(here, 'src/app.js')], bundle: true, format: 'esm', target: 'es2022', minify: true, write: false, logLevel: 'warning',
})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const css = fs.readFileSync(path.join(here, 'src/app.css'), 'utf8');
const icon = fs.readFileSync(path.join(here, 'icons/icon-180.png')).toString('base64');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Walk Base</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="An adjustable 2D side-view walk to trace over. Runs on this device, with no network.">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#f4f1e9">
<link rel="icon" href="data:image/png;base64,${icon}">
<link rel="apple-touch-icon" href="data:image/png;base64,${icon}">
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<noscript>Walk Base needs JavaScript. It runs entirely on this device.</noscript>
<script type="module">${js}</script>
</body>
</html>
`;
const out = path.join(here, 'WalkBase.html');
fs.writeFileSync(out, html);
console.log(`WalkBase.html ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
