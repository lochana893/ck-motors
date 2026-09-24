create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  technician_name text,
  mileage integer,
  service_date date not null default current_date,
  services_performed text not null,
  labour_cost numeric(12,2) not null default 0,
  parts_cost numeric(12,2) not null default 0,
  additional_cost numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  technician_notes text,
  recommended_repairs text,
  next_service_date date,
  next_service_mileage integer,
  created_at timestamptz not null default now()
);

create table if not exists public.service_parts (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.service_records(id) on delete cascade,
  inventory_part_id uuid null references public.inventory_parts(id) on delete set null,
  part_name text not null,
  part_number text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_records_user_idx on public.service_records (user_id, service_date desc);
create index if not exists service_records_booking_idx on public.service_records (booking_id);
create index if not exists service_parts_record_idx on public.service_parts (service_record_id);

alter table public.service_records enable row level security;
alter table public.service_parts enable row level security;

create policy "Admin and staff manage service records"
  on public.service_records for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
    or user_id = auth.uid()
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
    or user_id = auth.uid()
  );

create policy "Users can view their service parts"
  on public.service_parts for select
  to authenticated
  using (
    exists (
      select 1
      from public.service_records sr
      where sr.id = service_record_id
        and (sr.user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'staff')
        ))
    )
  );

create policy "Admin and staff manage service parts"
  on public.service_parts for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
    or exists (
      select 1
      from public.service_records sr
      where sr.id = service_record_id and sr.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
    or exists (
      select 1
      from public.service_records sr
      where sr.id = service_record_id and sr.user_id = auth.uid()
    )
  );

create or replace function public.set_service_record_total()
returns trigger
language plpgsql
as $$
begin
  new.total_cost = coalesce(new.labour_cost, 0) + coalesce(new.parts_cost, 0) + coalesce(new.additional_cost, 0) - coalesce(new.discount, 0);

  if new.total_cost < 0 then
    new.total_cost = 0;
  end if;

  return new;
end;
$$;

create trigger service_records_total_cost
before insert or update on public.service_records
for each row
execute function public.set_service_record_total();

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

  insert into public.service_records (
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
  ) returning id into new_record_id;

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
      select * into selected_part
      from public.inventory_parts
      where id = inventory_part_id
      for update;

      if not found then
        raise exception 'Inventory part not found for %', part_name;
      end if;

      if selected_part.quantity_in_stock < requested_quantity then
        raise exception 'Insufficient inventory stock for %', selected_part.part_name;
      end if;

      update public.inventory_parts
      set quantity_in_stock = quantity_in_stock - requested_quantity,
          updated_at = now()
      where id = inventory_part_id;

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
    select total_cost
    from public.service_records
    where id = new_record_id
  );
end;
$$;

create policy "Users can create service records"
  on public.service_records for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
    or user_id = auth.uid()
  );

create policy "Users can read their service records"
  on public.service_records for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  );
