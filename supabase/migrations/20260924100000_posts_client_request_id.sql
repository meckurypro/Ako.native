-- Idempotency key for post creation. The mobile outbox generates one id per queued post (and the
-- composer one per publish attempt) and sends it on every attempt, so a retry after a
-- timed-out-but-successful request returns the existing post instead of publishing a second copy.
-- Nullable: web and older app builds don't send one and behave exactly as before.
--
-- Apply this BEFORE deploying the updated create-post / create-page-post functions: they insert
-- and look up by this column.
alter table public.posts add column if not exists client_request_id uuid;

create unique index if not exists posts_author_client_request_id_key
  on public.posts (author_id, client_request_id)
  where client_request_id is not null;
