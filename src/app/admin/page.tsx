"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Car,
  ClipboardList,
  DollarSign,
  Edit3,
  Eye,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Users,
  Wrench,
  Images,
  KeyRound,
  Settings,
  Package,
  Factory,
  UserCog,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import ServiceRecordManager from "@/components/admin/ServiceRecordManager";
import ServiceInvoices from "@/components/admin/ServiceInvoices";
import CKLogo from "@/components/CKLogo";
import ThemeToggle from "@/components/ThemeToggle";
import WebsiteSettingsSection from "@/components/admin/WebsiteSettingsSection";
import AdminUsersSection from "@/components/admin/AdminUsersSection";
import InventoryManager from "@/components/admin/InventoryManager";
import SuppliersManager from "@/components/admin/SuppliersManager";
import TechniciansManager from "@/components/admin/TechniciansManager";
import { isProtectedOwnerEmail } from "@/lib/protected-owner";
import SearchableVehicleSelect from "@/components/vehicles/SearchableVehicleSelect";
import { useVehicleMasterData } from "@/lib/vehicle-master-data";
import VehicleSettingsSection from "@/components/admin/VehicleSettingsSection";



type Section =
  | "dashboard"
  | "bookings"
  | "customers"
  | "vehicles"
  | "services"
  | "records"
  | "messages"
  | "gallery"
  | "website-settings"
  | "users"
  | "vehicle-settings"
  | "inventory"
  | "suppliers"
  | "technicians";

type Profile = {
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

type Vehicle = {
  id: string;
  user_id: string;
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
  is_active: boolean;
};

type VehicleForm = {
  registration_number: string;
  brand: string;
  model: string;
  manufacture_year: string;
  vehicle_type: string;
  fuel_type: string;
  engine_capacity: string;
  transmission: string;
  mileage: string;
  chassis_number: string;
  engine_number: string;
  notes: string;
};

const emptyVehicleForm: VehicleForm = {
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

type Booking = {
  id: string;
  booking_reference: string;
  user_id: string;
  vehicle_id: string;
  service_id: string | null;
  service_name_snapshot: string | null;
  booking_date: string;
  booking_time: string;
  mileage: number | null;
  problem_description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

type Service = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  price_from: number | null;
  estimated_duration_minutes: number | null;
  active: boolean;
  created_at: string;
};

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
  next_service_date: string | null;
  created_at: string;
};

type GalleryItem = {
  id: string;
  title: string | null;
  caption: string | null;
  storage_path: string;
  image_url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

type MessageRecipientMode = "all" | "selected" | "individual";

type SentMessage = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  message_attachments: { id: string; file_name: string }[];
  message_recipients: { user_id: string; is_read: boolean }[];
};

const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "vehicle_received",
  "inspection",
  "repair_in_progress",
  "waiting_for_parts",
  "ready_for_collection",
  "completed",
  "cancelled",
];

const emptyServiceForm = {
  name: "",
  slug: "",
  category: "",
  description: "",
  price_from: "",
  estimated_duration_minutes: "",
  active: true,
};

function monthKey(date: string | Date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00`));
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [activeSection, setActiveSection] =
    useState<Section>("dashboard");

    const [sidebarOpen, setSidebarOpen] = useState(false);  
    const [loading, setLoading] = useState(true);

  const [adminProfile, setAdminProfile] =
    useState<Profile | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [updatingBooking, setUpdatingBooking] =
    useState<string | null>(null);

  const [showServiceModal, setShowServiceModal] =
    useState(false);

  const [editingService, setEditingService] =
    useState<Service | null>(null);

  const [serviceForm, setServiceForm] =
    useState(emptyServiceForm);

  const [savingService, setSavingService] =
    useState(false);
  const [revenueModalOpen, setRevenueModalOpen] =
    useState(false);
  const [revenueMonth, setRevenueMonth] = useState(
    monthKey(new Date())
  );
  const [messageMode, setMessageMode] = useState<MessageRecipientMode>("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [messageFileError, setMessageFileError] = useState("");
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [customerView, setCustomerView] = useState<Profile | null>(null);
  const [roleEditor, setRoleEditor] = useState<Profile | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Profile | null>(null);
  const [customerForm, setCustomerForm] = useState({
    full_name: "", phone: "", address_line1: "", address_line2: "", city: "", district: "", postal_code: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    district: "",
    postal_code: "",
  });
  const [addVehicleNow, setAddVehicleNow] = useState(false);
  const [newVehicleForm, setNewVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [vehicleEditor, setVehicleEditor] = useState<{
    customerId: string;
    vehicle: Vehicle | null;
  } | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [editingGallery, setEditingGallery] = useState<GalleryItem | null>(null);
  const [createdCustomerCredentials, setCreatedCustomerCredentials] = useState<{
    full_name: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [repairedCustomerCredentials, setRepairedCustomerCredentials] = useState<{
    full_name: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: currentProfile, error: profileError } =
      await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, address, address_line1, address_line2, city, district, postal_code, role, status, created_at"
        )
        .eq("id", user.id)
        .single();

    if (profileError || !currentProfile) {
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    if (
      currentProfile.status !== "active" ||
      !["admin", "staff"].includes(currentProfile.role)
    ) {
      router.replace("/dashboard");
      return;
    }

    setAdminProfile(currentProfile as Profile);

    const [
      profileResult,
      vehicleResult,
      bookingResult,
      serviceResult,
      recordResult,
      messageResult,
      galleryResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, address, address_line1, address_line2, city, district, postal_code, role, status, created_at"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("vehicles")
        .select(
          `
          id,
          user_id,
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
          notes,
          is_active
          `
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("bookings")
        .select(
          `
          id,
          booking_reference,
          user_id,
          vehicle_id,
          service_id,
          service_name_snapshot,
          booking_date,
          booking_time,
          mileage,
          problem_description,
          status,
          admin_notes,
          created_at
          `
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("services")
        .select(
          `
          id,
          name,
          slug,
          category,
          description,
          price_from,
          estimated_duration_minutes,
          active,
          created_at
          `
        )
        .order("name", { ascending: true }),

      supabase
        .from("service_records")
        .select(
          `
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
          next_service_date,
          created_at
          `
        )
        .order("service_date", { ascending: false }),

      supabase
        .from("messages")
        .select("id, title, body, created_at, message_attachments(id, file_name), message_recipients(user_id, is_read)")
        .order("created_at", { ascending: false }),
      supabase
        .from("gallery")
        .select("id, title, caption, storage_path, image_url, is_active, display_order, created_at")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.error) {
      setError(profileResult.error.message);
    } else {
      setProfiles((profileResult.data || []) as Profile[]);
    }

    if (vehicleResult.error) {
      setError(vehicleResult.error.message);
    } else {
      setVehicles((vehicleResult.data || []) as Vehicle[]);
    }

    if (bookingResult.error) {
      setError(bookingResult.error.message);
    } else {
      setBookings((bookingResult.data || []) as Booking[]);
    }

    if (serviceResult.error) {
      setError(serviceResult.error.message);
    } else {
      setServices((serviceResult.data || []) as Service[]);
    }

    if (recordResult.error) {
      setError(recordResult.error.message);
    } else {
      setRecords(
        (recordResult.data || []) as ServiceRecord[]
      );
    }

    if (!messageResult.error) {
      setSentMessages((messageResult.data || []) as unknown as SentMessage[]);
    }
    if (galleryResult.error) setError(galleryResult.error.message);
    else setGallery((galleryResult.data || []) as GalleryItem[]);

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdminData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function changeSection(section: Section) {
    setActiveSection(section);
    setSidebarOpen(false);
    setSearch("");
    setError("");
    setSuccess("");
  }

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

  function openCustomerMessage(customer: Profile) {
    setSelectedCustomerIds([customer.id]);
    setMessageMode("individual");
    setActiveSection("messages");
    setSidebarOpen(false);
    setError("");
    setSuccess("");
  }

  function openCustomerEdit(customer: Profile) {
    setEditingCustomer(customer);
    setCustomerForm({
      full_name: customer.full_name,
      phone: customer.phone || "",
      address_line1: customer.address_line1 || "",
      address_line2: customer.address_line2 || "",
      city: customer.city || "",
      district: customer.district || "",
      postal_code: customer.postal_code || "",
    });
    setError("");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCustomer || adminProfile?.role !== "admin") return;
    if (!customerForm.full_name.trim()) {
      setError("Customer name is required.");
      return;
    }

    setSavingCustomer(true);
    setError("");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: customerForm.full_name.trim(),
        phone: customerForm.phone.trim() || null,
        address_line1: customerForm.address_line1.trim() || null,
        address_line2: customerForm.address_line2.trim() || null,
        city: customerForm.city.trim() || null,
        district: customerForm.district.trim() || null,
        postal_code: customerForm.postal_code.trim() || null,
      })
      .eq("id", editingCustomer.id)
      .eq("role", "customer");

    setSavingCustomer(false);
    if (updateError) {
      setError(`Customer could not be updated: ${updateError.message}`);
      return;
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === editingCustomer.id
          ? {
              ...profile,
              full_name: customerForm.full_name.trim(),
              phone: customerForm.phone.trim() || null,
              address_line1: customerForm.address_line1.trim() || null,
              address_line2: customerForm.address_line2.trim() || null,
              city: customerForm.city.trim() || null,
              district: customerForm.district.trim() || null,
              postal_code: customerForm.postal_code.trim() || null,
            }
          : profile
      )
    );
    setEditingCustomer(null);
    setSuccess("Customer updated successfully.");
  }

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adminProfile?.role !== "admin") return;
    if (
      !newCustomerForm.full_name.trim() ||
      !newCustomerForm.email.trim()
    ) {
      setError("Full name and email are required.");
      return;
    }

    setSavingCustomer(true);
    setError("");
    const response = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCustomerForm),
    });
    const result = (await response.json()) as {
      error?: string;
      customer?: { id: string; full_name: string; email: string };
      temporaryPassword?: string;
    };
    setSavingCustomer(false);

    if (!response.ok) {
      setError(result.error || "Customer could not be created.");
      return;
    }

    setShowAddCustomer(false);
    setNewCustomerForm({ full_name: "", email: "", phone: "", address_line1: "", address_line2: "", city: "", district: "", postal_code: "" });
    if (result.customer && result.temporaryPassword) {
      setCreatedCustomerCredentials({
        ...result.customer,
        temporaryPassword: result.temporaryPassword,
      });
    }
    if (result.customer?.id && addVehicleNow) {
      const { error: vehicleError } = await saveVehicleRecord(
        result.customer.id,
        newVehicleForm,
        null
      );
      if (vehicleError) {
        setError(
          `Customer created successfully, but vehicle could not be added: ${vehicleError}`
        );
      }
    }
    setAddVehicleNow(false);
    setNewVehicleForm(emptyVehicleForm);
    await loadAdminData();
  }

  async function repairCustomerLogin(customer: Profile) {
    if (adminProfile?.role !== "admin") return;
    if (!window.confirm(`Reset the login for ${customer.email}?\n\nThis will invalidate the current password and generate a temporary password.`)) return;

    setError("");
    const response = await fetch("/api/admin/customers/repair-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: customer.id }),
    });
    const result = (await response.json()) as {
      error?: string;
      customer?: { full_name: string; email: string };
      temporaryPassword?: string;
    };

    if (!response.ok) {
      setError(result.error || "Customer login could not be repaired.");
      return;
    }

    if (result.customer && result.temporaryPassword) {
      setRepairedCustomerCredentials({
        ...result.customer,
        temporaryPassword: result.temporaryPassword,
      });
    }
  }

  function vehiclePayload(customerId: string, form: VehicleForm) {
    return {
      user_id: customerId,
      registration_number: form.registration_number.trim().toUpperCase(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      manufacture_year: form.manufacture_year ? Number(form.manufacture_year) : null,
      vehicle_type: form.vehicle_type || null,
      fuel_type: form.fuel_type || null,
      engine_capacity: form.engine_capacity.trim() || null,
      transmission: form.transmission || null,
      mileage: form.mileage ? Number(form.mileage) : null,
      chassis_number: form.chassis_number.trim() || null,
      engine_number: form.engine_number.trim() || null,
      notes: form.notes.trim() || null,
    };
  }

  async function saveVehicleRecord(
    customerId: string,
    form: VehicleForm,
    vehicleId: string | null
  ) {
    if (!form.registration_number.trim() || !form.brand.trim() || !form.model.trim()) {
      return { error: "Registration number, brand, and model are required." };
    }
    const duplicateQuery = supabase
      .from("vehicles")
      .select("id")
      .eq("registration_number", form.registration_number.trim().toUpperCase());
    const { data: duplicate, error: duplicateError } = vehicleId
      ? await duplicateQuery.neq("id", vehicleId).maybeSingle()
      : await duplicateQuery.maybeSingle();
    if (duplicateError) return { error: duplicateError.message };
    if (duplicate) return { error: "This registration number already exists." };

    const query = vehicleId
      ? supabase.from("vehicles").update(vehiclePayload(customerId, form)).eq("id", vehicleId).eq("user_id", customerId)
      : supabase.from("vehicles").insert(vehiclePayload(customerId, form));
    const { error } = await query;
    return { error: error?.message || null };
  }

  function openVehicleEditor(customerId: string, vehicle: Vehicle | null) {
    setVehicleEditor({ customerId, vehicle });
    setVehicleForm(
      vehicle
        ? {
            registration_number: vehicle.registration_number || "",
            brand: vehicle.brand || "",
            model: vehicle.model || "",
            manufacture_year: vehicle.manufacture_year?.toString() || "",
            vehicle_type: vehicle.vehicle_type || "Car",
            fuel_type: vehicle.fuel_type || "Petrol",
            engine_capacity: vehicle.engine_capacity || "",
            transmission: vehicle.transmission || "Automatic",
            mileage: vehicle.mileage?.toString() || "",
            chassis_number: vehicle.chassis_number || "",
            engine_number: vehicle.engine_number || "",
            notes: vehicle.notes || "",
          }
        : emptyVehicleForm
    );
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicleEditor) return;
    setSavingVehicle(true);
    const result = await saveVehicleRecord(
      vehicleEditor.customerId,
      vehicleForm,
      vehicleEditor.vehicle?.id || null
    );
    setSavingVehicle(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setVehicleEditor(null);
    setSuccess("Vehicle saved successfully.");
    await loadAdminData();
  }

  async function deleteVehicle(vehicle: Vehicle) {
    const hasHistory =
      bookings.some((booking) => booking.vehicle_id === vehicle.id) ||
      records.some((record) => record.vehicle_id === vehicle.id);
    if (hasHistory) {
      setError("This vehicle has existing service history and cannot be permanently deleted.");
      return;
    }
    if (!window.confirm(`Delete ${vehicle.registration_number}? This action cannot be undone.`)) return;
    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", vehicle.id)
      .eq("user_id", vehicle.user_id);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess("Vehicle deleted successfully.");
    await loadAdminData();
  }

  async function deleteCustomer(customer: Profile) {
    if (adminProfile?.role !== "admin") return;
    if (isProtectedOwnerEmail(customer.email)) {
      setError("The primary CK Motors owner account cannot be deleted.");
      return;
    }
    const hasHistory =
      vehicles.some((vehicle) => vehicle.user_id === customer.id) ||
      bookings.some((booking) => booking.user_id === customer.id) ||
      records.some((record) => record.user_id === customer.id);

    if (hasHistory) {
      setError(
        "This customer has existing service history or related records. Deactivate the account instead to preserve business records."
      );
      return;
    }

    if (!window.confirm(`Delete ${customer.full_name}? This action cannot be undone.`)) {
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: customer.id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(`Customer could not be deleted: ${result.error || "Unknown error."}`);
      return;
    }

    setProfiles((current) => current.filter((profile) => profile.id !== customer.id));
    setSuccess("Customer deleted successfully.");
  }

  const activeCustomers = profiles.filter(
    (profile, index, allProfiles) =>
      profile.role === "customer" &&
      profile.status === "active" &&
      allProfiles.findIndex((item) => item.id === profile.id) === index
  );

  const visibleMessageCustomers = activeCustomers.filter((customer) => {
    const query = messageSearch.trim().toLowerCase();
    return (
      !query ||
      [customer.full_name, customer.email, customer.phone || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  });

  async function sendCustomerMessage() {
    const recipientIds =
      messageMode === "all"
        ? activeCustomers.map((customer) => customer.id)
        : messageMode === "individual"
          ? selectedCustomerIds.slice(0, 1)
          : selectedCustomerIds;

    if (!messageTitle.trim() || (!messageBody.trim() && messageFiles.length === 0) || recipientIds.length === 0) {
      setError("Choose at least one active customer, enter a title, and add text or an image.");
      return;
    }

    const recipientLabel =
      messageMode === "all"
        ? `all ${recipientIds.length} active customers`
        : messageMode === "individual"
          ? activeCustomers.find((customer) => customer.id === recipientIds[0])?.full_name || "this customer"
          : `${recipientIds.length} selected customers`;

    if (!window.confirm(`Send this notification to ${recipientLabel}?`)) {
      return;
    }

    setSendingMessage(true);
    setError("");
    setSuccess("");

    const uniqueRecipientIds = [...new Set(recipientIds)];
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        sender_id: adminProfile?.id,
        title: messageTitle.trim(),
        body: messageBody.trim(),
      })
      .select("id")
      .single();

    if (messageError || !message) {
      setSendingMessage(false);
      setError(`Message could not be created: ${messageError?.message || "Unknown error"}`);
      return;
    }

    const recipientResult = await supabase.from("message_recipients").insert(
      uniqueRecipientIds.map((userId) => ({ message_id: message.id, user_id: userId }))
    );
    if (recipientResult.error) {
      await supabase.from("messages").delete().eq("id", message.id);
      setSendingMessage(false);
      setError(`Recipients could not be added: ${recipientResult.error.message}`);
      return;
    }

    const uploadedPaths: string[] = [];
    for (const file of messageFiles) {
      const storagePath = `${message.id}/${crypto.randomUUID()}-${file.name}`;
      const uploadResult = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadResult.error) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("message-attachments").remove(uploadedPaths);
        }
        await supabase.from("messages").delete().eq("id", message.id);
        setSendingMessage(false);
        setError(`Photo upload failed: ${uploadResult.error.message}`);
        return;
      }
      uploadedPaths.push(storagePath);

      const attachmentResult = await supabase.from("message_attachments").insert({
        message_id: message.id,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
      if (attachmentResult.error) {
        await supabase.storage.from("message-attachments").remove(uploadedPaths);
        await supabase.from("messages").delete().eq("id", message.id);
        setSendingMessage(false);
        setError(`Photo record could not be saved: ${attachmentResult.error.message}`);
        return;
      }
    }

    setSendingMessage(false);

    setSuccess(
      `Notification sent successfully to ${uniqueRecipientIds.length} ${
        uniqueRecipientIds.length === 1 ? "customer" : "customers"
      }.`
    );
    setMessageTitle("");
    setMessageBody("");
    setSelectedCustomerIds([]);
    setMessageFiles([]);
    setMessageFileError("");
  }

  function handleMessageFiles(files: FileList | null) {
    if (!files) return;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    const nextFiles = Array.from(files);
    if (nextFiles.length > 5) {
      setMessageFileError("You can attach up to 5 images.");
      return;
    }
    const invalid = nextFiles.find((file) => !allowed.has(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setMessageFileError("Use JPG, PNG, or WEBP images up to 5 MB each.");
      return;
    }
    setMessageFileError("");
    setMessageFiles(nextFiles);
  }

  async function updateBookingStatus(
    bookingId: string,
    status: string
  ) {
    setUpdatingBooking(bookingId);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);

    if (updateError) {
      setError(updateError.message);
      setUpdatingBooking(null);
      return;
    }

    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? { ...booking, status }
          : booking
      )
    );

    setSuccess("Booking status updated successfully.");
    setUpdatingBooking(null);
  }

  async function changeCustomerStatus(
    customer: Profile
  ) {
    if (adminProfile?.role !== "admin") return;
    if (isProtectedOwnerEmail(customer.email)) {
      setError("The primary owner account cannot be deactivated.");
      return;
    }

    const nextStatus =
      customer.status === "active"
        ? "disabled"
        : "active";

    const confirmed = window.confirm(
      `${nextStatus === "disabled" ? "Disable" : "Enable"} ${
        customer.full_name
      }'s account?`
    );

    if (!confirmed) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        status: nextStatus,
      })
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProfiles((current) =>
      current.map((item) =>
        item.id === customer.id
          ? { ...item, status: nextStatus }
          : item
      )
    );

    setSuccess(
      `Customer account ${nextStatus}.`
    );
  }

  async function changeCustomerRole(customer: Profile, role: "admin" | "staff" | "customer") {
    if (adminProfile?.role !== "admin") return;
    if (isProtectedOwnerEmail(customer.email)) {
      setError("The primary CK Motors owner account role cannot be changed.");
      return;
    }
    if (role === customer.role || !window.confirm(
      role === "admin"
        ? "Grant Admin Access? This user will be able to access CK Motors administration features."
        : `Remove ${customer.role === "admin" ? "Admin" : "Staff"} access from ${customer.full_name}?`
    )) return;
    setRoleSaving(true);
    setError("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: customer.id, role }),
    });
    const result = (await response.json()) as { error?: string };
    setRoleSaving(false);
    if (!response.ok) {
      setError(result.error || "Unable to change user role.");
      return;
    }
    setProfiles((current) => current.map((item) => item.id === customer.id ? { ...item, role } : item));
    setRoleEditor(null);
    setSuccess("User role updated successfully.");
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function openAddService() {
    setEditingService(null);
    setServiceForm(emptyServiceForm);
    setShowServiceModal(true);
    setError("");
  }

  function openEditService(service: Service) {
    setEditingService(service);

    setServiceForm({
      name: service.name,
      slug: service.slug,
      category: service.category || "",
      description: service.description || "",
      price_from:
        service.price_from?.toString() || "",
      estimated_duration_minutes:
        service.estimated_duration_minutes?.toString() ||
        "",
      active: service.active,
    });

    setShowServiceModal(true);
    setError("");
  }

  async function saveService(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (adminProfile?.role !== "admin") {
      setError("Only admins can manage services.");
      return;
    }

    if (!serviceForm.name.trim()) {
      setError("Service name is required.");
      return;
    }

    const slug =
      serviceForm.slug.trim() ||
      generateSlug(serviceForm.name);

    setSavingService(true);
    setError("");

    const payload = {
      name: serviceForm.name.trim(),
      slug,
      category:
        serviceForm.category.trim() || null,
      description:
        serviceForm.description.trim() || null,
      price_from: serviceForm.price_from
        ? Number(serviceForm.price_from)
        : null,
      estimated_duration_minutes:
        serviceForm.estimated_duration_minutes
          ? Number(
              serviceForm.estimated_duration_minutes
            )
          : null,
      active: serviceForm.active,
    };

    if (editingService) {
      const { error: updateError } =
        await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id);

      if (updateError) {
        setError(updateError.message);
        setSavingService(false);
        return;
      }

      setSuccess("Service updated successfully.");
    } else {
      const { error: insertError } =
        await supabase
          .from("services")
          .insert(payload);

      if (insertError) {
        setError(insertError.message);
        setSavingService(false);
        return;
      }

      setSuccess("Service created successfully.");
    }

    setShowServiceModal(false);
    setSavingService(false);

    await loadAdminData();
  }

  async function deleteService(service: Service) {
    if (adminProfile?.role !== "admin") return;

    const relatedBookings = bookings.filter((booking) => booking.service_id === service.id);
    const relatedBookingIds = new Set(relatedBookings.map((booking) => booking.id));
    const hasHistory = relatedBookings.length > 0 || records.some((record) => record.booking_id !== null && relatedBookingIds.has(record.booking_id));
    if (hasHistory) {
      setError("This service is used in historical records and cannot be permanently deleted. Deactivate it instead.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${service.name}"?`
    );

    if (!confirmed) return;

    const { error: deleteError } =
      await supabase
        .from("services")
        .delete()
        .eq("id", service.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setServices((current) =>
      current.filter(
        (item) => item.id !== service.id
      )
    );

    setSuccess("Service deleted successfully.");
  }

  async function toggleService(service: Service) {
    if (adminProfile?.role !== "admin") return;
    const { error: updateError } = await supabase
      .from("services")
      .update({ active: !service.active })
      .eq("id", service.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setServices((current) => current.map((item) => item.id === service.id ? { ...item, active: !service.active } : item));
    setSuccess(`Service ${service.active ? "deactivated" : "activated"} successfully.`);
  }

    function openGalleryEditor(item: GalleryItem | null) {
      setEditingGallery(item);
      setShowGalleryModal(true);
    }

    async function saveGalleryItem(formData: FormData) {
      if (!["admin", "staff"].includes(adminProfile?.role || "")) return;
      const file = formData.get("file");
      const title = String(formData.get("title") || "").trim() || null;
      const caption = String(formData.get("caption") || "").trim() || null;
      const isActive = formData.get("is_active") === "on";
      const displayOrder = Number(formData.get("display_order") || 0);
      if (!editingGallery && !(file instanceof File)) {
        setError("Please select an image.");
        return;
      }
      setError("");
      let storagePath = editingGallery?.storage_path || "";
      let imageUrl = editingGallery?.image_url || "";
      if (file instanceof File && file.size > 0) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
          setError("Use a JPG, PNG, or WEBP image up to 5 MB.");
          return;
        }
        storagePath = `${crypto.randomUUID()}-${file.name}`;
        const upload = await supabase.storage.from("gallery-images").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (upload.error) {
          console.error("Gallery storage upload failed:", {
            operation: "storage.upload",
            bucket: "gallery-images",
            path: storagePath,
            error: upload.error,
          });
          setError(`Gallery image upload failed: ${upload.error.message}`);
          return;
        }
        imageUrl = supabase.storage.from("gallery-images").getPublicUrl(storagePath).data.publicUrl;
      }
      const payload = { title, caption, storage_path: storagePath, image_url: imageUrl, is_active: isActive, display_order: displayOrder };
      const result = editingGallery
        ? await supabase.from("gallery").update(payload).eq("id", editingGallery.id)
        : await supabase.from("gallery").insert(payload);
      if (result.error) {
        console.error("Gallery database save failed:", {
          operation: editingGallery ? "gallery.update" : "gallery.insert",
          payload,
          error: result.error,
        });
        setError(`Unable to save gallery item: ${result.error.message}`);
        if (file instanceof File && storagePath && storagePath !== editingGallery?.storage_path) {
          const cleanup = await supabase.storage.from("gallery-images").remove([storagePath]);
          if (cleanup.error) {
            console.warn("Gallery upload cleanup failed:", cleanup.error);
          }
        }
        return;
      }
      if (editingGallery && file instanceof File && editingGallery.storage_path !== storagePath) {
        await supabase.storage.from("gallery-images").remove([editingGallery.storage_path]);
      }
      setShowGalleryModal(false);
      setSuccess(editingGallery ? "Gallery photo updated." : "Gallery photo added.");
      await loadAdminData();
    }

    async function deleteGalleryItem(item: GalleryItem) {
      if (!["admin", "staff"].includes(adminProfile?.role || "")) return;
      if (!window.confirm("Delete Photo?\n\nThis will remove the gallery item from the website.")) return;
      const { error: deleteError } = await supabase.from("gallery").delete().eq("id", item.id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      const storageResult = await supabase.storage.from("gallery-images").remove([item.storage_path]);
      if (storageResult.error) setError(`Photo removed, but storage cleanup failed: ${storageResult.error.message}`);
      else setSuccess("Gallery photo deleted.");
      await loadAdminData();
    }

    async function toggleGalleryItem(item: GalleryItem) {
      if (!["admin", "staff"].includes(adminProfile?.role || "")) return;
      const { error: updateError } = await supabase.from("gallery").update({ is_active: !item.is_active }).eq("id", item.id);
      if (updateError) setError(updateError.message);
      else setGallery((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_active: !item.is_active } : entry));
    }
  const customers = profiles.filter(
    (profile) => profile.role === "customer"
  );

  const activeBookings = bookings.filter(
    (booking) =>
      !["completed", "cancelled"].includes(
        booking.status
      )
  );

  const completedBookings = bookings.filter(
    (booking) =>
      booking.status === "completed"
  );

  const monthlyRevenue = records
    .filter((record) => monthKey(record.service_date) === monthKey(new Date()))
    .reduce(
      (total, record) =>
        total + Number(record.total_cost || 0),
      0
    );

  const filteredBookings = bookings.filter(
    (booking) => {
      const customer = getCustomer(
        booking.user_id
      );

      const vehicle = getVehicle(
        booking.vehicle_id
      );

      const searchable = [
        booking.booking_reference,
        booking.service_name_snapshot,
        customer?.full_name,
        customer?.email,
        customer?.phone,
        vehicle?.registration_number,
        vehicle?.brand,
        vehicle?.model,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = searchable.includes(
        search.toLowerCase()
      );

      const statusMatch =
        statusFilter === "all" ||
        booking.status === statusFilter;

      return searchMatch && statusMatch;
    }
  );

  const filteredCustomers = customers.filter(
    (customer) => {
      const text = [
        customer.full_name,
        customer.email,
        customer.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    }
  );

  const filteredVehicles = vehicles.filter(
    (vehicle) => {
      const customer = getCustomer(
        vehicle.user_id
      );

      const text = [
        vehicle.registration_number,
        vehicle.brand,
        vehicle.model,
        customer?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    }
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070707] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />

          <p className="text-sm text-gray-500">
            Loading CK Motors Admin...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="portal-surface min-h-screen bg-[#080808] text-white">
   {/* MOBILE HEADER */}
<header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#090909]/95 px-5 backdrop-blur">
  <div className="flex items-center gap-4">
    <button
      onClick={() => setSidebarOpen(true)}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#111] text-gray-400 transition hover:border-red-700 hover:text-red-500"
      aria-label="Open admin menu"
    >
      <Menu size={20} />
    </button>

    <Brand />
  </div>

  <div className="flex items-center gap-3">
    <ThemeToggle />
    <button
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#111]"
      aria-label="Notifications"
    >
      <Bell size={18} />
    </button>

    <div className="hidden rounded-xl border border-white/10 bg-[#111] px-4 py-2.5 sm:block">
      <p className="text-[9px] text-gray-600">
        Logged in as
      </p>

      <p className="text-xs font-bold">
        {adminProfile?.full_name || "Admin"}
      </p>
    </div>
  </div>
</header>

     {sidebarOpen && (
  <div
    onClick={() => setSidebarOpen(false)}
    className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]"
  />
)}
      {/* SIDEBAR */}
     <aside
  className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-white/10 bg-[#0c0c0c] shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
    sidebarOpen
      ? "translate-x-0"
      : "-translate-x-full"
  }`}
>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <Brand />

          <button
            onClick={() =>
              setSidebarOpen(false)
            }
            className="lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
            Administration
          </p>

          <SidebarButton
            active={activeSection === "gallery"}
            icon={<Images size={18} />}
            label="Gallery"
            onClick={() => changeSection("gallery")}
          />

          <SidebarButton
            active={
              activeSection === "dashboard"
            }
            icon={
              <LayoutDashboard size={18} />
            }
            label="Dashboard"
            onClick={() =>
              changeSection("dashboard")
            }
          />

          <SidebarButton
            active={
              activeSection === "bookings"
            }
            icon={
              <CalendarDays size={18} />
            }
            label="Bookings"
            badge={activeBookings.length}
            onClick={() =>
              changeSection("bookings")
            }
          />

          <SidebarButton
            active={
              activeSection === "customers"
            }
            icon={<Users size={18} />}
            label="Customers"
            onClick={() =>
              changeSection("customers")
            }
          />

          <SidebarButton
            active={
              activeSection === "vehicles"
            }
            icon={<Car size={18} />}
            label="Vehicles"
            onClick={() =>
              changeSection("vehicles")
            }
          />

          <SidebarButton
            active={
              activeSection === "services"
            }
            icon={<Wrench size={18} />}
            label="Services"
            onClick={() =>
              changeSection("services")
            }
          />

          <SidebarButton
            active={
              activeSection === "records"
            }
            icon={
              <ClipboardList size={18} />
            }
            label="Service Records"
            onClick={() =>
              changeSection("records")
            }
          />

          <SidebarButton
            active={activeSection === "messages"}
            icon={<MessageSquare size={18} />}
            label="Messages"
            onClick={() => changeSection("messages")}
          />

          <SidebarButton
            active={activeSection === "inventory"}
            icon={<Package size={18} />}
            label="Inventory"
            onClick={() => changeSection("inventory")}
          />

          <SidebarButton
            active={activeSection === "suppliers"}
            icon={<Factory size={18} />}
            label="Suppliers"
            onClick={() => changeSection("suppliers")}
          />

          <SidebarButton
            active={activeSection === "technicians"}
            icon={<UserCog size={18} />}
            label="Technicians"
            onClick={() => changeSection("technicians")}
          />

          {adminProfile?.role === "admin" && (
            <>
              <SidebarButton
                active={activeSection === "vehicle-settings"}
                icon={<Car size={18} />}
                label="Vehicle Settings"
                onClick={() => changeSection("vehicle-settings")}
              />
              <SidebarButton
                active={activeSection === "users"}
                icon={<Users size={18} />}
                label="Admin Users"
                onClick={() => changeSection("users")}
              />
              <SidebarButton
                active={activeSection === "website-settings"}
                icon={<Settings size={18} />}
                label="Website Settings"
                onClick={() => changeSection("website-settings")}
              />
            </>
          )}
        </div>

        <div className="mt-auto border-t border-white/10 p-4">
          <div className="mb-3 rounded-xl bg-white/[0.03] p-3">
            <p className="text-xs font-bold">
              {adminProfile?.full_name ||
                "Administrator"}
            </p>

            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-red-500">
              {adminProfile?.role}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-gray-500 transition hover:bg-red-950/40 hover:text-red-500"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}
        <section className="admin-content min-h-screen overflow-x-hidden lg:ml-[280px] lg:w-[calc(100%-280px)]">        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
            <div className="mx-auto w-full max-w-[1500px] p-5 md:p-8">            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-red-500">
                CK Motors Administration
              </p>

              <h1 className="text-2xl font-black md:text-3xl">
                {sectionTitle(activeSection)}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="rounded-xl border border-white/10 bg-[#111] p-3">
                <Bell size={18} />
              </div>

              <div className="hidden rounded-xl border border-white/10 bg-[#111] px-4 py-3 sm:block">
                <p className="text-[10px] text-gray-600">
                  Logged in as
                </p>

                <p className="mt-1 text-xs font-bold">
                  {adminProfile?.full_name}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <MessageBox
              type="error"
              message={error}
            />
          )}

          {success && (
            <MessageBox
              type="success"
              message={success}
            />
          )}

          {activeSection ===
            "dashboard" && (
            <DashboardSection
              customers={customers}
              vehicles={vehicles}
              bookings={bookings}
              records={records}
              completedBookings={
                completedBookings
              }
              monthlyRevenue={
                monthlyRevenue
              }
              getCustomer={getCustomer}
              getVehicle={getVehicle}
              openBookings={() =>
                changeSection("bookings")
              }
              onRevenueClick={() => {
                setRevenueMonth(monthKey(new Date()));
                setRevenueModalOpen(true);
              }}
            />
          )}

          {activeSection === "bookings" && (
            <BookingsSection
              bookings={filteredBookings}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={
                setStatusFilter
              }
              getCustomer={getCustomer}
              getVehicle={getVehicle}
              updatingBooking={
                updatingBooking
              }
              updateBookingStatus={
                updateBookingStatus
              }
            />
          )}

          {activeSection ===
            "customers" && (
            <CustomersSection
              customers={filteredCustomers}
              search={search}
              setSearch={setSearch}
              vehicles={vehicles}
              bookings={bookings}
              adminRole={
                adminProfile?.role || ""
              }
              changeStatus={
                changeCustomerStatus
              }
              onView={setCustomerView}
              onRoleChange={setRoleEditor}
              onEdit={openCustomerEdit}
              onMessage={openCustomerMessage}
              onDelete={deleteCustomer}
              onRepairLogin={repairCustomerLogin}
              onAdd={() => {
                setShowAddCustomer(true);
                setError("");
              }}
            />
          )}

          {activeSection ===
            "vehicles" && (
            <VehiclesSection
              vehicles={filteredVehicles}
              search={search}
              setSearch={setSearch}
              getCustomer={getCustomer}
            />
          )}

          {activeSection ===
            "services" && (
            <ServicesSection
              services={services}
              adminRole={
                adminProfile?.role || ""
              }
              addService={openAddService}
              editService={
                openEditService
              }
              deleteService={
                deleteService
              }
              toggleService={toggleService}
            />
          )}

          {activeSection === "records" && (
  <div className="space-y-6">
    <ServiceRecordManager />
    <ServiceInvoices />
  </div>
)}

          {activeSection === "messages" && (
            <MessagesSection
              mode={messageMode}
              setMode={setMessageMode}
              customers={visibleMessageCustomers}
              allCustomers={activeCustomers}
              selectedIds={selectedCustomerIds}
              setSelectedIds={setSelectedCustomerIds}
              search={messageSearch}
              setSearch={setMessageSearch}
              title={messageTitle}
              setTitle={setMessageTitle}
              body={messageBody}
              setBody={setMessageBody}
              sending={sendingMessage}
              files={messageFiles}
              fileError={messageFileError}
              onFilesChange={handleMessageFiles}
              onRemoveFile={(index) => setMessageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
              sentMessages={sentMessages}
              onSend={sendCustomerMessage}
            />
          )}
          {activeSection === "gallery" && (
            <GallerySection
              gallery={gallery}
              onAdd={() => openGalleryEditor(null)}
              onEdit={openGalleryEditor}
              onToggle={toggleGalleryItem}
              onDelete={deleteGalleryItem}
            />
          )}
          {activeSection === "inventory" && <InventoryManager />}
          {activeSection === "suppliers" && <SuppliersManager />}
          {activeSection === "technicians" && <TechniciansManager />}
          {activeSection === "website-settings" && adminProfile?.role === "admin" && (
            <WebsiteSettingsSection
              onSaved={setSuccess}
              onError={setError}
            />
          )}
          {activeSection === "users" && adminProfile?.role === "admin" && <AdminUsersSection />}
          {activeSection === "vehicle-settings" && adminProfile?.role === "admin" && <VehicleSettingsSection />}

          <p className="mt-10 text-center text-[10px] text-gray-800">
            © 2026 CK Motors Administration
            System
          </p>
        </div>
      </section>

      {revenueModalOpen && (
        <RevenueBreakdownModal
          month={revenueMonth}
          records={records}
          getCustomer={getCustomer}
          getVehicle={getVehicle}
          getBooking={(id) =>
            bookings.find((booking) => booking.id === id)
          }
          onMonthChange={setRevenueMonth}
          onClose={() => setRevenueModalOpen(false)}
        />
      )}

      {editingCustomer && (
        <CustomerEditModal
          customer={editingCustomer}
          form={customerForm}
          setForm={setCustomerForm}
          saving={savingCustomer}
          onSubmit={saveCustomer}
          onClose={() => setEditingCustomer(null)}
        />
      )}

      {showAddCustomer && (
        <CustomerAddModal
          form={newCustomerForm}
          setForm={setNewCustomerForm}
          addVehicleNow={addVehicleNow}
          setAddVehicleNow={setAddVehicleNow}
          vehicleForm={newVehicleForm}
          setVehicleForm={setNewVehicleForm}
          saving={savingCustomer}
          onSubmit={addCustomer}
          onClose={() => setShowAddCustomer(false)}
        />
      )}

      {showGalleryModal && (
        <GalleryModal
          item={editingGallery}
          onClose={() => setShowGalleryModal(false)}
          onSubmit={saveGalleryItem}
        />
      )}

      {createdCustomerCredentials && (
        <TemporaryPasswordModal
          credentials={createdCustomerCredentials}
          onDone={() => {
            setCreatedCustomerCredentials(null);
            setSuccess("Customer created successfully.");
          }}
        />
      )}
      {repairedCustomerCredentials && (
        <TemporaryPasswordModal
          credentials={repairedCustomerCredentials}
          title="Customer Login Reset"
          onDone={() => setRepairedCustomerCredentials(null)}
        />
      )}

      {vehicleEditor && (
        <VehicleEditorModal
          form={vehicleForm}
          setForm={setVehicleForm}
          saving={savingVehicle}
          editing={Boolean(vehicleEditor.vehicle)}
          onSubmit={saveVehicle}
          onClose={() => setVehicleEditor(null)}
        />
      )}

      {customerView && (
        <CustomerDetailsModal
          customer={customerView}
          vehicles={vehicles.filter((vehicle) => vehicle.user_id === customerView.id)}
          bookings={bookings.filter((booking) => booking.user_id === customerView.id)}
          records={records.filter((record) => record.user_id === customerView.id)}
          getVehicle={getVehicle}
          onAddVehicle={() => openVehicleEditor(customerView.id, null)}
          onEditVehicle={(vehicle) => openVehicleEditor(customerView.id, vehicle)}
          onDeleteVehicle={deleteVehicle}
          onClose={() => setCustomerView(null)}
        />
      )}
      {roleEditor && (
        <RoleChangeModal
          customer={roleEditor}
          saving={roleSaving}
          onClose={() => setRoleEditor(null)}
          onSubmit={(role) => void changeCustomerRole(roleEditor, role)}
        />
      )}

      {/* SERVICE MODAL */}
      {showServiceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">
                  CK Motors
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {editingService
                    ? "Edit Service"
                    : "Add Service"}
                </h2>
              </div>

              <button
                onClick={() =>
                  setShowServiceModal(false)
                }
                className="rounded-lg border border-white/10 p-2"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={saveService}
              className="space-y-4 p-6"
            >
              <AdminInput
                label="Service Name *"
                value={serviceForm.name}
                placeholder="Engine Repair"
                onChange={(value) =>
                  setServiceForm({
                    ...serviceForm,
                    name: value,
                  })
                }
              />

              <AdminInput
                label="Slug"
                value={serviceForm.slug}
                placeholder="engine-repair"
                onChange={(value) =>
                  setServiceForm({
                    ...serviceForm,
                    slug: value,
                  })
                }
              />

              <AdminInput
                label="Category"
                value={
                  serviceForm.category
                }
                placeholder="Engine"
                onChange={(value) =>
                  setServiceForm({
                    ...serviceForm,
                    category: value,
                  })
                }
              />

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Description
                </label>

                <textarea
                  rows={4}
                  value={
                    serviceForm.description
                  }
                  onChange={(event) =>
                    setServiceForm({
                      ...serviceForm,
                      description:
                        event.target.value,
                    })
                  }
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminInput
                  label="Price From (LKR)"
                  type="number"
                  value={
                    serviceForm.price_from
                  }
                  placeholder="5000"
                  onChange={(value) =>
                    setServiceForm({
                      ...serviceForm,
                      price_from: value,
                    })
                  }
                />

                <AdminInput
                  label="Duration (Minutes)"
                  type="number"
                  value={
                    serviceForm.estimated_duration_minutes
                  }
                  placeholder="90"
                  onChange={(value) =>
                    setServiceForm({
                      ...serviceForm,
                      estimated_duration_minutes:
                        value,
                    })
                  }
                />
              </div>

              <label className="flex items-center gap-3 text-xs font-semibold text-gray-400">
                <input
                  type="checkbox"
                  checked={
                    serviceForm.active
                  }
                  onChange={(event) =>
                    setServiceForm({
                      ...serviceForm,
                      active:
                        event.target
                          .checked,
                    })
                  }
                />

                Service Active
              </label>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowServiceModal(
                      false
                    )
                  }
                  className="rounded-lg border border-white/10 px-5 py-3 text-xs font-bold text-gray-500"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingService}
                  className="rounded-lg bg-red-600 px-6 py-3 text-xs font-bold hover:bg-red-500 disabled:opacity-50"
                >
                  {savingService
                    ? "Saving..."
                    : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

/* ============================================================
   DASHBOARD
============================================================ */

function DashboardSection({
  customers,
  vehicles,
  bookings,
  records,
  completedBookings,
  monthlyRevenue,
  getCustomer,
  getVehicle,
  openBookings,
  onRevenueClick,
}: {
  customers: Profile[];
  vehicles: Vehicle[];
  bookings: Booking[];
  records: ServiceRecord[];
  completedBookings: Booking[];
  monthlyRevenue: number;
  getCustomer: (
    id: string
  ) => Profile | undefined;
  getVehicle: (
    id: string
  ) => Vehicle | undefined;
  openBookings: () => void;
  onRevenueClick: () => void;
}) {
  const activeBookings =
    bookings.filter(
      (booking) =>
        ![
          "completed",
          "cancelled",
        ].includes(booking.status)
    );

  return (
    <>
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={<Users />}
          value={customers.length}
          label="Customers"
        />

        <StatCard
          icon={<Car />}
          value={vehicles.length}
          label="Vehicles"
        />

        <StatCard
          icon={<CalendarDays />}
          value={activeBookings.length}
          label="Active Bookings"
        />

        <StatCard
          icon={<ClipboardList />}
          value={
            completedBookings.length
          }
          label="Completed"
        />

        <StatCard
          icon={<DollarSign />}
          value={`LKR ${monthlyRevenue.toLocaleString()}`}
          label="Monthly Revenue"
          onClick={onRevenueClick}
          ariaLabel="View monthly revenue breakdown"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Recent Bookings"
          action="View All"
          onAction={openBookings}
        >
          {bookings.length === 0 ? (
            <Empty text="No bookings found." />
          ) : (
            <div className="space-y-3">
              {bookings
                .slice(0, 6)
                .map((booking) => {
                  const customer =
                    getCustomer(
                      booking.user_id
                    );

                  const vehicle =
                    getVehicle(
                      booking.vehicle_id
                    );

                  return (
                    <div
                      key={booking.id}
                      className="rounded-xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-red-500">
                            {
                              booking.booking_reference
                            }
                          </p>

                          <p className="mt-1 font-bold">
                            {customer?.full_name ||
                              "Customer"}
                          </p>

                          <p className="mt-1 text-xs text-gray-600">
                            {vehicle
                              ? `${vehicle.registration_number} • ${vehicle.brand} ${vehicle.model}`
                              : "Vehicle"}
                          </p>
                        </div>

                        <StatusBadge
                          status={
                            booking.status
                          }
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Panel>

        <Panel title="System Overview">
          <div className="space-y-4">
            <OverviewRow
              label="Total Services"
              value={records.length}
            />

            <OverviewRow
              label="Pending Bookings"
              value={
                bookings.filter(
                  (item) =>
                    item.status ===
                    "pending"
                ).length
              }
            />

            <OverviewRow
              label="Completed Records"
              value={records.length}
            />

            <OverviewRow
              label="Active Customers"
              value={
                customers.filter(
                  (item) =>
                    item.status ===
                    "active"
                ).length
              }
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

function MessagesSection({
  mode,
  setMode,
  customers,
  allCustomers,
  selectedIds,
  setSelectedIds,
  search,
  setSearch,
  title,
  setTitle,
  body,
  setBody,
  sending,
  files,
  fileError,
  onFilesChange,
  onRemoveFile,
  sentMessages,
  onSend,
}: {
  mode: MessageRecipientMode;
  setMode: (mode: MessageRecipientMode) => void;
  customers: Profile[];
  allCustomers: Profile[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  search: string;
  setSearch: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  sending: boolean;
  files: File[];
  fileError: string;
  onFilesChange: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  sentMessages: SentMessage[];
  onSend: () => void;
}) {
  const isIndividual = mode === "individual";
  const previewUrls = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );

  useEffect(
    () => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)),
    [previewUrls]
  );

  function toggleCustomer(id: string) {
    if (isIndividual) {
      setSelectedIds(selectedIds.includes(id) ? [] : [id]);
      return;
    }

    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id]
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Customer Messages">
        <p className="mb-6 text-sm text-gray-500">
          Send notifications to all customers, selected customers, or an individual customer.
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ["all", "All Customers"],
            ["selected", "Selected Customers"],
            ["individual", "Individual Customer"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                if (value === "all") setSelectedIds([]);
              }}
              className={`rounded-xl border px-3 py-3 text-left text-xs font-bold transition ${
                mode === value
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-white/10 bg-white/[0.03] text-gray-500 hover:border-red-500/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <p className="font-bold">
            Recipient: {mode === "all" ? "All Active Customers" : isIndividual ? "One Customer" : "Selected Customers"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Recipients: {mode === "all" ? allCustomers.length : selectedIds.length} customer
            {((mode === "all" ? allCustomers.length : selectedIds.length) === 1 ? "" : "s")}
          </p>
        </div>

        {mode !== "all" && (
          <div className="mt-5 rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-xs font-bold text-gray-500" htmlFor="message-customer-search">
                Find customers
              </label>
              <div className="flex gap-2">
                {!isIndividual && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(customers.map((customer) => customer.id))}
                    className="text-[10px] font-bold text-red-500"
                  >
                    Select All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[10px] font-bold text-gray-500"
                >
                  Clear
                </button>
              </div>
            </div>
            <input
              id="message-customer-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or phone"
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2.5 text-sm outline-none placeholder:text-gray-600 focus:border-red-600"
            />
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => toggleCustomer(customer.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 p-3 text-left transition hover:border-red-500/50"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                      selectedIds.includes(customer.id)
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-white/20"
                    }`}
                  >
                    {selectedIds.includes(customer.id) ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{customer.full_name}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {customer.email} {customer.phone ? `· ${customer.phone}` : ""}
                    </span>
                  </span>
                </button>
              ))}
              {customers.length === 0 && (
                <p className="py-5 text-center text-xs text-gray-500">No active customers found.</p>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Compose Notification">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold text-gray-500" htmlFor="message-title">
              Title *
            </label>
            <input
              id="message-title"
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Service update"
              className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none placeholder:text-gray-600 focus:border-red-600"
            />
            <p className="mt-1 text-right text-[10px] text-gray-600">{title.length}/120</p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-gray-500" htmlFor="message-body">
              Message *
            </label>
            <textarea
              id="message-body"
              maxLength={1000}
              rows={7}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your message to customers..."
              className="w-full resize-none rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none placeholder:text-gray-600 focus:border-red-600"
            />
            <p className="mt-1 text-right text-[10px] text-gray-600">{body.length}/1000</p>
          </div>
          <div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-4 text-xs font-bold text-gray-500 transition hover:border-red-500 hover:text-red-500">
              <Paperclip size={16} />
              Add Photos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => onFilesChange(event.target.files)}
                className="sr-only"
              />
            </label>
            <p className="mt-2 text-[10px] text-gray-600">Up to 5 JPG, PNG, or WEBP images, 5 MB each.</p>
            {fileError && <p className="mt-2 text-xs text-red-500">{fileError}</p>}
            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}`} className="relative overflow-hidden rounded-lg border border-white/10">
                    <img src={previewUrls[index]} alt={file.name} className="aspect-square w-full object-cover" />
                    <button type="button" onClick={() => onRemoveFile(index)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white" aria-label={`Remove ${file.name}`}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={onSend}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquare size={17} />
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </div>
      </Panel>
      <Panel title="Sent Messages" >
        {sentMessages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages sent yet.</p>
        ) : (
          <div className="space-y-3">
            {sentMessages.map((message) => {
              const recipients = message.message_recipients || [];
              const read = recipients.filter((recipient) => recipient.is_read).length;
              return (
                <div key={message.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{message.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{new Date(message.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xs font-bold text-red-500">
                      {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-gray-500">{message.body || "Photo message"}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-600">
                    <span>Read: {read}</span>
                    <span>Unread: {recipients.length - read}</span>
                    {message.message_attachments.length > 0 && (
                      <span>{message.message_attachments.length} photo{message.message_attachments.length === 1 ? "" : "s"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RevenueBreakdownModal({
  month,
  records,
  getCustomer,
  getVehicle,
  getBooking,
  onMonthChange,
  onClose,
}: {
  month: string;
  records: ServiceRecord[];
  getCustomer: (id: string) => Profile | undefined;
  getVehicle: (id: string) => Vehicle | undefined;
  getBooking: (id: string | null) => Booking | undefined;
  onMonthChange: (month: string) => void;
  onClose: () => void;
}) {
  const monthRecords = records.filter(
    (record) => monthKey(record.service_date) === month
  );
  const total = monthRecords.reduce(
    (sum, record) => sum + Number(record.total_cost || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revenue-breakdown-title"
        className="revenue-modal max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 md:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600">
              Revenue detail
            </p>
            <h2 id="revenue-breakdown-title" className="mt-1 text-xl font-black">
              Monthly Revenue Breakdown
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="revenue-month">
              Select revenue month
            </label>
            <input
              id="revenue-month"
              type="month"
              value={month}
              onChange={(event) => onMonthChange(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close revenue breakdown"
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-red-200 hover:text-red-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 md:p-7">
          <div className="rounded-xl border border-red-100 bg-red-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              {formatMonth(month)}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Total Monthly Revenue
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900">
              LKR {total.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Sum of the <code>total_cost</code> value from each service record
              dated in this month.
            </p>
          </div>

          {monthRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No completed service revenue found for this month.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {monthRecords.map((record) => {
                const customer = getCustomer(record.user_id);
                const vehicle = getVehicle(record.vehicle_id);
                const booking = getBooking(record.booking_id);

                return (
                  <article
                    key={record.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-sm font-black text-red-600">
                          CKI-{record.service_date.replaceAll("-", "")}-
                          {record.id.slice(0, 6).toUpperCase()}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900">
                          {customer?.full_name || "Customer"} ·{" "}
                          {vehicle
                            ? `${vehicle.registration_number} · ${vehicle.brand} ${vehicle.model}`
                            : "Vehicle"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{record.service_date}</p>
                        <p className="mt-1">
                          {booking?.booking_reference || "No booking reference"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="text-sm text-slate-600">
                        <p className="mb-2 font-bold text-slate-900">
                          {record.services_performed}
                        </p>
                        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                          <RevenueLine label="Labour Cost" value={record.labour_cost} />
                          <RevenueLine label="Parts Cost" value={record.parts_cost} />
                          <RevenueLine label="Additional Cost" value={record.additional_cost} />
                          <RevenueLine label="Discount" value={-Number(record.discount || 0)} negative />
                        </div>
                      </div>
                      <div className="border-t border-slate-200 pt-3 text-left lg:min-w-[180px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Invoice Total
                        </p>
                        <p className="mt-1 text-xl font-black text-red-600">
                          LKR {Number(record.total_cost || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueLine({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className={negative ? "font-semibold text-red-600" : "font-semibold text-slate-900"}>
        {negative ? "-LKR " : "LKR "}
        {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}

/* ============================================================
   BOOKINGS
============================================================ */

function BookingsSection({
  bookings,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  getCustomer,
  getVehicle,
  updatingBooking,
  updateBookingStatus,
}: {
  bookings: Booking[];
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (
    value: string
  ) => void;
  getCustomer: (
    id: string
  ) => Profile | undefined;
  getVehicle: (
    id: string
  ) => Vehicle | undefined;
  updatingBooking: string | null;
  updateBookingStatus: (
    id: string,
    status: string
  ) => void;
}) {
  return (
    <Panel title="Booking Management">
      <div className="mb-5 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          setValue={setSearch}
          placeholder="Search booking, customer or vehicle..."
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          className="rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-xs outline-none"
        >
          <option value="all">
            All Statuses
          </option>

          {BOOKING_STATUSES.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {formatStatus(status)}
              </option>
            )
          )}
        </select>
      </div>

      {bookings.length === 0 ? (
        <Empty text="No bookings found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-600">
                <th className="p-4">
                  Booking
                </th>
                <th className="p-4">
                  Customer
                </th>
                <th className="p-4">
                  Vehicle
                </th>
                <th className="p-4">
                  Service
                </th>
                <th className="p-4">
                  Appointment
                </th>
                <th className="p-4">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {bookings.map(
                (booking) => {
                  const customer =
                    getCustomer(
                      booking.user_id
                    );

                  const vehicle =
                    getVehicle(
                      booking.vehicle_id
                    );

                  return (
                    <tr
                      key={booking.id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="p-4">
                        <p className="text-xs font-black text-red-500">
                          {
                            booking.booking_reference
                          }
                        </p>
                      </td>

                      <td className="p-4">
                        <p className="text-xs font-bold">
                          {customer?.full_name ||
                            "Unknown"}
                        </p>

                        <p className="mt-1 text-[10px] text-gray-600">
                          {customer?.phone ||
                            customer?.email}
                        </p>
                      </td>

                      <td className="p-4">
                        <p className="text-xs font-bold">
                          {vehicle?.registration_number ||
                            "—"}
                        </p>

                        <p className="mt-1 text-[10px] text-gray-600">
                          {vehicle
                            ? `${vehicle.brand} ${vehicle.model}`
                            : ""}
                        </p>
                      </td>

                      <td className="p-4 text-xs">
                        {booking.service_name_snapshot ||
                          "Vehicle Service"}
                      </td>

                      <td className="p-4 text-xs">
                        {
                          booking.booking_date
                        }
                        <p className="mt-1 text-[10px] text-gray-600">
                          {booking.booking_time.slice(
                            0,
                            5
                          )}
                        </p>
                      </td>

                      <td className="p-4">
                        <select
                          value={
                            booking.status
                          }
                          disabled={
                            updatingBooking ===
                            booking.id
                          }
                          onChange={(
                            event
                          ) =>
                            updateBookingStatus(
                              booking.id,
                              event.target
                                .value
                            )
                          }
                          className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-[11px] font-bold text-red-400 outline-none"
                        >
                          {BOOKING_STATUSES.map(
                            (status) => (
                              <option
                                key={
                                  status
                                }
                                value={
                                  status
                                }
                              >
                                {formatStatus(
                                  status
                                )}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ============================================================
   CUSTOMERS
============================================================ */

function CustomerModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:text-red-500">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CustomerEditModal({
  customer,
  form,
  setForm,
  saving,
  onSubmit,
  onClose,
}: {
  customer: Profile;
  form: { full_name: string; phone: string; address_line1: string; address_line2: string; city: string; district: string; postal_code: string };
  setForm: (form: { full_name: string; phone: string; address_line1: string; address_line2: string; city: string; district: string; postal_code: string }) => void;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <CustomerModalShell title={`Edit ${customer.full_name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-xs font-bold text-gray-500">
          Full Name *
          <input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600" />
        </label>
        <label className="block text-xs font-bold text-gray-500">
          Email Address
          <input disabled value={customer.email} className="mt-2 w-full cursor-not-allowed rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-500" />
          <span className="mt-1 block text-[10px] text-gray-600">Email changes require the Supabase Auth email flow.</span>
        </label>
        <label className="block text-xs font-bold text-gray-500">
          Phone Number
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600" />
        </label>
        <AddressFields form={form} setForm={(address) => setForm({ ...form, ...address })} />
        <button disabled={saving} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? "Saving Changes..." : "Save Changes"}
        </button>
      </form>
    </CustomerModalShell>
  );
}

function CustomerAddModal({
  form,
  setForm,
  addVehicleNow,
  setAddVehicleNow,
  vehicleForm,
  setVehicleForm,
  saving,
  onSubmit,
  onClose,
}: {
  form: { full_name: string; email: string; phone: string; address_line1: string; address_line2: string; city: string; district: string; postal_code: string };
  setForm: (form: { full_name: string; email: string; phone: string; address_line1: string; address_line2: string; city: string; district: string; postal_code: string }) => void;
  addVehicleNow: boolean;
  setAddVehicleNow: (value: boolean) => void;
  vehicleForm: VehicleForm;
  setVehicleForm: (form: VehicleForm) => void;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <CustomerModalShell title="Add Customer" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {(["full_name", "email", "phone"] as const).map((field) => (
          <label key={field} className="block text-xs font-bold text-gray-500">
            {field === "full_name" ? "Full Name *" : field === "email" ? "Email Address *" : "Phone Number"}
            <input
              required={field !== "phone"}
              type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
              value={form[field]}
              onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600"
            />
          </label>
        ))}
        <AddressFields form={form} setForm={(address) => setForm({ ...form, ...address })} />
        <label className="flex items-center gap-3 rounded-lg border border-white/10 p-3 text-xs font-bold text-gray-400">
          <input
            type="checkbox"
            checked={addVehicleNow}
            onChange={(event) => setAddVehicleNow(event.target.checked)}
            className="h-4 w-4 accent-red-600"
          />
          Add a vehicle now (optional)
        </label>
        {addVehicleNow && (
          <VehicleFields form={vehicleForm} setForm={setVehicleForm} />
        )}
        <p className="text-xs leading-5 text-gray-500">A secure temporary password will be generated server-side and shown once after creation.</p>
        <button disabled={saving} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? "Creating Customer..." : "Add Customer"}
        </button>
      </form>
    </CustomerModalShell>
  );
}

function AddressFields({
  form,
  setForm,
}: {
  form: { address_line1: string; address_line2: string; city: string; district: string; postal_code: string };
  setForm: (form: { address_line1: string; address_line2: string; city: string; district: string; postal_code: string }) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-red-500">Address Information</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ["address_line1", "Address Line 1"],
          ["address_line2", "Address Line 2"],
          ["city", "City"],
          ["district", "District"],
          ["postal_code", "Postal Code"],
        ] as const).map(([key, label]) => (
          <label key={key} className={`text-xs font-bold text-gray-500 ${key === "address_line1" || key === "address_line2" ? "sm:col-span-2" : ""}`}>
            {label}
            <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-600" />
          </label>
        ))}
      </div>
    </div>
  );
}

function VehicleFields({
  form,
  setForm,
}: {
  form: VehicleForm;
  setForm: (form: VehicleForm) => void;
}) {
  const masterData = useVehicleMasterData();
  const fields: { key: keyof VehicleForm; label: string; required?: boolean; type?: string }[] = [
    { key: "registration_number", label: "Registration Number *", required: true },
    { key: "manufacture_year", label: "Year", type: "number" },
    { key: "mileage", label: "Mileage", type: "number" },
    { key: "chassis_number", label: "Chassis Number" },
    { key: "engine_number", label: "Engine Number" },
  ];
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-red-500">Vehicle Information</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="text-xs font-bold text-gray-500">
            {field.label}
            <input
              required={field.required}
              type={field.type || "text"}
              value={form[field.key]}
              onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2.5 text-sm outline-none focus:border-red-600"
            />
          </label>
        ))}
        <SearchableVehicleSelect label="Brand" required value={form.brand} options={masterData.brands} onChange={(value) => setForm({ ...form, brand: value, model: "" })} />
        <SearchableVehicleSelect label="Model" required value={form.model} options={masterData.models.filter((model) => model.brand === form.brand).map((model) => model.name)} onChange={(value) => setForm({ ...form, model: value })} />
        <SearchableVehicleSelect label="Vehicle Type" value={form.vehicle_type} options={masterData.vehicleTypes} onChange={(value) => setForm({ ...form, vehicle_type: value })} />
        <SearchableVehicleSelect label="Fuel Type" value={form.fuel_type} options={masterData.fuelTypes} onChange={(value) => setForm({ ...form, fuel_type: value })} />
        <SearchableVehicleSelect label="Engine Capacity" value={form.engine_capacity} options={masterData.engineCapacities} onChange={(value) => setForm({ ...form, engine_capacity: value })} />
        <SearchableVehicleSelect label="Transmission" value={form.transmission} options={masterData.transmissions} onChange={(value) => setForm({ ...form, transmission: value })} />
      </div>
      <label className="mt-3 block text-xs font-bold text-gray-500">
        Notes
        <textarea
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-[#080808] px-3 py-2.5 text-sm outline-none focus:border-red-600"
          rows={2}
        />
      </label>
    </div>
  );
}

function VehicleEditorModal({
  form,
  setForm,
  saving,
  editing,
  onSubmit,
  onClose,
}: {
  form: VehicleForm;
  setForm: (form: VehicleForm) => void;
  saving: boolean;
  editing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <CustomerModalShell title={editing ? "Edit Vehicle" : "Add Vehicle"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <VehicleFields form={form} setForm={setForm} />
        <button disabled={saving} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? "Saving Vehicle..." : editing ? "Save Changes" : "Add Vehicle"}
        </button>
      </form>
    </CustomerModalShell>
  );
}

function TemporaryPasswordModal({
  credentials,
  title = "Customer Created Successfully",
  onDone,
}: {
  credentials: {
    full_name: string;
    email: string;
    temporaryPassword: string;
  };
  title?: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    await navigator.clipboard.writeText(credentials.temporaryPassword);
    setCopied(true);
  }

  return (
    <CustomerModalShell title={title} onClose={onDone}>
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Customer</p>
          <p className="font-bold">{credentials.full_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Email</p>
          <p className="font-bold">{credentials.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Temporary Password</p>
          <code className="mt-2 block rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 font-mono text-base font-bold tracking-wider text-red-400">
            {credentials.temporaryPassword}
          </code>
        </div>
        <p className="text-xs leading-5 text-gray-500">
          Give this temporary password to the customer. They will be required to create a new password when they first sign in.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={copyPassword} className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm font-bold text-gray-400 hover:border-red-500 hover:text-red-500">
            {copied ? "Copied" : "Copy Password"}
          </button>
          <button type="button" onClick={onDone} className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500">
            Done
          </button>
        </div>
      </div>
    </CustomerModalShell>
  );
}

function CustomerDetailsModal({
  customer,
  vehicles,
  bookings,
  records,
  getVehicle,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
  onClose,
}: {
  customer: Profile;
  vehicles: Vehicle[];
  bookings: Booking[];
  records: ServiceRecord[];
  getVehicle: (id: string) => Vehicle | undefined;
  onAddVehicle: () => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicle: Vehicle) => void;
  onClose: () => void;
}) {
  return (
    <CustomerModalShell title="Customer Details" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="text-xs text-gray-500">Name</p><p className="font-bold">{customer.full_name}</p></div>
        <div><p className="text-xs text-gray-500">Email</p><p className="font-bold">{customer.email}</p></div>
        <div><p className="text-xs text-gray-500">Phone</p><p className="font-bold">{customer.phone || "—"}</p></div>
        <div className="sm:col-span-2"><p className="text-xs text-gray-500">Address</p><p className="font-bold">{customer.address_line1 || customer.address || "—"}{customer.address_line2 ? `, ${customer.address_line2}` : ""}</p><p className="text-xs text-gray-500">{[customer.city, customer.district, customer.postal_code].filter(Boolean).join(", ") || "—"}</p></div>
        <div><p className="text-xs text-gray-500">Status</p><p className="font-bold">{customer.status}</p></div>
        <div><p className="text-xs text-gray-500">Joined</p><p className="font-bold">{new Date(customer.created_at).toLocaleDateString()}</p></div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-black">Vehicles ({vehicles.length})</h3>
            <button type="button" onClick={onAddVehicle} className="text-[10px] font-bold text-red-500">+ Add Vehicle</button>
          </div>
          <div className="space-y-2">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="rounded-lg border border-white/10 p-3">
                <p className="text-xs font-bold text-red-500">{vehicle.registration_number}</p>
                <p className="mt-1 text-xs text-gray-500">{vehicle.brand} {vehicle.model} · {vehicle.manufacture_year || "Year —"}</p>
                <p className="mt-1 text-[10px] text-gray-600">{vehicle.fuel_type || "Fuel —"} · {vehicle.mileage ?? "Mileage —"}</p>
                <div className="mt-2 flex gap-3 text-[10px] font-bold">
                  <button type="button" onClick={() => onEditVehicle(vehicle)} className="text-gray-500 hover:text-red-500">Edit</button>
                  <button type="button" onClick={() => onDeleteVehicle(vehicle)} className="text-red-500">Delete</button>
                </div>
              </div>
            ))}
            {vehicles.length === 0 && <p className="text-xs text-gray-500">No vehicles added.</p>}
          </div>
        </div>
        <div><h3 className="mb-2 font-black">Bookings</h3>{bookings.map((booking) => <p key={booking.id} className="text-xs text-gray-500">{booking.booking_reference} · {booking.status}</p>)}{bookings.length === 0 && <p className="text-xs text-gray-500">None</p>}</div>
        <div><h3 className="mb-2 font-black">Service History</h3>{records.map((record) => <p key={record.id} className="text-xs text-gray-500">{record.service_date} · {getVehicle(record.vehicle_id)?.registration_number || "Vehicle"} · LKR {Number(record.total_cost || 0).toLocaleString()}</p>)}{records.length === 0 && <p className="text-xs text-gray-500">None</p>}</div>
      </div>
    </CustomerModalShell>
  );
}

function RoleChangeModal({
  customer,
  saving,
  onClose,
  onSubmit,
}: {
  customer: Profile;
  saving: boolean;
  onClose: () => void;
  onSubmit: (role: "admin" | "staff" | "customer") => void;
}) {
  const [role, setRole] = useState<"admin" | "staff" | "customer">(customer.role as "admin" | "staff" | "customer");
  return (
    <CustomerModalShell title="Change User Role" onClose={onClose}>
      <p className="text-sm text-gray-400">User: <strong className="text-white">{customer.full_name}</strong></p>
      <p className="mt-3 text-xs text-gray-500">Current role: <span className="font-bold uppercase text-red-400">{customer.role}</span></p>
      <label className="mt-5 block text-xs font-bold text-gray-400">
        New role
        <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "staff" | "customer")} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm text-white">
          <option value="customer">Customer</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      {role === "admin" && customer.role !== "admin" && <p className="mt-4 rounded-lg bg-amber-950/30 p-3 text-xs text-amber-300">This user will be able to access CK Motors administration features.</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-gray-400">Cancel</button>
        <button type="button" disabled={saving || role === customer.role} onClick={() => onSubmit(role)} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Updating..." : "Update Role"}</button>
      </div>
    </CustomerModalShell>
  );
}

function CustomersSection({
  customers,
  search,
  setSearch,
  vehicles,
  bookings,
  adminRole,
  changeStatus,
  onView,
  onRoleChange,
  onEdit,
  onMessage,
  onDelete,
  onRepairLogin,
  onAdd,
}: {
  customers: Profile[];
  search: string;
  setSearch: (value: string) => void;
  vehicles: Vehicle[];
  bookings: Booking[];
  adminRole: string;
  changeStatus: (
    customer: Profile
  ) => void;
  onView: (customer: Profile) => void;
  onRoleChange: (customer: Profile) => void;
  onEdit: (customer: Profile) => void;
  onMessage: (customer: Profile) => void;
  onDelete: (customer: Profile) => void;
  onRepairLogin: (customer: Profile) => void;
  onAdd: () => void;
}) {
  return (
    <Panel title="Customer Management">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={search} setValue={setSearch} placeholder="Search customer..." />
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-500">
            {customers.length} customers
          </span>
          {adminRole === "admin" && (
            <button type="button" onClick={onAdd} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500">
              <Plus size={14} className="mr-1 inline" /> Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {customers.map(
          (customer) => (
            <div
              key={customer.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-950/40 font-black text-red-500">
                  {customer.full_name
                    ?.charAt(0)
                    .toUpperCase() ||
                    "C"}
                </div>

                <StatusPill
                  active={
                    customer.status ===
                    "active"
                  }
                  text={
                    customer.status
                  }
                />
              </div>

              <h3 className="font-black">
                {customer.full_name}
              </h3>

              <p className="mt-2 text-xs text-gray-500">
                {customer.email}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {customer.phone ||
                  "No phone"}
              </p>
              <span className="mt-3 inline-flex rounded-full border border-red-900/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
                {customer.role}
              </span>

              <div className="my-4 h-px bg-white/10" />

              <div className="grid grid-cols-2 gap-3 text-xs">
                <SmallStat
                  label="Vehicles"
                  value={
                    vehicles.filter(
                      (vehicle) =>
                        vehicle.user_id ===
                        customer.id
                    ).length
                  }
                />

                <SmallStat
                  label="Bookings"
                  value={
                    bookings.filter(
                      (booking) =>
                        booking.user_id ===
                        customer.id
                    ).length
                  }
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onView(customer)} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-500 hover:border-red-500 hover:text-red-500">
                  <Eye size={14} /> View
                </button>
                {adminRole === "admin" && (
                  <button type="button" onClick={() => onEdit(customer)} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-500 hover:border-red-500 hover:text-red-500">
                    <Edit3 size={14} /> Edit
                  </button>
                )}
                <button type="button" onClick={() => onMessage(customer)} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-500 hover:border-red-500 hover:text-red-500">
                  <Mail size={14} /> Message
                </button>
                {adminRole === "admin" && (
                  <>
                    <button type="button" onClick={() => onRepairLogin(customer)} className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-amber-900/40 px-3 py-2 text-xs font-bold text-amber-500 hover:bg-amber-950/30">
                      <KeyRound size={14} /> Repair Login
                    </button>
                    <button type="button" onClick={() => onRoleChange(customer)} className="col-span-2 rounded-lg border border-blue-900/40 px-3 py-2 text-xs font-bold text-blue-400 hover:bg-blue-950/30">
                      Change Role
                    </button>
                    <button type="button" onClick={() => changeStatus(customer)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-500 hover:border-red-500 hover:text-red-500">
                      {customer.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" onClick={() => onDelete(customer)} className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-red-900/40 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-950/30">
                      <Trash2 size={14} /> Delete Customer
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </Panel>
  );
}

/* ============================================================
   VEHICLES
============================================================ */

function VehiclesSection({
  vehicles,
  search,
  setSearch,
  getCustomer,
}: {
  vehicles: Vehicle[];
  search: string;
  setSearch: (value: string) => void;
  getCustomer: (
    id: string
  ) => Profile | undefined;
}) {
  return (
    <Panel title="All Customer Vehicles">
      <div className="mb-5">
        <SearchInput
          value={search}
          setValue={setSearch}
          placeholder="Search registration, brand or customer..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => {
          const customer =
            getCustomer(vehicle.user_id);

          return (
            <div
              key={vehicle.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <Car
                size={28}
                className="mb-4 text-red-500"
              />

              <h3 className="font-black">
                {vehicle.brand}{" "}
                {vehicle.model}
              </h3>

              <p className="mt-1 font-bold text-red-500">
                {
                  vehicle.registration_number
                }
              </p>

              <div className="mt-4 space-y-2 text-xs text-gray-500">
                <p>
                  Customer:{" "}
                  {customer?.full_name ||
                    "—"}
                </p>

                <p>
                  Year:{" "}
                  {vehicle.manufacture_year ||
                    "—"}
                </p>

                <p>
                  Fuel:{" "}
                  {vehicle.fuel_type ||
                    "—"}
                </p>

                <p>
                  Mileage:{" "}
                  {vehicle.mileage
                    ? `${vehicle.mileage.toLocaleString()} km`
                    : "—"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ============================================================
   SERVICES
============================================================ */

function ServicesSection({
  services,
  adminRole,
  addService,
  editService,
  deleteService,
  toggleService,
}: {
  services: Service[];
  adminRole: string;
  addService: () => void;
  editService: (
    service: Service
  ) => void;
  deleteService: (
    service: Service
  ) => void;
  toggleService: (service: Service) => void;
}) {
  return (
    <Panel title="Services Management">
      {adminRole === "admin" && (
        <div className="mb-5 flex justify-end">
          <button
            onClick={addService}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-xs font-bold hover:bg-red-500"
          >
            <Plus size={16} />
            Add Service
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="rounded-2xl border border-white/10 bg-black/30 p-5"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-950/40 text-red-500">
                <Wrench size={22} />
              </div>

              <StatusPill
                active={service.active}
                text={
                  service.active
                    ? "Active"
                    : "Inactive"
                }

              />
            </div>

            <h3 className="font-black">
              {service.name}
            </h3>

            <p className="mt-1 text-xs font-semibold text-red-500">
              {service.category ||
                "General"}
            </p>

            <p className="mt-3 min-h-10 text-xs leading-5 text-gray-600">
              {service.description ||
                "No description"}
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-sm font-black">
                {service.price_from !==
                null
                  ? `LKR ${Number(
                      service.price_from
                    ).toLocaleString()}+`
                  : "Price on request"}
              </span>

              {adminRole ===
                "admin" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleService(service)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-500 hover:text-red-500"
                  >
                    {service.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editService(
                        service
                      )
                    }
                    className="rounded-lg border border-white/10 p-2 text-gray-500 hover:text-red-500"
                  >
                    <Edit3
                      size={14}
                    />
                  </button>

                  <button
                    onClick={() =>
                      deleteService(
                        service
                      )
                    }
                    className="rounded-lg border border-white/10 p-2 text-gray-500 hover:text-red-500"
                  >
                    <Trash2
                      size={14}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GallerySection({ gallery, onAdd, onEdit, onToggle, onDelete }: { gallery: GalleryItem[]; onAdd: () => void; onEdit: (item: GalleryItem) => void; onToggle: (item: GalleryItem) => void; onDelete: (item: GalleryItem) => void }) {
  return <Panel title="Gallery Management"><div className="mb-5 flex items-center justify-between gap-4"><p className="text-xs text-gray-500">Manage workshop photos displayed on the CK Motors website.</p><button type="button" onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-xs font-bold"><Plus size={16} /> Add Photo</button></div>{gallery.length === 0 ? <Empty text="No gallery photos yet." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{gallery.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"><img src={item.image_url} alt={item.title || "Gallery photo"} className="aspect-[4/3] w-full object-cover" /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.title || "Untitled photo"}</h3><p className="mt-1 text-xs text-gray-500">{item.caption || "No caption"}</p></div><StatusPill active={item.is_active} text={item.is_active ? "Active" : "Inactive"} /></div><p className="mt-3 text-[10px] text-gray-600">Order {item.display_order} · {new Date(item.created_at).toLocaleDateString()}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => onEdit(item)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-400">Edit</button><button type="button" onClick={() => onToggle(item)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-400">{item.is_active ? "Deactivate" : "Activate"}</button><button type="button" onClick={() => onDelete(item)} className="rounded-lg border border-red-900/50 px-3 py-2 text-[10px] font-bold text-red-500">Delete</button></div></div></article>)}</div>}</Panel>;
}

function GalleryModal({ item, onClose, onSubmit }: { item: GalleryItem | null; onClose: () => void; onSubmit: (formData: FormData) => Promise<void> }) {
  const [preview, setPreview] = useState(item?.image_url || "");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); await onSubmit(new FormData(event.currentTarget)); setSaving(false); }
  return <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/80 p-4"><div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111] p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">{item ? "Edit Photo" : "Add Photo"}</h2><button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2"><X size={18} /></button></div><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-gray-400">Photo {item ? "(optional replacement)" : "*"}<input name="file" required={!item} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} className="mt-2 block w-full text-xs" /></label>{preview && <img src={preview} alt="Selected preview" className="max-h-56 w-full rounded-xl object-cover" />}<label className="block text-xs font-bold text-gray-400">Title<input name="title" defaultValue={item?.title || ""} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm" /></label><label className="block text-xs font-bold text-gray-400">Caption<textarea name="caption" defaultValue={item?.caption || ""} rows={3} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold text-gray-400">Display Order<input name="display_order" type="number" defaultValue={item?.display_order || 0} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm" /></label><label className="flex items-center gap-2 pt-6 text-xs font-bold text-gray-400"><input name="is_active" type="checkbox" defaultChecked={item?.is_active ?? true} /> Active</label></div><div className="flex justify-end gap-3 border-t border-white/10 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-3 text-xs font-bold">Cancel</button><button disabled={saving} className="rounded-lg bg-red-600 px-5 py-3 text-xs font-bold disabled:opacity-50">{saving ? "Saving..." : "Save Photo"}</button></div></form></div></div>;
}

/* ============================================================
   SHARED COMPONENTS
============================================================ */

function Brand() {
  return (
    <div className="flex items-center">
      <CKLogo size="small" surface />
    </div>
  );
}

function SidebarButton({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
        active
          ? "bg-red-600 text-white"
          : "text-gray-500 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}

      <span className="flex-1">
        {label}
      </span>

      {!!badge && badge > 0 && (
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-red-600">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({
  icon,
  value,
  label,
  onClick,
  ariaLabel,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-950/40 text-red-500">
        {icon}
      </div>

      <p className="text-2xl font-black">
        {value}
      </p>

      <p className="mt-1 text-xs font-semibold text-gray-600">
        {label}
      </p>
      {onClick && (
        <span className="mt-3 inline-flex text-[10px] font-bold text-red-500">
          View breakdown →
        </span>
      )}
    </>
  );

  const className =
    "w-full rounded-2xl border border-white/10 bg-[#111] p-5 text-left transition";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${className} cursor-pointer hover:-translate-y-0.5 hover:border-red-500/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/60`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function Panel({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black">
          {title}
        </h2>

       {action && onAction && (
         <button
           onClick={onAction}
            className="group flex cursor-pointer items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs font-bold text-red-500 transition-all duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white active:scale-95"
     >
    <span>{action}</span>

    <span className="transition-transform duration-200 group-hover:translate-x-1">
      →
    </span>
  </button>
)}
      </div>

      {children}
    </div>
  );
}

function SearchInput({
  value,
  setValue,
  placeholder,
}: {
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-sm">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
      />

      <input
        value={value}
        onChange={(event) =>
          setValue(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-[#080808] py-3 pl-10 pr-4 text-xs outline-none placeholder:text-gray-700 focus:border-red-700"
      />
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span className="rounded-full border border-red-900/50 bg-red-950/30 px-3 py-1 text-[10px] font-bold text-red-400">
      {formatStatus(status)}
    </span>
  );
}

function StatusPill({
  active,
  text,
}: {
  active: boolean;
  text: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
        active
          ? "bg-green-950/40 text-green-500"
          : "bg-red-950/40 text-red-500"
      }`}
    >
      {text}
    </span>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-3">
      <p className="text-lg font-black">
        {value}
      </p>

      <p className="mt-1 text-[9px] uppercase text-gray-700">
        {label}
      </p>
    </div>
  );
}

function OverviewRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-0">
      <span className="text-xs text-gray-500">
        {label}
      </span>

      <span className="font-black">
        {value}
      </span>
    </div>
  );
}

function MessageBox({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3 text-xs ${
        type === "error"
          ? "border-red-900/60 bg-red-950/20 text-red-400"
          : "border-green-900/60 bg-green-950/20 text-green-400"
      }`}
    >
      {message}
    </div>
  );
}

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-sm text-gray-600">
      {text}
    </div>
  );
}

function AdminInput({
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
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none placeholder:text-gray-700 focus:border-red-600"
      />
    </div>
  );
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function sectionTitle(
  section: Section
) {
  switch (section) {
    case "bookings":
      return "Booking Management";

    case "customers":
      return "Customer Management";

    case "vehicles":
      return "Vehicle Management";

    case "services":
      return "Services Management";
    case "gallery":
      return "Gallery Management";

    case "records":
      return "Service Records";

    case "messages":
      return "Customer Messages";

    case "website-settings":
      return "Website Settings";
    case "users":
      return "Admin Users";
    case "vehicle-settings":
      return "Vehicle Settings";

    default:
      return "Admin Dashboard";
  }
}