#!/usr/bin/env bash
# Usage: scripts/lighthouse.sh <url> <outbase>  — runs Lighthouse (mobile, simulated throttling) 3× and keeps the median run.
set -euo pipefail
URL=$1; OUT=$2
CHROME_PATH=${CHROME_PATH:-$(ls -d "$LOCALAPPDATA"/ms-playwright/chromium-*/chrome-win*/chrome.exe 2>/dev/null | head -1)}
export CHROME_PATH
for i in 1 2 3; do
  npx --yes lighthouse@12 "$URL" --quiet --chrome-flags="--headless=new --no-sandbox" \
    --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="$OUT.run$i.json" >/dev/null 2>&1
done
node -e '
const fs=require("fs"); const base=process.argv[1];
const runs=[1,2,3].map(i=>JSON.parse(fs.readFileSync(`${base}.run${i}.json`)));
runs.sort((a,b)=>a.categories.performance.score-b.categories.performance.score);
const m=runs[1]; fs.writeFileSync(`${base}.json`, JSON.stringify(m));
console.log("runs perf:", runs.map(r=>Math.round(r.categories.performance.score*100)).join(","));
for (const [k,v] of Object.entries(m.categories)) console.log(k, Math.round(v.score*100));
console.log("LCP", m.audits["largest-contentful-paint"].displayValue, "TBT", m.audits["total-blocking-time"].displayValue, "CLS", m.audits["cumulative-layout-shift"].displayValue);
for (let i=1;i<=3;i++) fs.unlinkSync(`${base}.run${i}.json`);
' "$OUT"
