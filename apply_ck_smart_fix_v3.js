const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const FILES = {
  admin: "src/app/admin/page.tsx",
  home: "src/app/page.tsx",
  modal: "src/components/services/ServiceContactModal.tsx",
  booking: "src/components/dashboard/BookingManager.tsx",
  record: "src/components/admin/ServiceRecordManager.tsx",
};

function die(message) {
  throw new Error(message);
}

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) die(`Missing file: ${rel}`);
  return fs.readFileSync(p, "utf8");
}

function backup(rel, content) {
  const p = path.join(ROOT, `${rel}.backup-smart-v3-${STAMP}`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("Backup:", p);
}

function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
}

function blockBounds(src, startMarker, endMarker = "};") {
  const start = src.indexOf(startMarker);
  if (start < 0) die(`Could not find block start: ${startMarker}`);
  const endStart = src.indexOf(endMarker, start);
  if (endStart < 0) die(`Could not find block end after: ${startMarker}`);
  return { start, end: endStart + endMarker.length };
}

function ensureLineBeforeInBlock(src, startMarker, anchorRegex, line, alreadyRegex, label) {
  const { start, end } = blockBounds(src, startMarker);
  const block = src.slice(start, end);
  if (alreadyRegex.test(block)) {
    console.log("SKIP/already present:", label);
    return src;
  }
  const m = block.match(anchorRegex);
  if (!m || m.index == null) die(`Could not find anchor in ${label}`);
  const pos = start + m.index;
  const indent = (block.slice(0, m.index).match(/(?:^|\n)([ \t]*)[^\n]*$/) || [,"  "])[1];
  const insert = `${indent}${line}\n`;
  console.log("OK:", label);
  return src.slice(0, pos) + insert + src.slice(pos);
}

function ensureObjectFieldBefore(src, startMarker, anchorText, fieldText, alreadyText, label) {
  const { start, end } = blockBounds(src, startMarker);
  const block = src.slice(start, end);
  if (block.includes(alreadyText)) {
    console.log("SKIP/already present:", label);
    return src;
  }
  const idx = block.indexOf(anchorText);
  if (idx < 0) die(`Could not find ${anchorText} in ${label}`);
  console.log("OK:", label);
  return src.slice(0, start + idx) + fieldText + src.slice(start + idx);
}

function ensureServicesSelectFields(src, fields, label) {
  let from = 0;
  while (true) {
    const idx = src.indexOf('.from("services")', from);
    if (idx < 0) break;
    const selectIdx = src.indexOf(".select(", idx);
    if (selectIdx < 0 || selectIdx - idx > 1200) {
      from = idx + 10;
      continue;
    }
    const closeIdx = src.indexOf(")", selectIdx);
    if (closeIdx < 0 || closeIdx - selectIdx > 1600) {
      from = idx + 10;
      continue;
    }
    let block = src.slice(selectIdx, closeIdx + 1);
    if (!block.includes("estimated_duration_minutes") || !block.includes("icon_name")) {
      from = idx + 10;
      continue;
    }
    const missing = fields.filter((f) => !block.includes(f));
    if (!missing.length) {
      console.log("SKIP/already present:", label);
      return src;
    }
    if (block.includes("estimated_duration_minutes,")) {
      block = block.replace(
        "estimated_duration_minutes,",
        `estimated_duration_minutes, ${missing.join(", ")},`
      );
    } else if (block.includes("estimated_duration_minutes")) {
      block = block.replace(
        "estimated_duration_minutes",
        `estimated_duration_minutes, ${missing.join(", ")}`
      );
    } else {
      die(`Could not insert service fields for ${label}`);
    }
    console.log("OK:", label);
    return src.slice(0, selectIdx) + block + src.slice(closeIdx + 1);
  }
  die(`Could not find services select query for ${label}`);
}

function insertBeforeMarker(src, marker, content, label, alreadyMarker) {
  if (alreadyMarker && src.includes(alreadyMarker)) {
    console.log("SKIP/already present:", label);
    return src;
  }
  const idx = src.indexOf(marker);
  if (idx < 0) die(`Could not find marker for ${label}`);
  console.log("OK:", label);
  return src.slice(0, idx) + content + src.slice(idx);
}

function replaceRegexRequired(src, regex, replacement, label, alreadyMarker) {
  if (alreadyMarker && src.includes(alreadyMarker)) {
    console.log("SKIP/already present:", label);
    return src;
  }
  if (!regex.test(src)) die(`Could not find expected code for: ${label}`);
  console.log("OK:", label);
  return src.replace(regex, replacement);
}

const original = {};
const updated = {};
for (const [key, rel] of Object.entries(FILES)) {
  original[key] = read(rel);
  updated[key] = original[key];
}

try {
  /* ============================================================
     1) ADMIN SERVICES — robust against formatting changes
  ============================================================ */
  {
    let c = updated.admin;

    c = ensureLineBeforeInBlock(
      c,
      "type Service = {",
      /^\s*icon_name\s*:/m,
      "workload_weight: number;\n  requires_confirmation: boolean;",
      /requires_confirmation\s*:\s*boolean/,
      "Admin Service type"
    );

    c = ensureLineBeforeInBlock(
      c,
      "type ServiceForm = {",
      /^\s*icon_name\s*:/m,
      "workload_weight: number;\n  requires_confirmation: boolean;",
      /requires_confirmation\s*:\s*boolean/,
      "Admin ServiceForm type"
    );

    c = ensureObjectFieldBefore(
      c,
      "const emptyServiceForm: ServiceForm = {",
      'icon_name:',
      "  workload_weight: 1,\n  requires_confirmation: false,\n",
      "requires_confirmation:",
      "Admin empty service defaults"
    );

    c = ensureServicesSelectFields(
      c,
      ["workload_weight", "requires_confirmation"],
      "Admin service load query"
    );

    // openEditService block
    {
      const start = c.indexOf("function openEditService");
      const end = c.indexOf("async function saveService", start);
      if (start < 0 || end < 0) die("Could not locate openEditService()");
      const block = c.slice(start, end);
      if (!block.includes("requires_confirmation:")) {
        const anchor = "icon_name:";
        const idx = block.indexOf(anchor);
        if (idx < 0) die("Could not locate icon_name in openEditService()");
        const insert = `workload_weight: service.workload_weight || 1,\n      requires_confirmation: Boolean(service.requires_confirmation),\n      `;
        c = c.slice(0, start + idx) + insert + c.slice(start + idx);
        console.log("OK: Admin edit-service workload values");
      } else {
        console.log("SKIP/already present: Admin edit-service workload values");
      }
    }

    // save payload block
    {
      const start = c.indexOf("const payload = {", c.indexOf("async function saveService"));
      const end = c.indexOf("};", start);
      if (start < 0 || end < 0) die("Could not locate service save payload");
      const block = c.slice(start, end);
      if (!block.includes("requires_confirmation:")) {
        const anchor = "icon_name:";
        const idx = block.indexOf(anchor);
        if (idx < 0) die("Could not locate icon_name in service payload");
        const insert = `workload_weight: Number(serviceForm.workload_weight || 1),\n      requires_confirmation: serviceForm.requires_confirmation,\n      `;
        c = c.slice(0, start + idx) + insert + c.slice(start + idx);
        console.log("OK: Admin save-service workload values");
      } else {
        console.log("SKIP/already present: Admin save-service workload values");
      }
    }

    if (!c.includes("Requires Availability Confirmation")) {
      const popular = c.indexOf("Mark as Popular");
      if (popular < 0) die('Could not locate "Mark as Popular" in service modal');
      const flex = c.lastIndexOf('<div className="flex flex-wrap gap-4">', popular);
      if (flex < 0) die("Could not locate service option row");
      const controls = `              <div className="grid gap-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-300">
                  Workshop Workload
                  <select
                    value={serviceForm.workload_weight}
                    onChange={(event) => setServiceForm({ ...serviceForm, workload_weight: Number(event.target.value) })}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white outline-none focus:border-red-600"
                  >
                    <option value={1}>Light — 1</option>
                    <option value={2}>Normal — 2</option>
                    <option value={3}>Medium — 3</option>
                    <option value={4}>Heavy — 4</option>
                    <option value={5}>Very Heavy — 5</option>
                  </select>
                  <span className="mt-2 block text-[10px] font-normal leading-4 text-gray-500">Higher values use more of the Daily Workload Capacity.</span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#080808] p-3 text-xs font-semibold text-gray-300">
                  <input
                    type="checkbox"
                    checked={serviceForm.requires_confirmation}
                    onChange={(event) => setServiceForm({ ...serviceForm, requires_confirmation: event.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    Requires Availability Confirmation
                    <span className="mt-1 block text-[10px] font-normal leading-4 text-gray-500">Turn this ON for Engine Repair, Engine Overhaul, Gearbox Repair and other heavy/long jobs. Customers cannot instantly book these online.</span>
                  </span>
                </label>
              </div>

`;
      c = c.slice(0, flex) + controls + c.slice(flex);
      console.log("OK: Admin workload controls");
    } else {
      console.log("SKIP/already present: Admin workload controls");
    }

    updated.admin = c;
  }

  /* ============================================================
     2) PUBLIC HOME — admin preview + heavy-service CTA
  ============================================================ */
  {
    let c = updated.home;

    c = ensureLineBeforeInBlock(
      c,
      "type PublicService = {",
      /^\s*icon_name\s*:/m,
      "workload_weight: number;\n  requires_confirmation: boolean;",
      /requires_confirmation\s*:\s*boolean/,
      "Public Service type"
    );

    c = ensureServicesSelectFields(
      c,
      ["workload_weight", "requires_confirmation"],
      "Public service query"
    );

    if (!c.includes("ADMIN PREVIEW MODE")) {
      const mainIdx = c.indexOf('<main id="top"');
      if (mainIdx < 0) die("Could not locate public <main id=top>");
      const close = c.indexOf(">", mainIdx);
      if (close < 0) die("Could not locate end of public main tag");
      const preview = `
      {loggedIn && (accountRole === "admin" || accountRole === "staff") && (
        <aside className="fixed bottom-4 right-4 z-[140] w-[min(360px,calc(100%-2rem))] rounded-2xl border border-sky-400/40 bg-[#062B55] p-4 text-white shadow-2xl" aria-label="Admin preview controls">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">ADMIN PREVIEW MODE</p>
          <p className="mt-1 text-sm font-semibold">Viewing Customer Site</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Logged in as {accountName}. Customers and logged-out visitors cannot see this control.</p>
          <Link href="/admin" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-xs font-black text-[#062B55] transition hover:bg-sky-50">
            Back to Admin Dashboard
          </Link>
        </aside>
      )}`;
      c = c.slice(0, close + 1) + preview + c.slice(close + 1);
      console.log("OK: Admin customer-site preview");
    } else {
      console.log("SKIP/already present: Admin customer-site preview");
    }

    if (!c.includes("Confirm availability</span>")) {
      const recommended = `<span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-sky-800">Recommended</span>`;
      const idx = c.indexOf(recommended);
      if (idx >= 0) {
        const end = idx + recommended.length;
        const badge = `{service.requires_confirmation && <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-violet-800">Confirm availability</span>}`;
        c = c.slice(0, end) + badge + c.slice(end);
        console.log("OK: Public confirmation badge");
      } else {
        console.log("WARN: Recommended badge not found; skipping optional confirmation badge");
      }
    }

    if (!c.includes(">Confirm availability <span aria-hidden>→</span>")) {
      c = replaceRegexRequired(
        c,
        /<Link href=\{loggedIn \? "\/dashboard\?section=bookings" : "\/register"\} className="text-sm font-bold text-slate-700 transition group-hover:text-red-600">Book now <span aria-hidden>→<\/span><\/Link>/,
        `{service.requires_confirmation ? (
  <button type="button" onClick={() => setContactService(service)} className="text-sm font-bold text-violet-700 transition hover:text-violet-900">
    Confirm availability <span aria-hidden>→</span>
  </button>
) : (
  <Link href={loggedIn ? \`/dashboard?section=bookings&serviceId=\${service.id}\` : "/register"} className="text-sm font-bold text-slate-700 transition group-hover:text-red-600">
    Book now <span aria-hidden>→</span>
  </Link>
)}`,
        "Public heavy-service CTA"
      );
    } else {
      console.log("SKIP/already present: Public heavy-service CTA");
    }

    updated.home = c;
  }

  /* ============================================================
     3) CONTACT MODAL — Call/WhatsApp/Request Availability
  ============================================================ */
  {
    let c = updated.modal;

    c = ensureLineBeforeInBlock(
      c,
      "export type ServiceContactModalService = {",
      /^\s*estimated_duration_minutes\s*:/m,
      "workload_weight: number;\n  requires_confirmation: boolean;",
      /requires_confirmation\s*:\s*boolean/,
      "Contact modal service type"
    );

    if (!c.includes("I would like to check workshop availability")) {
      c = replaceRegexRequired(
        c,
        /const whatsappMessage = `Hello CK Motors, I would like to know the price and details for \$\{service\.name\}\.\$\{showRealPrice \? ` Displayed price: \$\{priceLabel\}` : ""\}`;/,
        `const whatsappMessage = service.requires_confirmation
    ? \`Hello CK Motors, I would like to check workshop availability for \${service.name}. Please let me know a suitable date/time.\`
    : \`Hello CK Motors, I would like to know the price and details for \${service.name}.\${showRealPrice ? \` Displayed price: \${priceLabel}\` : ""}\`;`,
        "Heavy-service WhatsApp message"
      );
    }

    if (!c.includes("This is a heavy/long workshop job")) {
      c = replaceRegexRequired(
        c,
        /<p className="mt-2 text-sm leading-relaxed text-slate-600">\s*Call us for pricing and more information about \{service\.name\}\.\s*<\/p>/,
        `<p className="mt-2 text-sm leading-relaxed text-slate-600">
          {service.requires_confirmation
            ? \`Workshop availability for \${service.name} depends on current workload. Please call, WhatsApp or request availability before confirming.\`
            : \`Call us for pricing and more information about \${service.name}.\`}
        </p>

        {service.requires_confirmation && (
          <div className="mt-4 rounded-xl border border-violet-300 bg-violet-50 p-4 text-violet-900">
            <p className="text-xs font-black uppercase tracking-wide">Availability confirmation required</p>
            <p className="mt-1 text-xs leading-5">This is a heavy/long workshop job and is not available as an instant online booking.</p>
            <p className="mt-2 text-[11px] font-semibold">Workshop Workload: {service.workload_weight || 1} / 5</p>
          </div>
        )}`,
        "Contact confirmation notice"
      );
    }

    if (!c.includes(">Request Availability</button>")) {
      c = replaceRegexRequired(
        c,
        /<Link\s+href=\{bookingHref\}\s+onClick=\{\(\) => trackPublicEvent\("service_book_clicked", \{ serviceId: service\.id, serviceName: service\.name \}\)\}\s+className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-red-600 px-4 py-3\.5 text-base font-black text-white transition hover:bg-red-700"\s*>\s*Book This Service\s*<\/Link>/,
        `{service.requires_confirmation ? (
            <button
              type="button"
              onClick={() => setCallbackState("form")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-700 bg-violet-700 px-4 py-3.5 text-base font-black text-white transition hover:bg-violet-800"
            >
              Request Availability
            </button>
          ) : (
            <Link
              href={bookingHref}
              onClick={() => trackPublicEvent("service_book_clicked", { serviceId: service.id, serviceName: service.name })}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-red-600 px-4 py-3.5 text-base font-black text-white transition hover:bg-red-700"
            >
              Book This Service
            </Link>
          )}`,
        "Request Availability action"
      );
    }

    if (!c.includes('{service.requires_confirmation ? "Request Availability" : "Request a Callback"}')) {
      c = c.replace(
        "Request a Callback",
        `{service.requires_confirmation ? "Request Availability" : "Request a Callback"}`
      );
      console.log("OK: Callback/request-availability label");
    }

    c = c.replace(
      "{nextAvailableLabel && (",
      "{!service.requires_confirmation && nextAvailableLabel && ("
    );

    updated.modal = c;
  }

  /* ============================================================
     4) CUSTOMER BOOKING — block heavy instant booking + workload RPC
  ============================================================ */
  {
    let c = updated.booking;

    if (!c.includes("MessageCircle,")) {
      c = c.replace("  Gauge,\n  Wrench,", "  Gauge,\n  MessageCircle,\n  PhoneCall,\n  Wrench,");
      console.log("OK: Booking contact icons");
    }

    c = ensureLineBeforeInBlock(
      c,
      "type Service = {",
      /^\s*};/m,
      "workload_weight: number;\n  requires_confirmation: boolean;",
      /requires_confirmation\s*:\s*boolean/,
      "Booking Service type"
    );

    c = ensureServicesSelectFields(
      c,
      ["workload_weight", "requires_confirmation"],
      "Booking service query"
    );

    if (!c.includes("const requiresAvailabilityConfirmation")) {
      const marker = `  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === vehicleId
  );`;
      c = insertBeforeMarker(
        c,
        marker + "\n",
        marker + `

  const requiresAvailabilityConfirmation = Boolean(
    selectedService?.requires_confirmation
  );
`,
        "Heavy-service booking state",
        "const requiresAvailabilityConfirmation"
      );
      // remove duplicated marker caused by insert-before approach
      const duplicated = marker + "\n" + marker;
      c = c.replace(duplicated, marker);
    }

    if (!c.includes("This service requires workshop availability confirmation")) {
      const marker = `    if (!bookingDate) {
      setError("Please select a booking date.");
      return;
    }`;
      const guard = `    if (requiresAvailabilityConfirmation) {
      setError("This service requires workshop availability confirmation. Please call, WhatsApp or request availability from CK Motors.");
      return;
    }

`;
      c = insertBeforeMarker(c, marker, guard, "Heavy-service booking guard", "This service requires workshop availability confirmation");
    }

    if (!c.includes("get_available_service_booking_slots")) {
      const start = c.indexOf('  useEffect(() => {\n    if (!bookingDate) return;');
      const dep = c.indexOf("  }, [bookingDate, supabase]);", start);
      if (start < 0 || dep < 0) die("Could not locate booking availability useEffect");
      const end = dep + '  }, [bookingDate, supabase]);'.length;
      const effect = `  useEffect(() => {
    if (!bookingDate || !serviceId || requiresAvailabilityConfirmation) {
      setAvailableTimes([]);
      setBookingTime("");
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingTimes(true);
      setSlotError("");
      void supabase
        .rpc("get_available_service_booking_slots", {
          target_date: bookingDate,
          target_service_id: serviceId,
        })
        .then(({ data, error: availabilityError }) => {
          if (!active) return;
          if (availabilityError) {
            setSlotError(\`Available times could not be loaded: \${availabilityError.message}\`);
            setAvailableTimes([]);
            setBookingTime("");
          } else {
            const slots = (data || []) as Array<{ slot_time: string; remaining_workload: number; availability_status: string }>;
            setAvailableTimes(slots.map((slot) => ({
              slot_time: slot.slot_time,
              remaining_capacity: slot.remaining_workload,
            })));
          }
          setLoadingTimes(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bookingDate, serviceId, requiresAvailabilityConfirmation, supabase]);`;
      c = c.slice(0, start) + effect + c.slice(end);
      console.log("OK: Service-aware workload booking slots");
    }

    c = c.replace(
      "disabled={!bookingDate || loadingTimes || !!slotError}",
      "disabled={!bookingDate || !serviceId || loadingTimes || !!slotError || requiresAvailabilityConfirmation}"
    );

    if (!c.includes("Workshop Workload: {selectedService.workload_weight")) {
      const marker = `            {/* DESCRIPTION */}`;
      const idx = c.indexOf(marker);
      if (idx < 0) die("Could not locate booking description marker");
      const panel = `            {selectedService && requiresAvailabilityConfirmation && (
              <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-4">
                <p className="text-xs font-black text-violet-300">Availability confirmation required</p>
                <p className="mt-1 text-[11px] leading-5 text-gray-400">
                  {selectedService.name} may take several hours or days. Please contact CK Motors before confirming.
                </p>
                <p className="mt-2 text-[11px] font-semibold text-gray-400">
                  Workshop Workload: {selectedService.workload_weight || 1} / 5
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="tel:0772723940" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white"><PhoneCall size={13} /> Call 077 272 3940</a>
                  <a href="tel:0777258599" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white"><PhoneCall size={13} /> Call 077 725 8599</a>
                  <a href={\`https://wa.me/94772723940?text=\${encodeURIComponent(\`Hello CK Motors, I would like to check availability for \${selectedService.name}.\`)}\`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-[11px] font-bold text-white"><MessageCircle size={13} /> WhatsApp CK Motors</a>
                  <a href="/#services" className="inline-flex items-center rounded-lg border border-violet-500 px-3 py-2 text-[11px] font-bold text-violet-200">Request Availability</a>
                </div>
              </div>
            )}

`;
      c = c.slice(0, idx) + panel + c.slice(idx);
      console.log("OK: Heavy-service customer contact panel");
    }

    c = c.replace("disabled={booking}", "disabled={booking || requiresAvailabilityConfirmation}");

    if (!c.includes("Contact CK Motors to Confirm")) {
      c = c.replace(
`{booking
                  ? "Submitting Booking..."
                  : "Confirm Service Booking"}`,
`{booking
                  ? "Submitting Booking..."
                  : requiresAvailabilityConfirmation
                    ? "Contact CK Motors to Confirm"
                    : "Confirm Service Booking"}`
      );
      console.log("OK: Heavy-service submit label");
    }

    updated.booking = c;
  }

  /* ============================================================
     5) WALK-IN / SERVICE RECORD WORKLOAD SNAPSHOT
  ============================================================ */
  {
    let c = updated.record;

    c = ensureLineBeforeInBlock(
      c,
      "type Service = {",
      /^\s*active\s*:/m,
      "workload_weight: number;",
      /workload_weight\s*:\s*number/,
      "Walk-In Service type"
    );

    // This query is simple and predictable.
    if (!c.includes('.select("id, name, workload_weight, active")')) {
      if (!c.includes('.select("id, name, active")')) die("Could not locate Walk-In services query");
      c = c.replace('.select("id, name, active")', '.select("id, name, workload_weight, active")');
      console.log("OK: Walk-In service workload query");
    }

    if (!c.includes("const primaryWorkloadService")) {
      const marker = `  const customPerformedText = performedLines
    .filter((line) => !services.some((service) => service.name === line.trim()))
    .join("\\n");`;
      if (!c.includes(marker)) die("Could not locate Walk-In performed service calculation");
      c = c.replace(
        marker,
        marker + `
  const primaryWorkloadService = selectedPerformedServices.reduce<Service | null>(
    (current, service) =>
      !current || Number(service.workload_weight || 1) > Number(current.workload_weight || 1)
        ? service
        : current,
    null
  );
  const calculatedWorkload = Number(primaryWorkloadService?.workload_weight || 1);`
      );
      console.log("OK: Walk-In workload calculation");
    }

    if (!c.includes('set_service_record_workload')) {
      const marker = `    if (selectedJobCardId) {`;
      const insert = `    const { error: workloadError } = await supabase.rpc("set_service_record_workload", {
      target_record_id: record.id,
      target_service_id: primaryWorkloadService?.id || null,
      target_workload_weight: calculatedWorkload,
    });
    if (workloadError) {
      console.warn("Service workload snapshot could not be saved:", workloadError.message);
    }

`;
      c = insertBeforeMarker(c, marker, insert, "Walk-In workload snapshot", "set_service_record_workload");
    }

    updated.record = c;
  }

  /* ============================================================
     VALIDATE EVERYTHING BEFORE WRITING
  ============================================================ */
  const checks = [
    ["admin", "Workshop Workload"],
    ["admin", "Requires Availability Confirmation"],
    ["home", "ADMIN PREVIEW MODE"],
    ["home", "Back to Admin Dashboard"],
    ["home", "Confirm availability"],
    ["modal", "Request Availability"],
    ["booking", "get_available_service_booking_slots"],
    ["booking", "Contact CK Motors to Confirm"],
    ["record", "set_service_record_workload"],
  ];

  for (const [key, needle] of checks) {
    if (!updated[key].includes(needle)) die(`Validation failed: ${needle} missing from ${FILES[key]}`);
  }

  for (const [key, rel] of Object.entries(FILES)) {
    if (updated[key] !== original[key]) backup(rel, original[key]);
  }

  for (const [key, rel] of Object.entries(FILES)) {
    if (updated[key] !== original[key]) {
      write(rel, updated[key]);
      console.log("Changed:", rel);
    }
  }

  const report = `SUCCESS: CK Motors Smart Fix V3 completed.

Installed/verified:
- Admin Services: Workshop Workload 1-5
- Admin Services: Requires Availability Confirmation
- Heavy/engine services: no instant online booking when confirmation is ON
- Call / WhatsApp / Request Availability
- Workload-aware service booking slots
- Walk-In / Quick Invoice workload snapshot
- Admin-only ADMIN PREVIEW MODE on customer/public site
- Back to Admin Dashboard
- Normal customers/logged-out visitors do not see the admin preview control

No project files were deleted.
Timestamped backups were created for every changed file.

NEXT:
1. npm run build
2. npm run dev
3. Admin > Services > Edit Engine Repair
4. Workload = Heavy (4) or Very Heavy (5)
5. Requires Availability Confirmation = ON
6. Save
7. View Customer Site and verify ADMIN PREVIEW MODE
8. Test Engine Repair from public/customer side
`;

  fs.writeFileSync(path.join(ROOT, "CK_SMART_FIX_V3_REPORT.txt"), report, "utf8");
  console.log("\n" + report);
} catch (error) {
  console.error("\nERROR:", error.message);
  console.error("No changed project files were written. Existing project remains unchanged.");
  process.exit(1);
}
