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

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(p, "utf8");
}

function backup(rel, content) {
  const p = path.join(ROOT, `${rel}.backup-all-remaining-${STAMP}`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("Backup:", p);
}

function replaceOnce(src, oldText, newText, label, alreadyMarker) {
  if (alreadyMarker && src.includes(alreadyMarker)) {
    console.log("SKIP/already present:", label);
    return src;
  }
  if (!src.includes(oldText)) {
    throw new Error(`Could not find expected code for: ${label}`);
  }
  console.log("OK:", label);
  return src.replace(oldText, newText);
}

function write(rel, content) {
  const p = path.join(ROOT, rel);
  fs.writeFileSync(p, content, "utf8");
}

const original = {};
const updated = {};
for (const [key, rel] of Object.entries(FILES)) {
  original[key] = read(rel);
  updated[key] = original[key];
}

try {
  /* ============================================================
     A. ADMIN > SERVICES
  ============================================================ */
  {
    let c = updated.admin;

    c = replaceOnce(
      c,
`  estimated_duration_minutes: number | null;
  icon_name: string | null;`,
`  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
  icon_name: string | null;`,
      "Admin Service type",
      "requires_confirmation: boolean;"
    );

    c = replaceOnce(
      c,
`  estimated_duration_minutes: string;
  icon_name: string | null;`,
`  estimated_duration_minutes: string;
  workload_weight: number;
  requires_confirmation: boolean;
  icon_name: string | null;`,
      "ServiceForm fields",
      "workload_weight: number;\n  requires_confirmation: boolean;\n  icon_name"
    );

    c = replaceOnce(
      c,
`  estimated_duration_minutes: "",
  icon_name: "Wrench",`,
`  estimated_duration_minutes: "",
  workload_weight: 1,
  requires_confirmation: false,
  icon_name: "Wrench",`,
      "Service form defaults",
      "workload_weight: 1,\n  requires_confirmation: false"
    );

    if (!c.includes("estimated_duration_minutes,\n          workload_weight,\n          requires_confirmation,\n          icon_name,")) {
      c = replaceOnce(
        c,
`          estimated_duration_minutes,
          icon_name,`,
`          estimated_duration_minutes,
          workload_weight,
          requires_confirmation,
          icon_name,`,
        "Load service workload fields"
      );
    } else {
      console.log("SKIP/already present: Load service workload fields");
    }

    if (!c.includes("workload_weight: service.workload_weight || 1")) {
      c = replaceOnce(
        c,
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
        "Edit service workload fields"
      );
    } else {
      console.log("SKIP/already present: Edit service workload fields");
    }

    if (!c.includes("requires_confirmation: serviceForm.requires_confirmation")) {
      c = replaceOnce(
        c,
`      icon_name: serviceForm.icon_name || null,
      is_popular: serviceForm.is_popular,`,
`      workload_weight: Number(serviceForm.workload_weight || 1),
      requires_confirmation: serviceForm.requires_confirmation,
      icon_name: serviceForm.icon_name || null,
      is_popular: serviceForm.is_popular,`,
        "Save service workload fields"
      );
    } else {
      console.log("SKIP/already present: Save service workload fields");
    }

    if (!c.includes("Requires Availability Confirmation")) {
      c = replaceOnce(
        c,
`              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-3 text-xs font-semibold text-gray-400">`,
`              <div className="grid gap-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-300">
                  Workshop Workload
                  <select
                    value={serviceForm.workload_weight}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        workload_weight: Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white outline-none focus:border-red-600"
                  >
                    <option value={1}>Light — 1</option>
                    <option value={2}>Normal — 2</option>
                    <option value={3}>Medium — 3</option>
                    <option value={4}>Heavy — 4</option>
                    <option value={5}>Very Heavy — 5</option>
                  </select>
                  <span className="mt-2 block text-[10px] font-normal leading-4 text-gray-500">
                    Higher values use more of the Daily Workload Capacity.
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#080808] p-3 text-xs font-semibold text-gray-300">
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
                    <span className="mt-1 block text-[10px] font-normal leading-4 text-gray-500">
                      Turn this ON for Engine Repair, Engine Overhaul, Gearbox Repair and other long/heavy jobs. Customers cannot instantly book these online.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-3 text-xs font-semibold text-gray-400">`,
        "Admin workload controls"
      );
    } else {
      console.log("SKIP/already present: Admin workload controls");
    }

    updated.admin = c;
  }

  /* ============================================================
     B. PUBLIC HOME + ADMIN PREVIEW + SERVICE CTA
  ============================================================ */
  {
    let c = updated.home;

    c = replaceOnce(
      c,
`  estimated_duration_minutes: number | null;
  icon_name: string | null;`,
`  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
  icon_name: string | null;`,
      "Public Service type",
      "requires_confirmation: boolean;"
    );

    if (!c.includes("estimated_duration_minutes, workload_weight, requires_confirmation, icon_name")) {
      c = replaceOnce(
        c,
`.select("id, name, category, description, price_from, estimated_duration_minutes, icon_name, is_popular, is_recommended")`,
`.select("id, name, category, description, price_from, estimated_duration_minutes, workload_weight, requires_confirmation, icon_name, is_popular, is_recommended")`,
        "Public service query"
      );
    } else {
      console.log("SKIP/already present: Public service query");
    }

    if (!c.includes("ADMIN PREVIEW MODE")) {
      c = replaceOnce(
        c,
`    <main id="top" className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <nav`,
`    <main id="top" className="min-h-screen bg-[#f5f6f8] text-slate-900">
      {loggedIn && (accountRole === "admin" || accountRole === "staff") && (
        <aside
          className="fixed bottom-4 right-4 z-[140] w-[min(360px,calc(100%-2rem))] rounded-2xl border border-sky-400/40 bg-[#062B55] p-4 text-white shadow-2xl"
          aria-label="Admin preview controls"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
            ADMIN PREVIEW MODE
          </p>
          <p className="mt-1 text-sm font-semibold">
            Viewing Customer Site
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Logged in as {accountName}. This page is the normal customer-facing website.
          </p>
          <Link
            href="/admin"
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-xs font-black text-[#062B55] transition hover:bg-sky-50"
          >
            Back to Admin Dashboard
          </Link>
        </aside>
      )}
      <nav`,
        "Admin customer-site preview"
      );
    } else {
      console.log("SKIP/already present: Admin customer-site preview");
    }

    if (!c.includes(">Confirm availability<")) {
      const marker = `{service.is_recommended && <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-sky-800">Recommended</span>}`;
      if (c.includes(marker) && !c.includes("Confirm availability</span>")) {
        c = c.replace(
          marker,
          marker + `{service.requires_confirmation && <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-violet-800">Confirm availability</span>}`
        );
        console.log("OK: Public confirmation badge");
      }

      c = replaceOnce(
        c,
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
        "Public service booking/confirmation CTA"
      );
    } else {
      console.log("SKIP/already present: Public service booking/confirmation CTA");
    }

    updated.home = c;
  }

  /* ============================================================
     C. SERVICE CONTACT MODAL
  ============================================================ */
  {
    let c = updated.modal;

    c = replaceOnce(
      c,
`  estimated_duration_minutes: number | null;
};`,
`  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
};`,
      "Contact modal service type",
      "requires_confirmation: boolean;"
    );

    if (!c.includes("service.requires_confirmation\n    ? `Hello CK Motors")) {
      c = replaceOnce(
        c,
`  const whatsappMessage = \`Hello CK Motors, I would like to know the price and details for \${service.name}.\${showRealPrice ? \` Displayed price: \${priceLabel}\` : ""}\`;`,
`  const whatsappMessage = service.requires_confirmation
    ? \`Hello CK Motors, I would like to check workshop availability for \${service.name}. Please let me know a suitable date/time.\`
    : \`Hello CK Motors, I would like to know the price and details for \${service.name}.\${showRealPrice ? \` Displayed price: \${priceLabel}\` : ""}\`;`,
        "Confirmation WhatsApp message"
      );
    }

    if (!c.includes("This is a heavy/long workshop job")) {
      c = replaceOnce(
        c,
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
            <p className="text-xs font-black uppercase tracking-wide">
              Availability confirmation required
            </p>
            <p className="mt-1 text-xs leading-5">
              This is a heavy/long workshop job and is not available as an instant online booking.
            </p>
            <p className="mt-2 text-[11px] font-semibold">
              Workshop Workload: {service.workload_weight || 1} / 5
            </p>
          </div>
        )}`,
        "Contact modal confirmation notice"
      );
    }

    if (!c.includes('service.requires_confirmation ? (\n            <button')) {
      c = replaceOnce(
        c,
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
        "Hide instant booking for confirmation services"
      );
    }

    if (!c.includes('{service.requires_confirmation ? "Request Availability" : "Request a Callback"}')) {
      c = replaceOnce(
        c,
`              Request a Callback`,
`              {service.requires_confirmation ? "Request Availability" : "Request a Callback"}`,
        "Callback/availability button label"
      );
    }

    if (c.includes("{nextAvailableLabel && (") && !c.includes("{!service.requires_confirmation && nextAvailableLabel && (")) {
      c = c.replace("{nextAvailableLabel && (", "{!service.requires_confirmation && nextAvailableLabel && (");
      console.log("OK: Hide generic next-available label for heavy services");
    }

    updated.modal = c;
  }

  /* ============================================================
     D. CUSTOMER BOOKING MANAGER
  ============================================================ */
  {
    let c = updated.booking;

    if (!c.includes("MessageCircle,")) {
      c = replaceOnce(
        c,
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

    c = replaceOnce(
      c,
`  estimated_duration_minutes: number | null;
};`,
`  estimated_duration_minutes: number | null;
  workload_weight: number;
  requires_confirmation: boolean;
};`,
      "Booking Service type",
      "requires_confirmation: boolean;"
    );

    if (!c.includes("estimated_duration_minutes, workload_weight, requires_confirmation")) {
      c = replaceOnce(
        c,
`            "id, name, category, description, price_from, estimated_duration_minutes"`,
`            "id, name, category, description, price_from, estimated_duration_minutes, workload_weight, requires_confirmation"`,
        "Booking service query"
      );
    }

    if (!c.includes("remaining_workload: number")) {
      c = replaceOnce(
        c,
`  const [availableTimes, setAvailableTimes] = useState<Array<{ slot_time: string; remaining_capacity: number }>>([]);`,
`  const [availableTimes, setAvailableTimes] = useState<Array<{ slot_time: string; remaining_workload: number; availability_status: string }>>([]);`,
        "Workload-aware slot type"
      );
    }

    if (!c.includes('get_available_service_booking_slots')) {
      const oldEffect = `  useEffect(() => {
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
  }, [bookingDate, supabase]);`;

      const newEffect = `  useEffect(() => {
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
            const slots = (data || []) as Array<{
              slot_time: string;
              remaining_workload: number;
              availability_status: string;
            }>;
            setAvailableTimes(slots);
          }
          setLoadingTimes(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bookingDate, serviceId, supabase]);`;

      c = replaceOnce(c, oldEffect, newEffect, "Service-aware workload availability RPC");
    }

    if (!c.includes("const requiresAvailabilityConfirmation")) {
      c = replaceOnce(
        c,
`  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === vehicleId
  );`,
`  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === vehicleId
  );

  const requiresAvailabilityConfirmation = Boolean(
    selectedService?.requires_confirmation
  );`,
        "Booking confirmation state"
      );
    }

    if (!c.includes('This service requires workshop availability confirmation')) {
      c = replaceOnce(
        c,
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
        "Prevent instant heavy-service booking"
      );
    }

    c = c.replace(
      `disabled={!bookingDate || loadingTimes || !!slotError}`,
      `disabled={!bookingDate || !serviceId || loadingTimes || !!slotError || requiresAvailabilityConfirmation}`
    );

    if (c.includes("{slot.slot_time} · {slot.remaining_capacity} available")) {
      c = c.replace(
        "{slot.slot_time} · {slot.remaining_capacity} available",
        `{slot.slot_time} · {slot.availability_status === "LIMITED" ? "Limited capacity" : "Available"}`
      );
      console.log("OK: Workload availability slot label");
    }

    if (!c.includes("Workshop Workload: {selectedService.workload_weight")) {
      c = replaceOnce(
        c,
`                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}`,
`                    </div>

                    <div className="mt-3 text-[11px] font-semibold text-gray-500">
                      Workshop Workload: {selectedService.workload_weight || 1} / 5
                    </div>

                    {requiresAvailabilityConfirmation && (
                      <div className="mt-4 rounded-xl border border-violet-700/40 bg-violet-950/20 p-4">
                        <p className="text-xs font-black text-violet-300">
                          Availability confirmation required
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-gray-400">
                          This service may take several hours or days, so it cannot be guaranteed as a normal online booking.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a href="tel:0772723940" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white">
                            <PhoneCall size={13} /> Call 077 272 3940
                          </a>
                          <a href="tel:0777258599" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white">
                            <PhoneCall size={13} /> Call 077 725 8599
                          </a>
                          <a
                            href={\`https://wa.me/94772723940?text=\${encodeURIComponent(\`Hello CK Motors, I would like to check availability for \${selectedService.name}.\`)}\`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-[11px] font-bold text-white"
                          >
                            <MessageCircle size={13} /> WhatsApp CK Motors
                          </a>
                          <a href="/#services" className="inline-flex items-center rounded-lg border border-violet-500 px-3 py-2 text-[11px] font-bold text-violet-200">
                            Request Availability
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}`,
        "Heavy-service customer contact panel"
      );
    }

    c = c.replace(
      `disabled={booking}`,
      `disabled={booking || requiresAvailabilityConfirmation}`
    );

    if (!c.includes('? "Contact CK Motors to Confirm"')) {
      c = replaceOnce(
        c,
`                {booking
                  ? "Submitting Booking..."
                  : "Confirm Service Booking"}`,
`                {booking
                  ? "Submitting Booking..."
                  : requiresAvailabilityConfirmation
                    ? "Contact CK Motors to Confirm"
                    : "Confirm Service Booking"}`,
        "Booking submit label"
      );
    }

    if (c.includes(`bookingDate && !loadingTimes && availableTimes.length === 0 ?`)) {
      c = c.replace(
        `bookingDate && !loadingTimes && availableTimes.length === 0 ?`,
        `bookingDate && !requiresAvailabilityConfirmation && !loadingTimes && availableTimes.length === 0 ?`
      );
    }

    updated.booking = c;
  }

  /* ============================================================
     E. WALK-IN / SERVICE RECORD WORKLOAD
  ============================================================ */
  {
    let c = updated.record;

    c = replaceOnce(
      c,
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
      "Service Record service type",
      "workload_weight: number;"
    );

    if (!c.includes('.select("id, name, workload_weight, active")')) {
      c = replaceOnce(
        c,
`.select("id, name, active")`,
`.select("id, name, workload_weight, active")`,
        "Load service workload in Walk-In/Quick Invoice"
      );
    }

    if (!c.includes("const primaryWorkloadService")) {
      c = replaceOnce(
        c,
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
        "Calculate walk-in workload"
      );
    }

    if (!c.includes('set_service_record_workload')) {
      c = replaceOnce(
        c,
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
        "Persist service-record workload"
      );
    }

    updated.record = c;
  }

  /* ============================================================
     VALIDATE BEFORE WRITING ANYTHING
  ============================================================ */
  const checks = [
    [updated.admin, "Workshop Workload", "Admin Workshop Workload"],
    [updated.admin, "Requires Availability Confirmation", "Admin confirmation toggle"],
    [updated.home, "ADMIN PREVIEW MODE", "Admin Preview Mode"],
    [updated.home, "Back to Admin Dashboard", "Back to Admin"],
    [updated.home, "Confirm availability", "Public confirmation CTA"],
    [updated.modal, "Request Availability", "Request Availability"],
    [updated.booking, "get_available_service_booking_slots", "Workload-aware slots"],
    [updated.booking, "Contact CK Motors to Confirm", "Heavy booking block"],
    [updated.record, "set_service_record_workload", "Walk-in workload snapshot"],
  ];

  for (const [content, needle, label] of checks) {
    if (!content.includes(needle)) {
      throw new Error(`Validation failed: ${label}`);
    }
  }

  // Back up and write only changed files.
  for (const [key, rel] of Object.entries(FILES)) {
    if (updated[key] !== original[key]) {
      backup(rel, original[key]);
    }
  }

  for (const [key, rel] of Object.entries(FILES)) {
    if (updated[key] !== original[key]) {
      write(rel, updated[key]);
      console.log("Changed:", rel);
    }
  }

  const report = `CK Motors remaining feature update completed.

Installed/verified:
- Admin Services: Workshop Workload 1-5
- Admin Services: Requires Availability Confirmation
- Public heavy-service: Confirm availability instead of instant Book Now
- Call / WhatsApp / Request Availability flow
- Customer dashboard blocks instant heavy-service booking
- Service-aware workload slot RPC
- Walk-In / Quick Invoice workload snapshot
- Admin-only ADMIN PREVIEW MODE on public site
- Back to Admin Dashboard

No project files were deleted.
Timestamped backups were created before changed files were written.

Next:
1) npm run build
2) npm run dev
3) Admin > Services > edit Engine Repair
4) Set Heavy (4) or Very Heavy (5)
5) Turn ON Requires Availability Confirmation
6) Save
7) View Customer Site -> ADMIN PREVIEW MODE should appear
8) Public/customer Engine Repair -> Call / WhatsApp / Request Availability, not instant booking
`;
  fs.writeFileSync(path.join(ROOT, "CK_REMAINING_FEATURES_REPORT.txt"), report, "utf8");
  console.log("\nSUCCESS: All remaining CK Motors features were applied safely.");
  console.log("\n" + report);
} catch (error) {
  console.error("\nERROR:", error.message);
  console.error("No changed project files were written because validation happens before the write stage.");
  process.exit(1);
}
