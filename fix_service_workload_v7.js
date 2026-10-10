const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const REL = "src/app/admin/page.tsx";
const FILE = path.join(ROOT, REL);
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

function stop(msg) {
  console.error("\nERROR:", msg);
  console.error("No new project changes were written by this V7 run.");
  process.exit(1);
}

if (!fs.existsSync(FILE)) stop(`Missing file: ${REL}`);

const original = fs.readFileSync(FILE, "utf8");
let src = original;

function typeBlock(name) {
  const start = src.indexOf(`type ${name} = {`);
  if (start < 0) stop(`Could not find type ${name}`);
  const end = src.indexOf("};", start);
  if (end < 0) stop(`Could not find end of type ${name}`);
  return { start, end: end + 2, text: src.slice(start, end + 2) };
}

function objectBlock(startNeedle) {
  const start = src.indexOf(startNeedle);
  if (start < 0) stop(`Could not find ${startNeedle}`);
  const brace = src.indexOf("{", start);
  if (brace < 0) stop(`Could not find opening brace for ${startNeedle}`);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return { start, end: i + 1, text: src.slice(start, i + 1) };
    }
  }
  stop(`Could not find end of ${startNeedle}`);
}

function addTypeField(typeName, field, label) {
  const b = typeBlock(typeName);
  if (b.text.includes(field.split(":")[0] + ":")) {
    console.log("SKIP/already present:", label);
    return;
  }
  const pos = b.end - 2;
  src = src.slice(0, pos) + `  ${field}\n` + src.slice(pos);
  console.log("OK:", label);
}

function addObjectFields(startNeedle, fields, marker, label) {
  const b = objectBlock(startNeedle);
  if (b.text.includes(marker)) {
    console.log("SKIP/already present:", label);
    return;
  }
  let local = b.text.indexOf("icon_name:");
  if (local < 0) local = b.text.lastIndexOf("}");
  if (local < 0) stop(`Could not find insertion point for ${label}`);
  const lineStart = b.text.lastIndexOf("\n", local) + 1;
  const indent = (b.text.slice(lineStart, local).match(/^\s*/) || ["  "])[0];
  const insertion = fields.split("\n").map(x => indent + x).join("\n") + "\n";
  src = src.slice(0, b.start + lineStart) + insertion + src.slice(b.start + lineStart);
  console.log("OK:", label);
}

function patchAdminServicesSelect() {
  const fromMatches = [...src.matchAll(/\.from\(\s*["'`]services["'`]\s*\)/g)];
  if (!fromMatches.length) stop('Could not find any .from("services") query');

  for (const match of fromMatches) {
    const fromIndex = match.index;
    const windowEnd = Math.min(src.length, fromIndex + 5000);
    const windowText = src.slice(fromIndex, windowEnd);

    const selectMatch = windowText.match(/\.select\(\s*(["'`])([\s\S]*?)\1\s*\)/);
    if (!selectMatch || selectMatch.index == null) continue;

    const full = selectMatch[0];
    const fields = selectMatch[2];

    // Choose the admin service catalogue query.
    const looksRight =
      fields.includes("id") &&
      fields.includes("name") &&
      (fields.includes("slug") || fields.includes("icon_name") || fields.includes("is_popular"));

    if (!looksRight) continue;

    if (fields.includes("workload_weight") && fields.includes("requires_confirmation")) {
      console.log("SKIP/already present: Admin services SELECT workload fields");
      return;
    }

    let nextFields = fields.trim().replace(/,\s*$/, "");
    if (!nextFields.includes("workload_weight")) nextFields += ", workload_weight";
    if (!nextFields.includes("requires_confirmation")) nextFields += ", requires_confirmation";

    const quote = selectMatch[1];
    const replacement = `.select(${quote}${nextFields}${quote})`;
    const absStart = fromIndex + selectMatch.index;

    src = src.slice(0, absStart) + replacement + src.slice(absStart + full.length);
    console.log("OK: Admin services SELECT workload fields");
    return;
  }

  // Fallback: if fields are already mapped through a wildcard select, accept it.
  for (const match of fromMatches) {
    const fromIndex = match.index;
    const windowText = src.slice(fromIndex, Math.min(src.length, fromIndex + 1500));
    if (/\.select\(\s*["'`]\*["'`]\s*\)/.test(windowText)) {
      console.log("SKIP: Admin services query uses select('*'), workload columns are included automatically.");
      return;
    }
  }

  stop("Could not identify the Admin services SELECT query. V7 stopped safely.");
}

function ensureOpenEditMapping() {
  const start = src.indexOf("function openEditService");
  if (start < 0) stop("Could not find openEditService()");
  const next = src.indexOf("async function saveService", start);
  if (next < 0) stop("Could not find saveService() after openEditService()");
  const block = src.slice(start, next);

  if (block.includes("requires_confirmation: Boolean(service.requires_confirmation)")) {
    console.log("SKIP/already present: Edit service workload mapping");
    return;
  }

  const marker = "icon_name:";
  const local = block.indexOf(marker);
  if (local < 0) stop("Could not find icon_name in openEditService()");
  const lineStart = block.lastIndexOf("\n", local) + 1;
  const indent = (block.slice(lineStart, local).match(/^\s*/) || ["      "])[0];

  const insertion =
    `${indent}workload_weight: service.workload_weight || 1,\n` +
    `${indent}requires_confirmation: Boolean(service.requires_confirmation),\n`;

  src = src.slice(0, start + lineStart) + insertion + src.slice(start + lineStart);
  console.log("OK: Edit service workload mapping");
}

function ensureSavePayload() {
  const start = src.indexOf("async function saveService");
  if (start < 0) stop("Could not find saveService()");
  const blockEndCandidates = [
    src.indexOf("async function deleteService", start),
    src.indexOf("function deleteService", start),
    src.indexOf("async function", start + 30),
  ].filter(x => x > start);
  const end = blockEndCandidates.length ? Math.min(...blockEndCandidates) : Math.min(src.length, start + 10000);
  const block = src.slice(start, end);

  if (block.includes("requires_confirmation: serviceForm.requires_confirmation")) {
    console.log("SKIP/already present: Save service workload payload");
    return;
  }

  const payload = block.indexOf("const payload");
  if (payload < 0) stop("Could not find const payload in saveService()");
  const local = block.indexOf("icon_name:", payload);
  if (local < 0) stop("Could not find icon_name in service save payload");
  const lineStart = block.lastIndexOf("\n", local) + 1;
  const indent = (block.slice(lineStart, local).match(/^\s*/) || ["      "])[0];

  const insertion =
    `${indent}workload_weight: Number(serviceForm.workload_weight || 1),\n` +
    `${indent}requires_confirmation: serviceForm.requires_confirmation,\n`;

  src = src.slice(0, start + lineStart) + insertion + src.slice(start + lineStart);
  console.log("OK: Save service workload payload");
}

function ensureVisibleControls() {
  if (src.includes("Workshop Workload") && src.includes("Requires Availability Confirmation")) {
    console.log("SKIP/already present: Visible workload controls");
    return;
  }

  const popular = src.indexOf("Mark as Popular");
  if (popular < 0) stop('Could not find "Mark as Popular"');

  let insertAt = src.lastIndexOf('<div className="flex flex-wrap gap-4">', popular);
  if (insertAt < 0) {
    insertAt = src.lastIndexOf("<label", popular);
  }
  if (insertAt < 0) stop("Could not find insertion point before Popular/Recommended controls");

  const controls = `              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Workshop Workload
                  <select
                    value={serviceForm.workload_weight}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        workload_weight: Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-red-600"
                  >
                    <option value={1}>Light — 1</option>
                    <option value={2}>Normal — 2</option>
                    <option value={3}>Medium — 3</option>
                    <option value={4}>Heavy — 4</option>
                    <option value={5}>Very Heavy — 5</option>
                  </select>
                  <span className="mt-2 block text-[10px] font-normal leading-4 text-slate-500">
                    Heavy jobs use more of the Daily Workload Capacity.
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs font-semibold text-violet-900">
                  <input
                    type="checkbox"
                    checked={serviceForm.requires_confirmation}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        requires_confirmation: event.target.checked,
                      })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    Requires Availability Confirmation
                    <span className="mt-1 block text-[10px] font-normal leading-4 text-violet-700">
                      Turn this ON for Engine Repair, Engine Overhaul, Gearbox Repair and other long/heavy jobs. Customers must contact CK Motors instead of instantly booking online.
                    </span>
                  </span>
                </label>
              </div>

`;

  src = src.slice(0, insertAt) + controls + src.slice(insertAt);
  console.log("OK: Visible Workshop Workload controls");
}

// Apply
addTypeField("Service", "workload_weight: number;", "Service.workload_weight");
addTypeField("Service", "requires_confirmation: boolean;", "Service.requires_confirmation");
addTypeField("ServiceForm", "workload_weight: number;", "ServiceForm.workload_weight");
addTypeField("ServiceForm", "requires_confirmation: boolean;", "ServiceForm.requires_confirmation");

addObjectFields(
  "const emptyServiceForm",
  "workload_weight: 1,\nrequires_confirmation: false,",
  "requires_confirmation:",
  "emptyServiceForm workload defaults"
);

patchAdminServicesSelect();
ensureOpenEditMapping();
ensureSavePayload();
ensureVisibleControls();

const required = [
  "Workshop Workload",
  "Requires Availability Confirmation",
  "workload_weight: number;",
  "requires_confirmation: boolean;",
  "workload_weight: service.workload_weight || 1",
  "requires_confirmation: Boolean(service.requires_confirmation)",
  "workload_weight: Number(serviceForm.workload_weight || 1)",
  "requires_confirmation: serviceForm.requires_confirmation",
];

const missing = required.filter(x => !src.includes(x));
if (missing.length) stop("Validation failed. Missing: " + missing.join(" | "));

const backup = FILE + `.backup-v7-${STAMP}`;
fs.writeFileSync(backup, original, "utf8");
fs.writeFileSync(FILE, src, "utf8");

console.log("\nSUCCESS: CK Motors Service Workload V7 installed.");
console.log("Changed:", REL);
console.log("Backup:", backup);
console.log("\nNEXT:");
console.log("1) npm run build");
console.log("2) npm run dev");
console.log("3) Open http://localhost:3000/admin?section=services");
console.log("4) Edit Engine Repair");
console.log("5) Set Workshop Workload = Heavy (4)");
console.log("6) Turn ON Requires Availability Confirmation");
console.log("7) Save Service");
