const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const FILES = {
  home: "src/app/page.tsx",
  modal: "src/components/services/ServiceContactModal.tsx",
  booking: "src/components/dashboard/BookingManager.tsx",
  record: "src/components/admin/ServiceRecordManager.tsx",
  jobs: "src/components/admin/JobCardManager.tsx",
};

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(p, "utf8");
}
function backup(rel, content) {
  const p = path.join(ROOT, `${rel}.backup-remaining-v1-${STAMP}`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("Backup:", p);
}
function replaceOnce(src, oldText, newText, label, marker) {
  if (marker && src.includes(marker)) {
    console.log("SKIP/already present:", label);
    return src;
  }
  if (!src.includes(oldText)) throw new Error(`Could not find expected code for: ${label}`);
  console.log("OK:", label);
  return src.replace(oldText, newText);
}
function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
}

const original = {};
const updated = {};
for (const [k, rel] of Object.entries(FILES)) {
  original[k] = read(rel);
  updated[k] = original[k];
}

try {
  /* ============================================================
     1) PUBLIC HOME: admin preview + heavy-service CTA
  ============================================================ */
  let h = updated.home;

  h = replaceOnce(
    h,
`  price_from: number | null;
  estimated_duration_minutes: number | null;
  icon_name: string | null;`,
`  price_from: number | null;
  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
  icon_name: string | null;`,
    "Public service type",
    "requires_confirmation: boolean;\n  icon_name"
  );

  h = replaceOnce(
    h,
`.select("id, name, category, description, price_from, estimated_duration_minutes, icon_name, is_popular, is_recommended")`,
`.select("id, name, category, description, price_from, estimated_duration_minutes, workload_weight, requires_confirmation, icon_name, is_popular, is_recommended")`,
    "Public service query",
    "estimated_duration_minutes, workload_weight, requires_confirmation, icon_name"
  );

  if (!h.includes("ADMIN PREVIEW MODE")) {
    h = replaceOnce(
      h,
`    <main id="top" className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <nav`,
`    <main id="top" className="min-h-screen bg-[#f5f6f8] text-slate-900">
      {loggedIn && (accountRole === "admin" || accountRole === "staff") && (
        <aside className="fixed bottom-4 right-4 z-[140] w-[min(360px,calc(100%-2rem))] rounded-2xl border border-sky-400/40 bg-[#062B55] p-4 text-white shadow-2xl" aria-label="Admin preview controls">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">ADMIN PREVIEW MODE</p>
          <p className="mt-1 text-sm font-semibold">Viewing Customer Site</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Logged in as {accountName}. This control is visible only to admin/staff.</p>
          <Link href="/admin" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-xs font-black text-[#062B55] transition hover:bg-sky-50">
            Back to Admin Dashboard
          </Link>
        </aside>
      )}
      <nav`,
      "Admin Preview Mode"
    );
  }

  if (!h.includes("Confirm availability</span>")) {
    h = replaceOnce(
      h,
`{service.is_recommended && <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-sky-800">Recommended</span>}`,
`{service.is_recommended && <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-sky-800">Recommended</span>}{service.requires_confirmation && <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-violet-800">Confirm availability</span>}`,
      "Heavy-service badge"
    );
  }

  if (!h.includes("Confirm availability <span aria-hidden>→</span>")) {
    h = replaceOnce(
      h,
`<Link href={loggedIn ? "/dashboard?section=bookings" : "/register"} className="text-sm font-bold text-slate-700 transition group-hover:text-red-600">Book now <span aria-hidden>→</span></Link>`,
`{service.requires_confirmation ? (
  <button
    type="button"
    onClick={() => setContactService(service)}
    className="text-sm font-bold text-violet-700 transition hover:text-violet-900"
  >
    Confirm availability <span aria-hidden>→</span>
  </button>
) : (
  <Link
    href={loggedIn ? \`/dashboard?section=bookings&serviceId=\${service.id}\` : "/register"}
    className="text-sm font-bold text-slate-700 transition group-hover:text-red-600"
  >
    Book now <span aria-hidden>→</span>
  </Link>
)}`,
      "Public heavy-service CTA"
    );
  }

  updated.home = h;

  /* ============================================================
     2) CONTACT MODAL: Call + WhatsApp + Request Availability
  ============================================================ */
  let m = updated.modal;

  m = replaceOnce(
    m,
`  icon_name: string | null;
  estimated_duration_minutes: number | null;
};`,
`  icon_name: string | null;
  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
};`,
    "Contact modal service type",
    "requires_confirmation: boolean;\n};"
  );

  if (!m.includes("I would like to check workshop availability")) {
    m = replaceOnce(
      m,
`  const whatsappMessage = \`Hello CK Motors, I would like to know the price and details for \${service.name}.\${showRealPrice ? \` Displayed price: \${priceLabel}\` : ""}\`;`,
`  const whatsappMessage = service.requires_confirmation
    ? \`Hello CK Motors, I would like to check workshop availability for \${service.name}. Please let me know a suitable date/time.\`
    : \`Hello CK Motors, I would like to know the price and details for \${service.name}.\${showRealPrice ? \` Displayed price: \${priceLabel}\` : ""}\`;`,
      "Availability WhatsApp message"
    );
  }

  if (!m.includes("This is a heavy/long workshop job")) {
    m = replaceOnce(
      m,
`        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Call us for pricing and more information about {service.name}.
        </p>`,
`        <p className="mt-2 text-sm leading-relaxed text-slate-600">
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
      "Availability notice"
    );
  }

  if (!m.includes(">Request Availability</button>")) {
    m = replaceOnce(
      m,
`          <Link
            href={bookingHref}
            onClick={() => trackPublicEvent("service_book_clicked", { serviceId: service.id, serviceName: service.name })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-red-600 px-4 py-3.5 text-base font-black text-white transition hover:bg-red-700"
          >
            Book This Service
          </Link>`,
`          {service.requires_confirmation ? (
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
      "Request Availability button"
    );
  }

  if (!m.includes('{service.requires_confirmation ? "Request Availability" : "Request a Callback"}')) {
    m = m.replace(
      "Request a Callback",
      '{service.requires_confirmation ? "Request Availability" : "Request a Callback"}'
    );
    console.log("OK: Callback label");
  }

  if (m.includes("{nextAvailableLabel && (")) {
    m = m.replace("{nextAvailableLabel && (", "{!service.requires_confirmation && nextAvailableLabel && (");
  }

  updated.modal = m;

  /* ============================================================
     3) CUSTOMER BOOKING: workload slots + heavy booking block
  ============================================================ */
  let b = updated.booking;

  if (!b.includes("MessageCircle,")) {
    b = replaceOnce(
      b,
`  Clock3,
  Gauge,
  Wrench,`,
`  Clock3,
  Gauge,
  MessageCircle,
  PhoneCall,
  Wrench,`,
      "Booking contact icons"
    );
  }

  b = replaceOnce(
    b,
`  price_from: number | null;
  estimated_duration_minutes: number | null;
};`,
`  price_from: number | null;
  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
};`,
    "Booking service type",
    "requires_confirmation: boolean;\n};"
  );

  b = replaceOnce(
    b,
`            "id, name, category, description, price_from, estimated_duration_minutes"`,
`            "id, name, category, description, price_from, estimated_duration_minutes, workload_weight, requires_confirmation"`,
    "Booking service query",
    "estimated_duration_minutes, workload_weight, requires_confirmation"
  );

  if (!b.includes("get_available_service_booking_slots")) {
    b = replaceOnce(
      b,
`  useEffect(() => {
    if (!bookingDate) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingTimes(true);
      setSlotError("");
      void supabase.rpc("get_available_booking_slots", { target_date: bookingDate }).then(({ data, error: availabilityError }) => {
        if (!active) return;
        if (availabilityError) {
          setSlotError(\`Available times could not be loaded: \${availabilityError.message}\`);
          setAvailableTimes([]);
          setBookingTime("");
        } else {
          const slots = (data || []) as Array<{ slot_time: string; remaining_capacity: number }>;
          setAvailableTimes(slots);
        }
        setLoadingTimes(false);
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bookingDate, supabase]);`,
`  useEffect(() => {
    const chosenService = services.find((service) => service.id === serviceId);
    if (!bookingDate || !serviceId || chosenService?.requires_confirmation) {
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
  }, [bookingDate, serviceId, services, supabase]);`,
      "Workload-aware booking slots"
    );
  }

  if (!b.includes("const requiresAvailabilityConfirmation")) {
    b = replaceOnce(
      b,
`  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === vehicleId
  );`,
`  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === vehicleId
  );

  const requiresAvailabilityConfirmation = Boolean(
    selectedService?.requires_confirmation
  );`,
      "Heavy booking state"
    );
  }

  if (!b.includes("This service requires workshop availability confirmation")) {
    b = replaceOnce(
      b,
`    if (!bookingDate) {
      setError("Please select a booking date.");
      return;
    }`,
`    if (requiresAvailabilityConfirmation) {
      setError("This service requires workshop availability confirmation. Please call, WhatsApp or request availability from CK Motors.");
      return;
    }

    if (!bookingDate) {
      setError("Please select a booking date.");
      return;
    }`,
      "Heavy booking guard"
    );
  }

  b = b.replace(
    "disabled={!bookingDate || loadingTimes || !!slotError}",
    "disabled={!bookingDate || !serviceId || loadingTimes || !!slotError || requiresAvailabilityConfirmation}"
  );

  b = b.replace(
    `bookingDate && !loadingTimes && availableTimes.length === 0 ?`,
    `bookingDate && !requiresAvailabilityConfirmation && !loadingTimes && availableTimes.length === 0 ?`
  );

  if (!b.includes("Workshop Workload: {selectedService.workload_weight")) {
    b = replaceOnce(
      b,
`                    <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-semibold text-gray-500">
                       {selectedService.price_from !== null && (`,
`                    <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-semibold text-gray-500">
                      <span>Workshop Workload: {selectedService.workload_weight || 1} / 5</span>
                       {selectedService.price_from !== null && (`,
      "Selected service workload label"
    );
  }

  if (!b.includes("Contact CK Motors to Confirm")) {
    b = replaceOnce(
      b,
`              </div>
            )}

            {/* DESCRIPTION */}`,
`              </div>
            )}

            {selectedService && requiresAvailabilityConfirmation && (
              <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-4">
                <p className="text-xs font-black text-violet-300">Availability confirmation required</p>
                <p className="mt-1 text-[11px] leading-5 text-gray-400">
                  {selectedService.name} may take several hours or days. Please contact CK Motors before confirming.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="tel:0772723940" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white"><PhoneCall size={13} /> Call 077 272 3940</a>
                  <a href="tel:0777258599" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white"><PhoneCall size={13} /> Call 077 725 8599</a>
                  <a href={\`https://wa.me/94772723940?text=\${encodeURIComponent(\`Hello CK Motors, I would like to check availability for \${selectedService.name}.\`)}\`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-[11px] font-bold text-white"><MessageCircle size={13} /> WhatsApp CK Motors</a>
                  <a href="/#services" className="inline-flex items-center rounded-lg border border-violet-500 px-3 py-2 text-[11px] font-bold text-violet-200">Request Availability</a>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}`,
      "Heavy-service booking contact panel"
    );

    b = b.replace("disabled={booking}", "disabled={booking || requiresAvailabilityConfirmation}");
    b = b.replace(
`                {booking
                  ? "Submitting Booking..."
                  : "Confirm Service Booking"}`,
`                {booking
                  ? "Submitting Booking..."
                  : requiresAvailabilityConfirmation
                    ? "Contact CK Motors to Confirm"
                    : "Confirm Service Booking"}`
    );
  }

  updated.booking = b;

  /* ============================================================
     4) WALK-IN / QUICK INVOICE: workload snapshot
  ============================================================ */
  let r = updated.record;

  r = replaceOnce(
    r,
`type Service = {
  id: string;
  name: string;
  active: boolean;
};`,
`type Service = {
  id: string;
  name: string;
  workload_weight: number;
  active: boolean;
};`,
    "Walk-In service type",
    "workload_weight: number;\n  active: boolean;"
  );

  r = replaceOnce(
    r,
`.select("id, name, active")`,
`.select("id, name, workload_weight, active")`,
    "Walk-In service query",
    '.select("id, name, workload_weight, active")'
  );

  if (!r.includes("const primaryWorkloadService")) {
    r = replaceOnce(
      r,
`  const customPerformedText = performedLines
    .filter((line) => !services.some((service) => service.name === line.trim()))
    .join("\n");`,
`  const customPerformedText = performedLines
    .filter((line) => !services.some((service) => service.name === line.trim()))
    .join("\n");
  const primaryWorkloadService = selectedPerformedServices.reduce<Service | null>(
    (current, service) =>
      !current || Number(service.workload_weight || 1) > Number(current.workload_weight || 1)
        ? service
        : current,
    null
  );
  const calculatedWorkload = Number(primaryWorkloadService?.workload_weight || 1);`,
      "Walk-In workload calculation"
    );
  }

  if (!r.includes("set_service_record_workload")) {
    r = replaceOnce(
      r,
`    if (selectedJobCardId) {`,
`    const { error: workloadError } = await supabase.rpc("set_service_record_workload", {
      target_record_id: record.id,
      target_service_id: primaryWorkloadService?.id || null,
      target_workload_weight: calculatedWorkload,
    });
    if (workloadError) {
      console.warn("Service workload snapshot could not be saved:", workloadError.message);
    }

    if (selectedJobCardId) {`,
      "Walk-In workload save"
    );
  }

  updated.record = r;

  /* ============================================================
     5) JOB CARDS: standalone walk-in workload + multi-day dates
  ============================================================ */
  let j = updated.jobs;

  if (!j.includes("workload_weight: number;")) {
    j = replaceOnce(
      j,
`  estimated_completion_at: string | null;
  status: JobStatus;`,
`  estimated_completion_at: string | null;
  workload_weight: number;
  workload_start_date: string;
  estimated_completion_date: string | null;
  status: JobStatus;`,
      "JobCard workload type"
    );
  }

  if (!j.includes('workload_weight, workload_start_date, estimated_completion_date')) {
    j = replaceOnce(
      j,
`supabase.from("job_cards").select("id, job_card_number, booking_id, customer_id, vehicle_id, assigned_technician_id, current_mileage, fuel_level, customer_complaint, inspection_notes, requested_services, estimated_completion_at, status, internal_notes, created_at")`,
`supabase.from("job_cards").select("id, job_card_number, booking_id, customer_id, vehicle_id, assigned_technician_id, current_mileage, fuel_level, customer_complaint, inspection_notes, requested_services, estimated_completion_at, workload_weight, workload_start_date, estimated_completion_date, status, internal_notes, created_at")`,
      "JobCard workload query"
    );
  }

  if (!j.includes('workload_weight: "1"')) {
    j = replaceOnce(
      j,
`    estimated_completion_at: "",
    internal_notes: "",`,
`    estimated_completion_at: "",
    workload_weight: "1",
    internal_notes: "",`,
      "JobCard form workload field"
    );
  }

  if (!j.includes('workload_weight: card.workload_weight?.toString()')) {
    j = replaceOnce(
      j,
`      estimated_completion_at: card.estimated_completion_at ? new Date(card.estimated_completion_at).toISOString().slice(0, 16) : "",
      internal_notes: card.internal_notes || "",`,
`      estimated_completion_at: card.estimated_completion_at ? new Date(card.estimated_completion_at).toISOString().slice(0, 16) : "",
      workload_weight: card.workload_weight?.toString() || "1",
      internal_notes: card.internal_notes || "",`,
      "JobCard edit workload mapping"
    );
  }

  if (!j.includes("workload_start_date:")) {
    j = replaceOnce(
      j,
`      estimated_completion_at: form.estimated_completion_at ? new Date(form.estimated_completion_at).toISOString() : null,
      internal_notes: form.internal_notes.trim() || null,`,
`      estimated_completion_at: form.estimated_completion_at ? new Date(form.estimated_completion_at).toISOString() : null,
      workload_weight: Math.min(5, Math.max(1, Number(form.workload_weight || 1))),
      workload_start_date: flow === "booking" ? (selectedBooking?.booking_date || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10),
      estimated_completion_date: form.estimated_completion_at ? new Date(form.estimated_completion_at).toISOString().slice(0, 10) : null,
      internal_notes: form.internal_notes.trim() || null,`,
      "JobCard workload payload"
    );
  }

  if (!j.includes("Walk-In Job Workload")) {
    j = replaceOnce(
      j,
`            <label className="text-xs font-bold text-gray-400">Estimated completion<input type="datetime-local" value={form.estimated_completion_at} onChange={(event) => setForm({ ...form, estimated_completion_at: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>`,
`            <label className="text-xs font-bold text-gray-400">Estimated completion<input type="datetime-local" value={form.estimated_completion_at} onChange={(event) => setForm({ ...form, estimated_completion_at: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>
            {flow === "walk-in" && <label className="text-xs font-bold text-gray-400">Walk-In Job Workload<select value={form.workload_weight} onChange={(event) => setForm({ ...form, workload_weight: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white"><option value="1">Light — 1</option><option value="2">Normal — 2</option><option value="3">Medium — 3</option><option value="4">Heavy — 4</option><option value="5">Very Heavy — 5</option></select></label>}`,
      "JobCard walk-in workload UI"
    );
  }

  updated.jobs = j;

  /* ============================================================
     VALIDATE BEFORE WRITING
  ============================================================ */
  const checks = [
    [updated.home, "ADMIN PREVIEW MODE"],
    [updated.home, "Back to Admin Dashboard"],
    [updated.home, "Confirm availability"],
    [updated.modal, "Request Availability"],
    [updated.booking, "get_available_service_booking_slots"],
    [updated.booking, "Contact CK Motors to Confirm"],
    [updated.record, "set_service_record_workload"],
    [updated.jobs, "Walk-In Job Workload"],
  ];

  for (const [content, needle] of checks) {
    if (!content.includes(needle)) throw new Error(`Validation failed: ${needle}`);
  }

  for (const [k, rel] of Object.entries(FILES)) {
    if (updated[k] !== original[k]) backup(rel, original[k]);
  }
  for (const [k, rel] of Object.entries(FILES)) {
    if (updated[k] !== original[k]) {
      write(rel, updated[k]);
      console.log("Changed:", rel);
    }
  }

  console.log("\nSUCCESS: All remaining CK Motors features installed.");
  console.log("Nothing was deleted.");
  console.log("\nNEXT:");
  console.log("1) npm run build");
  console.log("2) npm run dev");
  console.log("3) Test View Customer Site -> ADMIN PREVIEW MODE");
  console.log("4) Test Engine Repair -> Confirm availability / Call / WhatsApp / Request Availability");
  console.log("5) Test customer booking + walk-in/job-card workload");
} catch (e) {
  console.error("\nERROR:", e.message);
  console.error("No project files were written because validation runs before writes.");
  process.exit(1);
}
