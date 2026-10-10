const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const rel = "src/app/admin/page.tsx";
const file = path.join(ROOT, rel);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

function fail(msg) {
  console.error("\nERROR:", msg);
  console.error("No changes were written.");
  process.exit(1);
}

if (!fs.existsSync(file)) fail(`Missing file: ${file}`);

const original = fs.readFileSync(file, "utf8");
let src = original;

function getBlock(startMarker, nextMarker) {
  const start = src.indexOf(startMarker);
  if (start < 0) fail(`Could not find: ${startMarker}`);
  const end = src.indexOf(nextMarker, start + startMarker.length);
  if (end < 0) fail(`Could not find block end: ${nextMarker}`);
  return { start, end, text: src.slice(start, end) };
}

function insertInBlock(startMarker, nextMarker, anchorRegex, insertText, alreadyRegex, label) {
  const b = getBlock(startMarker, nextMarker);
  if (alreadyRegex.test(b.text)) {
    console.log("SKIP/already present:", label);
    return;
  }
  const m = b.text.match(anchorRegex);
  if (!m || m.index == null) fail(`Could not find anchor for ${label}`);
  src = src.slice(0, b.start + m.index) + insertText + src.slice(b.start + m.index);
  console.log("OK:", label);
}

function replaceInBlock(startMarker, nextMarker, regex, replacement, alreadyRegex, label) {
  const b = getBlock(startMarker, nextMarker);
  if (alreadyRegex.test(b.text)) {
    console.log("SKIP/already present:", label);
    return;
  }
  if (!regex.test(b.text)) fail(`Could not find replace target for ${label}`);
  const newBlock = b.text.replace(regex, replacement);
  src = src.slice(0, b.start) + newBlock + src.slice(b.end);
  console.log("OK:", label);
}

/* 1) type Service */
insertInBlock(
  "type Service = {",
  "type ServiceRecord",
  /^\s*icon_name\s*:/m,
  "  workload_weight: number;\n  requires_confirmation: boolean;\n",
  /requires_confirmation\s*:\s*boolean/,
  "Service type workload fields"
);

/* 2) type ServiceForm */
insertInBlock(
  "type ServiceForm = {",
  "const emptyServiceForm",
  /^\s*icon_name\s*:/m,
  "  workload_weight: number;\n  requires_confirmation: boolean;\n",
  /requires_confirmation\s*:\s*boolean/,
  "ServiceForm workload fields"
);

/* 3) emptyServiceForm */
insertInBlock(
  "const emptyServiceForm: ServiceForm = {",
  "function monthKey",
  /^\s*icon_name\s*:/m,
  "  workload_weight: 1,\n  requires_confirmation: false,\n",
  /requires_confirmation\s*:/,
  "Default workload fields"
);

/* 4) service SELECT query: find services .select(...) and add fields */
if (!src.includes("workload_weight") || !src.includes("requires_confirmation")) {
  // Types now include them; still continue to query logic below.
}
{
  const serviceFrom = src.indexOf('.from("services")');
  if (serviceFrom < 0) fail('Could not find .from("services")');
  const selectStart = src.indexOf(".select(", serviceFrom);
  if (selectStart < 0 || selectStart - serviceFrom > 1500) fail("Could not find services select()");
  const selectEnd = src.indexOf(")", selectStart);
  if (selectEnd < 0 || selectEnd - selectStart > 2000) fail("Could not parse services select()");
  let sel = src.slice(selectStart, selectEnd + 1);
  if (!sel.includes("workload_weight") || !sel.includes("requires_confirmation")) {
    if (!sel.includes("estimated_duration_minutes")) fail("Services select missing expected estimated_duration_minutes");
    sel = sel.replace(
      /estimated_duration_minutes\s*,?/,
      "estimated_duration_minutes, workload_weight, requires_confirmation,"
    );
    src = src.slice(0, selectStart) + sel + src.slice(selectEnd + 1);
    console.log("OK: Load workload fields from services");
  } else {
    console.log("SKIP/already present: Load workload fields from services");
  }
}

/* 5) openEditService mapping */
replaceInBlock(
  "function openEditService",
  "async function saveService",
  /(\s*icon_name\s*:\s*service\.icon_name\s*\|\|\s*"Wrench"\s*,?)/,
  `      workload_weight: service.workload_weight || 1,
      requires_confirmation: Boolean(service.requires_confirmation),
$1`,
  /requires_confirmation\s*:\s*Boolean\(service\.requires_confirmation\)/,
  "Edit Service workload mapping"
);

/* 6) save payload */
replaceInBlock(
  "async function saveService",
  "async function deleteService",
  /(\s*icon_name\s*:\s*serviceForm\.icon_name\s*\|\|\s*null\s*,?)/,
  `      workload_weight: Number(serviceForm.workload_weight || 1),
      requires_confirmation: serviceForm.requires_confirmation,
$1`,
  /requires_confirmation\s*:\s*serviceForm\.requires_confirmation/,
  "Save Service workload payload"
);

/* 7) Add visible controls before Popular/Recommended */
if (!src.includes("Requires Availability Confirmation")) {
  const popularIndex = src.indexOf("Mark as Popular");
  if (popularIndex < 0) fail('Could not find "Mark as Popular"');
  const rowStart = src.lastIndexOf('<div className="flex flex-wrap gap-4">', popularIndex);
  if (rowStart < 0) fail("Could not find Popular/Recommended options row");

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
                      Turn this ON for Engine Repair, Engine Overhaul, Gearbox Repair and other long jobs. Customers will contact CK Motors instead of instantly booking online.
                    </span>
                  </span>
                </label>
              </div>

`;
  src = src.slice(0, rowStart) + controls + src.slice(rowStart);
  console.log("OK: Visible Workshop Workload + Requires Availability Confirmation controls");
} else {
  console.log("SKIP/already present: Visible workload controls");
}

/* Final validation */
const mustHave = [
  "Workshop Workload",
  "Requires Availability Confirmation",
  "workload_weight: number",
  "requires_confirmation: boolean",
  "workload_weight: service.workload_weight || 1",
  "requires_confirmation: Boolean(service.requires_confirmation)",
  "workload_weight: Number(serviceForm.workload_weight || 1)",
  "requires_confirmation: serviceForm.requires_confirmation",
];

const missing = mustHave.filter((x) => !src.includes(x));
if (missing.length) fail("Validation failed. Missing: " + missing.join(" | "));

/* Backup + write */
const backup = file + `.backup-service-workload-v4-${stamp}`;
fs.writeFileSync(backup, original, "utf8");
fs.writeFileSync(file, src, "utf8");

console.log("\nSUCCESS: Services workload controls installed.");
console.log("Changed:", rel);
console.log("Backup:", backup);
console.log("\nNEXT:");
console.log("1) npm run build");
console.log("2) npm run dev");
console.log("3) Open /admin?section=services");
console.log("4) Edit Engine Repair");
console.log("5) Set Workshop Workload = Heavy (4) or Very Heavy (5)");
console.log("6) Turn ON Requires Availability Confirmation");
console.log("7) Save Service");
