const fs = require("fs");
const path = require("path");

const root = process.cwd();
const rel = "src/components/admin/BusinessHoursManager.tsx";
const file = path.join(root, rel);

if (!fs.existsSync(file)) {
  console.error("ERROR: File not found:", file);
  process.exit(1);
}

const original = fs.readFileSync(file, "utf8");
let src = original;
let changed = false;

function mark(next, label) {
  if (next !== src) {
    src = next;
    changed = true;
    console.log("OK:", label);
  } else {
    console.log("SKIP/already present:", label);
  }
}

function fail(msg) {
  console.error("\nERROR:", msg);
  console.error("No project file was overwritten.");
  process.exit(1);
}

// Backup first. This never deletes the original.
const backup = file + ".backup-before-workload-v2";
if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
  console.log("Backup created:", backup);
} else {
  console.log("Backup already exists:", backup);
}

// 1) Type field
if (!/daily_workload_capacity\s*:\s*number\s*;/.test(src)) {
  const next = src.replace(
    /(max_bookings_per_slot\s*:\s*number\s*;)/,
    `$1\n  daily_workload_capacity: number;`
  );
  if (next === src) fail("Could not add daily_workload_capacity to BusinessHours type.");
  mark(next, "BusinessHours.daily_workload_capacity");
} else {
  console.log("SKIP/already present: BusinessHours.daily_workload_capacity");
}

// 2) business_hours SELECT
if (!/select\([^)]*daily_workload_capacity[^)]*\)/s.test(
  (src.match(/supabase\.from\("business_hours"\)[\s\S]{0,400}/) || [""])[0]
)) {
  const old = `.select("day_of_week, is_open, opens_at, closes_at, slot_duration_minutes, max_bookings_per_slot")`;
  if (src.includes(old)) {
    mark(
      src.replace(
        old,
        `.select("day_of_week, is_open, opens_at, closes_at, slot_duration_minutes, max_bookings_per_slot, daily_workload_capacity")`
      ),
      "Load daily_workload_capacity"
    );
  } else {
    const next = src.replace(
      /(\.from\("business_hours"\)\s*\.select\(")([^"]*max_bookings_per_slot)(?![^"]*daily_workload_capacity)("\))/,
      (_m, a, cols, z) => `${a}${cols}, daily_workload_capacity${z}`
    );
    if (next === src) fail("Could not update the business_hours select query.");
    mark(next, "Load daily_workload_capacity");
  }
} else {
  console.log("SKIP/already present: Load daily_workload_capacity");
}

// 3) Save field
if (!/daily_workload_capacity\s*:\s*Number\(day\.daily_workload_capacity\)/.test(src)) {
  const next = src.replace(
    /(max_bookings_per_slot\s*:\s*Number\(day\.max_bookings_per_slot\)\s*,)/,
    `$1\n      daily_workload_capacity: Number(day.daily_workload_capacity ?? 15),`
  );
  if (next === src) fail("Could not add daily_workload_capacity to saveDay().");
  mark(next, "Save daily_workload_capacity");
} else {
  console.log("SKIP/already present: Save daily_workload_capacity");
}

// 4) Helper text
if (!src.includes("Workload capacity represents workshop effort")) {
  const needle = `Available slots are checked again in the database when a booking is submitted, so parallel requests cannot overbook a slot.`;
  if (src.includes(needle)) {
    mark(
      src.replace(
        needle,
        needle + `</p><p className="mt-1 text-xs text-amber-600">Workload capacity represents workshop effort, not a fixed number of vehicles. Heavy services can use more capacity and may require confirmation.`
      ),
      "Workload helper text"
    );
  } else {
    console.log("WARN: Could not find helper paragraph; continuing because this is cosmetic.");
  }
} else {
  console.log("SKIP/already present: Workload helper text");
}

// Fix accidental duplicate closing p if helper replacement ran against a full <p>.
src = src.replace(
  /<\/p><\/p><p className="mt-1 text-xs text-amber-600">/,
  `</p><p className="mt-1 text-xs text-amber-600">`
);

// 5) Wider table
if (src.includes('min-w-[760px]')) {
  mark(src.replace('min-w-[760px]', 'min-w-[980px]'), "Wider Business Hours table");
}

// 6) Rename header
if (src.includes(">Bookings per slot<")) {
  mark(src.replace(">Bookings per slot<", ">Online Booking Limit<"), "Rename Bookings per slot");
}
if (src.includes(">BOOKINGS PER SLOT<")) {
  mark(src.replace(">BOOKINGS PER SLOT<", ">ONLINE BOOKING LIMIT<"), "Rename BOOKING header");
}

// 7) Add Daily Workload Capacity header
if (!src.includes(">Daily Workload Capacity<")) {
  const headerPattern = /(<th className="p-4">Online Booking Limit<\/th>)/;
  if (!headerPattern.test(src)) fail('Could not locate "Online Booking Limit" table header.');
  mark(
    src.replace(
      headerPattern,
      `$1<th className="p-4">Daily Workload Capacity</th>`
    ),
    "Daily Workload Capacity header"
  );
} else {
  console.log("SKIP/already present: Daily Workload Capacity header");
}

// 8) Rename aria-label on online limit, when old wording is present
src = src.replace(
  /\`\$\{weekdays\[day\.day_of_week\]\} bookings per slot\`/g,
  `\`\${weekdays[day.day_of_week]} online booking limit\``
);

// 9) Add the daily capacity input directly after max_bookings_per_slot input
if (!src.includes("daily workload capacity`}")) {
  const cellRegex = /(<td className="p-4"><input[\s\S]*?value=\{day\.max_bookings_per_slot\}[\s\S]*?<\/td>)/;
  const match = src.match(cellRegex);
  if (!match) fail("Could not locate the Online Booking Limit input cell.");

  const dailyCell = `
            <td className="p-4"><input aria-label={\`\${weekdays[day.day_of_week]} daily workload capacity\`} type="number" min="1" max="500" value={day.daily_workload_capacity ?? 15} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, daily_workload_capacity: Number(event.target.value) } : item))} className="w-24 rounded border border-white/10 bg-[#080808] px-2 py-2" /></td>`;
  mark(
    src.replace(cellRegex, `$1${dailyCell}`),
    "Daily Workload Capacity input"
  );
} else {
  console.log("SKIP/already present: Daily Workload Capacity input");
}

// Final validation BEFORE writing
const requiredChecks = [
  ["daily_workload_capacity type", /daily_workload_capacity\s*:\s*number\s*;/],
  ["load query", /max_bookings_per_slot,\s*daily_workload_capacity/],
  ["save payload", /daily_workload_capacity\s*:\s*Number\(day\.daily_workload_capacity/],
  ["Online Booking Limit", /Online Booking Limit/],
  ["Daily Workload Capacity header", />Daily Workload Capacity</],
  ["daily capacity input", /daily workload capacity/],
];

const missing = requiredChecks.filter(([, re]) => !re.test(src)).map(([name]) => name);
if (missing.length) {
  fail("Validation failed. Missing: " + missing.join(", "));
}

if (!changed && src === original) {
  console.log("\nNothing to change: Business Hours workload UI already appears to be installed.");
  process.exit(0);
}

fs.writeFileSync(file, src, "utf8");

console.log("\nSUCCESS: Business Hours workload UI is now installed.");
console.log("Changed:", rel);
console.log("Backup:", rel + ".backup-before-workload-v2");
console.log("\nNEXT:");
console.log("1) npm run dev");
console.log("2) Open http://localhost:3000/admin");
console.log("3) Go to Business Hours");
console.log("4) Confirm: Online Booking Limit + Daily Workload Capacity");
