"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Edit3,
  Gauge,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SearchableVehicleSelect from "@/components/vehicles/SearchableVehicleSelect";
import { useVehicleMasterData } from "@/lib/vehicle-master-data";

type Vehicle = {
  id: string;
  registration_number: string;
  brand: string;
  model: string;
  manufacture_year: number | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  engine_capacity: string | null;
  transmission: string | null;
  mileage: number | null;
  chassis_number: string | null;
  engine_number: string | null;
  notes: string | null;
};

const emptyForm = {
  registration_number: "",
  brand: "",
  model: "",
  manufacture_year: "",
  vehicle_type: "Car",
  fuel_type: "Petrol",
  engine_capacity: "",
  transmission: "Automatic",
  mileage: "",
  chassis_number: "",
  engine_number: "",
  notes: "",
};

export default function VehiclesManager() {
  const supabase = useMemo(() => createClient(), []);
  const masterData = useVehicleMasterData();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] =
    useState<Vehicle | null>(null);

  const [form, setForm] = useState(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadVehicles = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select(
        `
        id,
        registration_number,
        brand,
        model,
        manufacture_year,
        vehicle_type,
        fuel_type,
        engine_capacity,
        transmission,
        mileage,
        chassis_number,
        engine_number,
        notes
        `
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setVehicles((data || []) as Vehicle[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadVehicles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadVehicles]);

  function updateForm(
    field: keyof typeof emptyForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openAddForm() {
    setEditingVehicle(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(vehicle: Vehicle) {
    setEditingVehicle(vehicle);

    setForm({
      registration_number: vehicle.registration_number || "",
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      manufacture_year:
        vehicle.manufacture_year?.toString() || "",
      vehicle_type: vehicle.vehicle_type || "Car",
      fuel_type: vehicle.fuel_type || "Petrol",
      engine_capacity: vehicle.engine_capacity || "",
      transmission: vehicle.transmission || "Automatic",
      mileage: vehicle.mileage?.toString() || "",
      chassis_number: vehicle.chassis_number || "",
      engine_number: vehicle.engine_number || "",
      notes: vehicle.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingVehicle(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSave(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.registration_number.trim()) {
      setError("Vehicle registration number is required.");
      return;
    }

    if (!form.brand.trim()) {
      setError("Vehicle brand is required.");
      return;
    }

    if (!form.model.trim()) {
      setError("Vehicle model is required.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please login again.");
      return;
    }

    setSaving(true);

    const vehicleData = {
      user_id: user.id,

      registration_number:
        form.registration_number.trim().toUpperCase(),

      brand: form.brand.trim(),

      model: form.model.trim(),

      manufacture_year: form.manufacture_year
        ? Number(form.manufacture_year)
        : null,

      vehicle_type: form.vehicle_type,

      fuel_type: form.fuel_type,

      engine_capacity:
        form.engine_capacity.trim() || null,

      transmission: form.transmission,

      mileage: form.mileage
        ? Number(form.mileage)
        : null,

      chassis_number:
        form.chassis_number.trim() || null,

      engine_number:
        form.engine_number.trim() || null,

      notes: form.notes.trim() || null,
    };

    if (editingVehicle) {
      const { error } = await supabase
        .from("vehicles")
        .update(vehicleData)
        .eq("id", editingVehicle.id);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      setSuccess("Vehicle updated successfully.");
    } else {
      const { error } = await supabase
        .from("vehicles")
        .insert(vehicleData);

      if (error) {
        if (
          error.message
            .toLowerCase()
            .includes("duplicate")
        ) {
          setError(
            "This vehicle registration number already exists in your account."
          );
        } else {
          setError(error.message);
        }

        setSaving(false);
        return;
      }

      setSuccess("Vehicle added successfully.");
    }

    setSaving(false);
    closeForm();

    await loadVehicles();

    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  async function handleDelete(vehicle: Vehicle) {
    const confirmed = window.confirm(
      `Remove ${vehicle.registration_number} from your vehicles?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", vehicle.id);

    if (error) {
      setError(
        "This vehicle cannot be removed if it already has bookings or service history."
      );
      return;
    }

    setSuccess("Vehicle removed successfully.");

    await loadVehicles();

    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">
              Vehicle Management
            </p>

            <h2 className="text-xl font-black">
              My Vehicles
            </h2>

            <p className="mt-1 text-xs text-gray-600">
              Add and manage vehicles registered to your
              CK Motors account.
            </p>
          </div>

          <button
            onClick={openAddForm}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-4 py-3 text-xs font-bold transition hover:from-red-500 hover:to-red-700"
          >
            <Plus size={17} />
            Add Vehicle
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-900/60 bg-green-950/30 px-4 py-3 text-xs text-green-400">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-5 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-red-950/30 text-red-500">
              <Car size={28} />
            </div>

            <h3 className="font-bold">
              No Vehicles Registered
            </h3>

            <p className="mt-2 max-w-sm text-xs leading-5 text-gray-600">
              Add your first vehicle to book maintenance
              and keep your service history organized.
            </p>

            <button
              onClick={openAddForm}
              className="mt-5 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-bold hover:bg-red-500"
            >
              + Add First Vehicle
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="group rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-red-900/70"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-950/40 text-red-500">
                    <Car size={25} />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        openEditForm(vehicle)
                      }
                      title="Edit vehicle"
                      className="rounded-lg border border-white/10 p-2 text-gray-500 transition hover:border-red-800 hover:text-red-500"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      onClick={() =>
                        handleDelete(vehicle)
                      }
                      title="Remove vehicle"
                      className="rounded-lg border border-white/10 p-2 text-gray-500 transition hover:border-red-800 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-black">
                  {vehicle.brand} {vehicle.model}
                </h3>

                <p className="mt-1 text-sm font-black tracking-wide text-red-500">
                  {vehicle.registration_number}
                </p>

                <div className="my-5 h-px bg-white/10" />

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <VehicleInfo
                    label="Year"
                    value={
                      vehicle.manufacture_year?.toString() ||
                      "—"
                    }
                  />

                  <VehicleInfo
                    label="Fuel"
                    value={vehicle.fuel_type || "—"}
                  />

                  <VehicleInfo
                    label="Type"
                    value={vehicle.vehicle_type || "—"}
                  />

                  <VehicleInfo
                    label="Transmission"
                    value={
                      vehicle.transmission || "—"
                    }
                  />
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-gray-500">
                  <Gauge size={14} />

                  {vehicle.mileage !== null
                    ? `${vehicle.mileage.toLocaleString()} km`
                    : "Mileage not added"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#111] px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">
                  CK Motors
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {editingVehicle
                    ? "Edit Vehicle"
                    : "Add New Vehicle"}
                </h2>
              </div>

              <button
                onClick={closeForm}
                className="rounded-lg border border-white/10 p-2 text-gray-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="p-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Registration Number *"
                  value={form.registration_number}
                  placeholder="ABC-1234"
                  onChange={(value) =>
                    updateForm(
                      "registration_number",
                      value
                    )
                  }
                />

                <SearchableVehicleSelect label="Brand" required value={form.brand} options={masterData.brands} onChange={(value) => setForm((current) => ({ ...current, brand: value, model: "" }))} />
                <SearchableVehicleSelect label="Model" required value={form.model} options={masterData.models.filter((model) => model.brand === form.brand).map((model) => model.name)} onChange={(value) => updateForm("model", value)} />

                <Input
                  label="Manufacturing Year"
                  type="number"
                  value={form.manufacture_year}
                  placeholder="2020"
                  onChange={(value) =>
                    updateForm(
                      "manufacture_year",
                      value
                    )
                  }
                />

                <SearchableVehicleSelect label="Vehicle Type" value={form.vehicle_type} options={masterData.vehicleTypes} onChange={(value) => updateForm("vehicle_type", value)} />
                <SearchableVehicleSelect label="Fuel Type" value={form.fuel_type} options={masterData.fuelTypes} onChange={(value) => updateForm("fuel_type", value)} />
                <SearchableVehicleSelect label="Engine Capacity" value={form.engine_capacity} options={masterData.engineCapacities} onChange={(value) => updateForm("engine_capacity", value)} />
                <SearchableVehicleSelect label="Transmission" value={form.transmission} options={masterData.transmissions} onChange={(value) => updateForm("transmission", value)} />

                <Input
                  label="Current Mileage (km)"
                  type="number"
                  value={form.mileage}
                  placeholder="65000"
                  onChange={(value) =>
                    updateForm("mileage", value)
                  }
                />

                <Input
                  label="Chassis Number"
                  value={form.chassis_number}
                  placeholder="Optional"
                  onChange={(value) =>
                    updateForm(
                      "chassis_number",
                      value
                    )
                  }
                />

                <Input
                  label="Engine Number"
                  value={form.engine_number}
                  placeholder="Optional"
                  onChange={(value) =>
                    updateForm(
                      "engine_number",
                      value
                    )
                  }
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Notes
                </label>

                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) =>
                    updateForm(
                      "notes",
                      e.target.value
                    )
                  }
                  placeholder="Any additional information about the vehicle..."
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none transition placeholder:text-gray-700 focus:border-red-600"
                />
              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-white/10 px-5 py-3 text-xs font-bold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-6 py-3 text-xs font-bold transition hover:from-red-500 hover:to-red-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingVehicle
                    ? "Save Changes"
                    : "Add Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function VehicleInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-700">
        {label}
      </p>

      <p className="mt-1 font-semibold text-gray-400">
        {value}
      </p>
    </div>
  );
}

function Input({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-gray-400">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none transition placeholder:text-gray-700 focus:border-red-600"
      />
    </div>
  );
}
