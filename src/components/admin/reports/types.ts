// Shared, structurally-compatible types for the Report Center. These mirror
// the existing types already defined in src/app/admin/page.tsx so the same
// already-loaded arrays can be passed straight in without re-fetching.

export type ReportProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  role: string;
  status: string;
  created_at: string;
};

export type ReportVehicle = {
  id: string;
  user_id: string;
  registration_number: string;
  brand: string;
  model: string;
  manufacture_year: number | null;
  mileage: number | null;
  is_active: boolean;
};

export type ReportBooking = {
  id: string;
  booking_reference: string;
  user_id: string;
  vehicle_id: string;
  service_id: string | null;
  service_name_snapshot: string | null;
  booking_date: string;
  booking_time: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

export type ReportServiceRecord = {
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
  next_service_date: string | null;
  created_at: string;
};

export type ReportSentMessage = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  message_recipients: { user_id: string; is_read: boolean }[];
};

export function invoiceNumberFor(record: Pick<ReportServiceRecord, "id" | "service_date">) {
  const date = record.service_date.replaceAll("-", "");
  return `CKI-${date}-${record.id.slice(0, 6).toUpperCase()}`;
}
