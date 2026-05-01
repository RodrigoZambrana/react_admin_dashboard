SELECT setval(
  pg_get_serial_sequence('"ProductImage"', 'id'),
  COALESCE((SELECT MAX("id") FROM "ProductImage"), 1),
  true
);
