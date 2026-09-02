-- Seed uses fractional ordering (e.g. 6.1 for inserted phases). Allow decimals.
alter table public.roadmap_items alter column sort_order type numeric(10,3) using sort_order::numeric;
alter table public.course_units  alter column sort_order type numeric(10,3) using sort_order::numeric;
alter table public.modules       alter column sort_order type numeric(10,3) using sort_order::numeric;
alter table public.milestones    alter column sort_order type numeric(10,3) using sort_order::numeric;
alter table public.projects      alter column sort_order type numeric(10,3) using sort_order::numeric;
