ALTER TABLE "Order"
ADD COLUMN "shippingDepartment" TEXT,
ADD COLUMN "shippingNeighborhood" TEXT,
ADD COLUMN "billingDepartment" TEXT,
ADD COLUMN "billingNeighborhood" TEXT;

ALTER TABLE "CustomerAddress"
ADD COLUMN "department" TEXT,
ADD COLUMN "neighborhood" TEXT;

UPDATE "Order"
SET "shippingDepartment" = COALESCE(
  NULLIF("shippingDepartment", ''),
  NULLIF("shippingState", ''),
  CASE
    WHEN "shippingCity" IN (
      'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida',
      'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha',
      'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres'
    ) THEN "shippingCity"
    ELSE NULL
  END
)
WHERE "shippingDepartment" IS NULL;

UPDATE "Order"
SET "billingDepartment" = COALESCE(
  NULLIF("billingDepartment", ''),
  NULLIF("billingState", ''),
  CASE
    WHEN "billingCity" IN (
      'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida',
      'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha',
      'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres'
    ) THEN "billingCity"
    ELSE NULL
  END
)
WHERE "billingDepartment" IS NULL;

UPDATE "CustomerAddress"
SET "department" = COALESCE(
  NULLIF("department", ''),
  CASE
    WHEN "city" IN (
      'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida',
      'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha',
      'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres'
    ) THEN "city"
    ELSE NULL
  END
)
WHERE "department" IS NULL;
