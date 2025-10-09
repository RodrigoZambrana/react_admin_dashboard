"use client";
import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

type CityRow = {
  country_name?: string;
  name?: string; // nombre de la ciudad
  // ... otros campos del CSV son ignorados
};

type CitySelectProps = {
  countryCode?: string;      // no lo usamos para filtrar, pero lo mantenemos por compat
  countryName?: string;      // ← usamos ESTE para filtrar (country_name)
  value?: string;            // ciudad seleccionada (name)
  onChange?: (cityName: string) => void;
  placeholder?: string;
  csvUrl?: string;           // opcional, por defecto "/data/cities.csv"
  disabled?: boolean;
  className?: string;
};

export default function CitySelect({
  countryCode: _countryCode,
  countryName,
  value,
  onChange,
  placeholder = "Selecciona una ciudad",
  csvUrl = "/data/cities.csv",
  disabled,
  className,
}: CitySelectProps) {
  const [rows, setRows] = useState<CityRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Carga única del CSV
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(csvUrl, { cache: "force-cache" });
        if (!res.ok) throw new Error(`No se pudo cargar CSV: ${res.status}`);
        const text = await res.text();

        const parsed = Papa.parse<CityRow>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });

        if (parsed.errors?.length) {
          // No bloqueamos por warnings menores, pero puedes endurecer la validación
          // console.warn(parsed.errors);
        }

        if (alive) setRows(parsed.data);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Error leyendo CSV");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [csvUrl]);

  // Filtrado por país (country_name)
  const citiesForCountry = useMemo(() => {
    if (!rows || !countryName) return [];
    const filtered = rows.filter(
      r => (r.country_name ?? "").toLowerCase() === countryName.toLowerCase()
    );

    // Deduplicar por nombre de ciudad
    const seen = new Set<string>();
    const unique = [];
    for (const r of filtered) {
      const city = (r.name ?? "").trim();
      if (!city || seen.has(city.toLowerCase())) continue;
      seen.add(city.toLowerCase());
      unique.push(city);
    }

    // Orden alfabético
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [rows, countryName]);

  const isDisabled = disabled || !countryName || loading || !!err;

  return (
    <select
      className={className ?? "w-full rounded-2xl border px-3 py-2 shadow-sm disabled:opacity-60"}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={isDisabled}
    >
      <option value="">
        {loading ? "Cargando ciudades…" : err ? "Error al cargar" : (placeholder || "Selecciona una ciudad")}
      </option>
      {citiesForCountry.map((city) => (
        <option key={city} value={city}>{city}</option>
      ))}
    </select>
  );
}
