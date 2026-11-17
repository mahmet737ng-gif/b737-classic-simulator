#!/usr/bin/env node
"use strict";
/* English-only user-facing test-lab source audit.
 * Scan HTML and inline-browser JS/CSS under cockpit + test lab roots.
 * Exclude reference documents, source photography, test scripts and generated JS bundles.
 * This is a conservative UTF-8 check: it may also flag comments or developer notes.
 */
const fs=require("node:fs"),path=require("node:path");
const roots=[
 "acdc-metering-lab","audio-lab","bus-consumer-test-lab","cb-panel-lab","cdu-font-test",
 "cdu-standalone","cdu-standalone-v3","cdu-standalone-v5","cdu-standalone-v6",
 "cpcs-lab","dcpcs-lab","eadi-attitude-lab","efis-display-lab",
 "electrical-lab","electrical-load-lab","fire-handle-lab","fire-protection-lab",
 "flight-controls-panel","fuel-panel","integration-lab","interactive-panel-test",
 "isn-ecu-start-lab","isn-electrical-pack-lab","isn-start-sequence-lab",
 "main-panel-lab","navigation/fmc-lab","navigation/reference-progress",
 "panel-mosaic-lab","pneumatics-lab","stall-warning-lab","switch-lab",
 "systems-integration-lab","trainer-lab","vector-lab","instrument-lab"
];
const ignoreDirs=new Set(["node_modules",".git","assets","performance","reference","references","__snapshots__","archive","archive-old","tests"]);
function walk(dir,files){
 if(!fs.existsSync(dir))return;
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,ent.name);
  if(ent.isDirectory()){if(!ignoreDirs.has(ent.name))walk(p,files);continue;}
  if(!ent.isFile()||!/\.(?:html|js|css)$/i.test(ent.name))continue;
  if(/(?:\.test\.|\.spec\.|\.min\.|\.map\.)/.test(ent.name))continue;
  files.push(p);
 }
}
const files=[];for(const root of roots)walk(root,files);
const flagged=[];let scanned=0;
for(const f of files){
 const src=fs.readFileSync(f,"utf8"),matches=[...src.matchAll(/[\u0600-\u06FF]/g)];
 scanned++;if(!matches.length)continue;
 const lines=src.split("\n"),examples=[];
 for(let i=0;i<lines.length;i++)if(/[\u0600-\u06FF]/.test(lines[i])){
  examples.push({line:i+1,excerpt:lines[i].trim().slice(0,160)});
  if(examples.length===3)break;
 }
 flagged.push({path:f.replaceAll(path.sep,"/"),chars:matches.length,examples});
}
flagged.sort((a,b)=>b.chars-a.chars);
console.log(JSON.stringify({scan:"English-only active test-lab HTML/JS/CSS",filesScanned:scanned,filesFlagged:flagged.length,flagged:flagged.slice(0,150)},null,2));
if(process.argv.includes("--strict")&&flagged.length)process.exitCode=1;
