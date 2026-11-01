// Her memory is sealed: every save carries an HMAC of its content under a secret only this Windows
// account can read (DPAPI). A memory changed behind the plugin's back — in the file, in a backup,
// while the plugin runs or while it is off — no longer matches its seal, and the plugin marks her
// data as changed by hand.
//
// The mark is sticky: it is kept in several places at once (her memory, her settings, the registry,
// a protected file in Documents), and whichever of them still has it puts it back into the others.
// Nothing local is beyond a determined person with the source in hand; this makes changing her
// numbers and hiding it a real investigation instead of an edit of one line.
import * as crypto from "node:crypto";

// the content a seal covers: everything but the seal and the mark, in a fixed key order
export function canonical(obj) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).filter((k) => k !== "seal").sort().map((k) => [k, walk(v[k])]));
    if (typeof v === "number") return Math.round(v * 1e6) / 1e6;
    return v;
  };
  return JSON.stringify(walk(obj));
}
export const sealOf = (secret, obj) => crypto.createHmac("sha256", secret).update(canonical(obj)).digest("hex");
export const sealOk = (secret, obj) => !!obj?.seal && !!secret && crypto.timingSafeEqual(Buffer.from(sealOf(secret, obj)), Buffer.from(String(obj.seal).padEnd(64, "0").slice(0, 64)));

// a mark: when, and why ("edited", "edited-running", "seal-removed", "backup-edited", "restored-unverified")
export function markOf(...sources) {
  const marks = sources.filter((m) => m && typeof m === "object" && m.at);
  if (!marks.length) return null;
  // the earliest one stands
  return marks.sort((a, b) => String(a.at).localeCompare(String(b.at)))[0];
}

// What a loaded memory says, given whether her memory was sealed before (`sealed`):
//   "ok" — the seal matches; "new" — nothing sealed yet (first run of a sealing version, or a fresh
//   start): seal it now; "edited" — sealed before and the seal no longer matches; "seal-removed" —
//   sealed before and the seal is gone.
export function verify(secret, obj, sealed) {
  if (!secret) return "unknown";
  if (!obj) return sealed ? "seal-removed" : "new";
  if (!obj.seal) return sealed ? "seal-removed" : "new";
  return sealOk(secret, obj) ? "ok" : "edited";
}

// the PowerShell that keeps the secret and the marks: DPAPI for the secret (this Windows account
// only), the registry and a protected file for the marks. `op`: "load" prints
// "secret|registryMark|fileMark"; "mark" stores a mark in both places.
export function sealScript(op, { dataKey, docsKey, docsMark, mark = "" }) {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  return `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Security
$enc = [Text.Encoding]::UTF8
function Prot($t) { [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($enc.GetBytes($t), $null, 'CurrentUser')) }
function Unprot($b) { try { $enc.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($b), $null, 'CurrentUser')) } catch { '' } }
$reg = 'HKCU:\\Software\\CompanionLifeAvatar'
if (-not (Test-Path $reg)) { New-Item -Path $reg -Force | Out-Null }
$files = @(${q(dataKey)}, ${q(docsKey)})
if (${q(op)} -eq 'load') {
  $secret = ''
  foreach ($f in $files) { if (-not $secret -and (Test-Path $f)) { $secret = Unprot (Get-Content $f -Raw).Trim() } }
  if (-not $secret) { $r = (Get-ItemProperty $reg -Name K).K; if ($r) { $secret = Unprot $r } }
  $fresh = 0
  if (-not $secret) { $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $secret = -join ($b | ForEach-Object { $_.ToString('x2') }); $fresh = 1 }
  $p = Prot $secret
  foreach ($f in $files) { New-Item -ItemType Directory -Force -Path (Split-Path $f) | Out-Null; Set-Content -Path $f -Value $p -NoNewline; (Get-Item $f -Force).Attributes = 'Hidden' }
  Set-ItemProperty -Path $reg -Name K -Value $p
  $rm = (Get-ItemProperty $reg -Name M).M; if ($rm) { $rm = Unprot $rm }
  $fm = ''; if (Test-Path ${q(docsMark)}) { $fm = Unprot (Get-Content ${q(docsMark)} -Raw).Trim() }
  $sealed = (Get-ItemProperty $reg -Name S).S
  [Console]::Out.WriteLine("$secret|$fresh|$sealed|$rm|$fm")
} elseif (${q(op)} -eq 'sealed') {
  Set-ItemProperty -Path $reg -Name S -Value 1
} else {
  $p = Prot ${q(mark)}
  Set-ItemProperty -Path $reg -Name M -Value $p
  New-Item -ItemType Directory -Force -Path (Split-Path ${q(docsMark)}) | Out-Null
  Set-Content -Path ${q(docsMark)} -Value $p -NoNewline; (Get-Item ${q(docsMark)} -Force).Attributes = 'Hidden'
}`;
}
