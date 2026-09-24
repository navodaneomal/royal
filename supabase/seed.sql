-- Seed the two launch stories into the catalog tables.
insert into public.stories (id, slug, title, tagline, visibility)
values
  ('6f9f2c6a-3d5e-4b1c-9a52-1f4be8a30d17', 'the-tulip-and-the-jester', 'The Tulip & The Jester', 'A story that was never meant to be remembered.', 'public'),
  ('2b4dfd0e-91c8-45c0-8a3e-6f0a5cf6f2aa', 'neon-horizon', 'Neon Horizon', 'A dead relay station. A live signal.', 'public')
on conflict (id) do nothing;
