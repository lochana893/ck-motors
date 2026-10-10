const fs = require("fs");
const path = require("path");

const root = process.cwd();
const rel = "src/components/admin/BusinessHoursManager.tsx";
const file = path.join(root, rel);

if (!fs.existsSync(file)) {
  console.error("ERROR: File not found:", file);
  process.exit(1);
}

let src = fs.readFileSync(file, "utf8");

if (src.includes("Daily Workload Capacity") && src.includes("daily_workload_capacity")) {
  console.log("Business Hours workload UI is already present. No changes needed.");
  process.exit(0);
}

// Safety backup
const backup = file + ".backup-before-workload";
if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
  console.log("Backup created:", backup);
}

function mustReplace(oldText, newText, label) {
  if (!src.includes(oldText)) {
    console.error("\nERROR: Could not find expected section:", label);
    console.error("No changes were written.");
    process.exit(1);
  }
  src = src.replace(oldText, newText);
}

// 1) Type
mustReplace(
`  max_bookings_per_slot: number;
};`,
`  max_bookings_per_slot: number;
  daily_workload_capacity: number;
};`,
"BusinessHours type"
);

// 2) Load query
mustReplace(
`select("day_of_week, is_open, opens_at, closes_at, slot_duration_minutes, max_bookings_per_slot")`,
`select("day_of_week, is_open, opens_at, closes_at, slot_duration_minutes, max_bookings_per_slot, daily_workload_capacity")`,
"business_hours select"
);

// 3) Save payload
mustReplace(
`      max_bookings_per_slot: Number(day.max_bookings_per_slot),
    }).eq("day_of_week", day.day_of_week);`,
`      max_bookings_per_slot: Number(day.max_bookings_per_slot),
      daily_workload_capacity: Number(day.daily_workload_capacity),
    }).eq("day_of_week", day.day_of_week);`,
"save payload"
);

// 4) Helper text
mustReplace(
`<p className="mt-2 text-xs text-gray-500">Available slots are checked again in the database when a booking is submitted, so parallel requests cannot overbook a slot.</p>`,
`<p className="mt-2 text-xs text-gray-500">Available slots are checked again in the database when a booking is submitted, so parallel requests cannot overbook a slot.</p>
      <p className="mt-1 text-xs text-amber-600">Daily Workload Capacity is an estimated workshop-effort limit, not a fixed number of vehicles. Online Booking Limit controls only online bookings per time slot.</p>`,
"helper text"
);

// 5) Wider table
mustReplace(
`<table className="w-full min-w-[760px] text-left text-xs">`,
`<table className="w-full min-w-[980px] text-left text-xs">`,
"table width"
);

// 6) Header
mustReplace(
`<th className="p-4">Bookings per slot</th><th className="p-4"></th>`,
`<th className="p-4">Online Booking Limit</th><th className="p-4">Daily Workload Capacity</th><th className="p-4"></th>`,
"table headers"
);

// 7) Row input
const oldRow = `<td className="p-4"><input aria-label={\`${weekdays[day.day_of_week]} bookings per slot\`} type="number" min="1" max="100" value={day.max_bookings_per_slot} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, max_bookings_per_slot: Number(event.target.value) } : item))} className="w-20 rounded border border-white/10 bg-[#080808] px-2 py-2" /></td>
            <td className="p-4"><button`;

const newRow = `<td className="p-4"><input aria-label={\`${weekdays[day.day_of_week]} online booking limit\`} type="number" min="1" max="100" value={day.max_bookings_per_slot} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, max_bookings_per_slot: Number(event.target.value) } : item))} className="w-20 rounded border border-white/10 bg-[#080808] px-2 py-2" /></td>
            <td className="p-4"><input aria-label={\`${weekdays[day.day_of_week]} daily workload capacity\`} type="number" min="1" max="500" value={day.daily_workload_capacity ?? 15} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, daily_workload_capacity: Number(event.target.value) } : item))} className="w-24 rounded border border-white/10 bg-[#080808] px-2 py-2" /></td>
            <td className="p-4"><button`;

mustReplace(oldRow, newRow, "daily workload input");

fs.writeFileSync(file, src, "utf8");

console.log("\nSUCCESS: Business Hours UI updated.");
console.log("Changed:", rel);
console.log("Backup:", rel + ".backup-before-workload");
console.log("\nNow run: npm run dev");
console.log("Then refresh Admin > Business Hours.");
