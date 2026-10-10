-- Optional helper: mark existing heavy services as confirmation-only.
-- Safe additive update; does not delete anything.

update public.services
set
  workload_weight = greatest(coalesce(workload_weight, 1), 4),
  requires_confirmation = true
where
  lower(name) like '%engine repair%'
  or lower(name) like '%engine overhaul%'
  or lower(name) like '%gearbox%'
  or lower(name) like '%transmission repair%'
  or lower(name) like '%major engine%';

select id, name, workload_weight, requires_confirmation
from public.services
where requires_confirmation = true
order by name;
