"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  Gauge,
  Wrench,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import SearchableVehicleSelect from "@/components/vehicles/SearchableVehicleSelect";

type Vehicle = {
  id: string;
  registration_number: string;
  brand: string;
  model: string;
};

type Service = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_from: number | null;
  estimated_duration_minutes: number | null;
};

type Booking = {
  id: string;
  booking_reference: string;
  booking_date: string;
  booking_time: string;
  mileage: number | null;
  problem_description: string | null;
  status: string;
  service_name_snapshot: string | null;
  vehicle_id: string;
};

const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function BookingManager({
  onAddVehicle,
}: {
  onAddVehicle?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [vehicleId, setVehicleId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [mileage, setMileage] = useState("");
  const [problemDescription, setProblemDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reference, setReference] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please login again.");
      setLoading(false);
      return;
    }

    const [vehicleResult, serviceResult, bookingResult] =
      await Promise.all([
        supabase
          .from("vehicles")
          .select("id, registration_number, brand, model")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),

        supabase
          .from("services")
          .select(
            "id, name, category, description, price_from, estimated_duration_minutes"
          )
          .eq("active", true)
          .order("name", { ascending: true }),

        supabase
          .from("bookings")
          .select(
            `
            id,
            booking_reference,
            booking_date,
            booking_time,
            mileage,
            problem_description,
            status,
            service_name_snapshot,
            vehicle_id
            `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

    if (vehicleResult.error) {
      setError(vehicleResult.error.message);
    } else {
      setVehicles((vehicleResult.data || []) as Vehicle[]);
    }

    if (serviceResult.error) {
      setError(serviceResult.error.message);
    } else {
      setServices((serviceResult.data || []) as Service[]);
    }

    if (bookingResult.error) {
      setError(bookingResult.error.message);
    } else {
      setBookings((bookingResult.data || []) as Booking[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const selectedService = services.find(
    (service) => service.id === serviceId
  );

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === vehicleId
  );

  async function handleBooking(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setReference("");

    if (!vehicleId) {
      setError("Please select a vehicle.");
      return;
    }

    if (!serviceId) {
      setError("Please select a service.");
      return;
    }

    if (!bookingDate) {
      setError("Please select a booking date.");
      return;
    }

    if (bookingDate < getToday()) {
      setError("Booking date cannot be in the past.");
      return;
    }

    if (!bookingTime) {
      setError("Please select a time.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session has expired. Please login again.");
      return;
    }

    setBooking(true);

    const { data, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        vehicle_id: vehicleId,
        service_id: serviceId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        mileage: mileage ? Number(mileage) : null,
        problem_description:
          problemDescription.trim() || null,
        status: "pending",
      })
      .select(
        `
        id,
        booking_reference,
        booking_date,
        booking_time,
        mileage,
        problem_description,
        status,
        service_name_snapshot,
        vehicle_id
        `
      )
      .single();

    if (bookingError) {
      setError(bookingError.message);
      setBooking(false);
      return;
    }

    setReference(data.booking_reference);

    setSuccess(
      `Booking submitted successfully. Reference: ${data.booking_reference}`
    );

    setVehicleId("");
    setServiceId("");
    setBookingDate("");
    setBookingTime("");
    setMileage("");
    setProblemDescription("");

    await loadData();

    setBooking(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-white/10 bg-[#111]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />

          <p className="text-xs text-gray-500">
            Loading booking system...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BOOKING FORM */}
      <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6">
        <div className="mb-6">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">
            CK Motors Service Center
          </p>

          <h2 className="text-xl font-black">
            Book a Vehicle Service
          </h2>

          <p className="mt-2 text-xs leading-5 text-gray-600">
            Select your vehicle, service, date and preferred
            time to request an appointment.
          </p>
        </div>

        {vehicles.length === 0 ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onAddVehicle?.()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onAddVehicle?.();
              }
            }}
            aria-label="Add a vehicle to enable service booking"
            className="cursor-pointer rounded-xl border border-dashed border-red-900/50 bg-red-950/10 p-8 text-center transition hover:border-red-500 hover:bg-red-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Car
              size={34}
              className="mx-auto mb-3 text-red-500"
            />

            <h3 className="font-bold">
              Add a Vehicle First
            </h3>

            <p className="mt-2 text-xs text-gray-500">
              You must register a vehicle before making a
              service booking.
            </p>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddVehicle?.();
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-red-500"
            >
              ADD VEHICLE
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleBooking}
            className="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {/* VEHICLE */}
              <SearchableVehicleSelect
                label="Select Vehicle"
                required
                value={vehicles.find((vehicle) => vehicle.id === vehicleId) ? `${vehicles.find((vehicle) => vehicle.id === vehicleId)?.registration_number} — ${vehicles.find((vehicle) => vehicle.id === vehicleId)?.brand} ${vehicles.find((vehicle) => vehicle.id === vehicleId)?.model}` : ""}
                options={vehicles.map((vehicle) => `${vehicle.registration_number} — ${vehicle.brand} ${vehicle.model}`)}
                onChange={(value) => setVehicleId(vehicles.find((vehicle) => `${vehicle.registration_number} — ${vehicle.brand} ${vehicle.model}` === value)?.id || "")}
                placeholder="Search vehicles..."
              />

              {/* SERVICE */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Select Service *
                </label>

                <select
                  value={serviceId}
                  onChange={(e) =>
                    setServiceId(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600"
                >
                  <option value="">
                    Choose a service
                  </option>

                  {services.map((service) => (
                    <option
                      key={service.id}
                      value={service.id}
                    >
                      {service.name}
                      {service.price_from !== null
                        ? ` — From LKR ${Number(
                            service.price_from
                          ).toLocaleString()}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* DATE */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Appointment Date *
                </label>

                <input
                  type="date"
                  min={getToday()}
                  value={bookingDate}
                  onChange={(e) =>
                    setBookingDate(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600"
                />
              </div>

              {/* TIME */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Preferred Time *
                </label>

                <select
                  value={bookingTime}
                  onChange={(e) =>
                    setBookingTime(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600"
                >
                  <option value="">
                    Choose a time
                  </option>

                  {TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              {/* MILEAGE */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Current Mileage (km)
                </label>

                <div className="relative">
                  <Gauge
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600"
                  />

                  <input
                    type="number"
                    min="0"
                    value={mileage}
                    onChange={(e) =>
                      setMileage(e.target.value)
                    }
                    placeholder="65000"
                    className="w-full rounded-lg border border-white/10 bg-[#080808] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-gray-700 focus:border-red-600"
                  />
                </div>
              </div>
            </div>

            {/* SELECTED SERVICE */}
            {selectedService && (
              <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-950/50 text-red-500">
                    <Wrench size={19} />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold">
                      {selectedService.name}
                    </h3>

                    {selectedService.description && (
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {selectedService.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-semibold text-gray-500">
                      {selectedService.price_from !== null && (
                        <span className="text-red-500">
                          From LKR{" "}
                          {Number(
                            selectedService.price_from
                          ).toLocaleString()}
                        </span>
                      )}

                      {selectedService.estimated_duration_minutes && (
                        <span>
                          Approx.{" "}
                          {
                            selectedService.estimated_duration_minutes
                          }{" "}
                          minutes
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Describe Vehicle Problem / Request
              </label>

              <textarea
                rows={5}
                value={problemDescription}
                onChange={(e) =>
                  setProblemDescription(e.target.value)
                }
                placeholder="Example: Engine warning light is on, unusual noise when accelerating..."
                className="w-full resize-none rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none placeholder:text-gray-700 focus:border-red-600"
              />
            </div>

            {selectedVehicle && (
              <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-4 py-3 text-xs text-gray-500">
                <Car size={16} />

                Booking for:
                <span className="font-bold text-gray-300">
                  {selectedVehicle.registration_number} —{" "}
                  {selectedVehicle.brand}{" "}
                  {selectedVehicle.model}
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-900/60 bg-green-950/20 px-4 py-4">
                <div className="flex gap-3">
                  <CheckCircle2
                    size={20}
                    className="shrink-0 text-green-500"
                  />

                  <div>
                    <p className="text-sm font-bold text-green-400">
                      Service Booking Submitted
                    </p>

                    <p className="mt-1 text-xs text-green-700">
                      {success}
                    </p>

                    {reference && (
                      <p className="mt-3 text-lg font-black tracking-wider text-white">
                        {reference}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end border-t border-white/10 pt-5">
              <button
                type="submit"
                disabled={booking}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-6 py-3 text-xs font-bold transition hover:from-red-500 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalendarDays size={17} />

                {booking
                  ? "Submitting Booking..."
                  : "Confirm Service Booking"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* BOOKINGS */}
      <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6">
        <div className="mb-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">
            Booking History
          </p>

          <h2 className="text-xl font-black">
            My Service Bookings
          </h2>
        </div>

        {bookings.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-center">
            <CalendarDays
              size={30}
              className="mb-3 text-gray-700"
            />

            <p className="text-sm text-gray-600">
              No service bookings yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((item) => {
              const vehicle = vehicles.find(
                (vehicle) =>
                  vehicle.id === item.vehicle_id
              );

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-red-500">
                        {item.booking_reference}
                      </p>

                      <h3 className="mt-1 font-black">
                        {item.service_name_snapshot ||
                          "Vehicle Service"}
                      </h3>

                      {vehicle && (
                        <p className="mt-2 text-xs text-gray-500">
                          {vehicle.registration_number} •{" "}
                          {vehicle.brand} {vehicle.model}
                        </p>
                      )}
                    </div>

                    <StatusBadge status={item.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-5 border-t border-white/10 pt-4 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} />
                      {item.booking_date}
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock3 size={14} />
                      {item.booking_time.slice(0, 5)}
                    </div>

                    {item.mileage !== null && (
                      <div className="flex items-center gap-2">
                        <Gauge size={14} />
                        {item.mileage.toLocaleString()} km
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const readableStatus = status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

  return (
    <span className="rounded-full border border-red-900/50 bg-red-950/30 px-3 py-1 text-[10px] font-bold text-red-400">
      {readableStatus}
    </span>
  );
}