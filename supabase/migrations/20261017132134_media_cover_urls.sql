-- Covers are administrative metadata; TV playback does not request or decode them.
alter table public.media_metadata add column cover_url text not null default ''
 check (cover_url = '' or (length(cover_url) <= 2048 and cover_url ~ '^https://[^[:space:]@]+$'));
alter table public.advertisements add column cover_url text not null default ''
 check (cover_url = '' or (length(cover_url) <= 2048 and cover_url ~ '^https://[^[:space:]@]+$'));
