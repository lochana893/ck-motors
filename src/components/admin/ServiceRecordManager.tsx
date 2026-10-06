"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import SearchableVehicleSelect from "@/components/vehicles/SearchableVehicleSelect";
import { useVehicleMasterData } from "@/lib/vehicle-master-data";
import {
  ServiceInvoiceModal,
  type InvoiceServicePart,
  type ServiceInvoiceRecord,
} from "@/components/admin/ServiceInvoices";

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
  phone: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
};

type Vehicle = {
  id: string;
  user_id: string;
  registration_number: string;
  brand: string;
  model: string;
  manufacture_year: number | null;
  fuel_type: string | null;
  mileage: number | null;
};

type ExistingRecord = {
  booking_id: string | null;
};

type JobCardOption = {
  id: string;
  job_card_number: string;
  booking_id: string | null;
  customer_id: string;
  vehicle_id: string;
  status: string;
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
  const [walkInVehicles, setWalkInVehicles] = useState<Vehicle[]>([]);
  const [existingRecords, setExistingRecords] = useState<ExistingRecord[]>([]);
  const [jobCards, setJobCards] = useState<JobCardOption[]>([]);
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
  const [selectedJobCardId, setSelectedJobCardId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomer, setNewCustomer] = useState({ full_name: "", email: "", phone: "" });
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [loadingCustomerVehicles, setLoadingCustomerVehicles] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ registration_number: "", brand: "", model: "" });
  const vehicleRequestId = useRef(0);
  const mileageManuallyEdited = useRef(false);

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdServiceRecordId, setCreatedServiceRecordId] = useState<string | null>(null);
  const [createdInvoiceRecord, setCreatedInvoiceRecord] = useState<ServiceInvoiceRecord | null>(null);
  const [createdInvoiceParts, setCreatedInvoiceParts] = useState<InvoiceServicePart[]>([]);
  const [createdInvoicePreparedBy, setCreatedInvoicePreparedBy] = useState<string | null>(null);
  const [createdInvoiceLoading, setCreatedInvoiceLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      bookingResult,
      profileResult,
      vehicleResult,
      recordsResult,
      jobCardResult,
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
        .select("id, full_name, email, phone, address, address_line1, address_line2, city, district, postal_code")
        .eq("role", "customer")
        .order("full_name"),

      supabase
        .from("vehicles")
        .select("id, user_id, registration_number, brand, model, manufacture_year, fuel_type, mileage"),

      supabase
        .from("service_records")
        .select("booking_id"),

      supabase
        .from("job_cards")
        .select("id, job_card_number, booking_id, customer_id, vehicle_id, status")
        .order("created_at", { ascending: false })
        .limit(500),

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

    if (profileResult.error) {
      setError(`Unable to load customers: ${profileResult.error.message}`);
    } else if (profileResult.data) {
      setProfiles(profileResult.data as Profile[]);
    }

    if (vehicleResult.error) {
      setError(`Unable to load vehicles: ${vehicleResult.error.message}`);
    } else if (vehicleResult.data) {
      setVehicles(vehicleResult.data as Vehicle[]);
    }

    if (recordsResult.data) {
      setExistingRecords(recordsResult.data as ExistingRecord[]);
    }

    if (jobCardResult.error) {
      setError(jobCardResult.error.message);
    } else {
      setJobCards((jobCardResult.data || []) as JobCardOption[]);
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
  const activeJobCards = jobCards.filter((card) =>
    !["delivered", "cancelled"].includes(card.status)
    && card.customer_id === (flow === "booking" ? selectedBooking?.user_id : selectedCustomerId)
    && card.vehicle_id === (flow === "booking" ? selectedBooking?.vehicle_id : selectedVehicleId)
  );
  const selectedWalkInCustomer = profiles.find(
    (profile) => profile.id === selectedCustomerId
  );
  const visibleCustomers = profiles.filter((profile) =>
    `${profile.full_name} ${profile.email} ${profile.phone || ""}`.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const selectedWalkInVehicle = walkInVehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId
  );
  const performedLines = servicesPerformed.split(/\r?\n/);
  const selectedPerformedServices = services.filter((service) =>
    performedLines.some((line) => line.trim() === service.name)
  );
  const customPerformedText = performedLines
    .filter((line) => !services.some((service) => service.name === line.trim()))
    .join("\n");

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleCustomerChange(customerId: string) {
    const requestId = ++vehicleRequestId.current;
    setSelectedCustomerId(customerId);
    setSelectedVehicleId("");
    setSelectedJobCardId("");
    setWalkInVehicles([]);
    setMileage("");
    mileageManuallyEdited.current = false;
    setError("");
    if (customerId) clearFieldError("customer");
    setLoadingCustomerVehicles(Boolean(customerId));

    if (!customerId) return;

    const { data, error: vehicleLoadError } = await supabase
      .from("vehicles")
      .select("id, user_id, registration_number, brand, model, manufacture_year, fuel_type, mileage")
      .eq("user_id", customerId)
      .order("registration_number");

    if (requestId !== vehicleRequestId.current) return;
    setLoadingCustomerVehicles(false);

    if (vehicleLoadError) {
      setError(`Unable to load this customer's vehicles: ${vehicleLoadError.message}`);
      return;
    }

    setWalkInVehicles((data || []) as Vehicle[]);
  }

  function handleBookingChange(id: string) {
    setSelectedBookingId(id);
    setSelectedJobCardId("");
    if (id) clearFieldError("booking");
    mileageManuallyEdited.current = false;

    const booking = bookings.find((item) => item.id === id);

    if (!booking) return;

    const bookingService = booking.service_name_snapshot || "Vehicle Service";
    setServicesPerformed(bookingService);
    setSelectedJobCardId(jobCards.find((card) => card.booking_id === booking.id && !["delivered", "cancelled"].includes(card.status))?.id || "");

    setMileage(
      booking.mileage !== null
        ? booking.mileage.toString()
        : ""
    );
    clearFieldError("services");
  }

  function handleWalkInVehicleChange(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setSelectedJobCardId("");
    if (vehicleId) clearFieldError("vehicle");
    const vehicle = walkInVehicles.find((item) => item.id === vehicleId);
    if (!mileageManuallyEdited.current) {
      setMileage(vehicle?.mileage != null ? String(vehicle.mileage) : "");
    } else if (vehicle?.mileage != null) {
      setMileage((current) => String(Math.max(Number(current) || 0, vehicle.mileage || 0)));
    }
  }

  async function createWalkInCustomer() {
    setCreatedServiceRecordId(null);
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email.trim());
    if (!newCustomer.full_name.trim() || !newCustomer.email.trim() || !emailIsValid) {
      const nextErrors: Record<string, string> = {};
      if (!newCustomer.full_name.trim()) nextErrors["new-customer-name"] = "Full name is required.";
      if (!newCustomer.email.trim()) nextErrors["new-customer-email"] = "Email is required.";
      else if (!emailIsValid) nextErrors["new-customer-email"] = "Enter a valid email address.";
      setFieldErrors((current) => ({ ...current, ...nextErrors }));
      setError("Enter the required customer details.");
      const firstMissing = Object.keys(nextErrors)[0];
      if (firstMissing) {
        window.requestAnimationFrame(() => {
          const field = document.getElementById(firstMissing);
          field?.scrollIntoView({ behavior: "smooth", block: "center" });
          field?.focus({ preventScroll: true });
        });
      }
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
      customer?: { id: string; full_name: string; email: string; phone?: string | null };
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
      phone: (result.customer.phone ?? newCustomer.phone.trim()) || null,
      address: null,
      address_line1: null,
      address_line2: null,
      city: null,
      district: null,
      postal_code: null,
    };
    setProfiles((current) => [...current, createdProfile]);
    await handleCustomerChange(createdProfile.id);
    setTemporaryPassword(result.temporaryPassword || "");
    setNewCustomer({ full_name: "", email: "", phone: "" });
    setSuccess("Customer created. Add a vehicle before creating the service.");
  }

  async function createWalkInVehicle() {
    setCreatedServiceRecordId(null);
    if (!selectedCustomerId || !newVehicle.registration_number.trim() || !newVehicle.brand.trim() || !newVehicle.model.trim()) {
      const nextErrors: Record<string, string> = {};
      if (!newVehicle.registration_number.trim()) nextErrors["new-vehicle-registration"] = "Registration is required.";
      if (!newVehicle.brand.trim() || newVehicle.brand === "Other") nextErrors["new-vehicle-brand"] = "Brand is required.";
      if (!newVehicle.model.trim() || newVehicle.model === "Other") nextErrors["new-vehicle-model"] = "Model is required.";
      setFieldErrors((current) => ({ ...current, ...nextErrors }));
      setError("Select a customer and enter registration, brand, and model.");
      const firstMissing = Object.keys(nextErrors)[0];
      if (firstMissing) {
        window.requestAnimationFrame(() => {
          const field = document.getElementById(firstMissing);
          field?.scrollIntoView({ behavior: "smooth", block: "center" });
          field?.focus({ preventScroll: true });
        });
      }
      return;
    }
    setAddingVehicle(true);
    setError("");
    const customerId = selectedCustomerId;
    const customerRequestId = vehicleRequestId.current;
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
        user_id: customerId,
        registration_number: normalizedRegistration,
        brand: newVehicle.brand.trim(),
        model: newVehicle.model.trim(),
      })
      .select("id, user_id, registration_number, brand, model, manufacture_year, fuel_type, mileage")
      .single();
    setAddingVehicle(false);
    if (vehicleError || !data) {
      setError(vehicleError?.message || "Vehicle could not be added.");
      return;
    }
    const createdVehicle = { ...data, user_id: customerId };
    setVehicles((current) => [...current, createdVehicle]);
    if (vehicleRequestId.current === customerRequestId) {
      setWalkInVehicles((current) => [...current, createdVehicle]);
      setSelectedVehicleId(createdVehicle.id);
      setSelectedJobCardId("");
      clearFieldError("vehicle");
      if (createdVehicle.mileage !== null && !mileageManuallyEdited.current) {
        setMileage(String(createdVehicle.mileage));
      }
    }
    setNewVehicle({ registration_number: "", brand: "", model: "" });
  }

  function addPerformedService(serviceName: string) {
    if (!serviceName || performedLines.some((line) => line.trim() === serviceName)) return;
    setServicesPerformed((current) => `${current.trimEnd()}${current.trim() ? "\n" : ""}${serviceName}`);
    clearFieldError("services");
  }

  function removePerformedService(serviceName: string) {
    setServicesPerformed((current) =>
      current
        .split(/\r?\n/)
        .filter((line) => line.trim() !== serviceName)
        .join("\n")
    );
  }

  function updateCustomPerformedText(value: string) {
    const selectedNames = services
      .filter((service) => performedLines.some((line) => line.trim() === service.name))
      .map((service) => service.name);
    setServicesPerformed([...selectedNames, value].filter(Boolean).join("\n"));
    if (value.trim() || selectedNames.length) clearFieldError("services");
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
    setFieldErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("part-")))
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
    if (field === "part_name" && value.trim()) clearFieldError(`part-${index}-name`);
    if (field === "quantity" && Number.isInteger(Number(value)) && Number(value) > 0) clearFieldError(`part-${index}-quantity`);
    if (field === "unit_price" && Number.isFinite(Number(value)) && Number(value) >= 0) clearFieldError(`part-${index}-unit-price`);
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
    if (selectedInventoryPart) {
      clearFieldError(`part-${index}-name`);
      clearFieldError(`part-${index}-quantity`);
      clearFieldError(`part-${index}-unit-price`);
    }
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

  async function openCreatedInvoice() {
    if (!createdServiceRecordId) return;
    setCreatedInvoiceLoading(true);
    setError("");

    const { data: recordData, error: recordLoadError } = await supabase
      .from("service_records")
      .select("id, booking_id, user_id, vehicle_id, created_by, technician_name, mileage, service_date, services_performed, labour_cost, parts_cost, additional_cost, discount, total_cost, technician_notes, recommended_repairs, next_service_date, next_service_mileage, created_at")
      .eq("id", createdServiceRecordId)
      .single();

    if (recordLoadError || !recordData) {
      setError("Service record was created, but the invoice could not be opened.");
      setCreatedInvoiceLoading(false);
      return;
    }

    const { data: partsData, error: partsLoadError } = await supabase
      .from("service_parts")
      .select("id, part_name, part_number, quantity, unit_price, total_price")
      .eq("service_record_id", createdServiceRecordId)
      .order("created_at", { ascending: true });

    if (partsLoadError) {
      setError("Service record was created, but the invoice could not be opened.");
      setCreatedInvoiceLoading(false);
      return;
    }

    let preparedBy: string | null = null;
    if (recordData.created_by) {
      const { data: creator, error: creatorError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", recordData.created_by)
        .maybeSingle();
      if (creatorError) {
        setError(`Invoice opened, but the issuer name could not be loaded: ${creatorError.message}`);
      } else {
        preparedBy = creator?.full_name?.trim() || null;
      }
    }

    setCreatedInvoiceRecord(recordData as ServiceInvoiceRecord);
    setCreatedInvoiceParts((partsData || []) as InvoiceServicePart[]);
    setCreatedInvoicePreparedBy(preparedBy);
    setCreatedInvoiceLoading(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const nextFieldErrors: Record<string, string> = {};
    if (flow === "booking" && !selectedBooking) {
      nextFieldErrors.booking = "Please select a booking.";
    } else if (flow === "walk-in" && !selectedCustomerId) {
      nextFieldErrors.customer = "Please select a customer.";
    } else if (flow === "walk-in" && selectedCustomerId && !selectedVehicleId) {
      nextFieldErrors.vehicle = "Please select a vehicle.";
    }
    if (!serviceDate) nextFieldErrors.serviceDate = "This field is required.";
    if (!servicesPerformed.trim()) nextFieldErrors.services = "Please add at least one service performed.";
    if (mileage.trim() && (!Number.isFinite(Number(mileage)) || Number(mileage) < 0 || Number(mileage) > 9999999)) {
      nextFieldErrors.mileage = "Enter a valid mileage between 0 and 9,999,999.";
    }
    [
      ["labour-cost", labourCost],
      ["additional-cost", additionalCost],
      ["discount", discount],
    ].forEach(([field, value]) => {
      if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        nextFieldErrors[field] = "Enter a value of zero or more.";
      }
    });
    parts.forEach((part, index) => {
      const hasPartEntry = Boolean(
        part.inventory_part_id ||
        part.part_name.trim() ||
        part.part_number.trim() ||
        part.unit_price.trim()
      );
      if (!hasPartEntry) return;
      if (!part.part_name.trim()) nextFieldErrors[`part-${index}-name`] = "Enter a part name.";
      if (!Number.isInteger(Number(part.quantity)) || Number(part.quantity) <= 0) {
        nextFieldErrors[`part-${index}-quantity`] = "Enter a whole quantity greater than zero.";
      }
      if (part.unit_price.trim() && (!Number.isFinite(Number(part.unit_price)) || Number(part.unit_price) < 0)) {
        nextFieldErrors[`part-${index}-unit-price`] = "Enter a valid unit price of zero or more.";
      }
    });

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Please complete the highlighted required fields.");
      const firstFieldId = Object.keys(nextFieldErrors)[0];
      window.requestAnimationFrame(() => {
        const firstField = document.getElementById(firstFieldId);
        firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
        firstField?.focus({ preventScroll: true });
      });
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

    let followupWarning = "";
    if (selectedJobCardId) {
      const [{ error: linkError }, { error: statusError }] = await Promise.all([
        supabase.from("service_records").update({ job_card_id: selectedJobCardId }).eq("id", record.id),
        supabase.from("job_cards").update({ status: "delivered" }).eq("id", selectedJobCardId),
      ]);
      if (linkError || statusError) {
        followupWarning = `Service record was created, but the job card could not be fully updated: ${linkError?.message || statusError?.message}`;
      }
    }

    if (flow === "booking" && selectedBooking) {
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", selectedBooking.id);
      if (bookingUpdateError) {
        followupWarning = `${followupWarning ? `${followupWarning} ` : ""}The service record was saved, but the booking status could not be updated: ${bookingUpdateError.message}`;
      }
    } else {
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: selectedCustomerId,
        booking_id: null,
        type: "service_completed",
        title: "Service Invoice Ready",
        message: "Your CK Motors walk-in service invoice is ready.",
      });
      if (notificationError) {
        followupWarning = `${followupWarning ? `${followupWarning} ` : ""}The service record was saved, but the customer notification could not be created: ${notificationError.message}`;
      }
    }

    setSuccess(
      `${followupWarning ? `${followupWarning} ` : ""}Service record created successfully. Total: LKR ${Number(
        record.total_cost
      ).toLocaleString()}`
    );
    setCreatedServiceRecordId(record.id);
    setCreatedInvoiceRecord(null);
    setCreatedInvoiceParts([]);
    setCreatedInvoicePreparedBy(null);

    setSelectedBookingId("");
    setSelectedCustomerId("");
    setSelectedVehicleId("");
    vehicleRequestId.current += 1;
    setLoadingCustomerVehicles(false);
    setWalkInVehicles([]);
    setSelectedJobCardId("");
    setCustomerSearch("");
    setTechnicianName("");
    setMileage("");
    setServicesPerformed("");
    mileageManuallyEdited.current = false;
    setFieldErrors({});
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
      <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#111]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
        <p className="text-sm text-gray-300">Loading customer and service data...</p>
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

      {error && error !== "Please complete the highlighted required fields." && (
        <div className="admin-alert admin-alert--error mb-5 rounded-xl border p-4 text-xs font-semibold">
          {error}
        </div>
      )}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="admin-alert admin-alert--error mb-5 rounded-xl border p-4 text-xs font-semibold">
          Please complete the highlighted required fields.
        </div>
      )}

      {success && (
        <div className="admin-alert admin-alert--success mb-5 rounded-xl border p-4 text-xs font-semibold">
          <p>{success}</p>
          {createdServiceRecordId && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void openCreatedInvoice()} disabled={createdInvoiceLoading} className="min-h-11 rounded-lg bg-[#062B55] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0A3B72] disabled:opacity-60">
                {createdInvoiceLoading ? "Loading invoice..." : "View Invoice"}
              </button>
              <button type="button" onClick={() => void openCreatedInvoice()} disabled={createdInvoiceLoading} className="min-h-11 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">
                Print / Save PDF
              </button>
            </div>
          )}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit}>
        <div className="mb-5 flex gap-2 rounded-xl border border-white/10 p-1">
          {(["booking", "walk-in"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setFlow(option);
                setSelectedJobCardId("");
              }}
              className={`flex-1 rounded-lg px-4 py-3 text-xs font-bold ${flow === option ? "bg-red-600 text-white" : "text-gray-500 hover:bg-white/5"}`}
            >
              {option === "booking" ? "Booking Service" : "Walk-In Service"}
            </button>
          ))}
        </div>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          {flow === "booking" ? <Field label="Select Booking" htmlFor="booking" required error={fieldErrors.booking}>
            <select
              id="booking"
              value={selectedBookingId}
              onChange={(e) =>
                handleBookingChange(e.target.value)
              }
              aria-invalid={Boolean(fieldErrors.booking)}
              aria-describedby={fieldErrors.booking ? "booking-error" : undefined}
              className={`input-style w-full min-w-0 ${fieldErrors.booking ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
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
              <Field label="Search Existing Customer" htmlFor="customer" required error={fieldErrors.customer}>
                <input
                  aria-label="Filter customers by name, email, or phone"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Search name, email, or phone"
                  className="input-style w-full min-w-0"
                />
                <select
                  id="customer"
                  value={selectedCustomerId}
                  onChange={(event) => void handleCustomerChange(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.customer)}
                  aria-describedby={fieldErrors.customer ? "customer-error" : undefined}
                  className={`input-style mt-2 w-full min-w-0 ${fieldErrors.customer ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
                >
                  <option value="">Choose customer</option>
                  {visibleCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || customer.email}{customer.email ? ` — ${customer.email}` : ""}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
                </select>
                {visibleCustomers.length === 0 && <p className="mt-2 text-xs text-gray-500">{customerSearch ? "No customers match this search." : "No customers available."}</p>}
              </Field>
              <Field label="Add New Customer">
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label htmlFor="new-customer-name" className="mb-1 block text-xs font-semibold text-gray-400">Full Name *</label>
                    <input id="new-customer-name" value={newCustomer.full_name} onChange={(event) => { setNewCustomer({ ...newCustomer, full_name: event.target.value }); if (event.target.value.trim()) clearFieldError("new-customer-name"); }} placeholder="Full name" aria-invalid={Boolean(fieldErrors["new-customer-name"])} aria-describedby={fieldErrors["new-customer-name"] ? "new-customer-name-error" : undefined} className={`input-style w-full min-w-0 ${fieldErrors["new-customer-name"] ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`} />
                    {fieldErrors["new-customer-name"] && <p id="new-customer-name-error" className="mt-1 text-xs font-semibold text-red-500">{fieldErrors["new-customer-name"]}</p>}
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="new-customer-email" className="mb-1 block text-xs font-semibold text-gray-400">Email *</label>
                    <input id="new-customer-email" type="text" inputMode="email" value={newCustomer.email} onChange={(event) => { setNewCustomer({ ...newCustomer, email: event.target.value }); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.target.value.trim())) clearFieldError("new-customer-email"); }} placeholder="Email" aria-invalid={Boolean(fieldErrors["new-customer-email"])} aria-describedby={fieldErrors["new-customer-email"] ? "new-customer-email-error" : undefined} className={`input-style w-full min-w-0 ${fieldErrors["new-customer-email"] ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`} />
                    {fieldErrors["new-customer-email"] && <p id="new-customer-email-error" className="mt-1 text-xs font-semibold text-red-500">{fieldErrors["new-customer-email"]}</p>}
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="new-customer-phone" className="mb-1 block text-xs font-semibold text-gray-400">Phone (optional)</label>
                    <input id="new-customer-phone" type="tel" value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} placeholder="Phone" className="input-style w-full min-w-0" />
                  </div>
                  <button type="button" onClick={() => void createWalkInCustomer()} disabled={addingCustomer} className="min-h-11 self-end rounded-lg bg-red-600 px-3 py-2 text-xs font-bold disabled:opacity-50">{addingCustomer ? "Adding..." : "Add Customer"}</button>
                </div>
              </Field>
              {selectedWalkInCustomer && (
                <div className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-4 md:col-span-2">
                  <h3 className="text-sm font-bold text-white">Selected Customer</h3>
                  <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <CustomerDetail label="Full Name" value={selectedWalkInCustomer.full_name} />
                    <CustomerDetail label="Email" value={selectedWalkInCustomer.email} />
                    <CustomerDetail label="Phone" value={selectedWalkInCustomer.phone} />
                    <CustomerDetail
                      label="Address"
                      value={selectedWalkInCustomer.address || [
                        selectedWalkInCustomer.address_line1,
                        selectedWalkInCustomer.address_line2,
                        selectedWalkInCustomer.city,
                        selectedWalkInCustomer.district,
                        selectedWalkInCustomer.postal_code,
                      ].filter(Boolean).join(", ")}
                    />
                  </dl>
                </div>
              )}
              {selectedWalkInCustomer && (
                <>
                  <Field label="Select Vehicle" htmlFor="vehicle" required error={fieldErrors.vehicle}>
                    <select
                      id="vehicle"
                      value={selectedVehicleId}
                      onChange={(event) => handleWalkInVehicleChange(event.target.value)}
                      aria-invalid={Boolean(fieldErrors.vehicle)}
                      aria-describedby={fieldErrors.vehicle ? "vehicle-error" : undefined}
                      aria-busy={loadingCustomerVehicles}
                      className={`input-style w-full min-w-0 ${fieldErrors.vehicle ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
                    >
                      <option value="">{loadingCustomerVehicles ? "Loading vehicles..." : "Choose vehicle"}</option>
                      {walkInVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {[vehicle.registration_number, vehicle.brand, vehicle.model].filter(Boolean).join(" — ")}
                        </option>
                      ))}
                    </select>
                    {!loadingCustomerVehicles && walkInVehicles.length === 0 && <p className="mt-2 text-xs text-gray-500">No vehicles found for this customer. Add a vehicle below.</p>}
                  </Field>
                  {selectedWalkInVehicle && (
                    <div className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-4">
                      <h3 className="text-sm font-bold text-white">Selected Vehicle</h3>
                      <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                        <CustomerDetail label="Registration" value={selectedWalkInVehicle.registration_number} />
                        <CustomerDetail label="Brand" value={selectedWalkInVehicle.brand} />
                        <CustomerDetail label="Model" value={selectedWalkInVehicle.model} />
                        <CustomerDetail label="Year" value={selectedWalkInVehicle.manufacture_year?.toString() || null} />
                        <CustomerDetail label="Fuel Type" value={selectedWalkInVehicle.fuel_type} />
                        <CustomerDetail label="Current Mileage" value={selectedWalkInVehicle.mileage?.toLocaleString() || null} />
                      </dl>
                    </div>
                  )}
                  <Field label="Add Vehicle">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <div className="min-w-0">
                        <label htmlFor="new-vehicle-registration" className="mb-1 block text-xs font-semibold text-gray-400">Registration *</label>
                        <input id="new-vehicle-registration" value={newVehicle.registration_number} onChange={(event) => { setNewVehicle({ ...newVehicle, registration_number: event.target.value }); if (event.target.value.trim()) clearFieldError("new-vehicle-registration"); }} placeholder="Registration" aria-invalid={Boolean(fieldErrors["new-vehicle-registration"])} aria-describedby={fieldErrors["new-vehicle-registration"] ? "new-vehicle-registration-error" : undefined} className={`input-style w-full min-w-0 ${fieldErrors["new-vehicle-registration"] ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`} />
                        {fieldErrors["new-vehicle-registration"] && <p id="new-vehicle-registration-error" className="mt-1 text-xs font-semibold text-red-500">{fieldErrors["new-vehicle-registration"]}</p>}
                      </div>
                      <div className="min-w-0">
                        <SearchableVehicleSelect id="new-vehicle-brand" label="Brand *" value={newVehicle.brand} options={masterData.brands} invalid={Boolean(fieldErrors["new-vehicle-brand"])} describedBy={fieldErrors["new-vehicle-brand"] ? "new-vehicle-brand-error" : undefined} onChange={(value) => { setNewVehicle({ ...newVehicle, brand: value, model: "" }); if (value.trim() && value !== "Other") clearFieldError("new-vehicle-brand"); }} />
                        {fieldErrors["new-vehicle-brand"] && <p id="new-vehicle-brand-error" className="mt-1 text-xs font-semibold text-red-500">{fieldErrors["new-vehicle-brand"]}</p>}
                      </div>
                      <div className="min-w-0">
                        <SearchableVehicleSelect id="new-vehicle-model" label="Model *" value={newVehicle.model} options={masterData.models.filter((model) => model.brand === newVehicle.brand).map((model) => model.name)} invalid={Boolean(fieldErrors["new-vehicle-model"])} describedBy={fieldErrors["new-vehicle-model"] ? "new-vehicle-model-error" : undefined} onChange={(value) => { setNewVehicle({ ...newVehicle, model: value }); if (value.trim() && value !== "Other") clearFieldError("new-vehicle-model"); }} />
                        {fieldErrors["new-vehicle-model"] && <p id="new-vehicle-model-error" className="mt-1 text-xs font-semibold text-red-500">{fieldErrors["new-vehicle-model"]}</p>}
                      </div>
                      <button type="button" onClick={() => void createWalkInVehicle()} disabled={addingVehicle || loadingCustomerVehicles} className="min-h-11 self-end rounded-lg border border-red-700 px-3 py-2 text-xs font-bold text-red-500 disabled:opacity-50">{addingVehicle ? "Adding..." : "+ Add Vehicle"}</button>
                    </div>
                  </Field>
                </>
              )}
            </>
          )}

          <Field label="Service Date" htmlFor="service-date" required error={fieldErrors.serviceDate}>
            <input
              id="service-date"
              type="date"
              value={serviceDate}
              onChange={(e) => { setServiceDate(e.target.value); if (e.target.value) clearFieldError("serviceDate"); }}
              aria-invalid={Boolean(fieldErrors.serviceDate)}
              aria-describedby={fieldErrors.serviceDate ? "service-date-error" : undefined}
              className={`input-style w-full min-w-0 ${fieldErrors.serviceDate ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
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

          <Field label="Mileage" htmlFor="service-mileage" error={fieldErrors.mileage}>
            <input
              id="service-mileage"
              type="number"
              min="0"
              max="9999999"
              step="1"
              value={mileage}
              onChange={(e) => { setMileage(e.target.value); mileageManuallyEdited.current = Boolean(e.target.value); if (!e.target.value || (Number(e.target.value) >= 0 && Number(e.target.value) <= 9999999)) clearFieldError("mileage"); }}
              placeholder="65000"
              aria-invalid={Boolean(fieldErrors.mileage)}
              aria-describedby={fieldErrors.mileage ? "service-mileage-error" : undefined}
              className={`input-style w-full min-w-0 ${fieldErrors.mileage ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
            />
          </Field>

          {activeJobCards.length > 0 && (
            <Field label="Link Job Card (optional)">
              <select value={selectedJobCardId} onChange={(event) => setSelectedJobCardId(event.target.value)} className="input-style">
                <option value="">Do not link a job card</option>
                {activeJobCards.map((jobCard) => <option key={jobCard.id} value={jobCard.id}>{jobCard.job_card_number} · {jobCard.status.replaceAll("_", " ")}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-gray-600">Saving this service record will link it to the job card and mark the card delivered.</p>
            </Field>
          )}
        </div>

        <div className="mt-5 min-w-0">
          <Field label="Services Performed" htmlFor="performed-service" required error={fieldErrors.services}>
            <p className="mb-2 text-xs text-gray-500">Choose one or more catalog services, and add any custom work in the notes box.</p>
            <select
              id="performed-service"
              value=""
              onChange={(event) => addPerformedService(event.target.value)}
              aria-invalid={Boolean(fieldErrors.services)}
              aria-describedby={fieldErrors.services ? "performed-service-error" : undefined}
              className={`input-style w-full min-w-0 !border-slate-300 !bg-white !text-slate-900 focus:!border-red-600 ${fieldErrors.services ? "!border-red-500 !bg-red-50 ring-1 ring-red-500" : ""}`}
            >
              <option value="">{services.length ? "Choose an existing service" : "No services available — add custom work below"}</option>
              {services.map((service) => <option key={service.id} value={service.name}>{service.name}</option>)}
            </select>
            {services.length === 0 && <p className="mt-2 text-xs text-amber-300">No services available. Add custom service work below.</p>}
            {selectedPerformedServices.length > 0 && (
              <ul className="mt-3 flex min-w-0 flex-wrap gap-2" aria-label="Selected services">
                {selectedPerformedServices.map((service) => (
                  <li key={service.id} className="flex max-w-full items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-950">
                    <span className="min-w-0 break-words">{service.name}</span>
                    <button type="button" onClick={() => removePerformedService(service.name)} aria-label={`Remove ${service.name}`} className="shrink-0 font-bold text-blue-800 hover:text-red-700">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <textarea
              id="performed-custom-work"
              rows={4}
              value={customPerformedText}
              onChange={(e) => updateCustomPerformedText(e.target.value)}
              placeholder="Describe custom service or work performed..."
              aria-label="Custom service name and work performed"
              className={`input-style mt-3 min-h-24 w-full min-w-0 resize-y !border-slate-300 !bg-white !text-slate-900 placeholder:!text-slate-500 focus:!border-red-600 ${fieldErrors.services ? "!border-red-500 !bg-red-50 ring-1 ring-red-500" : ""}`}
            />
          </Field>
        </div>

        {/* PARTS */}
        <div className="parts-used mt-7 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
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
              className="flex shrink-0 items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold"
            >
              <Plus size={15} />
              Add Part
            </button>
          </div>

          <div className="min-w-0 space-y-3">
            {parts.map((part, index) => (
              <div
                key={index}
                className="parts-used-row min-w-0 gap-3 rounded-xl border border-white/10 bg-[#111]/40 p-3 sm:p-4"
              >
                <div className="min-w-0 space-y-1">
                  <label htmlFor={`part-${index}-source`} className="block text-[10px] font-semibold text-gray-500">Part Source</label>
                  <select
                    id={`part-${index}-source`}
                    value={part.inventory_part_id}
                    onChange={(e) => selectInventoryPart(index, e.target.value)}
                    className="input-style w-full min-w-0"
                  >
                    <option value="">Manual part</option>
                    {inventoryParts.map((inventoryPart) => (
                      <option key={inventoryPart.id} value={inventoryPart.id}>
                        {inventoryPart.part_name} {inventoryPart.quantity_in_stock > 0 ? `(${inventoryPart.quantity_in_stock} in stock)` : "(out of stock)"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 space-y-1">
                  <label htmlFor={`part-${index}-name`} className="block text-[10px] font-semibold text-gray-500">Part Name</label>
                  <input
                    id={`part-${index}-name`}
                    placeholder="Part name"
                    value={part.part_name}
                    onChange={(e) =>
                      updatePart(
                        index,
                        "part_name",
                        e.target.value
                      )
                    }
                    aria-invalid={Boolean(fieldErrors[`part-${index}-name`])}
                    aria-describedby={fieldErrors[`part-${index}-name`] ? `part-${index}-name-error` : undefined}
                    className={`input-style w-full min-w-0 ${fieldErrors[`part-${index}-name`] ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
                  />
                  {fieldErrors[`part-${index}-name`] && <p id={`part-${index}-name-error`} className="text-xs font-semibold text-red-500">{fieldErrors[`part-${index}-name`]}</p>}
                </div>

                <div className="min-w-0 space-y-1">
                  <label htmlFor={`part-${index}-number`} className="block text-[10px] font-semibold text-gray-500">Part Number</label>
                  <input
                    id={`part-${index}-number`}
                    placeholder="Part number"
                    value={part.part_number}
                    onChange={(e) =>
                      updatePart(
                        index,
                        "part_number",
                        e.target.value
                      )
                    }
                    className="input-style w-full min-w-0"
                  />
                </div>

                <div className="min-w-0 space-y-1">
                  <label htmlFor={`part-${index}-quantity`} className="block text-[10px] font-semibold text-gray-500">Quantity</label>
                  <input
                    id={`part-${index}-quantity`}
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Qty"
                    value={part.quantity}
                    onChange={(e) =>
                      updatePart(
                        index,
                        "quantity",
                        e.target.value
                      )
                    }
                    aria-invalid={Boolean(fieldErrors[`part-${index}-quantity`])}
                    aria-describedby={fieldErrors[`part-${index}-quantity`] ? `part-${index}-quantity-error` : undefined}
                    className={`input-style w-full min-w-0 ${fieldErrors[`part-${index}-quantity`] ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
                  />
                  {fieldErrors[`part-${index}-quantity`] && <p id={`part-${index}-quantity-error`} className="text-xs font-semibold text-red-500">{fieldErrors[`part-${index}-quantity`]}</p>}
                </div>

                <div className="min-w-0 space-y-1">
                  <label htmlFor={`part-${index}-unit-price`} className="block text-[10px] font-semibold text-gray-500">Unit Price</label>
                  <input
                    id={`part-${index}-unit-price`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit price"
                    value={part.unit_price}
                    onChange={(e) =>
                      updatePart(
                        index,
                        "unit_price",
                        e.target.value
                      )
                    }
                    aria-invalid={Boolean(fieldErrors[`part-${index}-unit-price`])}
                    aria-describedby={fieldErrors[`part-${index}-unit-price`] ? `part-${index}-unit-price-error` : undefined}
                    className={`input-style w-full min-w-0 ${fieldErrors[`part-${index}-unit-price`] ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
                  />
                  {fieldErrors[`part-${index}-unit-price`] && <p id={`part-${index}-unit-price-error`} className="text-xs font-semibold text-red-500">{fieldErrors[`part-${index}-unit-price`]}</p>}
                </div>

                <div className="flex min-w-0 items-center justify-start xl:justify-center">
                  <span className="max-w-full truncate rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                    {part.inventory_part_id ? "Linked" : "Manual"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    removePart(index)
                  }
                  aria-label={`Remove part ${index + 1}`}
                  className="flex min-h-11 min-w-11 items-center justify-center justify-self-start rounded-lg border border-white/10 p-3 text-gray-400 hover:border-red-900/60 hover:text-red-500 xl:justify-self-center"
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
            id="labour-cost"
            value={labourCost}
            error={fieldErrors["labour-cost"]}
            onChange={(value) => { setLabourCost(value); if (!value || Number(value) >= 0) clearFieldError("labour-cost"); }}
          />

          <InfoBox
            label="Parts Total"
            value={`LKR ${partsTotal.toLocaleString()}`}
          />

          <CostInput
            label="Additional Cost"
            id="additional-cost"
            value={additionalCost}
            error={fieldErrors["additional-cost"]}
            onChange={(value) => { setAdditionalCost(value); if (!value || Number(value) >= 0) clearFieldError("additional-cost"); }}
          />

          <CostInput
            label="Discount"
            id="discount"
            value={discount}
            error={fieldErrors.discount}
            onChange={(value) => { setDiscount(value); if (!value || Number(value) >= 0) clearFieldError("discount"); }}
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
      {createdInvoiceRecord && (
        <ServiceInvoiceModal
          record={createdInvoiceRecord}
          customer={profiles.find((profile) => profile.id === createdInvoiceRecord.user_id)}
          vehicle={vehicles.find((vehicle) => vehicle.id === createdInvoiceRecord.vehicle_id)}
          booking={bookings.find((booking) => booking.id === createdInvoiceRecord.booking_id)}
          parts={createdInvoiceParts}
          invoiceNumber={`CKI-${createdInvoiceRecord.service_date.replaceAll("-", "")}-${createdInvoiceRecord.id.slice(0, 6).toUpperCase()}`}
          preparedBy={createdInvoicePreparedBy}
          close={() => setCreatedInvoiceRecord(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
  htmlFor,
  required = false,
  error,
}: {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-semibold text-gray-400">
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </label>

      {children}
      {error && <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1 text-xs font-semibold text-red-500">{error}</p>}
    </div>
  );
}

function CustomerDetail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-gray-200">{value?.trim() || "—"}</dd>
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
  id,
  value,
  onChange,
  error,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <input
        id={id}
        type="number"
        min="0"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="0"
        className={`input-style w-full min-w-0 ${error ? "!border-red-500 !bg-red-50 !text-red-950 ring-1 ring-red-500" : ""}`}
      />
    </Field>
  );
}