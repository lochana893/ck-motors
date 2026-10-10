const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const REL = "src/app/admin/page.tsx";
const FILE = path.join(ROOT, REL);
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

function fail(msg) {
  console.error("\nERROR:", msg);
  console.error("No project changes were written.");
  process.exit(1);
}

if (!fs.existsSync(FILE)) fail(`Missing file: ${REL}`);

const original = fs.readFileSync(FILE, "utf8");
let src = original;

function findBlock(startNeedle, startAt = 0) {
  const start = src.indexOf(startNeedle, startAt);
  if (start < 0) fail(`Could not find block: ${startNeedle}`);

  const brace = src.indexOf("{", start);
  if (brace < 0) fail(`Could not find opening brace for: ${startNeedle}`);

  let depth = 0;
  let inSingle = false, inDouble = false, inTemplate = false, escaped = false;

  for (let i = brace; i < src.length; i++) {
    const ch = src[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
      continue;
    }

    if (inSingle || inDouble || inTemplate) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        while (end < src.length && /[\s;]/.test(src[end])) end++;
        return { start, brace, end, text: src.slice(start, end) };
      }
    }
  }

  fail(`Could not find closing brace for: ${startNeedle}`);
}

function replaceBlock(block, newText) {
  src = src.slice(0, block.start) + newText + src.slice(block.end);
}

function ensureTypeField(typeNeedle, fieldLine, fieldRegex, label) {
  const b = findBlock(typeNeedle);
  if (fieldRegex.test(b.text)) {
    console.log("SKIP/already present:", label);
    return;
  }
  const close = b.text.lastIndexOf("}");
  if (close < 0) fail(`Could not edit ${label}`);
  const before = b.text.slice(0, close).replace(/\s*$/, "");
  const after = b.text.slice(close);
  replaceBlock(b, before + "\n  " + fieldLine + "\n" + after);
  console.log("OK:", label);
}

function ensureObjectField(objectNeedle, fieldText, markerText, label) {
  const b = findBlock(objectNeedle);
  if (b.text.includes(markerText)) {
    console.log("SKIP/already present:", label);
    return;
  }

  // Prefer placing before icon_name, otherwise before final }
  let insertAt = b.text.indexOf("icon_name:");
  if (insertAt < 0) insertAt = b.text.lastIndexOf("}");
  if (insertAt < 0) fail(`Could not edit ${label}`);

  const lineStart = b.text.lastIndexOf("\n", insertAt) + 1;
  const indentMatch = b.text.slice(lineStart, insertAt).match(/^\s*/);
  const indent = indentMatch ? indentMatch[0] : "  ";
  const insertion = `${indent}${fieldText.replace(/\n/g, "\n" + indent)}\n`;

  const newBlock = b.text.slice(0, lineStart) + insertion + b.text.slice(lineStart);
  replaceBlock(b, newBlock);
  console.log("OK:", label);
}

function patchServicesSelect() {
  let cursor = 0;
  let patched = false;

  while (true) {
    const fromIdx = src.indexOf('.from("services")', cursor);
    if (fromIdx < 0) break;

    const selectIdx = src.indexOf(".select(", fromIdx);
    if (selectIdx < 0 || selectIdx - fromIdx > 2000) {
      cursor = fromIdx + 10;
      continue;
    }

    // find first quoted select string
    const quoteIdx = src.indexOf('"', selectIdx);
    if (quoteIdx < 0 || quoteIdx - selectIdx > 500) {
      cursor = fromIdx + 10;
      continue;
    }

    const endQuote = src.indexOf('"', quoteIdx + 1);
    if (endQuote < 0) {
      cursor = fromIdx + 10;
      continue;
    }

    let fields = src.slice(quoteIdx + 1, endQuote);

    // We want the admin services query, not a tiny unrelated one.
    if (!fields.includes("estimated_duration_minutes") || !fields.includes("icon_name")) {
      cursor = endQuote + 1;
      continue;
    }

    const missing = [];
    if (!fields.includes("workload_weight")) missing.push("workload_weight");
    if (!fields.includes("requires_confirmation")) missing.push("requires_confirmation");

    if (!missing.length) {
      console.log("SKIP/already present: services SELECT workload fields");
      return;
    }

    if (fields.includes("estimated_duration_minutes")) {
      fields = fields.replace(
        "estimated_duration_minutes",
        "estimated_duration_minutes, " + missing.join(", ")
      );
    } else {
      fields += ", " + missing.join(", ");
    }

    src = src.slice(0, quoteIdx + 1) + fields + src.slice(endQuote);
    console.log("OK: services SELECT workload fields");
    patched = true;
    return;
  }

  if (!patched) fail("Could not find the Admin services SELECT query.");
}

function ensureOpenEditMapping() {
  const start = src.indexOf("function openEditService");
  if (start < 0) fail("Could not find openEditService()");
  const end = src.indexOf("function ", start + 25);
  const blockEnd = end > start ? end : src.length;
  const block = src.slice(start, blockEnd);

  if (block.includes("requires_confirmation: Boolean(service.requires_confirmation)")) {
    console.log("SKIP/already present: openEditService workload mapping");
    return;
  }

  const iconIdxLocal = block.indexOf("icon_name:");
  if (iconIdxLocal < 0) fail("Could not find icon_name inside openEditService()");
  const lineStartLocal = block.lastIndexOf("\n", iconIdxLocal) + 1;
  const indent = (block.slice(lineStartLocal, iconIdxLocal).match(/^\s*/) || ["      "])[0];

  const insert =
    `${indent}workload_weight: service.workload_weight || 1,\n` +
    `${indent}requires_confirmation: Boolean(service.requires_confirmation),\n`;

  const abs = start + lineStartLocal;
  src = src.slice(0, abs) + insert + src.slice(abs);
  console.log("OK: openEditService workload mapping");
}

function ensureSavePayload() {
  const start = src.indexOf("async function saveService");
  if (start < 0) fail("Could not find saveService()");
  const end = src.indexOf("async function ", start + 25);
  const blockEnd = end > start ? end : src.length;
  const block = src.slice(start, blockEnd);

  if (block.includes("requires_confirmation: serviceForm.requires_confirmation")) {
    console.log("SKIP/already present: saveService workload payload");
    return;
  }

  const payloadIdx = block.indexOf("const payload");
  if (payloadIdx < 0) fail("Could not find service payload");
  const iconIdxLocal = block.indexOf("icon_name:", payloadIdx);
  if (iconIdxLocal < 0) fail("Could not find icon_name inside service payload");

  const lineStartLocal = block.lastIndexOf("\n", iconIdxLocal) + 1;
  const indent = (block.slice(lineStartLocal, iconIdxLocal).match(/^\s*/) || ["      "])[0];
  const insert =
    `${indent}workload_weight: Number(serviceForm.workload_weight || 1),\n` +
    `${indent}requires_confirmation: serviceForm.requires_confirmation,\n`;

  const abs = start + lineStartLocal;
  src = src.slice(0, abs) + insert + src.slice(abs);
  console.log("OK: saveService workload payload");
}

function ensureVisibleControls() {
  if (src.includes("Requires Availability Confirmation") && src.includes("Workshop Workload")) {
    console.log("SKIP/already present: visible workload controls");
    return;
  }

  const popular = src.indexOf("Mark as Popular");
  if (popular < 0) fail('Could not find "Mark as Popular"');

  const candidates = [
    '<div className="flex flex-wrap gap-4">',
    '<div className="grid gap-4',
    '<label className="flex items-center gap-3'
  ];

  let insertAt = -1;
  for (const marker of candidates) {
    const idx = src.lastIndexOf(marker, popular);
    if (idx > insertAt) insertAt = idx;
  }
  if (insertAt < 0) fail("Could not locate service options area");

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
  console.log("OK: visible workload controls");
}

// Apply robustly
ensureTypeField("type Service = {", "workload_weight: number;", /workload_weight\s*:\s*number/, "Service.workload_weight");
ensureTypeField("type Service = {", "requires_confirmation: boolean;", /requires_confirmation\s*:\s*boolean/, "Service.requires_confirmation");

ensureTypeField("type ServiceForm = {", "workload_weight: number;", /workload_weight\s*:\s*number/, "ServiceForm.workload_weight");
ensureTypeField("type ServiceForm = {", "requires_confirmation: boolean;", /requires_confirmation\s*:\s*boolean/, "ServiceForm.requires_confirmation");

ensureObjectField(
  "const emptyServiceForm",
  "workload_weight: 1,\nrequires_confirmation: false,",
  "requires_confirmation:",
  "emptyServiceForm defaults"
);

patchServicesSelect();
ensureOpenEditMapping();
ensureSavePayload();
ensureVisibleControls();

// Validate BEFORE write
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

const missing = required.filter((x) => !src.includes(x));
if (missing.length) fail("Validation failed. Missing: " + missing.join(" | "));

const backup = FILE + `.backup-service-v6-${STAMP}`;
fs.writeFileSync(backup, original, "utf8");
fs.writeFileSync(FILE, src, "utf8");

console.log("\nSUCCESS: Service workload UI installed with flexible V6 patcher.");
console.log("Changed:", REL);
console.log("Backup:", backup);
console.log("\nNEXT:");
console.log("1) npm run build");
console.log("2) npm run dev");
console.log("3) Open http://localhost:3000/admin?section=services");
console.log("4) Edit Engine Repair");
console.log("5) Confirm Workshop Workload + Requires Availability Confirmation are visible");
