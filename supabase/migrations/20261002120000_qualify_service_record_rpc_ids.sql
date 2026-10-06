create or replace function public.create_service_record_with_parts(
  record_data jsonb,
  parts jsonb
)
returns table (id uuid, total_cost numeric(12,2))
language plpgsql
as $$
declare
  new_record_id uuid;
  part_item jsonb;
  selected_part record;
  inventory_part_id uuid;
  part_name text;
  part_number text;
  requested_quantity integer;
  unit_price numeric(12,2);
  record_user_id uuid;
  record_vehicle_id uuid;
  record_booking_id uuid;
  record_service_date date;
  record_services_performed text;
  record_labour_cost numeric(12,2);
  record_parts_cost numeric(12,2);
  record_additional_cost numeric(12,2);
  record_discount numeric(12,2);
  record_technician_name text;
  record_mileage integer;
  record_technician_notes text;
  record_recommended_repairs text;
  record_next_service_date date;
  record_next_service_mileage integer;
begin
  record_user_id := (record_data->>'user_id')::uuid;
  record_vehicle_id := (record_data->>'vehicle_id')::uuid;
  record_booking_id := case when nullif(record_data->>'booking_id', '') is null then null else (record_data->>'booking_id')::uuid end;
  record_service_date := case when nullif(record_data->>'service_date', '') is null then current_date else (record_data->>'service_date')::date end;
  record_services_performed := record_data->>'services_performed';
  record_labour_cost := case when nullif(record_data->>'labour_cost', '') is null then 0 else (record_data->>'labour_cost')::numeric end;
  record_parts_cost := case when nullif(record_data->>'parts_cost', '') is null then 0 else (record_data->>'parts_cost')::numeric end;
  record_additional_cost := case when nullif(record_data->>'additional_cost', '') is null then 0 else (record_data->>'additional_cost')::numeric end;
  record_discount := case when nullif(record_data->>'discount', '') is null then 0 else (record_data->>'discount')::numeric end;
  record_technician_name := nullif(record_data->>'technician_name', '');
  record_mileage := case when nullif(record_data->>'mileage', '') is null then null else (record_data->>'mileage')::integer end;
  record_technician_notes := nullif(record_data->>'technician_notes', '');
  record_recommended_repairs := nullif(record_data->>'recommended_repairs', '');
  record_next_service_date := case when nullif(record_data->>'next_service_date', '') is null then null else (record_data->>'next_service_date')::date end;
  record_next_service_mileage := case when nullif(record_data->>'next_service_mileage', '') is null then null else (record_data->>'next_service_mileage')::integer end;

  insert into public.service_records as sr (
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
    technician_notes,
    recommended_repairs,
    next_service_date,
    next_service_mileage
  ) values (
    record_booking_id,
    record_user_id,
    record_vehicle_id,
    record_technician_name,
    record_mileage,
    record_service_date,
    record_services_performed,
    record_labour_cost,
    record_parts_cost,
    record_additional_cost,
    record_discount,
    record_technician_notes,
    record_recommended_repairs,
    record_next_service_date,
    record_next_service_mileage
  ) returning sr.id into new_record_id;

  for part_item in select * from jsonb_array_elements(coalesce(parts, '[]'::jsonb))
  loop
    inventory_part_id := case when nullif(part_item->>'inventory_part_id', '') is null then null else (part_item->>'inventory_part_id')::uuid end;
    part_name := part_item->>'part_name';
    part_number := nullif(part_item->>'part_number', '');
    requested_quantity := case when nullif(part_item->>'quantity', '') is null then 0 else (part_item->>'quantity')::integer end;
    unit_price := case when nullif(part_item->>'unit_price', '') is null then 0 else (part_item->>'unit_price')::numeric end;

    if part_name is null or btrim(part_name) = '' then
      continue;
    end if;

    if requested_quantity <= 0 then
      raise exception 'Part quantity must be greater than zero for %', part_name;
    end if;

    if inventory_part_id is not null then
      select ip.* into selected_part
      from public.inventory_parts as ip
      where ip.id = inventory_part_id
      for update;

      if not found then
        raise exception 'Inventory part not found for %', part_name;
      end if;

      if selected_part.quantity_in_stock < requested_quantity then
        raise exception 'Insufficient inventory stock for %', selected_part.part_name;
      end if;

      update public.inventory_parts as ip
      set quantity_in_stock = quantity_in_stock - requested_quantity,
          updated_at = now()
      where ip.id = inventory_part_id;

      insert into public.stock_movements (
        inventory_part_id,
        movement_type,
        quantity,
        quantity_before,
        quantity_after,
        service_record_id,
        notes,
        created_by
      ) values (
        inventory_part_id,
        'service_usage',
        requested_quantity,
        selected_part.quantity_in_stock,
        selected_part.quantity_in_stock - requested_quantity,
        new_record_id,
        'Consumed during service record creation',
        auth.uid()
      );
    end if;

    insert into public.service_parts (
      service_record_id,
      inventory_part_id,
      part_name,
      part_number,
      quantity,
      unit_price
    ) values (
      new_record_id,
      inventory_part_id,
      part_name,
      part_number,
      requested_quantity,
      unit_price
    );
  end loop;

  return query
  select new_record_id, (
    select sr.total_cost
    from public.service_records as sr
    where sr.id = new_record_id
  );
end;
$$;
