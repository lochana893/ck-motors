const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const files = {
  admin: "src/app/admin/page.tsx",
  home: "src/app/page.tsx",
  booking: "src/components/dashboard/BookingManager.tsx",
  modal: "src/components/services/ServiceContactModal.tsx",
  record: "src/components/admin/ServiceRecordManager.tsx",
};

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(p, "utf8");
}

function backup(rel, content) {
  const out = path.join(ROOT, `${rel}.backup-v5-${STAMP}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
  console.log("Backup:", out);
}

function exact(src, oldText, newText, label, marker) {
  if (marker && src.includes(marker)) {
    console.log("SKIP/already present:", label);
    return src;
  }
  if (!src.includes(oldText)) throw new Error(`Could not find expected code for: ${label}`);
  console.log("OK:", label);
  return src.replace(oldText, newText);
}

const original = {};
const updated = {};
for (const [k, rel] of Object.entries(files)) {
  original[k] = read(rel);
  updated[k] = original[k];
}

try {
  /* ============================================================
     ADMIN SERVICE EDITOR
  ============================================================ */
  let a = updated.admin;

  a = exact(
    a,
`type Service = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  price_from: number | null;
  estimated_duration_minutes: number | null;
  icon_name: string | null;`,
`type Service = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  price_from: number | null;
  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
  icon_name: string | null;`,
    "Admin Service type",
    "type Service = {\n  id: string;\n  name: string;\n  slug: string;\n  category: string | null;\n  description: string | null;\n  price_from: number | null;\n  estimated_duration_minutes: number | null;\n  workload_weight: number;"
  );

  a = exact(
    a,
`type ServiceForm = {
  name: string;
  slug: string;
  category: string;
  description: string;
  price_from: string;
  estimated_duration_minutes: string;
  icon_name: string | null;`,
`type ServiceForm = {
  name: string;
  slug: string;
  category: string;
  description: string;
  price_from: string;
  estimated_duration_minutes: string;
  workload_weight: number;
  requires_confirmation: boolean;
  icon_name: string | null;`,
    "ServiceForm type",
    "type ServiceForm = {\n  name: string;\n  slug: string;\n  category: string;\n  description: string;\n  price_from: string;\n  estimated_duration_minutes: string;\n  workload_weight: number;"
  );

  a = exact(
    a,
`  price_from: "",
  estimated_duration_minutes: "",
  icon_name: "Wrench",`,
`  price_from: "",
  estimated_duration_minutes: "",
  workload_weight: 1,
  requires_confirmation: false,
  icon_name: "Wrench",`,
    "ServiceForm defaults",
    "workload_weight: 1,\n  requires_confirmation: false"
  );

  // Add fields to the service SELECT that loads admin services.
  if (!/estimated_duration_minutes[\s\S]{0,100}workload_weight[\s\S]{0,100}requires_confirmation/.test(a)) {
    const idx = a.indexOf(".from(\"services\")");
    if (idx < 0) throw new Error("Could not find admin services query");
    const selStart = a.indexOf(".select(", idx);
    const selEnd = a.indexOf(")", selStart);
    if (selStart < 0 || selEnd < 0 || selEnd - selStart > 2500) throw new Error("Could not parse admin services select");
    let sel = a.slice(selStart, selEnd + 1);
    if (!sel.includes("estimated_duration_minutes")) throw new Error("Admin services select did not contain expected fields");
    sel = sel.replace("estimated_duration_minutes,", "estimated_duration_minutes,\n          workload_weight,\n          requires_confirmation,");
    a = a.slice(0, selStart) + sel + a.slice(selEnd + 1);
    console.log("OK: Admin service query");
  } else {
    console.log("SKIP/already present: Admin service query");
  }

  a = exact(
    a,
`      estimated_duration_minutes:
        service.estimated_duration_minutes?.toString() ||
        "",
      icon_name: service.icon_name || "Wrench",`,
`      estimated_duration_minutes:
        service.estimated_duration_minutes?.toString() ||
        "",
      workload_weight: service.workload_weight || 1,
      requires_confirmation: Boolean(service.requires_confirmation),
      icon_name: service.icon_name || "Wrench",`,
    "Edit Service workload mapping",
    "requires_confirmation: Boolean(service.requires_confirmation)"
  );

  a = exact(
    a,
`      icon_name: serviceForm.icon_name || null,
      is_popular: serviceForm.is_popular,`,
`      workload_weight: Number(serviceForm.workload_weight || 1),
      requires_confirmation: serviceForm.requires_confirmation,
      icon_name: serviceForm.icon_name || null,
      is_popular: serviceForm.is_popular,`,
    "Save Service workload mapping",
    "requires_confirmation: serviceForm.requires_confirmation"
  );

  if (!a.includes("Requires Availability Confirmation")) {
    const marker = `              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-3 text-xs font-semibold text-gray-400">`;
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
                      Turn this ON for Engine Repair, Engine Overhaul, Gearbox Repair and other long jobs. Customers must contact CK Motors instead of instantly booking online.
                    </span>
                  </span>
                </label>
              </div>

`;
    if (!a.includes(marker)) throw new Error("Could not find Popular/Recommended row in Edit Service");
    a = a.replace(marker, controls + marker);
    console.log("OK: Visible service workload controls");
  } else {
    console.log("SKIP/already present: Visible service workload controls");
  }

  updated.admin = a;

  /* ============================================================
     PUBLIC HOME + ADMIN PREVIEW
  ============================================================ */
  let h = updated.home;

  h = exact(
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

  h = exact(
    h,
`.select("id, name, category, description, price_from, estimated_duration_minutes, icon_name, is_popular, is_recommended")`,
`.select("id, name, category, description, price_from, estimated_duration_minutes, workload_weight, requires_confirmation, icon_name, is_popular, is_recommended")`,
    "Public service query",
    "estimated_duration_minutes, workload_weight, requires_confirmation, icon_name"
  );

  if (!h.includes("ADMIN PREVIEW MODE")) {
    h = exact(
      h,
`    <main id="top" className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <nav`,
`    <main id="top" className="min-h-screen bg-[#f5f6f8] text-slate-900">
      {loggedIn && (accountRole === "admin" || accountRole === "staff") && (
        <aside className="fixed bottom-4 right-4 z-[140] w-[min(360px,calc(100%-2rem))] rounded-2xl border border-sky-400/40 bg-[#062B55] p-4 text-white shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">ADMIN PREVIEW MODE</p>
          <p className="mt-1 text-sm font-semibold">Viewing Customer Site</p>
          <p className="mt-1 text-xs text-slate-300">Logged in as {accountName}. This control is visible only to admin/staff.</p>
          <Link href="/admin" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-xs font-black text-[#062B55]">
            Back to Admin Dashboard
          </Link>
        </aside>
      )}
      <nav`,
      "Admin Preview Mode"
    );
  }

  if (!h.includes("Confirm availability")) {
    h = exact(
      h,
`{service.is_recommended && <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-sky-800">Recommended</span>}`,
`{service.is_recommended && <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-sky-800">Recommended</span>}{service.requires_confirmation && <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-violet-800">Confirm availability</span>}`,
      "Confirmation badge"
    );

    h = exact(
      h,
`<Link href={loggedIn ? "/dashboard?section=bookings" : "/register"} className="text-sm font-bold text-slate-700 transition group-hover:text-red-600">Book now <span aria-hidden>→</span></Link>`,
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
  }

  updated.home = h;

  /* ============================================================
     SERVICE CONTACT MODAL
  ============================================================ */
  let m = updated.modal;

  m = exact(
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
    m = exact(
      m,
`  const whatsappMessage = \`Hello CK Motors, I would like to know the price and details for \${service.name}.\${showRealPrice ? \` Displayed price: \${priceLabel}\` : ""}\`;`,
`  const whatsappMessage = service.requires_confirmation
    ? \`Hello CK Motors, I would like to check workshop availability for \${service.name}. Please let me know a suitable date/time.\`
    : \`Hello CK Motors, I would like to know the price and details for \${service.name}.\${showRealPrice ? \` Displayed price: \${priceLabel}\` : ""}\`;`,
      "WhatsApp availability message"
    );
  }

  if (!m.includes("This is a heavy/long workshop job")) {
    m = exact(
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
      "Availability confirmation notice"
    );
  }

  if (!m.includes("Request Availability")) {
    m = exact(
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
    m = m.replace("Request a Callback", '{service.requires_confirmation ? "Request Availability" : "Request a Callback"}');
  }

  updated.modal = m;

  /* ============================================================
     CUSTOMER BOOKING
  ============================================================ */
  let b = updated.booking;

  if (!b.includes("MessageCircle,")) {
    b = exact(
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

  b = exact(
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

  b = exact(
    b,
`            "id, name, category, description, price_from, estimated_duration_minutes"`,
`            "id, name, category, description, price_from, estimated_duration_minutes, workload_weight, requires_confirmation"`,
    "Booking service query",
    "estimated_duration_minutes, workload_weight, requires_confirmation"
  );

  if (!b.includes("get_available_service_booking_slots")) {
    b = exact(
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
    if (!bookingDate || !serviceId) {
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
  }, [bookingDate, serviceId, supabase]);`,
      "Workload-aware booking slots"
    );
  }

  if (!b.includes("const requiresAvailabilityConfirmation")) {
    b = exact(
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
    b = exact(
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
      "Block instant heavy booking"
    );
  }

  b = b.replace(
    "disabled={!bookingDate || loadingTimes || !!slotError}",
    "disabled={!bookingDate || !serviceId || loadingTimes || !!slotError || requiresAvailabilityConfirmation}"
  );

  if (!b.includes("Workshop Workload: {selectedService.workload_weight")) {
    b = exact(
      b,
`            {/* DESCRIPTION */}`,
`            {selectedService && requiresAvailabilityConfirmation && (
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

            {/* DESCRIPTION */}`,
      "Heavy-service contact panel"
    );
  }

  b = b.replace("disabled={booking}", "disabled={booking || requiresAvailabilityConfirmation}");

  if (!b.includes("Contact CK Motors to Confirm")) {
    b = exact(
      b,
`                {booking
                  ? "Submitting Booking..."
                  : "Confirm Service Booking"}`,
`                {booking
                  ? "Submitting Booking..."
                  : requiresAvailabilityConfirmation
                    ? "Contact CK Motors to Confirm"
                    : "Confirm Service Booking"}`,
      "Heavy booking submit label"
    );
  }

  updated.booking = b;

  /* ============================================================
     WALK-IN / QUICK INVOICE WORKLOAD
  ============================================================ */
  let r = updated.record;

  r = exact(
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
    "Walk-In Service type",
    "type Service = {\n  id: string;\n  name: string;\n  workload_weight: number;"
  );

  r = exact(
    r,
`.select("id, name, active")`,
`.select("id, name, workload_weight, active")`,
    "Walk-In services query",
    '.select("id, name, workload_weight, active")'
  );

  if (!r.includes("const primaryWorkloadService")) {
    r = exact(
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
    r = exact(
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
     VALIDATE BEFORE WRITING
  ============================================================ */
  const checks = [
    [updated.admin, "Workshop Workload"],
    [updated.admin, "Requires Availability Confirmation"],
    [updated.home, "ADMIN PREVIEW MODE"],
    [updated.home, "Back to Admin Dashboard"],
    [updated.home, "Confirm availability"],
    [updated.modal, "Request Availability"],
    [updated.booking, "get_available_service_booking_slots"],
    [updated.booking, "Contact CK Motors to Confirm"],
    [updated.record, "set_service_record_workload"],
  ];
  for (const [content, needle] of checks) {
    if (!content.includes(needle)) throw new Error(`Validation failed: ${needle}`);
  }

  for (const [k, rel] of Object.entries(files)) {
    if (updated[k] !== original[k]) backup(rel, original[k]);
  }

  for (const [k, rel] of Object.entries(files)) {
    if (updated[k] !== original[k]) {
      fs.writeFileSync(path.join(ROOT, rel), updated[k], "utf8");
      console.log("Changed:", rel);
    }
  }

  console.log("\nSUCCESS: CK Motors final V5 features installed.");
  console.log("Nothing was deleted.");
  console.log("\nNEXT:");
  console.log("1) npm run build");
  console.log("2) npm run dev");
  console.log("3) Admin > Services > Edit Engine Repair");
  console.log("4) Set Heavy (4) + Requires Availability Confirmation ON");
  console.log("5) View Customer Site -> ADMIN PREVIEW MODE + Back to Admin Dashboard");
  console.log("6) Engine Repair public/customer -> Confirm availability + Call/WhatsApp/Request Availability");
} catch (e) {
  console.error("\nERROR:", e.message);
  console.error("No project files were written because validation occurs before writes.");
  process.exit(1);
}
