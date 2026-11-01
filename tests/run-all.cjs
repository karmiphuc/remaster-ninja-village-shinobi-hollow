// Runs the browser suites in parallel and prints one summary line per suite.
//   node tests/run-all.cjs                 all suites
//   node tests/run-all.cjs tactics omens   just these
//   TEST_JOBS=2 node tests/run-all.cjs     cap parallel suites (default: CPU cores, at most 4)
// Each suite still runs in its own Node process and browser, so suites stay isolated; only the waiting is shared.
// A failing suite's own output is printed in full after the summary. The exit code is non-zero if any suite fails.
const { spawn } = require('child_process'), os = require('os'), path = require('path');
const ALL = ['density', 'siege', 'battle-end', 'tate', 'tactics', 'dialogs', 'campaign', 'economy-flow', 'equipment', 'integration', 'porter-menu', 'market-collectors', 'building-move', 'omens', 'logistics', 'forge']; // slowest first, so it starts first
const pick = process.argv.slice(2), suites = pick.length ? ALL.filter(s => pick.includes(s)) : ALL;
const unknown = pick.filter(s => !ALL.includes(s));
if (unknown.length) { console.error('Unknown suite(s): ' + unknown.join(', ') + '. Known: ' + ALL.join(', ')); process.exit(2); }
const jobs = Math.max(1, Math.min(suites.length, +process.env.TEST_JOBS || Math.min(4, os.cpus().length)));
const results = [], start = Date.now();

function run(name) {
  return new Promise(resolve => {
    const t0 = Date.now(), out = [];
    const child = spawn(process.execPath, [path.join(__dirname, name + '.cjs')], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', d => out.push(d)); child.stderr.on('data', d => out.push(d));
    child.on('close', code => {
      const r = { name, ok: code === 0, code, secs: (Date.now() - t0) / 1000, output: Buffer.concat(out).toString() };
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${name.padEnd(12)} ${r.secs.toFixed(1).padStart(6)}s`);
      results.push(r); resolve();
    });
  });
}

(async () => {
  console.log(`Running ${suites.length} suite(s), ${jobs} at a time…`);
  const queue = suites.slice();
  await Promise.all(Array.from({ length: jobs }, async () => { while (queue.length) await run(queue.shift()); }));
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed in ${((Date.now() - start) / 1000).toFixed(1)}s wall time ` +
    `(${results.reduce((n, r) => n + r.secs, 0).toFixed(1)}s if run one after another).`);
  for (const r of failed) console.log(`\n──── ${r.name} (exit ${r.code}) ────\n${r.output.trim()}`);
  process.exitCode = failed.length ? 1 : 0;
})();
