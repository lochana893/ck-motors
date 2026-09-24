"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Printer,
  Search,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type ServiceRecord = {
  id: string;
  booking_id: string | null;
  user_id: string;
  vehicle_id: string;
  technician_name: string | null;
  mileage: number | null;
  service_date: string;
  services_performed: string;
  labour_cost: number;
  parts_cost: number;
  additional_cost: number;
  discount: number;
  total_cost: number;
  technician_notes: string | null;
  recommended_repairs: string | null;
  next_service_date: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
};

type Vehicle = {
  id: string;
  registration_number: string;
  brand: string;
  model: string;
};

type Booking = {
  id: string;
  booking_reference: string;
};

type ServicePart = {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export default function ServiceInvoices() {
  const supabase = useMemo(() => createClient(), []);

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [selectedRecord, setSelectedRecord] =
    useState<ServiceRecord | null>(null);

  const [parts, setParts] = useState<ServicePart[]>([]);

  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      recordResult,
      profileResult,
      vehicleResult,
      bookingResult,
    ] = await Promise.all([
      supabase
        .from("service_records")
        .select(`
          id,
          booking_id,
          user_id,
          vehicle_id,
          technician_name,
          mileage,
          service_date,
          services_performed,
          labour_cost,
          parts_cost,
          additional_cost,
          discount,
          total_cost,
          technician_notes,
          recommended_repairs,
          next_service_date,
          created_at
        `)
        .order("service_date", { ascending: false }),

      supabase
        .from("profiles")
        .select("id, full_name, email, phone"),

      supabase
        .from("vehicles")
        .select("id, registration_number, brand, model"),

      supabase
        .from("bookings")
        .select("id, booking_reference"),
    ]);

    if (recordResult.error) {
      setError(recordResult.error.message);
    } else {
      setRecords(
        (recordResult.data || []) as ServiceRecord[]
      );
    }

    if (profileResult.data) {
      setProfiles(profileResult.data as Profile[]);
    }

    if (vehicleResult.data) {
      setVehicles(vehicleResult.data as Vehicle[]);
    }

    if (bookingResult.data) {
      setBookings(bookingResult.data as Booking[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  function getCustomer(userId: string) {
    return profiles.find(
      (profile) => profile.id === userId
    );
  }

  function getVehicle(vehicleId: string) {
    return vehicles.find(
      (vehicle) => vehicle.id === vehicleId
    );
  }

  function getBooking(bookingId: string | null) {
    if (!bookingId) return undefined;

    return bookings.find(
      (booking) => booking.id === bookingId
    );
  }

  function invoiceNumber(record: ServiceRecord) {
    const date = record.service_date.replaceAll("-", "");

    return `CKI-${date}-${record.id
      .slice(0, 6)
      .toUpperCase()}`;
  }

  async function openInvoice(record: ServiceRecord) {
    setInvoiceLoading(true);
    setError("");

    const { data, error: partsError } =
      await supabase
        .from("service_parts")
        .select(`
          id,
          part_name,
          part_number,
          quantity,
          unit_price,
          total_price
        `)
        .eq("service_record_id", record.id)
        .order("created_at", { ascending: true });

    if (partsError) {
      setError(partsError.message);
      setInvoiceLoading(false);
      return;
    }

    setParts((data || []) as ServicePart[]);
    setSelectedRecord(record);
    setInvoiceLoading(false);
  }

  const filteredRecords = records.filter((record) => {
    const customer = getCustomer(record.user_id);
    const vehicle = getVehicle(record.vehicle_id);
    const booking = getBooking(record.booking_id);

    const searchable = [
      invoiceNumber(record),
      booking?.booking_reference,
      customer?.full_name,
      customer?.email,
      vehicle?.registration_number,
      vehicle?.brand,
      vehicle?.model,
      record.services_performed,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex min-h-60 items-center justify-center rounded-2xl border border-white/10 bg-[#111]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">
              CK Motors Billing
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Service Records & Invoices
            </h2>

            <p className="mt-2 text-xs text-gray-600">
              View completed services and print customer invoices.
            </p>
          </div>

          <div className="relative w-full max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice, customer, vehicle..."
              className="w-full rounded-lg border border-white/10 bg-[#080808] py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-red-600"
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {filteredRecords.length === 0 ? (
          <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-gray-600">
            No service records found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
              const customer = getCustomer(record.user_id);
              const vehicle = getVehicle(record.vehicle_id);
              const booking = getBooking(record.booking_id);

              return (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-white/10 bg-black/30 p-5"
                >
                  <div>
                    <p className="text-[10px] font-black tracking-wider text-red-500">
                      {invoiceNumber(record)}
                    </p>

                    <h3 className="mt-1 font-black">
                      {record.services_performed}
                    </h3>

                    <p className="mt-2 text-xs text-gray-500">
                      {customer?.full_name || "Customer"} •{" "}
                      {vehicle?.registration_number || "Vehicle"}
                    </p>

                    <p className="mt-1 text-[10px] text-gray-700">
                      <span className="mr-2 rounded bg-red-950/30 px-2 py-1 font-bold text-red-500">
                        {booking ? "Booking" : "Walk-In"}
                      </span>
                      {booking?.booking_reference || "Walk-In Service"} •{" "}
                      {record.service_date}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-gray-700">
                        Total
                      </p>

                      <p className="font-black text-red-500">
                        LKR{" "}
                        {Number(
                          record.total_cost || 0
                        ).toLocaleString()}
                      </p>
                    </div>

                    <button
                      onClick={() => openInvoice(record)}
                      disabled={invoiceLoading}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-xs font-bold text-red-500 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                    >
                      <FileText size={16} />
                      View Invoice
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INVOICE MODAL */}
      {selectedRecord && (
        <InvoiceModal
          record={selectedRecord}
          customer={getCustomer(selectedRecord.user_id)}
          vehicle={getVehicle(selectedRecord.vehicle_id)}
          booking={getBooking(selectedRecord.booking_id)}
          parts={parts}
          invoiceNumber={invoiceNumber(selectedRecord)}
          close={() => setSelectedRecord(null)}
        />
      )}
    </>
  );
}

function InvoiceModal({
  record,
  customer,
  vehicle,
  booking,
  parts,
  invoiceNumber,
  close,
}: {
  record: ServiceRecord;
  customer?: Profile;
  vehicle?: Vehicle;
  booking?: Booking;
  parts: ServicePart[];
  invoiceNumber: string;
  close: () => void;
}) {
  return (
    <div className="invoice-print-overlay fixed inset-0 z-[300] overflow-y-auto bg-black/85 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="no-print mb-4 flex justify-end gap-3">
          <button
            onClick={close}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#111] px-4 py-3 text-xs font-bold text-white hover:bg-white/10"
          >
            <X size={16} />
            Close
          </button>

          <button
            onClick={async () => {
              const logo = document.querySelector<HTMLImageElement>(
                ".invoice-print-area .invoice-logo"
              );
              if (logo && !logo.complete) {
                await logo.decode().catch(() => undefined);
              }
              window.print();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-xs font-bold text-white hover:bg-red-500"
          >
            <Printer size={16} />
            Print / Save PDF
          </button>
        </div>

        <div className="invoice-print-area rounded-2xl bg-white p-7 text-black shadow-2xl md:p-10">
          {/* HEADER */}
          <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-red-600 pb-6">
            <div className="flex min-h-[58px] items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ck-motors-logo.png"
                alt="CK Motors"
                className="invoice-logo"
              />
            </div>

            <div className="text-right">
              <h2 className="text-2xl font-black">
                INVOICE
              </h2>

              <p className="mt-2 text-sm font-bold text-red-600">
                {invoiceNumber}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Service Date: {record.service_date}
              </p>
            </div>
          </div>

          {/* DETAILS */}
          <div className="mt-7 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Bill To
              </p>

              <p className="mt-2 font-black">
                {customer?.full_name || "Customer"}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {customer?.email || ""}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {customer?.phone || ""}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Vehicle Details
              </p>

              <p className="mt-2 font-black">
                {vehicle
                  ? `${vehicle.brand} ${vehicle.model}`
                  : "Vehicle"}
              </p>

              <p className="mt-1 text-sm font-bold text-red-600">
                {vehicle?.registration_number || ""}
              </p>

              {record.mileage !== null && (
                <p className="mt-1 text-sm text-gray-600">
                  Mileage: {record.mileage.toLocaleString()} km
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-gray-100 p-4">
            <p className="text-xs text-gray-500">
              Service Type
            </p>

            <p className="mt-1 font-bold">
              {booking?.booking_reference || "Walk-In Service"}
            </p>
          </div>

          {/* SERVICE */}
          <div className="mt-7">
            <h3 className="border-b border-gray-200 pb-2 font-black">
              Service Performed
            </h3>

            <p className="mt-3 text-sm leading-6 text-gray-700">
              {record.services_performed}
            </p>
          </div>

          {/* PARTS */}
          <div className="mt-7">
            <h3 className="mb-3 font-black">
              Parts Used
            </h3>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-xs">
                  <tr>
                    <th className="p-3">Part</th>
                    <th className="p-3">Part No.</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {parts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-4 text-center text-gray-400"
                      >
                        No parts recorded
                      </td>
                    </tr>
                  ) : (
                    parts.map((part) => (
                      <tr
                        key={part.id}
                        className="border-t border-gray-200"
                      >
                        <td className="p-3 font-semibold">
                          {part.part_name}
                        </td>

                        <td className="p-3 text-gray-500">
                          {part.part_number || "—"}
                        </td>

                        <td className="p-3 text-right">
                          {part.quantity}
                        </td>

                        <td className="p-3 text-right">
                          {Number(
                            part.unit_price
                          ).toLocaleString()}
                        </td>

                        <td className="p-3 text-right font-bold">
                          {Number(
                            part.total_price
                          ).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOTALS */}
          <div className="mt-7 ml-auto max-w-sm space-y-3">
            <InvoiceRow
              label="Labour Cost"
              value={record.labour_cost}
            />

            <InvoiceRow
              label="Parts Cost"
              value={record.parts_cost}
            />

            <InvoiceRow
              label="Additional Cost"
              value={record.additional_cost}
            />

            <InvoiceRow
              label="Discount"
              value={-Number(record.discount || 0)}
            />

            <div className="flex items-center justify-between border-t-2 border-red-600 pt-4">
              <span className="font-black">
                GRAND TOTAL
              </span>

              <span className="text-2xl font-black text-red-600">
                LKR{" "}
                {Number(
                  record.total_cost || 0
                ).toLocaleString()}
              </span>
            </div>
          </div>

          {/* NOTES */}
          {(record.technician_notes ||
            record.recommended_repairs ||
            record.next_service_date) && (
            <div className="mt-8 grid gap-5 border-t border-gray-200 pt-6 md:grid-cols-2">
              <div>
                <p className="text-xs font-black">
                  Technician Notes
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  {record.technician_notes || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black">
                  Recommended Repairs
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  {record.recommended_repairs || "—"}
                </p>

                {record.next_service_date && (
                  <p className="mt-3 text-xs font-bold text-red-600">
                    Next Service: {record.next_service_date}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div className="mt-10 border-t border-gray-200 pt-5 text-center">
            <p className="text-sm font-black">
              Thank you for choosing CK Motors.
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Professional Vehicle Care • Drive With Confidence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">
        {label}
      </span>

      <span className="font-bold">
        LKR {Number(value || 0).toLocaleString()}
      </span>
    </div>
  );
}