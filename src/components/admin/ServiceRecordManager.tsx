"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import SearchableVehicleSelect from "@/components/vehicles/SearchableVehicleSelect";
import { useVehicleMasterData } from "@/lib/vehicle-master-data";

type Booking = {
  id: string;
  booking_reference: string;
  user_id: string;
  vehicle_id: string;
  service_name_snapshot: string | null;
  mileage: number | null;
  status: string;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
};

type Vehicle = {
  id: string;
  user_id: string;
  registration_number: string;
  brand: string;
  model: string;
};

type ExistingRecord = {
  booking_id: string | null;
};

type Service = {
  id: string;
  name: string;
  active: boolean;
};

type ServiceFlow = "booking" | "walk-in";

type Part = {
  inventory_part_id: string;
  part_name: string;
  part_number: string;
  quantity: string;
  unit_price: string;
};

const emptyPart: Part = {
  inventory_part_id: "",
  part_name: "",
  part_number: "",
  quantity: "1",
  unit_price: "",
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function ServiceRecordManager() {
  const supabase = useMemo(() => createClient(), []);
  const masterData = useVehicleMasterData();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [existingRecords, setExistingRecords] = useState<ExistingRecord[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [inventoryParts, setInventoryParts] = useState<Array<{
    id: string;
    part_name: string;
    sku: string | null;
    quantity_in_stock: number;
    selling_price: number | null;
    unit: string | null;
    is_active: boolean;
  }>>([]);

  const [flow, setFlow] = useState<ServiceFlow>("booking");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomer, setNewCustomer] = useState({ full_name: "", email: "", phone: "" });
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ registration_number: "", brand: "", model: "" });

  const [serviceDate, setServiceDate] = useState(getToday());
  const [technicianName, setTechnicianName] = useState("");
  const [mileage, setMileage] = useState("");
  const [servicesPerformed, setServicesPerformed] = useState("");

  const [labourCost, setLabourCost] = useState("");
  const [additionalCost, setAdditionalCost] = useState("");
  const [discount, setDiscount] = useState("");

  const [technicianNotes, setTechnicianNotes] = useState("");
  const [recommendedRepairs, setRecommendedRepairs] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [nextServiceMileage, setNextServiceMileage] = useState("");

  const [parts, setParts] = useState<Part[]>([{ ...emptyPart }]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      bookingResult,
      profileResult,
      vehicleResult,
      recordsResult,
      serviceResult,
      inventoryResult,
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          `
          id,
          booking_reference,
          user_id,
          vehicle_id,
          service_name_snapshot,
          mileage,
          status
          `
        )
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),

      supabase
        .from("profiles")
        .select("id, full_name, email"),

      supabase
        .from("vehicles")
        .select("id, user_id, registration_number, brand, model"),

      supabase
        .from("service_records")
        .select("booking_id"),

      supabase
        .from("services")
        .select("id, name, active")
        .eq("active", true)
        .order("name"),

      supabase
        .from("inventory_parts")
        .select("id, part_name, sku, quantity_in_stock, selling_price, unit, is_active")
        .eq("is_active", true)
        .order("part_name"),
    ]);

    if (bookingResult.error) {
      setError(bookingResult.error.message);
    } else {
      setBookings((bookingResult.data || []) as Booking[]);
    }

    if (profileResult.data) {
      setProfiles(profileResult.data as Profile[]);
    }

    if (vehicleResult.data) {
      setVehicles(vehicleResult.data as Vehicle[]);
    }

    if (recordsResult.data) {
      setExistingRecords(recordsResult.data as ExistingRecord[]);
    }

    if (serviceResult.data) {
      setServices(serviceResult.data as Service[]);
    }

    if (inventoryResult.data) {
      setInventoryParts(inventoryResult.data as Array<{
        id: string;
        part_name: string;
        sku: string | null;
        quantity_in_stock: number;
        selling_price: number | null;
        unit: string | null;
        is_active: boolean;
      }>);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const availableBookings = bookings.filter(
    (booking) =>
      !existingRecords.some(
        (record) => record.booking_id === booking.id
      )
  );

  const selectedBooking = bookings.find(
    (booking) => booking.id === selectedBookingId
  );

  const selectedCustomer = profiles.find(
    (profile) => profile.id === selectedBooking?.user_id
  );

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedBooking?.vehicle_id
  );
  const selectedWalkInCustomer = profiles.find(
    (profile) => profile.id === selectedCustomerId
  );
  const walkInVehicles = vehicles.filter(
    (vehicle) => vehicle.user_id === selectedCustomerId
  );
  const visibleCustomers = profiles.filter((profile) =>
    `${profile.full_name} ${profile.email}`.toLowerCase().includes(customerSearch.toLowerCase())
  );

  function handleBookingChange(id: string) {
    setSelectedBookingId(id);

    const booking = bookings.find((item) => item.id === id);

    if (!booking) return;

    setServicesPerformed(
      booking.service_name_snapshot || "Vehicle Service"
    );

    setMileage(
      booking.mileage !== null
        ? booking.mileage.toString()
        : ""
    );
  }

  async function createWalkInCustomer() {
    if (!newCustomer.full_name.trim() || !newCustomer.email.trim()) {
      setError("Full name and email are required.");
      return;
    }
    setAddingCustomer(true);
    setError("");
    const response = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCustomer),
    });
    const result = (await response.json()) as {
      error?: string;
      customer?: { id: string; full_name: string; email: string };
      temporaryPassword?: string;
    };
    setAddingCustomer(false);
    if (!response.ok || !result.customer) {
      setError(result.error || "Customer could not be created.");
      return;
    }
    const createdProfile: Profile = {
      id: result.customer.id,
      full_name: result.customer.full_name,
      email: result.customer.email,
    };
    setProfiles((current) => [...current, createdProfile]);
    setSelectedCustomerId(createdProfile.id);
    setTemporaryPassword(result.temporaryPassword || "");
    setNewCustomer({ full_name: "", email: "", phone: "" });
    setSuccess("Customer created. Add a vehicle before creating the service.");
  }

  async function createWalkInVehicle() {
    if (!selectedCustomerId || !newVehicle.registration_number.trim() || !newVehicle.brand.trim() || !newVehicle.model.trim()) {
      setError("Select a customer and enter registration, brand, and model.");
      return;
    }
    setAddingVehicle(true);
    setError("");
    const normalizedRegistration = newVehicle.registration_number.trim().toUpperCase();
    const { data: duplicate, error: duplicateError } = await supabase
      .from("vehicles")
      .select("id")
      .eq("registration_number", normalizedRegistration)
      .maybeSingle();
    if (duplicateError || duplicate) {
      setAddingVehicle(false);
      setError(duplicateError?.message || "This registration number already exists.");
      return;
    }
    const { data, error: vehicleError } = await supabase
      .from("vehicles")
      .insert({
        user_id: selectedCustomerId,
        registration_number: normalizedRegistration,
        brand: newVehicle.brand.trim(),
        model: newVehicle.model.trim(),
      })
      .select("id, registration_number, brand, model")
      .single();
    setAddingVehicle(false);
    if (vehicleError || !data) {
      setError(vehicleError?.message || "Vehicle could not be added.");
      return;
    }
    const createdVehicle = { ...data, user_id: selectedCustomerId };
    setVehicles((current) => [...current, createdVehicle]);
    setSelectedVehicleId(createdVehicle.id);
    setNewVehicle({ registration_number: "", brand: "", model: "" });
  }

  function addPart() {
    setParts((current) => [
      ...current,
      { ...emptyPart },
    ]);
  }

  function removePart(index: number) {
    setParts((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  function updatePart(
    index: number,
    field: keyof Part,
    value: string
  ) {
    setParts((current) =>
      current.map((part, i) =>
        i === index
          ? {
              ...part,
              [field]: value,
            }
          : part
      )
    );
  }

  function selectInventoryPart(index: number, inventoryPartId: string) {
    const selectedInventoryPart = inventoryParts.find((inventoryPart) => inventoryPart.id === inventoryPartId);

    setParts((current) =>
      current.map((part, i) => {
        if (i !== index) return part;

        if (!selectedInventoryPart) {
          return {
            ...part,
            inventory_part_id: "",
          };
        }

        return {
          ...part,
          inventory_part_id: selectedInventoryPart.id,
          part_name: selectedInventoryPart.part_name,
          part_number: selectedInventoryPart.sku || "",
          quantity: String(Math.max(Number(part.quantity) || 1, 1)),
          unit_price: String(selectedInventoryPart.selling_price ?? 0),
        };
      })
    );
  }

  const validParts = parts.filter(
    (part) =>
      part.part_name.trim() &&
      Number(part.quantity) > 0
  );

  const partsTotal = validParts.reduce(
    (total, part) =>
      total +
      Number(part.quantity || 0) *
        Number(part.unit_price || 0),
    0
  );

  const calculatedTotal = Math.max(
    Number(labourCost || 0) +
      partsTotal +
      Number(additionalCost || 0) -
      Number(discount || 0),
    0
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (flow === "booking" && !selectedBooking) {
      setError("Please select a booking.");
      return;
    }

    if (flow === "walk-in" && (!selectedCustomerId || !selectedVehicleId)) {
      setError("Select a customer and vehicle for the walk-in service.");
      return;
    }

    if (!servicesPerformed.trim()) {
      setError("Services performed is required.");
      return;
    }

    setSaving(true);

    const recordPayload = {
      booking_id: flow === "booking" ? selectedBooking?.id : null,
      user_id: flow === "booking" ? selectedBooking?.user_id : selectedCustomerId,
      vehicle_id: flow === "booking" ? selectedBooking?.vehicle_id : selectedVehicleId,
      technician_name: technicianName.trim() || null,
      mileage: mileage ? Number(mileage) : null,
      service_date: serviceDate,
      services_performed: servicesPerformed.trim(),
      labour_cost: Number(labourCost || 0),
      parts_cost: partsTotal,
      additional_cost: Number(additionalCost || 0),
      discount: Number(discount || 0),
      technician_notes: technicianNotes.trim() || null,
      recommended_repairs: recommendedRepairs.trim() || null,
      next_service_date: nextServiceDate || null,
      next_service_mileage: nextServiceMileage ? Number(nextServiceMileage) : null,
    };

    const servicePartPayload = validParts.map((part) => ({
      inventory_part_id: part.inventory_part_id || null,
      part_name: part.part_name.trim(),
      part_number: part.part_number.trim() || null,
      quantity: Number(part.quantity),
      unit_price: Number(part.unit_price || 0),
    }));

    const { data, error: recordError } = await supabase.rpc("create_service_record_with_parts", {
      record_data: recordPayload,
      parts: servicePartPayload,
    });

    const record = Array.isArray(data) ? (data[0] as { id: string; total_cost: number } | undefined) : (data as { id: string; total_cost: number } | null | undefined);

    if (recordError || !record) {
      setError(
        recordError?.message ||
          "Unable to create service record."
      );
      setSaving(false);
      return;
    }

    if (flow === "booking" && selectedBooking) {
      await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", selectedBooking.id);

      await supabase.from("notifications").insert({
        user_id: selectedBooking.user_id,
        booking_id: selectedBooking.id,
        type: "service_completed",
        title: "Vehicle Service Completed",
        message: `Your CK Motors service ${selectedBooking.booking_reference} has been completed.`,
      });
    } else {
      await supabase.from("notifications").insert({
        user_id: selectedCustomerId,
        booking_id: null,
        type: "service_completed",
        title: "Service Invoice Ready",
        message: "Your CK Motors walk-in service invoice is ready.",
      });
    }

    setSuccess(
      `Service record created successfully. Total: LKR ${Number(
        record.total_cost
      ).toLocaleString()}`
    );

    setSelectedBookingId("");
    setSelectedCustomerId("");
    setSelectedVehicleId("");
    setCustomerSearch("");
    setTechnicianName("");
    setMileage("");
    setServicesPerformed("");
    setLabourCost("");
    setAdditionalCost("");
    setDiscount("");
    setTechnicianNotes("");
    setRecommendedRepairs("");
    setNextServiceDate("");
    setNextServiceMileage("");
    setParts([{ ...emptyPart }]);

    await loadData();

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-white/10 bg-[#111]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7">
      <div className="mb-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">
          CK Motors Workshop
        </p>

        <h2 className="mt-1 text-2xl font-black">
          {flow === "walk-in" ? "Walk-In Service / Quick Invoice" : "Create Service Record"}
        </h2>

        <p className="mt-2 text-xs text-gray-600">
          Add work completed, parts, labour charges and
          next service recommendations.
        </p>
        {temporaryPassword && (
          <div className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-xs text-amber-300">
            <p className="font-bold">New customer temporary password</p>
            <p className="mt-1">Give this password to the customer. They must change it on first sign in.</p>
            <code className="mt-2 block rounded bg-black/30 p-2 text-sm">{temporaryPassword}</code>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-xs text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-xl border border-green-900/60 bg-green-950/20 p-4 text-xs text-green-400">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-5 flex gap-2 rounded-xl border border-white/10 p-1">
          {(["booking", "walk-in"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFlow(option)}
              className={`flex-1 rounded-lg px-4 py-3 text-xs font-bold ${flow === option ? "bg-red-600 text-white" : "text-gray-500 hover:bg-white/5"}`}
            >
              {option === "booking" ? "Booking Service" : "Walk-In Service"}
            </button>
          ))}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {flow === "booking" ? <Field label="Select Booking *">
            <select
              value={selectedBookingId}
              onChange={(e) =>
                handleBookingChange(e.target.value)
              }
              className="input-style"
            >
              <option value="">
                Choose booking
              </option>

              {availableBookings.map((booking) => {
                const vehicle = vehicles.find(
                  (item) =>
                    item.id === booking.vehicle_id
                );

                return (
                  <option
                    key={booking.id}
                    value={booking.id}
                  >
                    {booking.booking_reference} —{" "}
                    {vehicle?.registration_number || "Vehicle"}
                  </option>
                );
              })}
            </select>
          </Field> : (
            <>
              <Field label="Search Existing Customer">
                <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Name or email" className="input-style" />
                <select value={selectedCustomerId} onChange={(event) => { setSelectedCustomerId(event.target.value); setSelectedVehicleId(""); }} className="input-style mt-2">
                  <option value="">Choose customer</option>
                  {visibleCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name} — {customer.email}</option>)}
                </select>
              </Field>
              <Field label="Add New Customer">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input value={newCustomer.full_name} onChange={(event) => setNewCustomer({ ...newCustomer, full_name: event.target.value })} placeholder="Full name" className="input-style" />
                  <input type="email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} placeholder="Email" className="input-style" />
                  <button type="button" onClick={() => void createWalkInCustomer()} disabled={addingCustomer} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold disabled:opacity-50">{addingCustomer ? "Adding..." : "Add Customer"}</button>
                </div>
              </Field>
              {selectedWalkInCustomer && (
                <>
                  <Field label="Select Vehicle *">
                    <SearchableVehicleSelect label="Vehicle" required value={walkInVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ? `${walkInVehicles.find((vehicle) => vehicle.id === selectedVehicleId)?.registration_number} — ${walkInVehicles.find((vehicle) => vehicle.id === selectedVehicleId)?.brand} ${walkInVehicles.find((vehicle) => vehicle.id === selectedVehicleId)?.model}` : ""} options={walkInVehicles.map((vehicle) => `${vehicle.registration_number} — ${vehicle.brand} ${vehicle.model}`)} onChange={(value) => setSelectedVehicleId(walkInVehicles.find((vehicle) => `${vehicle.registration_number} — ${vehicle.brand} ${vehicle.model}` === value)?.id || "")} />
                  </Field>
                  <Field label="Add Vehicle">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input value={newVehicle.registration_number} onChange={(event) => setNewVehicle({ ...newVehicle, registration_number: event.target.value })} placeholder="Registration" className="input-style" />
                      <SearchableVehicleSelect label="Brand" value={newVehicle.brand} options={masterData.brands} onChange={(value) => setNewVehicle({ ...newVehicle, brand: value, model: "" })} />
                      <button type="button" onClick={() => void createWalkInVehicle()} disabled={addingVehicle} className="rounded-lg border border-red-700 px-3 py-2 text-xs font-bold text-red-500 disabled:opacity-50">{addingVehicle ? "Adding..." : "+ Add Vehicle"}</button>
                    </div>
                    <SearchableVehicleSelect label="Model" value={newVehicle.model} options={masterData.models.filter((model) => model.brand === newVehicle.brand).map((model) => model.name)} onChange={(value) => setNewVehicle({ ...newVehicle, model: value })} />
                  </Field>
                </>
              )}
            </>
          )}

          <Field label="Service Date">
            <input
              type="date"
              value={serviceDate}
              onChange={(e) =>
                setServiceDate(e.target.value)
              }
              className="input-style"
            />
          </Field>

          {flow === "booking" && selectedBooking && (
            <>
              <InfoBox
                label="Customer"
                value={
                  selectedCustomer?.full_name ||
                  selectedCustomer?.email ||
                  "—"
                }
              />

              <InfoBox
                label="Vehicle"
                value={
                  selectedVehicle
                    ? `${selectedVehicle.registration_number} — ${selectedVehicle.brand} ${selectedVehicle.model}`
                    : "—"
                }
              />
            </>
          )}

          <Field label="Technician Name">
            <input
              value={technicianName}
              onChange={(e) =>
                setTechnicianName(e.target.value)
              }
              placeholder="Technician name"
              className="input-style"
            />
          </Field>

          <Field label="Mileage">
            <input
              type="number"
              value={mileage}
              onChange={(e) =>
                setMileage(e.target.value)
              }
              placeholder="65000"
              className="input-style"
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Services Performed *">
            <select value={services.some((service) => service.name === servicesPerformed) ? servicesPerformed : ""} onChange={(event) => setServicesPerformed(event.target.value)} className="input-style">
              <option value="">Choose an existing service</option>
              {services.map((service) => <option key={service.id} value={service.name}>{service.name}</option>)}
            </select>
            <textarea
              rows={4}
              value={servicesPerformed}
              onChange={(e) =>
                setServicesPerformed(e.target.value)
              }
              className="input-style resize-none"
            />
          </Field>
        </div>

        {/* PARTS */}
        <div className="mt-7 rounded-xl border border-white/10 bg-black/20 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-black">
                Parts Used
              </h3>
              <p className="mt-1 text-xs text-gray-600">
                Add replacement parts used during service.
              </p>
            </div>

            <button
              type="button"
              onClick={addPart}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold"
            >
              <Plus size={15} />
              Add Part
            </button>
          </div>

          <div className="space-y-3">
            {parts.map((part, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-white/10 p-4 md:grid-cols-[1.5fr_1.2fr_1.2fr_.7fr_1fr_auto]"
              >
                <div className="space-y-2">
                  <select
                    value={part.inventory_part_id}
                    onChange={(e) => selectInventoryPart(index, e.target.value)}
                    className="input-style"
                  >
                    <option value="">Manual part</option>
                    {inventoryParts.map((inventoryPart) => (
                      <option key={inventoryPart.id} value={inventoryPart.id}>
                        {inventoryPart.part_name} {inventoryPart.quantity_in_stock > 0 ? `(${inventoryPart.quantity_in_stock} in stock)` : "(out of stock)"}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="Part name"
                    value={part.part_name}
                    onChange={(e) =>
                      updatePart(
                        index,
                        "part_name",
                        e.target.value
                      )
                    }
                    className="input-style"
                  />
                </div>

                <input
                  placeholder="Part number"
                  value={part.part_number}
                  onChange={(e) =>
                    updatePart(
                      index,
                      "part_number",
                      e.target.value
                    )
                  }
                  className="input-style"
                />

                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={part.quantity}
                  onChange={(e) =>
                    updatePart(
                      index,
                      "quantity",
                      e.target.value
                    )
                  }
                  className="input-style"
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Unit price"
                  value={part.unit_price}
                  onChange={(e) =>
                    updatePart(
                      index,
                      "unit_price",
                      e.target.value
                    )
                  }
                  className="input-style"
                />

                <div className="flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                  {part.inventory_part_id ? "Linked" : "Manual"}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    removePart(index)
                  }
                  className="rounded-lg border border-white/10 p-3 text-gray-600 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COSTS */}
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CostInput
            label="Labour Cost"
            value={labourCost}
            onChange={setLabourCost}
          />

          <InfoBox
            label="Parts Total"
            value={`LKR ${partsTotal.toLocaleString()}`}
          />

          <CostInput
            label="Additional Cost"
            value={additionalCost}
            onChange={setAdditionalCost}
          />

          <CostInput
            label="Discount"
            value={discount}
            onChange={setDiscount}
          />
        </div>

        <div className="mt-5 rounded-xl border border-red-900/40 bg-red-950/10 p-5">
          <p className="text-xs uppercase tracking-wider text-gray-600">
            Estimated Total
          </p>

          <p className="mt-2 text-3xl font-black text-red-500">
            LKR {calculatedTotal.toLocaleString()}
          </p>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <Field label="Next Service Date">
            <input
              type="date"
              value={nextServiceDate}
              onChange={(e) =>
                setNextServiceDate(e.target.value)
              }
              className="input-style"
            />
          </Field>

          <Field label="Next Service Mileage">
            <input
              type="number"
              value={nextServiceMileage}
              onChange={(e) =>
                setNextServiceMileage(e.target.value)
              }
              placeholder="70000"
              className="input-style"
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Technician Notes">
            <textarea
              rows={4}
              value={technicianNotes}
              onChange={(e) =>
                setTechnicianNotes(e.target.value)
              }
              className="input-style resize-none"
            />
          </Field>

          <Field label="Recommended Repairs">
            <textarea
              rows={4}
              value={recommendedRepairs}
              onChange={(e) =>
                setRecommendedRepairs(e.target.value)
              }
              className="input-style resize-none"
            />
          </Field>
        </div>

        <div className="mt-7 flex justify-end border-t border-white/10 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-6 py-3 text-xs font-bold disabled:opacity-50"
          >
            <ClipboardList size={17} />

            {saving
              ? "Saving Service Record..."
              : flow === "walk-in" ? "Create Service & Invoice" : "Complete Service & Save Record"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-gray-400">
        {label}
      </label>

      {children}
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-700">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold text-gray-300">
        {value}
      </p>
    </div>
  );
}

function CostInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder="0"
        className="input-style"
      />
    </Field>
  );
}