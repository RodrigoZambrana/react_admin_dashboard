export const URUGUAY_COUNTRY_NAME = "Uruguay";
export const URUGUAY_COUNTRY_CODE = "UY";
export const DEFAULT_URUGUAY_DEPARTMENT = "Montevideo";
export const DEFAULT_URUGUAY_CITY = "Montevideo";

export const URUGUAY_DEPARTMENTS = [
  "Artigas",
  "Canelones",
  "Cerro Largo",
  "Colonia",
  "Durazno",
  "Flores",
  "Florida",
  "Lavalleja",
  "Maldonado",
  "Montevideo",
  "Paysandú",
  "Río Negro",
  "Rivera",
  "Rocha",
  "Salto",
  "San José",
  "Soriano",
  "Tacuarembó",
  "Treinta y Tres"
] as const;

export const URUGUAY_DEFAULT_CITY_BY_DEPARTMENT: Record<string, string> = {
  Artigas: "Artigas",
  Canelones: "Canelones",
  "Cerro Largo": "Melo",
  Colonia: "Colonia del Sacramento",
  Durazno: "Durazno",
  Flores: "Trinidad",
  Florida: "Florida",
  Lavalleja: "Minas",
  Maldonado: "Maldonado",
  Montevideo: "Montevideo",
  Paysandú: "Paysandú",
  "Río Negro": "Fray Bentos",
  Rivera: "Rivera",
  Rocha: "Rocha",
  Salto: "Salto",
  "San José": "San José de Mayo",
  Soriano: "Mercedes",
  Tacuarembó: "Tacuarembó",
  "Treinta y Tres": "Treinta y Tres"
};

export const URUGUAY_CITIES_BY_DEPARTMENT: Record<string, string[]> = {
  Artigas: ["Artigas", "Bella Unión"],
  Canelones: ["Canelones", "Las Piedras", "Pando", "Ciudad de la Costa", "Santa Lucía"],
  "Cerro Largo": ["Melo", "Río Branco"],
  Colonia: ["Colonia del Sacramento", "Carmelo", "Juan Lacaze", "Nueva Helvecia", "Rosario"],
  Durazno: ["Durazno", "Sarandí del Yí"],
  Flores: ["Trinidad", "Ismael Cortinas"],
  Florida: ["Florida", "Sarandí Grande"],
  Lavalleja: ["Minas", "José Pedro Varela"],
  Maldonado: ["Maldonado", "Punta del Este", "San Carlos", "Piriápolis"],
  Montevideo: ["Montevideo"],
  Paysandú: ["Paysandú", "Guichón"],
  "Río Negro": ["Fray Bentos", "Young"],
  Rivera: ["Rivera", "Tranqueras"],
  Rocha: ["Rocha", "Chuy", "La Paloma", "Castillos"],
  Salto: ["Salto", "Villa Constitución"],
  "San José": ["San José de Mayo", "Ciudad del Plata", "Libertad"],
  Soriano: ["Mercedes", "Dolores", "Cardona"],
  Tacuarembó: ["Tacuarembó", "Paso de los Toros"],
  "Treinta y Tres": ["Treinta y Tres", "Vergara"]
};

export const MONTEVIDEO_NEIGHBORHOODS = [
  "Aguada",
  "Aires Puros",
  "Atahualpa",
  "Bella Italia",
  "Belvedere",
  "Brazo Oriental",
  "Buceo",
  "Carrasco",
  "Carrasco Norte",
  "Casabó",
  "Casavalle",
  "Centro",
  "Cerrito",
  "Cerro",
  "Ciudad Vieja",
  "Colón Centro y Noroeste",
  "Colón Sureste, Abayubá",
  "Conciliación",
  "Cordón",
  "Flor de Maroñas",
  "Goes",
  "Ituzaingó",
  "Jacinto Vera",
  "Jardines del Hipódromo",
  "La Blanqueada",
  "La Comercial",
  "La Figurita",
  "La Paloma - Tomkinson",
  "La Teja",
  "Larrañaga",
  "Las Acacias",
  "Lezica, Melilla",
  "Malvín",
  "Malvín Norte",
  "Manga",
  "Marconi",
  "Mercado Modelo y Bolívar",
  "Nuevo París",
  "Palermo",
  "Parque Batlle",
  "Parque Guaraní",
  "Parque Rodó",
  "Paso de la Arena",
  "Paso de las Duranas",
  "Peñarol, Lavalleja",
  "Pérez Castellanos",
  "Piedras Blancas",
  "Pocitos",
  "Pocitos Nuevo",
  "Prado, Nueva Savona",
  "Punta Carretas",
  "Punta de Rieles, Bella Italia",
  "Punta Gorda",
  "Reducto",
  "Sayago",
  "Tres Cruces",
  "Tres Ombúes, Pueblo Victoria",
  "Unión",
  "Villa Dolores",
  "Villa Española",
  "Villa García, Manga Rural",
  "Villa Muñoz, Retiro",
  "Villa del Cerro"
] as const;

const normalizeKey = (value?: string | null) => (value ?? "").trim().toLowerCase();

export const getDefaultCityForDepartment = (department?: string | null) => {
  const normalizedDepartment = (department ?? "").trim();
  return (
    URUGUAY_DEFAULT_CITY_BY_DEPARTMENT[normalizedDepartment] ??
    DEFAULT_URUGUAY_CITY
  );
};

export const getCitiesForDepartment = (department?: string | null) => {
  const normalizedDepartment = (department ?? "").trim();
  return URUGUAY_CITIES_BY_DEPARTMENT[normalizedDepartment] ?? [];
};

export const usesMontevideoNeighborhoods = (department?: string | null, city?: string | null) =>
  normalizeKey(department) === "montevideo" && normalizeKey(city) === "montevideo";
