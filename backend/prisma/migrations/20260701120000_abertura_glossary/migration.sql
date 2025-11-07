-- Create table to store normalized openings glossary entries
CREATE TABLE "abertura_glossary_items" (
    "id" SERIAL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "adjustPct" DECIMAL(8, 3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "abertura_glossary_category_label"
    ON "abertura_glossary_items" ("category", "label");

CREATE INDEX "AberturaGlossaryItem_category_idx"
    ON "abertura_glossary_items" ("category");
