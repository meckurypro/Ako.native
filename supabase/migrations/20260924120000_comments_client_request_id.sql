-- Idempotency key for comment creation. The mobile outbox generates one id per comment queued while
-- offline and sends it on every attempt, so a retry after a timed-out-but-successful request returns
-- the existing comment instead of posting a second copy. Nullable: web, online mobile sends and older
-- app builds don't send one and behave exactly as before.
--
-- Apply this BEFORE deploying the updated create-comment function: it inserts and looks up by this column.
alter table public.comments add column if not exists client_request_id uuid;

create unique index if not exists comments_author_client_request_id_key
  on public.comments (author_id, client_request_id)
  where client_request_id is not null;
