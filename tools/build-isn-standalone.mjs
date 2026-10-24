/* Mechanically bundle the ISN Pack 01 lab into a self-contained HTML file.
 * This is a portable educational preview, not a replacement for the repo app.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const labDir = path.join(repoRoot, 'isn-electrical-pack-lab');
const source = fs.readFileSync(path.join(labDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(labDir, 'style.css'), 'utf8');
let scripts = 0;
let output = source.replace('<link rel="stylesheet" href="./style.css">', `<style>\n${css}\n</style>`);
output = output.replace(/<script src="([^"]+)" defer><\/script>/g, (_, relative) => {
  const fullPath = path.resolve(labDir, relative);
  if (!fullPath.startsWith(repoRoot + path.sep)) throw Error('Script outside source repository: ' + relative);
  const code = fs.readFileSync(fullPath, 'utf8');
  if (/<\/script/i.test(code)) throw Error('Script contains a closing HTML script tag: ' + relative);
  scripts++;
  return `<script>\n/* Embedded: ${relative} */\n${code}\n</script>`;
});
if (scripts !== 6 || /<(script|link)\s+[^>]*(src|href)=/i.test(output)) throw Error('Standalone file still has linked JS/CSS or missing scripts');
output = output.replace('<a href="../panel-mosaic-lab/cockpit/">↩ بازگشت به Unified</a>',
  '<span class="offline-label">نسخهٔ آزمایشی مستقل · بدون نیاز به سرور</span>');
output = output.replace('<main>',
  '<p class="notice">این فایل به‌صورت مستقل در مرورگر اجرا می‌شود و اتصال آنلاین به GitHub Pages نیاز ندارد. منطق همان ISN Pack 01 است؛ تغییرات فقط در این صفحه باقی می‌مانند.</p><main>');
const outputPath = path.join(labDir, 'standalone.html');
fs.writeFileSync(outputPath, output, 'utf8');
console.log('Built ' + path.relative(repoRoot, outputPath) + ' with ' + scripts + ' embedded scripts (' + Buffer.byteLength(output) + ' bytes).');
