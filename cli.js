#!/usr/bin/env node
// CommitCraft CLI: writes your commit message + PR description from the staged diff using Google Gemma 4.
//   git diff --staged | node cli.js            # read diff from stdin
//   node cli.js                                 # runs `git diff --staged` itself
//   node cli.js --style gitmoji --issue "#42" --note "fixes login on Safari" --json
//   node cli.js --commit                        # also runs `git commit -F -` with the generated message (asks first)
const { execSync } = require("child_process");
const readline = require("readline");
const { craft } = require("./lib/craft");

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d = "") => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
if (flag("help") || flag("h")) {
  console.log("Usage: git diff --staged | commitcraft [--style conventional|gitmoji|simple] [--issue #12] [--note \"why\"] [--json] [--commit]\nNeeds GEMINI_API_KEY (free: https://aistudio.google.com/apikey)");
  process.exit(0);
}
// Read a piped diff; if nothing arrives quickly (e.g. run from an agent/IDE), fall back to `git diff --staged`.
const readStdin = () => new Promise((ok) => {
  let s = "", got = false;
  const t = setTimeout(() => { if (!got) { process.stdin.pause(); ok(""); } }, 400);
  process.stdin.on("data", (c) => { got = true; s += c; });
  process.stdin.on("end", () => { clearTimeout(t); ok(s); });
});

(async () => {
  let diff = process.stdin.isTTY ? "" : await readStdin();
  if (!diff.trim()) { try { diff = execSync("git diff --staged", { encoding: "utf8", maxBuffer: 2e7 }); } catch { } }
  if (!diff.trim()) { console.error("No staged changes. Stage files with `git add` or pipe a diff in."); process.exit(1); }
  const r = await craft({ diff, style: opt("style", "conventional"), issue: opt("issue"), context: opt("note") });
  if (flag("json")) return console.log(JSON.stringify(r, null, 2));
  const c = (n, s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
  console.log(c("1;35", "\n── Commit message ──\n") + r.message);
  console.log(c("1;35", "\n── PR title ──\n") + r.pr?.title);
  console.log(c("1;35", "\n── PR description ──\n") + r.pr?.description);
  if (r.review?.length) console.log(c("1;35", "\n── Review notes ──\n") + r.review.map((x) => `[${x.severity}] ${x.note}`).join("\n"));
  if (r.split) console.log(c("1;35", "\n── Split suggestion ──\n") + r.split);
  console.log(c("2", `\n${r.stats.files.length} files, +${r.stats.additions}/-${r.stats.deletions} · ${r.model}`));
  if (flag("commit")) {
    const rl = readline.createInterface({ input: process.stdin.isTTY ? process.stdin : require("fs").createReadStream("/dev/tty"), output: process.stdout });
    rl.question("\nCommit with this message? [y/N] ", (a) => {
      rl.close();
      if (/^y/i.test(a)) { execSync("git commit -F -", { input: r.message, stdio: ["pipe", "inherit", "inherit"] }); }
    });
  }
})().catch((e) => { console.error("commitcraft:", e.message); process.exit(1); });
