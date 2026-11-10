-- No-refund policy: customers can ask for a replacement (exchange) or a repair of wrong/faulty items.
alter table public.return_requests drop constraint if exists return_requests_resolution_check;
alter table public.return_requests add constraint return_requests_resolution_check
  check (resolution in ('refund','exchange','store_credit','repair'));
alter table public.return_requests alter column resolution set default 'exchange';
