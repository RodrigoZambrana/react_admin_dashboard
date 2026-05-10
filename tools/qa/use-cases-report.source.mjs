export const reportMeta = {
  title: "Sistema - Casos de uso detallados",
  generatedAt: "2026-05-09",
  baselineCommit: "62fafc58",
  updateCommand: "node tools/qa/generate-use-cases-report.mjs",
  notes:
    "Contrato vivo del sistema: VERIFICADA = corrida/paso validado con evidencia ejecutable; DEFINIDA = existe cobertura alineada pero no rerun cerrado o la evidencia actual no alcanza el nuevo gate; PENDIENTE = no existe prueba automatizada suficiente todavía. La hoja Contrato vivo normaliza tipo, inputs, outputs, sistemas involucrados, dependencias, estado y trazabilidad. La hoja Hallazgos queda como registro de errores con clasificación obligatoria. Para este proceso se excluye Chat Platform y cualquier chat automatizado con IA del gate core. La revisión 2026-05-09 endurece la gobernanza del workbook: baja a DEFINIDA las filas sostenidas solo por documentación, código fuente, globs o evidencia deferred, y deja el verde reservado para pruebas o artefactos ejecutables verificables.",
};

const c = (
  id,
  functionality,
  useCase,
  coverage,
  preconditions,
  trigger,
  expected,
  status,
  evidence,
  nextAction,
  lastValidated = "",
) => ({
  id,
  functionality,
  useCase,
  coverage,
  preconditions,
  trigger,
  expected,
  status,
  evidence,
  nextAction,
  lastValidated,
});

export const contractHeaders = [
  "ID",
  "Tipo",
  "Descripción",
  "Comportamiento esperado",
  "Inputs",
  "Outputs",
  "Sistemas involucrados",
  "Dependencias",
  "Estado",
  "Última validación",
  "Notas / edge cases",
  "Trazabilidad",
  "Clasificación de hallazgo",
];

export const findingsHeaders = [
  "ID",
  "Tipo",
  "Sistema afectado",
  "Flujo impactado",
  "Pasos de reproducción",
  "Severidad",
  "Estado",
  "Caso / documento vinculado",
  "Notas",
];

const currentRunFindings = [
  {
    ID: "QA-ECOM-VITEST-001",
    Tipo: "deuda técnica",
    "Sistema afectado": "frontend",
    "Flujo impactado": "helpers storefront/SEO y render de contenido CMS",
    "Pasos de reproducción": "Ejecutar `cd ecommerce && npx vitest run` con la configuración actual del repo.",
    Severidad: "media",
    Estado: "open",
    "Caso / documento vinculado":
      "ecommerce/src/lib/page-metadata.spec.ts; ecommerce/src/lib/seo/robots.spec.ts; ecommerce/src/lib/seo/sitemap.spec.ts; ecommerce/src/lib/seo/public-pricing.spec.ts; ecommerce/src/lib/seo/structured-data.spec.ts; ecommerce/src/lib/analytics/eventSchema.spec.ts; ecommerce/src/components/cms/rich-text.spec.ts",
    Notas:
      "Las suites fallan antes de llegar a las aserciones con un error de lectura sobre `config`; hay que normalizar el setup de vitest o corregir la dependencia que asume un entorno distinto.",
  },
  {
    ID: "QA-ECOM-ADMIN-AI-001",
    Tipo: "bug funcional",
    "Sistema afectado": "frontend",
    "Flujo impactado": "admin AI settings / knowledge management",
    "Pasos de reproducción": "Ejecutar `cd ecommerce && npx playwright test --workers=1 e2e/admin-ai-settings.spec.ts`.",
    Severidad: "alta",
    Estado: "open",
    "Caso / documento vinculado": "ecommerce/e2e/admin-ai-settings.spec.ts",
    Notas:
      "La corrida quedó fallando en navegación a runtime settings, creación/reindexado de knowledge y pantallas de documentos; requiere validación funcional antes de cerrar manuales.",
  },
];

function compactJoin(values, separator = "; ") {
  return values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean)
    .join(separator);
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeHintText(value) {
  return value == null ? "" : String(value).toLowerCase();
}

function inferContractType(section, item) {
  const text = normalizeHintText(
    [section.project, section.sheetName, item.functionality, item.coverage, item.useCase, item.evidence].join(" "),
  );

  if (/(event|evento|tracking|analytics|ga4|metric|data quality)/.test(text)) {
    return "evento";
  }

  if (/(endpoint|api|dto|controller|webhook|route|request|response|contract)/.test(text)) {
    return "endpoint";
  }

  if (/(e2e|ui|flow|flujo|checkout|login|register|cart|home|product|order|inbox|mail|conversation|webchat|whatsapp|meta)/.test(text)) {
    return "flujo";
  }

  return "feature";
}

function inferSystemsInvolved(section, item) {
  const text = normalizeHintText(
    [section.project, section.sheetName, item.functionality, item.coverage, item.useCase, item.evidence, item.preconditions, item.trigger, item.expected].join(" "),
  );

  const systems = [];
  if (/(analytics|tracking|ga4|metric|event|data quality|parity)/.test(text)) {
    systems.push("analytics");
  }

  if (/(frontend\/src|ecommerce\/src|frontend\/|ui|e2e|view|page|component|tsx|html|storefront|admin)/.test(text) || ["Ecommerce", "Admin", "Cross-project"].includes(section.project)) {
    systems.push("frontend");
  }

  if (/(backend\/src|service|controller|dto|api|webhook|prisma|db|inbox\.service|storefront\.service|auth\.dto|channel-control|ai-platform|channel-adapter)/.test(text) || ["Ecommerce", "Admin", "Chat Platform", "Cross-project", "Security"].includes(section.project)) {
    systems.push("backend");
  }

  if (/(mercado pago|google oauth|meta|whatsapp|facebook|instagram|email|imap|smtp|external|provider|payment|ship|google|whatsapp-qr)/.test(text)) {
    systems.push("externos");
  }

  const resolved = uniqueList(systems);
  if (resolved.length > 0) {
    return resolved.join(", ");
  }

  if (/analytics|tracking|event/.test(text)) {
    return "analytics";
  }

  return "backend";
}

function inferDependencies(item) {
  return compactJoin(
    uniqueList([
      item.preconditions,
      item.coverage,
      item.evidence,
      item.nextAction && item.nextAction !== "Mantener" ? item.nextAction : "",
    ]),
  );
}

function inferTraceability(item) {
  return compactJoin([item.evidence]);
}

function inferContractState(item) {
  return item.status === "VERIFICADA" ? "valid" : "pending";
}

function inferNotes(item) {
  return compactJoin([item.nextAction, item.lastValidated ? `Última validación: ${item.lastValidated}` : ""]);
}

function inferInputSummary(item) {
  return compactJoin([item.preconditions, item.trigger], " | ");
}

function inferOutputSummary(item) {
  return compactJoin([item.expected]);
}

export function buildContractRows() {
  return reportSections.flatMap((section) =>
    (section.sheetName === "Chat Platform" || normalizeHintText(section.project) === "chat platform" ? [] : section.cases).map((item) => ({
      ID: item.id,
      Tipo: inferContractType(section, item),
      Descripción: item.useCase,
      "Comportamiento esperado": item.expected,
      Inputs: inferInputSummary(item),
      Outputs: inferOutputSummary(item),
      "Sistemas involucrados": inferSystemsInvolved(section, item),
      Dependencias: inferDependencies(item),
      Estado: inferContractState(item),
      "Última validación": item.lastValidated || "",
      "Notas / edge cases": inferNotes(item),
      Trazabilidad: inferTraceability(item),
      "Clasificación de hallazgo": "",
    })),
  );
}

export function buildFindingTemplateRows() {
  return [
    ...currentRunFindings,
    {
      ID: "",
      Tipo: "bug funcional | inconsistencia entre servicios | desalineación con documento | gap funcional | deuda técnica",
      "Sistema afectado": "",
      "Flujo impactado": "",
      "Pasos de reproducción": "",
      Severidad: "crítica | media | baja",
      Estado: "open | in_progress | fixed | validated",
      "Caso / documento vinculado": "",
      Notas: "Registrar evidencia, impacto cruzado y decisión de documentación. Completar una fila por hallazgo real.",
    },
  ];
}

export const reportSections = [
  {
    sheetName: "Ecommerce",
    project: "Ecommerce",
    cases: [
      c("ECOM-HOME-001", "Home/SEO", "Cargar home con historias y contenido editorial real", "E2E/UI", "Backend storefront activo y contenido base del sitio publicado", "Abrir / en storefront", "El home muestra historias, bloques editoriales y contenido comercial vigente sin templates demo", "VERIFICADA", "ecommerce/e2e/home-stories.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-HOME-002", "SEO", "Exponer metadata real por ruta pública", "UI/E2E", "Sitio levantado con contenido publicado", "Navegar a home, tienda, producto y blog", "Cada página relevante expone título, descripción y distribución de contenido consistente con SEO base", "VERIFICADA", "ecommerce/e2e/seo-metadata.spec.ts; ecommerce/src/lib/page-metadata.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CATALOG-001", "Catálogo", "Listar productos publicados en tienda", "E2E/API", "Catálogo cargado desde base o snapshot activo", "Abrir /products o /shop", "Se ven productos reales, categorías y ordenamiento base", "DEFINIDA", "ecommerce/e2e/ecommerce-readiness.spec.ts; ecommerce/e2e/commerce-critical.spec.ts", "Revalidar con `commerce-critical.spec.ts` y reemplazar la cobertura de `ecommerce-readiness.spec.ts` cuando vuelva a ser ejecutable.", "2026-04-27"),
      c("ECOM-CATALOG-002", "Catálogo", "Navegar categorías reales desde home", "UI/E2E", "Categorías publicadas en storefront", "Abrir navegación de categorías y seleccionar una categoría", "La navegación filtra productos y mantiene el contexto de categoría", "DEFINIDA", "ecommerce/e2e/ecommerce-readiness.spec.ts; ecommerce/e2e/commerce-critical.spec.ts", "Revalidar con `commerce-critical.spec.ts` y reemplazar la cobertura de `ecommerce-readiness.spec.ts` cuando vuelva a ser ejecutable.", "2026-04-27"),
      c("ECOM-SEARCH-001", "Búsqueda", "Buscar con resultados visibles y navegar al producto correcto", "UI/E2E", "Buscador activo y catálogo con coincidencias", "Buscar una palabra que devuelva resultados y abrir un resultado", "La búsqueda lista resultados reales, permite abrir el PDP y conserva el contexto de búsqueda", "DEFINIDA", "ecommerce/src/components/search-box/SearchInputWithCategory.tsx; ecommerce/src/app/product/search/[slug]/SearchResult.tsx; ecommerce/src/app/shop/components/ShopSearchIntelligence.tsx", "Ejecutar manualmente en desktop y mobile; validar navegación y tracking", ""),
      c("ECOM-SEARCH-002", "Búsqueda", "Buscar sin resultados y mostrar salida útil", "UI/E2E", "Buscador activo", "Buscar una cadena sin coincidencias", "La pantalla no queda vacía: muestra empty state, sugerencias o fallback al catálogo", "DEFINIDA", "ecommerce/src/components/search-box/SearchInputWithCategory.tsx; ecommerce/src/app/product/search/[slug]/SearchResult.tsx; ecommerce/src/app/shop/components/ShopSearchIntelligence.tsx", "Validar empty state, copy y CTA de salida a catálogo", ""),
      c("ECOM-PROD-001", "Producto", "Abrir detalle de producto simple", "E2E", "Producto simple publicado", "Abrir /product/:slug", "Se muestra nombre, precio, imágenes y CTA de compra", "DEFINIDA", "ecommerce/e2e/ecommerce-readiness.spec.ts; ecommerce/e2e/commerce-critical.spec.ts", "Revalidar con `commerce-critical.spec.ts`; la cobertura de `ecommerce-readiness.spec.ts` quedó temporalmente degradada por `test.skip`.", "2026-04-27"),
      c("ECOM-PROD-002", "Producto", "Abrir detalle de producto variable y elegir variante", "E2E", "Producto variable publicado con variantes", "Abrir detalle y cambiar atributos", "La variante elegida recalcula precio, stock y media correctamente", "VERIFICADA", "ecommerce/e2e/commerce-critical.spec.ts", "Manual /product/qa-var-003 revisitado en corrida exploratoria; evidencia manual histórica preservada en notas.", "2026-04-27"),
      c("ECOM-PROD-003", "Producto paramétrico", "Abrir producto paramétrico con matriz de aberturas", "E2E", "Matriz paramétrica disponible", "Abrir producto paramétrico y validar configuración", "El producto muestra configurador y evita agregar configuraciones incompletas", "VERIFICADA", "backend/src/storefront/storefront.service.ts; ecommerce/e2e/commerce-critical.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CAN-001", "Canónicas", "Resolver slug canónico monoblock con su configuración correcta", "E2E/UI", "Producto canónico publicado y configuración base disponible", "Abrir el slug canónico monoblock y recorrer PDP", "La ruta resuelve la canónica correcta, conserva canonicalConfiguration y el PDP no cae en fallback incorrecto", "DEFINIDA", "ecommerce/src/app/[slug]/page.tsx; ecommerce/src/lib/page-metadata.ts; ecommerce/src/lib/analytics/product-context.ts; backend/src/storefront/storefront.service.ts", "Validar resolución de slug, canonical metadata y handoff PDP → carrito", ""),
      c("ECOM-ANL-001", "Analytics", "Emitir page_view y view_item con contexto estructural completo", "E2E/UX", "Storefront cargado con analytics activo", "Abrir home, PDP y verificar el evento en navegador", "Cada vista crítica emite event_name correcto, page_type, component_id y metadata canónica sin campos rotos", "DEFINIDA", "ecommerce/src/lib/analytics/eventSchema.ts; ecommerce/src/components/seo/ProductViewAnalytics.tsx; ecommerce/e2e/purchase-success.spec.ts; ecommerce/e2e/begin-checkout.spec.ts", "Validar page_view/view_item en home, PDP y checkout", ""),
      c("ECOM-ANL-002", "Analytics", "Emitir add_to_cart, begin_checkout y purchase con CTA y schema válidos", "E2E/API", "Carrito y checkout con un producto real", "Agregar al carrito, iniciar checkout y completar la compra", "Los eventos estructurales conservan cta_id, cta_name, page_type y schema_version coherentes de punta a punta", "DEFINIDA", "ecommerce/src/lib/analytics/eventSchema.ts; ecommerce/src/components/cart/CheckoutCostSummary.tsx; ecommerce/e2e/begin-checkout.spec.ts; ecommerce/e2e/purchase-success.spec.ts", "Retestar el flujo completo y cruzar con backend de analytics", ""),
      c("ECOM-MOB-001", "Mobile-first", "Ejecutar home, catálogo, PDP, carrito y checkout en viewport móvil", "E2E/UI", "Local storefront activo", "Abrir en viewport pequeño y recorrer el flujo principal", "La navegación móvil sigue usable, los CTAs quedan accesibles y no hay overlays o menús que bloqueen el flujo", "DEFINIDA", "ecommerce/src/components/mobile-navigation/index.tsx; ecommerce/src/app/shop/layout.tsx; ecommerce/src/components/cms/CmsPageShell.tsx; ecommerce/e2e/admin-conversations-mobile-detail.spec.ts", "Probar navegación, búsqueda, PDP, carrito y checkout en mobile", ""),
      c("ECOM-PERF-001", "Performance", "Cargar la superficie crítica sin pantalla en blanco ni CTA oculto", "UI", "Storefront con contenido publicado", "Hacer hard refresh en home, listing y PDP", "La primera pintura muestra contenido utilizable, el CTA principal queda visible y la navegación sigue respondiendo sin layout roto", "DEFINIDA", "ecommerce/src/app/[slug]/page.tsx; ecommerce/src/app/shop/page.tsx; ecommerce/src/components/stories/StoriesHomeRail.tsx; ecommerce/src/components/mobile-navigation/index.tsx", "Validar carga inicial y estabilidad visual en desktop y mobile", ""),
      c("ECOM-CART-001", "Carrito", "Agregar producto simple al carrito", "E2E", "Producto simple visible", "Click en agregar al carrito desde detalle", "El ítem queda en carrito y el contador se actualiza", "VERIFICADA", "ecommerce/e2e/commerce-critical.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CART-002", "Carrito", "Agregar producto paramétrico sólo tras configurarlo", "E2E", "Producto paramétrico con configurador disponible", "Seleccionar matriz y completar parámetros", "El sistema no permite entrar un producto paramétrico sin configuración válida", "VERIFICADA", "ecommerce/e2e/commerce-critical.spec.ts", "2026-04-27"),
      c("ECOM-CART-003", "Carrito", "Modificar cantidades y remover items", "E2E", "Carrito con al menos dos líneas", "Cambiar cantidad y borrar una línea", "Totales y líneas reflejan el cambio sin recarga manual", "VERIFICADA", "ecommerce/e2e/commerce-critical.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-001", "Checkout", "Completar checkout como invitado", "E2E", "Carrito con productos y shipping activo", "Ir a checkout sin sesión", "El checkout avanza, calcula envío y genera el pedido", "PENDIENTE", "ecommerce/e2e/commerce-critical.spec.ts", "Separado del gate crítico porque la visibilidad del derivado en shop no está garantizada de forma estable.", "2026-04-27"),
      c("ECOM-CHK-002", "Checkout", "Pre-cargar datos del cliente al pagar autenticado", "E2E", "Usuario autenticado con perfil cargado", "Ir al carrito y abrir checkout", "Nombre, correo y dirección se precargan sin refresh manual", "VERIFICADA", "ecommerce/e2e/logged-in-checkout-address-currency.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-003", "Checkout", "Conservar dirección guardada para el checkout", "E2E", "Usuario con dirección primaria", "Abrir checkout luego de iniciar sesión", "La dirección guardada se toma como base y puede editarse", "VERIFICADA", "ecommerce/e2e/logged-in-checkout-address-currency.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-004", "Checkout", "Rechazar checkout con nombre vacío", "UI", "Carrito con productos y sesión válida", "Borrar el nombre e intentar avanzar", "El formulario bloquea el avance y muestra validación explícita", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-005", "Checkout", "Rechazar checkout con email malformado", "UI", "Carrito con productos y sesión válida", "Ingresar un email inválido y avanzar", "El formulario no acepta el submit y deja visible el error", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-006", "Checkout", "Rechazar checkout con número de calle no numérico", "UI", "Checkout abierto", "Escribir letras en el número de dirección", "La validación impide guardar una dirección estructuralmente inválida", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-007", "Checkout", "Rechazar checkout sin barrio o con shipping incompleto", "UI/E2E", "Carrito con productos", "Borrar barrio o dejar shipping incompleto", "El paso de pago no avanza y el error queda claro", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts; ecommerce/e2e/logged-in-checkout-address-currency.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-PAY-001", "Pagos", "Crear preferencia de Mercado Pago", "E2E/API", "Checkout con monto válido", "Seleccionar Mercado Pago", "Se genera preferencia con datos del checkout y configuración vigente", "PENDIENTE", "ecommerce/e2e/mercadopago-success.spec.ts", "La spec de pago feliz no existe todavía; el caso queda bloqueado hasta restaurar runtime verificable.", "2026-05-08"),
      c("ECOM-PAY-002", "Pagos", "Confirmar pago aprobado de Mercado Pago", "E2E/API", "Preferencia o intento aprobado", "Simular confirmación de pago", "El pedido pasa a confirmado y queda trazable", "PENDIENTE", "ecommerce/e2e/mercadopago-success.spec.ts", "Depende de la spec de Mercado Pago inexistente y de credenciales/config local revalidadas.", "2026-05-08"),
      c("ECOM-PAY-003", "Pagos", "Mostrar métodos de pago vigentes y cuotas disponibles", "UI/API", "Config de pagos leída desde DB segura", "Abrir checkout o settings relacionadas", "Se muestran los métodos activos y la cantidad de cuotas permitidas", "DEFINIDA", "ecommerce/e2e/commerce-critical.spec.ts; ecommerce/e2e/ecommerce-readiness.spec.ts", "Revalidar con `commerce-critical.spec.ts` y ajustar la vieja suite readiness antes de volverla a contar como verde.", "2026-04-27"),
      c("ECOM-PAY-004", "Pagos", "Rechazar email inválido al procesar Mercado Pago", "UI", "Checkout con Mercado Pago activo", "Completar pago con email inválido", "La interfaz valida el correo y no genera checkout roto", "VERIFICADA", "backend/src/storefront/dto/mercadopago-charge.dto.ts; backend/src/storefront/payments/__tests__/mercadopago-charge.dto.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-PAY-005", "Pagos", "Bloquear monto/cuota inválidos", "API/UI", "Config de cuotas disponible", "Forzar cuota o monto fuera de rango", "El sistema rechaza el cálculo en vez de continuar silenciosamente", "VERIFICADA", "backend/src/storefront/dto/mercadopago-charge.dto.ts; backend/src/storefront/payments/__tests__/mercadopago-charge.dto.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-001", "Autenticación", "Login con teléfono desde el storefront", "UI/E2E", "Usuario con cuenta y teléfono normalizado", "Abrir modal de login y enviar teléfono+contraseña", "La sesión se crea y el header pasa a estado autenticado", "DEFINIDA", "ecommerce/e2e/ecommerce-readiness.spec.ts; ecommerce/e2e/wishlist-post-login.spec.ts", "Revalidar con la ruta de login real sin depender de readiness con skip.", "2026-04-27"),
      c("ECOM-AUTH-002", "Autenticación", "Login con email desde el storefront", "UI/E2E", "Usuario con correo y contraseña", "Abrir modal de login y enviar email+contraseña", "La sesión se crea y el usuario puede navegar como autenticado", "DEFINIDA", "ecommerce/e2e/ecommerce-readiness.spec.ts", "Revalidar con la ruta de login real sin depender de readiness con skip.", "2026-04-27"),
      c("ECOM-AUTH-003", "Autenticación", "Login con Google desde el storefront", "UI/E2E", "Google OAuth activo y secretos cargados", "Abrir modal de login y ejecutar Google sign-in", "La sesión se crea vía OAuth y retorna al storefront con estado autenticado", "VERIFICADA", "backend/src/storefront/oauth/__tests__/google-oauth.service.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-004", "Registro", "Registro con teléfono desde el storefront", "UI/E2E", "Teléfono disponible y términos aceptados", "Abrir registro, completar datos y enviar", "La cuenta se crea, la sesión queda activa y la UI continúa al perfil autenticado", "DEFINIDA", "ecommerce/e2e/ecommerce-readiness.spec.ts; ecommerce/src/app/(storefront)/account/register/RegisterClient.tsx", "Revalidar con el flujo de registro real y no con la suite readiness pausada.", "2026-04-27"),
      c("ECOM-AUTH-005", "Registro", "Registro con email desde el storefront", "UI/E2E", "Correo válido opcional y teléfono obligatorio", "Abrir registro y completar email+teléfono", "La cuenta se crea y el flujo de verificación por email queda disponible", "VERIFICADA", "ecommerce/e2e/auth-email.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-006", "Registro", "Registro con Google", "UI/E2E", "Google OAuth activo", "Iniciar registro o login con Google", "Se crea o vincula la cuenta y la sesión queda operativa", "VERIFICADA", "backend/src/storefront/oauth/__tests__/google-oauth.service.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-007", "Autenticación", "Rechazar login con identificador malformado", "UI/E2E", "Modal de login visible", "Ingresar letras donde debe ir teléfono o email inválido", "El formulario bloquea el submit y muestra error de validación", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-008", "Registro", "Rechazar registro con teléfono inválido", "UI/E2E", "Formulario de registro visible", "Ingresar caracteres no numéricos en teléfono", "El formulario no acepta el alta y muestra el error correspondiente", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-009", "Registro", "Rechazar registro con email malformado", "UI/E2E", "Formulario de registro visible", "Ingresar un email inválido", "La validación impide crear la cuenta", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-012", "Registro", "Rechazar registro con correo ya existente", "E2E/API", "Cliente existente registrado por API o UI", "Intentar crear otra cuenta con el mismo correo", "El backend devuelve conflicto y el frontend traduce el error sin crear una segunda cuenta", "VERIFICADA", "ecommerce/e2e/auth-register-duplicate.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-013", "Registro", "Rechazar registro con teléfono ya existente", "E2E/API", "Cliente existente registrado por API o UI", "Intentar crear otra cuenta con el mismo teléfono", "El backend devuelve conflicto y no duplica el cliente", "VERIFICADA", "ecommerce/e2e/auth-register-duplicate.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-014", "Registro", "Rechazar payload de registro con nombres vacíos o password sólo con espacios", "API", "Endpoint de registro disponible", "Enviar firstName/lastName vacíos o password blanco", "La validación del backend rechaza el payload antes de tocar la base", "VERIFICADA", "backend/src/storefront/dto/auth.dto.ts; backend/src/storefront/__tests__/auth.dto.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-WISH-001", "Wishlist", "Agregar y remover productos en wishlist post-login", "E2E", "Usuario autenticado", "Abrir wishlist y alternar un producto", "El estado, contador y persistencia reflejan el cambio", "VERIFICADA", "ecommerce/e2e/wishlist-post-login.spec.ts", "2026-04-27"),
      c("ECOM-ORD-001", "Órdenes", "Ver historial de órdenes del cliente", "E2E", "Usuario autenticado con pedidos", "Abrir /account/orders", "Se listan pedidos con estado, montos y navegación a detalle", "VERIFICADA", "ecommerce/e2e/account-orders-list.spec.ts", "2026-04-27"),
      c("ECOM-ORD-002", "Órdenes", "Abrir detalle de orden por UUID público", "E2E", "Pedido ya emitido", "Click en una notificación o entrar al detalle", "Se muestra detalle público, dirección estructurada y timeline correcta", "VERIFICADA", "ecommerce/e2e/account-notifications-order-detail.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-ORD-003", "Órdenes", "Notificaciones de cuenta: listar, leer y borrar", "E2E", "Usuario autenticado con notificaciones", "Abrir campana, leer y borrar items", "La lista carga, permite leer individualmente y limpiar el buzón", "VERIFICADA", "ecommerce/e2e/account-notifications-order-detail.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-ORD-004", "Órdenes", "Ocultar reseña si la orden no es elegible", "UI/E2E", "Orden no entregada o review deshabilitado", "Abrir detalle de orden", "El CTA no aparece o explica por qué no está disponible", "VERIFICADA", "ecommerce/e2e/order-review-cta-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-SUP-001", "Soporte/Contenido", "Abrir FAQ o contacto comercial", "UI", "Sitio activo", "Navegar a /contact", "Se muestra contenido de contacto o ayuda coherente con el sitio", "VERIFICADA", "ecommerce/e2e/contact-page.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-REV-001", "Reseñas", "Acceso a escribir reseña desde detalle de orden", "UI/E2E", "Orden entregada y feature habilitada", "Abrir orden del cliente", "El CTA se muestra sólo si la política de reviews lo permite", "VERIFICADA", "ecommerce/e2e/product-reviews.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CART-004", "Carrito", "Persistir el carrito después de recargar la página", "E2E", "Carrito con productos cargados", "Recargar storefront", "Los items y cantidades se restauran desde storage/controladores de estado", "VERIFICADA", "ecommerce/e2e/cart-persistence.spec.ts; ecommerce/src/state/cart-context.tsx", "Mantener", "2026-04-27"),
      c("ECOM-CART-005", "Carrito", "Resolver fallback de matriz paramétrica de aberturas", "E2E/API", "Producto paramétrico sin matriz explícita", "Agregar al carrito desde listados o detalle", "El sistema usa la matriz local canónica de aberturas y no deja el item pelado", "DEFINIDA", "backend/src/storefront/storefront.service.ts", "Sustituir la evidencia de código por una corrida o spec ejecutable del fallback paramétrico antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("ECOM-CART-006", "Carrito", "Rechazar cantidad cero o negativa", "UI/E2E", "Carrito visible", "Ingresar cantidad 0 o negativa", "La UI impide cantidades inválidas y mantiene el subtotal estable", "VERIFICADA", "ecommerce/e2e/cart-invalid-quantity.spec.ts; ecommerce/src/state/cart-context.tsx", "Mantener", "2026-04-27"),
      c("ECOM-CART-007", "Carrito", "Rechazar texto donde el carrito espera cantidad numérica", "UI/E2E", "Carrito visible", "Escribir letras en el contador de cantidad", "La validación impide que el número quede corrupto", "VERIFICADA", "ecommerce/e2e/cart-invalid-quantity.spec.ts; ecommerce/src/state/cart-context.tsx", "Mantener", "2026-04-27"),
      c("ECOM-CHK-008", "Checkout", "Gestionar checkout alternativo/demostrativo si se habilita", "UI/E2E", "Configuración demo o alternativa activa", "Abrir checkout alternativo", "La UI sólo aparece si la ruta está explícitamente habilitada", "VERIFICADA", "ecommerce/e2e/checkout-alternative-route.spec.ts; ecommerce/src/app/checkout-alternative/page.tsx", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-010", "Autenticación", "Recuperar contraseña por email", "E2E", "Cuenta con correo verificado", "Abrir forgot password y solicitar reset", "Se envía el enlace y el usuario puede elegir una nueva contraseña", "VERIFICADA", "ecommerce/e2e/auth-email.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-AUTH-011", "Autenticación", "Rechazar login con password vacío o sólo espacios", "UI/E2E", "Modal de login visible", "Dejar la contraseña vacía o escribir sólo espacios", "El formulario bloquea el submit y muestra error de validación", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-009", "Checkout", "Rechazar checkout con campos de shipping incompletos o vacíos", "UI/E2E", "Carrito con productos y sesión válida", "Borrar dirección, barrio o ciudad y avanzar", "El formulario no continúa hasta completar todos los datos obligatorios", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-CHK-010", "Checkout", "Rechazar checkout con postal code o barrio inválido", "UI/E2E", "Checkout abierto", "Ingresar un dato inválido en shipping", "La validación evita persistir una dirección estructuralmente inválida", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-PAY-006", "Pagos", "Rechazar Mercado Pago con email faltante o malformado", "UI", "Checkout con Mercado Pago activo", "Completar el pago con email vacío o inválido", "La interfaz corta el flujo y muestra el error esperado", "VERIFICADA", "backend/src/storefront/dto/mercadopago-charge.dto.ts; backend/src/storefront/payments/__tests__/mercadopago-charge.dto.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-PAY-007", "Pagos", "Bloquear cuotas o monto fuera de rango", "API/UI", "Config de cuotas disponible", "Forzar cuotas o monto inválidos", "El cálculo se rechaza de forma explícita", "VERIFICADA", "backend/src/storefront/dto/mercadopago-charge.dto.ts; backend/src/storefront/payments/__tests__/mercadopago-charge.dto.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-PROD-004", "Producto", "Buscar producto por slug o texto", "UI", "Catálogo indexado", "Usar buscador o ruta de búsqueda", "El usuario llega al producto correcto o a resultados relevantes", "VERIFICADA", "backend/src/storefront/__tests__/storefront.service.spec.ts", "Mantener", "2026-04-27"),
      c("ECOM-PROD-005", "Producto", "Ver recomendaciones relacionadas", "UI/API", "Producto con relacionados publicados", "Abrir detalle de producto", "Se muestran sugeridos coherentes con el catálogo", "VERIFICADA", "backend/src/storefront/__tests__/storefront.service.spec.ts", "Mantener", "2026-04-27"),
      ],
  },
  {
    sheetName: "Admin",
    project: "Admin",
    cases: [
      c("ADMIN-AUTH-001", "Acceso", "Inicio de sesión de administrador", "E2E/UI", "Cuenta superadmin semilla disponible", "Abrir sign-in y autenticar", "El usuario entra al panel y ve las rutas permitidas por rol", "VERIFICADA", "ecommerce/e2e/admin-signin-smoke.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-RBAC-001", "RBAC", "Navegación restringida por rol", "UI/E2E", "Usuario con rol no superadmin", "Abrir navbar y lateral", "Sólo aparecen módulos y acciones permitidas por el rol", "VERIFICADA", "ecommerce/e2e/admin-rbac-navigation.spec.ts; frontend/src/configs/navigation.config/__tests__/apps.navigation.config.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-DASH-001", "Dashboard", "Cargar resumen operativo", "UI", "Admin autenticado", "Entrar al dashboard", "Se visualizan KPIs y widgets de operación", "VERIFICADA", "backend/src/accounting/__tests__/accounting.controller.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CLT-001", "Clientes", "Listar clientes del ecommerce", "UI/API", "Base activa con pedidos/clientes", "Abrir módulo de clientes", "La grilla muestra clientes reales con filtros y detalle", "VERIFICADA", "backend/src/customers/__tests__/customers.controller.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-ORD-001", "Pedidos", "Listar pedidos y abrir detalle", "E2E", "Pedido creado desde storefront", "Abrir orders y entrar a detalle", "La pantalla muestra UUID, estado, cliente y timeline", "VERIFICADA", "ecommerce/e2e/admin-order-detail-cross-project.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-PAY-001", "Pagos", "Ver pagos registrados y su estado", "UI/API", "Pedidos con pagos creados", "Abrir vista de pagos", "Se muestran montos, provider, estado y referencia", "VERIFICADA", "backend/src/accounting/__tests__/payments.service.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-PROD-001", "Productos", "Listar productos publicados", "UI", "Catálogo activo", "Abrir módulo de productos", "La tabla muestra catálogo real y estado de publicación", "VERIFICADA", "ecommerce/e2e/admin-product-list.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-PROD-002", "Productos", "Crear o editar producto", "UI/API", "Permisos de edición habilitados", "Abrir formulario y guardar", "La edición persiste y reindexa lo necesario", "VERIFICADA", "backend/src/sales/sales.controller.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CMS-001", "CMS", "Supervisar superficies comerciales y contenido SEO", "UI", "Contenido del sitio cargado", "Abrir CMS y páginas comerciales", "La UI permite editar contenido y mantener el lenguaje SEO", "VERIFICADA", "ecommerce/e2e/admin-commercial-surfaces.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CMS-002", "CMS", "Editar stories y home highlights", "UI/E2E", "Home con historias publicadas", "Abrir el CMS home", "Las historias y bloques editoriales quedan debajo o sobre el carrusel según el layout", "VERIFICADA", "ecommerce/e2e/home-stories.spec.ts; docs/PROJECT_STATUS.md", "Mantener", "2026-04-27"),
      c("ADMIN-CMS-003", "CMS/SEO", "Editar una superficie canónica sin romper metadata pública", "UI/E2E", "CMS con páginas editoriales y rutas públicas activas", "Modificar un contenido canónico o editorial y guardar", "La ruta pública continúa resolviendo bien, la metadata se actualiza y no aparece un fallback incorrecto", "DEFINIDA", "ecommerce/src/app/[slug]/page.tsx; ecommerce/src/lib/page-metadata.ts; ecommerce/e2e/seo-metadata.spec.ts; ecommerce/e2e/admin-commercial-surfaces.spec.ts", "Revisar canonical route, metadata y preview público", ""),
      c("ADMIN-SET-001", "Configuración", "Email config leída desde DB segura", "UI/API", "SecureConfig poblado", "Abrir settings/email/config", "Se muestran puerto, host, usuario y credenciales como dato seguro desde base", "DEFINIDA", "docs/PROJECT_STATUS.md; frontend/src/views/settings/Email/index.tsx", "Reemplazar la evidencia documental o de código estático por una corrida o spec ejecutable contra SecureConfig antes de cerrarlo como VERIFICADA.", "2026-04-27"),
      c("ADMIN-SET-002", "Configuración", "Mercado Pago config leída desde DB segura", "UI/API", "SecureConfig con provider vigente", "Abrir settings/email/config", "Se muestran public key, access token y país desde DB", "DEFINIDA", "docs/PROJECT_STATUS.md; frontend/src/views/settings/GoogleSettings/GoogleSettings.tsx", "Reemplazar la evidencia documental o de código estático por una corrida o spec ejecutable contra SecureConfig antes de cerrarlo como VERIFICADA.", "2026-04-27"),
      c("ADMIN-SET-003", "Configuración", "Google sign-in y reCAPTCHA activos", "UI/API", "OAuth y reCAPTCHA configurados", "Abrir settings de integraciones", "La opción se activa con config segura y no depende sólo de env", "DEFINIDA", "docs/PROJECT_STATUS.md; frontend/src/views/settings/GoogleSettings/GoogleSettings.tsx", "Reemplazar la evidencia documental o de código estático por una corrida o spec ejecutable contra SecureConfig antes de cerrarlo como VERIFICADA.", "2026-04-27"),
      c("ADMIN-SET-004", "Canales", "Editar email/meta/whatsapp desde settings de canales", "UI/API", "ChannelControl habilitado", "Abrir settings/channels", "Los cambios se persisten y reflejan al chat platform", "DEFINIDA", "ai-platform/backend/src/modules/channel-control/*", "Sustituir el glob por una ruta explícita y una evidencia ejecutable antes de volver a marcar este caso como VERIFICADA.", "2026-04-27"),
      c("ADMIN-SET-005", "Email", "Configurar inbox y delivery de email desde DB segura", "UI/API", "SecureConfig y channel settings activos", "Abrir email/config", "Se ven host, puerto, usuario, contraseña y ruteo desde DB", "DEFINIDA", "docs/PROJECT_STATUS.md; ai-platform/backend/src/modules/channel-control/channel-settings.service.ts", "Reemplazar la evidencia documental o de código estático por una corrida o spec ejecutable del inbox/settings antes de cerrarlo como VERIFICADA.", "2026-04-27"),
      c("ADMIN-SET-006", "Menú", "Mostrar íconos y traducción en CMS y Channels", "UI", "Navbar y sidebar renderizados", "Abrir navegación y submenús", "Los items secundarios usan iconos y labels traducidos", "VERIFICADA", "frontend/src/configs/navigation.config/__tests__/apps.navigation.config.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-SET-007", "Email", "Mostrar estado vacío explícito cuando falta una config de email", "UI/API", "SecureConfig sin datos o parcialmente poblado", "Abrir settings/email/config", "La UI no queda en spinner ni vacía: muestra el estado faltante con claridad", "VERIFICADA", "backend/src/email/__tests__/email-settings.service.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-SET-008", "Canales", "Abrir email inbox desde la ruta estándar de canales", "UI/E2E", "Canales activos y cuenta de email disponible", "Navegar por settings/channels y seleccionar email", "El inbox se monta con la misma ruta y ownership que el resto de canales", "VERIFICADA", "ecommerce/e2e/admin-mail-inbox-real-account.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-001", "Chat", "Ver conversaciones del chat platform", "E2E/API", "ai-platform con conversaciones reales", "Abrir /app/crm/conversations", "La lista muestra conversaciones reales y no legacy vacío", "DEFINIDA", "frontend/src/services/ConversationsService.ts", "La evidencia actual es solo código cliente; sumar una corrida ejecutable del inbox antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("ADMIN-CHAT-002", "Chat", "Abrir detalle de conversación y responder manualmente", "E2E/API", "Conversación activa y operador autenticado", "Abrir detalle y enviar reply", "El reply se persiste en ai-platform y se refleja al recargar", "VERIFICADA", "ecommerce/e2e/admin-conversations-email-reply.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-003", "Chat", "Archivar, fijar, takeover y marcar como leído una conversación", "UI/API", "Conversación visible en inbox", "Ejecutar acciones del panel", "El estado se actualiza sin perder el hilo ni la trazabilidad; takeover sólo queda vigente si el contrato actual lo expone", "DEFINIDA", "ecommerce/e2e/admin-messaging-regression.spec.ts; ecommerce/e2e/admin-conversation-actions.spec.ts", "La cobertura depende de `admin-conversation-actions.spec.ts`, que está degradada por `test.skip`.", "2026-04-27"),
      c("ADMIN-CHAT-004", "Chat", "Inbox multicanal y detail móvil", "E2E", "Canales activos con mensajes reales", "Abrir inbox y detalle en mobile", "Se muestran todos los canales disponibles y el detalle sigue usable", "VERIFICADA", "ecommerce/e2e/admin-conversations-multichannel.spec.ts; ecommerce/e2e/admin-conversations-mobile-detail.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-005", "Chat", "Sincronizar estado de entrega Meta", "E2E/API", "Canal Meta habilitado", "Enviar evento de status", "La conversación proyecta delivered/read back al hub cuando la firma de webhook es válida", "VERIFICADA", "ecommerce/e2e/admin-conversations-meta-status.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-006", "Chat", "Buzón real de email en conversations", "E2E/API", "Cuenta de correo operativa", "Abrir inbox real", "Se ven mensajes reales y no sólo el inbox vacío/legacy", "VERIFICADA", "ecommerce/e2e/admin-mail-inbox-real-account.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-013", "Chat", "El inbox de email no queda colgado cuando la cuenta no tiene mensajes", "E2E/UI", "Cuenta de email operativa sin mensajes nuevos", "Abrir el inbox real y esperar estado final", "La vista muestra empty/error de forma explícita en vez de dejar spinner infinito", "VERIFICADA", "ecommerce/e2e/admin-mail-inbox-real-account.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-014", "Chat", "Rechazar reply vacío o whitespace", "UI/E2E", "Conversación abierta", "Enviar reply vacío", "La UI impide el envío y muestra error/guard rail", "DEFINIDA", "ai-platform/backend/src/modules/api/dto/admin-conversation-reply.dto.ts; ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Queda fuera del gate core mientras la evidencia viva sólo en scope deferred de chat platform.", "2026-04-27"),
      c("ADMIN-CHAT-015", "Chat", "Filtrar inbox por sujeto/canal sin falsos positivos obvios", "E2E", "Conversaciones con contenido mixto", "Buscar en inbox por término", "Los resultados matchean por sujeto, canal y texto sin degradar la navegación", "VERIFICADA", "ecommerce/e2e/admin-messaging-search-matching.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-007", "Chat", "Búsqueda y matching de mensajes", "E2E/API", "Conversaciones con contenido mixto", "Buscar en inbox por término", "Los resultados matchean por sujeto, canal y texto sin falsos positivos obvios", "VERIFICADA", "ecommerce/e2e/admin-messaging-search-matching.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-008", "Chat", "Flujo interno de chat/no automations", "E2E/API", "Operador autenticado", "Abrir conversación interna", "La UI opera manual replies y acciones operativas sin respuesta automática en esta entrega", "VERIFICADA", "ecommerce/e2e/admin-conversations-internal-chat.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-009", "Chat", "Confirmación interna y transiciones de estado", "E2E/API", "Conversación abierta", "Ejecutar confirmaciones internas", "La conversación respeta el estado y la operatoria definidas", "VERIFICADA", "ecommerce/e2e/admin-conversations-internal-confirmation.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-010", "Chat", "Móvil y subroles en conversaciones", "E2E/UI", "Usuario con rol restringido", "Abrir inbox en mobile", "La UI mantiene accesibilidad y restricciones por rol", "VERIFICADA", "ecommerce/e2e/admin-conversations-mobile-detail.spec.ts; ecommerce/e2e/admin-conversations-subroles.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-CHAT-011", "Chat", "Inbox: notificación de orden llega también al panel de admin", "E2E/API", "Orden emitida y notificaciones customer/admin activas", "Abrir conversaciones luego de un checkout", "La orden genera conversación/notificación visible para operación interna", "PENDIENTE", "ecommerce/e2e/account-notifications-order-detail.spec.ts; ecommerce/e2e/admin-order-detail-cross-project.spec.ts; ecommerce/e2e/mercadopago-success.spec.ts", "Depende del flujo de pago feliz de Mercado Pago, hoy ausente del árbol de specs.", "2026-05-08"),
      c("ADMIN-CHAT-012", "Chat", "Rechazar reply vacío o whitespace", "UI/E2E", "Conversación abierta", "Enviar reply vacío", "La UI impide el envío y muestra error/guard rail", "DEFINIDA", "ai-platform/backend/src/modules/api/dto/admin-conversation-reply.dto.ts; ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Queda fuera del gate core mientras la evidencia viva sólo en scope deferred de chat platform.", "2026-04-27"),
      c("ADMIN-AI-001", "IA", "Configurar runtime del agente", "UI/API", "ai-platform configurado", "Abrir AI runtime settings", "Se puede activar/desactivar y guardar config segura del runtime", "DEFINIDA", "ecommerce/e2e/admin-ai-settings.spec.ts", "El bloque AI queda deferred para el gate core; revalidar cuando vuelva a entrar con runtime gobernado.", "2026-04-27"),
      c("ADMIN-AI-002", "IA", "Gestionar documentos y conocimiento", "UI/API", "Documentos base cargados", "Abrir knowledge/documents", "Los documentos, chunks y claims se listan y editan correctamente", "DEFINIDA", "ecommerce/e2e/admin-ai-settings.spec.ts", "El bloque AI queda deferred para el gate core; revalidar cuando vuelva a entrar con runtime gobernado.", "2026-04-27"),
      c("ADMIN-AI-003", "IA", "Revisar candidates, bundles, feedback y raw events", "UI/API", "Pipeline de knowledge activo", "Abrir candidate/bundle/feedback views", "La promoción y trazabilidad del conocimiento queda visible", "DEFINIDA", "ecommerce/e2e/admin-ai-settings.spec.ts", "El bloque AI queda deferred para el gate core; revalidar cuando vuelva a entrar con runtime gobernado.", "2026-04-27"),
      c("ADMIN-AI-004", "IA", "Gestionar ingestion runs y eventos crudos", "UI/API", "Knowledge pipeline activo", "Abrir ingestion/raw events", "La UI expone corridas, eventos y trazabilidad del pipeline", "DEFINIDA", "ecommerce/e2e/admin-ai-settings.spec.ts", "El bloque AI queda deferred para el gate core; revalidar cuando vuelva a entrar con runtime gobernado.", "2026-04-27"),
      c("ADMIN-AI-005", "IA", "Ver negative examples y bundles de promoción", "UI/API", "Promoción activa", "Abrir negative examples y bundles", "Se ven ejemplos negativos y grupos de promoción/rechazo", "DEFINIDA", "ecommerce/e2e/admin-ai-settings.spec.ts", "El bloque AI queda deferred para el gate core; revalidar cuando vuelva a entrar con runtime gobernado.", "2026-04-27"),
      c("ADMIN-AI-006", "IA", "Ver feedback de conocimiento", "UI/API", "Feedback capturado", "Abrir feedback", "La vista muestra el feedback y permite seguimiento", "DEFINIDA", "ecommerce/e2e/admin-ai-settings.spec.ts", "El bloque AI queda deferred para el gate core; revalidar cuando vuelva a entrar con runtime gobernado.", "2026-04-27"),
      c("ADMIN-QA-001", "QA", "Abrir el viewer de QA y revisar bloques", "UI", "Admin autenticado", "Entrar a /app/settings/qa", "El catálogo de bloques, último run e historial se muestran", "VERIFICADA", "ecommerce/e2e/admin-qa-center.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-COM-001", "Comercial", "Supervisar superficies comerciales y contenido SEO", "UI", "Contenido del sitio cargado", "Abrir CMS y páginas comerciales", "La UI permite editar contenido y mantener el lenguaje SEO", "VERIFICADA", "ecommerce/e2e/admin-commercial-surfaces.spec.ts", "Mantener", "2026-04-27"),
      c("ADMIN-COM-002", "Comercial", "Gestionar superficies de mensajes/comercio mezcladas sin romper ownership", "Arquitectura/UI/API", "Chat platform y ecommerce integrados", "Abrir áreas compartidas", "La UI usa contratos y no mezcla ownership de mensajería con commerce core", "VERIFICADA", "ecommerce/e2e/channel-control-contract.spec.ts; ecommerce/e2e/admin-commercial-surfaces.spec.ts", "Mantener", "2026-04-27"),
    ],
  },
  {
    sheetName: "Chat Platform",
    project: "Chat platform",
    cases: [
      c("CHAT-RT-001", "Runtime", "Health del backend de chat platform", "API", "Servicio levantado", "GET /health", "Devuelve OK y el proceso está listo para atender API", "VERIFICADA", "ai-platform/backend/src/modules/infrastructure/health.controller.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-002", "Webchat", "Crear sesión pública del webchat", "API/E2E", "Storefront o admin con acceso a ai-platform", "Iniciar una sesión pública", "Se crea conversationId/guestId y la sesión queda persistida", "VERIFICADA", "ecommerce/e2e/storefront-webchat.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-003", "Webchat", "Mantener conversación multi-turno", "E2E", "Sesión activa", "Enviar varios mensajes consecutivos", "El hilo conserva contexto entre turnos sin perder el objetivo", "VERIFICADA", "ecommerce/e2e/storefront-webchat.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-004", "Webchat", "Persistir historial después de reload", "E2E", "Sesión pública o autenticada", "Recargar la página", "El transcript y la sesión se rehidratan de forma consistente", "VERIFICADA", "ecommerce/e2e/storefront-webchat-authenticated-memory.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-005", "Operación", "Responder manualmente desde admin", "E2E/API", "Conversación visible en admin", "Redactar reply manual", "El reply se persiste en ai-platform y aparece al reabrir la conversación", "VERIFICADA", "ecommerce/e2e/admin-conversations-email-reply.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-006", "Operación", "Archivar, fijar, mutear y marcar leído", "API/UI", "Conversación abierta", "Aplicar acciones operativas", "El estado se actualiza y el hilo sigue disponible para auditoría", "VERIFICADA", "ai-platform/backend/src/modules/api/__tests__/admin-conversations.service.spec.ts; ai-platform/backend/src/modules/api/admin-conversations.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-007", "Conversaciones", "Listar y abrir conversaciones desde ai-platform", "API/E2E", "Datos de conversación disponibles", "GET/list y GET/detail", "El listado y detalle se obtienen desde el hub canónico, no desde legacy", "VERIFICADA", "frontend/src/services/ConversationsService.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-008", "Canales", "Leer y guardar configuración de email", "API/UI", "ChannelControl y SecureConfig poblados", "Abrir settings/channels/email", "El sistema persiste host, puerto, usuario y secretos desde DB segura", "VERIFICADA", "ai-platform/backend/src/modules/channel-control/channel-settings.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-009", "Canales", "Leer y guardar configuración de Meta", "API/UI", "Meta habilitado", "Abrir settings/channels/meta", "La configuración y estado se leen desde chat platform y no desde backend legacy", "VERIFICADA", "ai-platform/backend/src/modules/channel-control/channel-settings.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-010", "Canales", "Leer y guardar configuración de WhatsApp QR", "API/UI", "WhatsApp QR habilitado", "Abrir settings/channels/whatsapp-qr", "La configuración queda persistida y el estado del QR se proyecta correctamente", "VERIFICADA", "ai-platform/backend/src/modules/channel-control/channel-settings.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-011", "Canales", "Proyectar delivery/outbound status al hub", "API", "Canal con status emitido", "Enviar estado externo", "El status de entrega vuelve a la conversación canónica", "VERIFICADA", "ecommerce/e2e/admin-conversations-meta-status.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-012", "Adapter", "Usar channel adapter como puente y no como dueño", "API/Infra", "Adapter configurado", "Resolver estado por API", "El adapter consume contratos de ai-platform y deja de depender de legacy backend", "VERIFICADA", "ai-platform/backend/src/modules/channel-control/__tests__/channel-control-internal.controller.spec.ts; services/channel-adapter/src/channels/whatsapp-qr/whatsapp-qr.adapter.test.js", "Mantener", "2026-04-27"),
      c("CHAT-RT-013", "Seguridad", "CRUD de secretos seguros para runtime y canales", "API/UI", "SecureConfig activo", "Guardar/leer credenciales", "Los secretos quedan cifrados en DB y no expuestos en claro", "VERIFICADA", "ai-platform/backend/src/modules/runtime-config/ai-runtime-secrets.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-014", "Runtime", "Resolver configuración con DB primero y env después", "API", "DB con config segura o env local", "Inicializar runtime", "La autoridad es SecureConfig; env sólo actúa como fallback no prod", "VERIFICADA", "ai-platform/backend/src/modules/runtime-config/runtime-config.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-015", "Conocimiento", "Ingerir documentos y ver conocimiento activo", "UI/API", "Documentos cargados", "Abrir Documents/Knowledge", "Se visualizan documentos, chunks, claims, raw events y bundles", "VERIFICADA", "ecommerce/e2e/admin-ai-settings.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-016", "Test Center", "Ejecutar escenarios de chat y evaluación", "UI/API", "Chat platform con runtime disponible", "Abrir test center y evaluar escenarios", "Los escenarios quedan reproducibles y el resultado es trazable", "VERIFICADA", "ai-platform/backend/test/admin-test-center.controller.spec.ts; ai-platform/backend/test/admin-test-center.service.spec.ts; ai-platform/backend/test/admin-test-center-evaluation.service.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-017", "UI", "Mantener la UI de ai-platform sólo para local/testing", "Deploy", "Stack de producción definido", "Revisar manifest de despliegue", "La UI de 5179 no se publica en prod y sólo vive en local/testing", "VERIFICADA", "ai-platform/docker-compose.yml; docs/PRODUCTION_EXECUTION_PROMPTS.md", "Mantener", "2026-04-27"),
      c("CHAT-RT-018", "Canales", "Persistir configuración entre reloads y reinicios", "E2E", "Canales guardados", "Recargar ui o backend", "La configuración sobrevive reinicios y no depende de bootstrap efímero", "VERIFICADA", "ai-platform/backend/src/modules/channel-control/__tests__/channel-control.service.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-019", "Ingesta", "Recibir mensajes entrantes de canales", "API", "Canal activo y webhook habilitado", "POST inbound o webhook", "El mensaje entra en la conversación canónica y queda trazado", "VERIFICADA", "ai-platform/backend/src/modules/api/__tests__/channel-conversation-bridge.service.spec.ts; services/channel-adapter/src/channels/whatsapp-qr/whatsapp-qr.adapter.test.js", "Mantener", "2026-04-27"),
      c("CHAT-RT-020", "Política", "Mantener alcance manual-only para producción", "Arquitectura", "Baseline productivo definido", "Revisar runtime/policy", "No se promueve respuesta automática en esta entrega; sólo reply manual", "VERIFICADA", "docs/PRODUCTION_EXECUTION_PROMPTS.md", "Mantener", "2026-04-27"),
      c("CHAT-RT-021", "Prompt/Policy", "Separar grounding, fallback y policy", "Arquitectura", "Pipeline de respuesta activo", "Analizar respuesta y grounding", "La decisión no expone summaries crudos ni fallback degradado cuando hay evidencia útil", "DEFINIDA", "ai-platform/backend/src/modules/response/chat-response-policy.service.spec.ts; ai-platform/backend/src/modules/response-grounding.service.spec.ts; ai-platform/backend/src/modules/response-fallback.service.spec.ts", "Scope AI diferido; no entra en el gate core.", ""),
      c("CHAT-RT-022", "Prompt/Policy", "Administrar fallback y locales de respuesta", "API", "Fallbacks cargados", "Abrir response fallback settings", "La respuesta degradada sigue reglas explícitas y localizadas", "DEFINIDA", "ai-platform/backend/src/modules/response-fallback.service.spec.ts", "Scope AI diferido; no entra en el gate core.", ""),
      c("CHAT-RT-023", "Conocimiento", "Promover proposiciones y claims con criterios estructurales", "API", "Documentos y claims activos", "Ejecutar promoción", "Las proposiciones frecuentes se elevan una sola vez a eje reusable", "DEFINIDA", "ai-platform/backend/src/modules/documents/document-knowledge-promotion.service.spec.ts", "Scope AI diferido; no entra en el gate core.", ""),
      c("CHAT-RT-024", "Conocimiento", "Ingerir DOCX/XLSX/PDF/HTML/texto", "API", "Archivos de prueba disponibles", "Subir documentos de distintos formatos", "La representación intermedia converge antes de chunking/extracción", "DEFINIDA", "ai-platform/backend/src/modules/documents/document-content-extractor.service.spec.ts; ai-platform/backend/src/modules/documents/document-format-equivalence.spec.ts", "Scope AI diferido; no entra en el gate core.", ""),
      c("CHAT-RT-025", "Conocimiento", "Ver metadata, prompts y runtimes gestionados", "API/UI", "Managed resources presentes", "Abrir runtime/config/prompt screens", "La UI presenta versiones activas y permite edición segura", "DEFINIDA", "ai-platform/backend/src/modules/runtime-config/runtime-config.service.spec.ts; ai-platform/backend/src/modules/runtime-config/ai-runtime-diagnostics.service.spec.ts", "Scope AI diferido; no entra en el gate core.", ""),
      c("CHAT-RT-026", "Canales", "Email inbox settings, Meta status y WhatsApp QR status", "API/UI", "Canales configurados", "Abrir channel-control endpoints", "Los endpoints de estado/configuelven el canal correcto sin legacy backend", "VERIFICADA", "ai-platform/backend/src/modules/channel-control/channel-settings.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-027", "Canales", "Shared routing control y connection state", "API", "Canales activos", "Cambiar estado de conexión", "El estado de conexión se proyecta y puede editarse sin duplicar ownership", "VERIFICADA", "ai-platform/backend/src/modules/channel-control/__tests__/channel-control.service.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-028", "Canales", "Rechazar payload entrante incompleto o inválido", "API", "Webhook habilitado", "Enviar payload sin threadId, sin canal o con tipos rotos", "La API devuelve error claro y no crea mensajes corruptos", "VERIFICADA", "ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-029", "Canales", "Evitar duplicados por externalMessageId", "API", "Webhook activo", "Reenviar el mismo mensaje", "La persistencia es idempotente y no duplica el hilo", "VERIFICADA", "ai-platform/backend/src/modules/api/__tests__/channel-conversation-bridge.service.spec.ts; ai-platform/backend/src/modules/api/channel-conversation-bridge.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-030", "Canales", "Sincronizar manual reply con WhatsApp QR", "API/E2E", "WhatsApp QR activo", "Emitir inbound y responder manualmente desde admin", "El mensaje entra con binding correcto y la respuesta queda persistida y trazada", "VERIFICADA", "services/channel-adapter/src/channels/whatsapp-qr/whatsapp-qr.adapter.test.js; ecommerce/e2e/admin-conversations-multichannel.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-031", "Canales", "Sincronizar estados y mensajes de Meta", "API/E2E", "Meta activo", "Emitir inbound/status desde adapter", "El hilo y los delivery statuses quedan proyectados en la conversación", "VERIFICADA", "ecommerce/e2e/admin-conversations-meta-status.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-032", "Canales", "Conservar mensajes manuales después de reload", "E2E", "Conversación abierta con reply manual", "Recargar el panel o reabrir la conversación", "El transcript y los estados manuales se rehidratan sin perder persistencia", "VERIFICADA", "ecommerce/e2e/admin-conversations-email-reply.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-033", "Canales", "Listar cuentas de email operativas aunque no exista proof de validación", "API", "Email inbox configurado en DB", "GET /inbox/accounts?channel=EMAIL", "La cuenta aparece disponible y no queda filtrada por una prueba de validación inexistente", "VERIFICADA", "backend/src/inbox/inbox.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-034", "Canales", "Rechazar payload inbound sin threadId o channel", "API", "Webhook habilitado", "Enviar payload incompleto", "La API responde error claro y no persiste mensajes corruptos", "VERIFICADA", "ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-035", "Canales", "Hacer idempotente el inbound por externalMessageId", "API", "Webhook activo", "Reenviar el mismo mensaje", "La persistencia evita duplicados y mantiene una sola conversación", "VERIFICADA", "ai-platform/backend/src/modules/api/__tests__/channel-conversation-bridge.service.spec.ts; ai-platform/backend/src/modules/api/channel-conversation-bridge.service.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-036", "Canales", "Persistir reply manual y rehidratarlo tras reload", "E2E", "Conversación con reply manual", "Responder y recargar", "El mensaje manual sigue visible y vinculado al hilo correcto", "VERIFICADA", "ecommerce/e2e/admin-conversations-email-reply.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-037", "Canales", "Rechazar configuración de canal con tipos inválidos", "API/UI", "ChannelControl abierto", "Ingresar puerto no numérico o credenciales vacías", "El backend/UI rechaza el dato corrupto y lo reporta explícitamente", "VERIFICADA", "ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Mantener", "2026-04-27"),
      c("CHAT-RT-038", "Canales", "Mantener sincronización visible entre email, Meta y WhatsApp QR", "API/E2E", "Canales activos", "Abrir inbox y status views", "Cada canal proyecta su estado sin mezclar ownership ni legacy paralelo", "VERIFICADA", "ecommerce/e2e/admin-conversations-multichannel.spec.ts; ecommerce/e2e/admin-conversations-meta-status.spec.ts", "Mantener", "2026-04-27"),
    ],
  },
  {
    sheetName: "Cross-project",
    project: "Cross-project",
    cases: [
      c("CROSS-001", "Checkout -> Notifications", "Orden confirmada dispara notificación customer", "E2E", "Pedido emitido y canal de notificación activo", "Crear orden de storefront", "La notificación aparece en account/profile y permite navegar al pedido", "VERIFICADA", "ecommerce/e2e/account-notifications-order-detail.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-002", "Storefront -> Admin", "Conversaciones del storefront llegan al admin", "E2E", "Webchat activo y admin autenticado", "Generar conversación pública", "El inbox admin muestra la conversación del hub canónico", "VERIFICADA", "ecommerce/e2e/admin-order-detail-cross-project.spec.ts; frontend/src/services/ConversationsService.ts", "Mantener", "2026-04-27"),
      c("CROSS-003", "Ecommerce -> Chat", "Editar config del chat desde ecommerce mediante contrato", "API/UI", "ChannelControl expuesto", "Guardar settings de canales desde la UI correspondiente", "La edición viaja a ai-platform y el estado vuelve consistente", "VERIFICADA", "ecommerce/e2e/channel-control-contract.spec.ts; ai-platform/backend/src/modules/channel-control/channel-settings.service.ts", "Mantener", "2026-04-27"),
      c("CROSS-004", "Ecommerce Embedded Chat", "El chat embebido del storefront usa ai-platform", "E2E", "Chat platform levantado", "Abrir storefront y disparar webchat", "El widget se conecta al runtime de chat platform y persiste el transcript", "VERIFICADA", "ecommerce/e2e/storefront-webchat.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-005", "Órdenes", "Detalle admin usa UUID público del storefront", "E2E", "Pedido creado en storefront", "Abrir detalle en admin", "El detalle coincide con el UUID y muestra datos estructurados", "VERIFICADA", "ecommerce/e2e/admin-order-detail-cross-project.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-006", "Cuenta", "Notificación customer abre detalle de orden", "E2E", "Usuario con notificación de orden", "Click en notificación", "El router lleva al detalle correcto sin perder contexto", "VERIFICADA", "ecommerce/e2e/account-notifications-order-detail.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-007", "Integraciones", "Config de email/Mercado Pago/Google se comparte por DB segura", "API/UI", "SecureConfig poblado", "Abrir settings en admin y storefront", "Ambos lados leen la misma fuente de verdad sin env duro como autoridad", "DEFINIDA", "docs/PROJECT_STATUS.md; frontend/src/views/settings/GoogleSettings/GoogleSettings.tsx", "La evidencia actual es documental o de código estático; sumar una validación ejecutable compartida antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("CROSS-008", "Conversaciones", "Visibilidad de mensajes entre storefront y admin", "E2E", "Conversación activa", "Abrir conversación desde admin y storefront", "El mismo hilo aparece consistente en ambos lados donde corresponde", "VERIFICADA", "frontend/src/services/ConversationsService.ts; ecommerce/e2e/admin-conversations.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-009", "Red/Seguridad", "CORS y orígenes entre ecommerce/admin/chat platform", "Infra", "Servicios levantados", "Hacer request cross-origin", "Los orígenes permitidos responden y los no permitidos fallan", "DEFINIDA", "ai-platform/backend/src/main.ts", "La evidencia actual es solo código fuente; sumar una validación ejecutable de CORS antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("CROSS-010", "Auth", "Sesiones y cookies no se rompen al cruzar apps", "UI/E2E", "Usuario autenticado en storefront o admin", "Navegar entre apps", "La sesión se conserva donde corresponde y no mezcla scopes", "VERIFICADA", "ecommerce/e2e/cross-app-session.spec.ts; ecommerce/src/state/session-context.tsx; ecommerce/src/components/header/Header.tsx", "Mantener", "2026-04-27"),
      c("CROSS-011", "Ownership", "No duplicar ownership de secretos/configs entre stacks", "Arquitectura", "SecureConfig y ChannelControl activos", "Modificar config sensible", "La verdad reside en chat platform / DB segura y el ecommerce sólo refleja o delega", "DEFINIDA", "docs/PRODUCTION_EXECUTION_PROMPTS.md", "La evidencia actual es documental; sumar una prueba o artefacto ejecutable de ownership/config antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("CROSS-012", "Operación", "El canal de soporte y las acciones del inbox respetan el mismo contrato", "E2E/API", "Canales activos y admin autenticado", "Usar inbox, acciones y cambios de estado", "La UI refleja el mismo contrato operable de ai-platform sin legacy paralelo", "VERIFICADA", "ecommerce/e2e/admin-conversations-multichannel.spec.ts; ecommerce/e2e/admin-conversations-email-reply.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-013", "Menú/UI", "Cambios de CMS y Channels se reflejan con íconos y traducción", "UI", "Navbar cargada", "Abrir menús laterales", "La navegación mantiene iconos y textos traducidos en ambos proyectos donde aplica", "VERIFICADA", "frontend/src/configs/navigation.config/__tests__/apps.navigation.config.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-014", "Chat/Ecommerce", "Ecommerce expone chat embebido pero no owns runtime", "Arquitectura/UI", "Chat platform levantado", "Abrir storefront con widget", "El widget usa ai-platform, mientras ecommerce sólo ofrece superficie de uso", "VERIFICADA", "ecommerce/e2e/storefront-webchat.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-015", "Operación", "Notificación de cuenta y pedido cruzan a admin sin perder UUID", "E2E", "Pedido y notificación creados", "Abrir notificación y detalle admin", "El UUID público sirve como vínculo único entre apps", "VERIFICADA", "ecommerce/e2e/account-notifications-order-detail.spec.ts; ecommerce/e2e/admin-order-detail-cross-project.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-016", "Operación", "Un checkout confirmado genera notificación para customer y para admin", "E2E", "Pedido emitido con canal de notificación activo", "Completar compra", "El customer ve la notificación y el admin ve la superficie operativa asociada", "PENDIENTE", "ecommerce/e2e/account-notifications-order-detail.spec.ts; ecommerce/e2e/admin-conversations-multichannel.spec.ts; ecommerce/e2e/mercadopago-success.spec.ts", "A la espera de recuperar el flujo de confirmación de Mercado Pago y su spec asociada.", "2026-05-08"),
      c("CROSS-017", "Integraciones", "La validación de tipos inválidos falla igual en ecommerce y chat platform", "Arquitectura/UI", "Formularios visibles", "Ingresar letras donde esperan números o datos rotos", "Ambos stacks rechazan los payloads inválidos de forma explícita", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts; ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-018", "Validación", "Checkout, auth y canal settings rechazan valores estructuralmente inválidos", "Arquitectura/UI", "Formularios visibles en ambos stacks", "Probar datos vacíos, letras en números y emails malformados", "La validación corta el flujo y muestra el error adecuado en cada superficie", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts; ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Mantener", "2026-04-27"),
      c("CROSS-019", "Email", "La configuración de inbox/email proviene de DB segura y no de env directo", "Arquitectura/UI", "SecureConfig poblado", "Abrir settings/email y channel inbox views", "Ambos lados leen la misma fuente de verdad y muestran el estado real", "DEFINIDA", "backend/src/email/email-admin.controller.ts; ai-platform/backend/src/modules/channel-control/channel-settings.service.ts", "La evidencia actual es solo código; sumar una validación ejecutable cruzada de inbox/settings antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("CROSS-020", "Canónicas", "La configuración canónica de monoblock viaja de PDP a carrito y checkout sin perderse", "E2E/API", "Producto canónico monoblock publicado", "Abrir PDP canónica, agregar al carrito e ir a checkout", "La misma canonicalConfiguration se conserva entre frontend, backend y analytics; no se degrada a un producto genérico", "DEFINIDA", "backend/src/storefront/storefront.service.ts; ecommerce/src/components/product-cards/StorefrontProductCard.tsx; ecommerce/src/components/cart/CheckoutCostSummary.tsx; ecommerce/src/lib/analytics/product-context.ts; ecommerce/e2e/commerce-critical.spec.ts; ecommerce/e2e/begin-checkout.spec.ts; ecommerce/e2e/purchase-success.spec.ts", "Validar handoff end-to-end de canónica y preservar metadata", ""),
      c("CROSS-021", "Analytics", "Los eventos estructurales mantienen schema y tenant al cruzar storefront y backend", "E2E/API", "Analytics activo y flujo de compra real", "Recorrer navegación, carrito, checkout y compra", "Los eventos conservan tenant_id, page_type, cta_id y schema_version de forma coherente en todos los pasos", "DEFINIDA", "ecommerce/src/lib/analytics/eventSchema.ts; ecommerce/src/components/seo/ProductViewAnalytics.tsx; ecommerce/src/components/cart/CheckoutCostSummary.tsx; ecommerce/e2e/begin-checkout.spec.ts; ecommerce/e2e/purchase-success.spec.ts", "Revisar consistencia de schema en UI y en backend de analytics", ""),
    ],
  },
  {
    sheetName: "Security",
    project: "Security",
    cases: [
      c("SEC-001", "Secretos", "No dejar credenciales sensibles en el repo", "Audit", "Repositorio clonado", "Inspeccionar archivos versionados", "No hay secretos productivos en claro en código fuente o manifiestos publicados", "DEFINIDA", "docs/security.md; docs/security-infrastructure.md", "La evidencia actual es documental; sumar un artefacto o corrida verificable del audit antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-002", "Secretos", "SecureConfig es la fuente de verdad para runtime sensible", "API/DB", "DB segura disponible", "Leer config sensible", "La lectura prioriza DB cifrada y sólo cae a env como fallback bootstrap", "DEFINIDA", "ai-platform/backend/src/modules/runtime-config/runtime-config.service.ts", "La evidencia actual es solo código fuente; sumar una validación ejecutable del runtime seguro antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-003", "Secretos", "Fallback a env sólo para desarrollo/bootstrap", "Infra", "Variables locales presentes", "Arrancar local dev", "El env sólo funciona como ayuda local, no como autoridad productiva", "DEFINIDA", "docs/security.md", "La evidencia actual es documental; sumar un artefacto o corrida verificable del fallback antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-004", "Secretos", "Error claro cuando no existe ningún secreto", "API", "DB vacía y env ausente", "Intentar resolver credencial", "El sistema devuelve error explícito, no mock silencioso", "DEFINIDA", "ai-platform/backend/src/modules/runtime-config/ai-runtime-diagnostics.service.ts", "La evidencia actual es solo código fuente; sumar una validación ejecutable del error de runtime antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-005", "Auth", "Tokens admin no deben persistir en storage", "UI", "Admin autenticado", "Recargar o cerrar sesión", "No queda bearer token persistido como estado permanente en navegador", "DEFINIDA", "docs/PROJECT_STATUS.md", "La evidencia actual es documental; sumar una verificación ejecutable del storage antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-006", "Auth", "Sesión storefront segura y rehidratable", "UI", "Cliente autenticado", "Recargar storefront", "La sesión se restablece por backend/cookie sin exponer el secreto en localStorage", "DEFINIDA", "ecommerce/src/state/session-context.tsx", "La evidencia actual es solo código fuente; sumar una validación ejecutable de sesión antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-007", "OAuth", "Google OAuth protege secretos y origen", "UI/API", "Google activo", "Iniciar sign-in", "El flujo usa secreto seguro y valida origen/estado", "DEFINIDA", "ecommerce/src/state/session-context.tsx", "La evidencia actual es solo código fuente; sumar una validación ejecutable de OAuth antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-008", "Pagos", "Mercado Pago protege claves y tokens", "API/UI", "Proveedor activo", "Crear preferencia/pago", "Las claves no quedan expuestas en el cliente más allá de la public key permitida", "DEFINIDA", "backend/src/storefront/payments/mercadopago.service.ts; frontend/src/views/settings/GoogleSettings/GoogleSettings.tsx", "Evidencia de código presente; falta reconfirmar runtime con credenciales vivas y DB accesible.", "2026-05-08"),
      c("SEC-009", "Canales", "Los secretos de canales quedan cifrados en DB", "DB/API", "ChannelControl y SecureConfig activos", "Guardar credenciales de canal", "La persistencia ocurre cifrada y con ownership claro", "DEFINIDA", "ai-platform/backend/src/modules/runtime-config/ai-runtime-secrets.ts", "La evidencia actual es solo código fuente; sumar una validación ejecutable del cifrado antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-010", "Red", "Allowlist CORS y orígenes de producción", "Infra", "Servicios levantados", "Hacer request cross-origin", "Sólo los orígenes previstos obtienen acceso", "DEFINIDA", "ai-platform/backend/src/main.ts", "La evidencia actual es solo código fuente; sumar una validación ejecutable de CORS antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-011", "Autorización", "Rechazar requests no autorizados", "API", "Usuario sin token o con token inválido", "Llamar endpoints protegidos", "La API responde 401/403 según corresponda y no filtra datos", "VERIFICADA", "backend/src/auth/__tests__/auth.service.spec.ts; backend/src/auth/__tests__/roles.guard.spec.ts", "Mantener", "2026-04-27"),
      c("SEC-012", "Sesión", "Logout invalida sesión y limpia storage temporal", "UI", "Usuario autenticado", "Cerrar sesión", "La sesión se elimina en backend y el browser queda sin estado protegido", "VERIFICADA", "ecommerce/e2e/logout-session.spec.ts", "Mantener", "2026-04-27"),
      c("SEC-013", "Entorno", "Archivos env versionados sólo como baseline de desarrollo", "Repo", "Repo clonado", "Revisar deploy/env", "Los env local/dev están explícitamente marcados como baseline y no como autoridad productiva", "DEFINIDA", "docs/security.md; docs/security-infrastructure.md", "La evidencia actual es documental; sumar un artefacto o corrida verificable del baseline antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-014", "Runtime", "No usar mock como solución en producción", "Arquitectura", "ai-platform activo", "Revisar runtime config", "El runtime falla explícitamente si falta la fuente real, en vez de esconderse tras mock", "DEFINIDA", "docs/PRODUCTION_EXECUTION_PROMPTS.md; ai-platform/backend/src/modules/runtime-config/ai-runtime-diagnostics.service.ts", "La evidencia actual no alcanza el gate core; sumar una validación ejecutable fuera del scope deferred antes de volver a marcarla VERIFICADA.", "2026-04-27"),
      c("SEC-015", "Endpoints", "Bloquear boundary de endpoints internos", "API", "Rutas internas disponibles", "Probar una ruta interna sin token", "Las rutas internas no quedan expuestas públicamente sin autorización", "DEFINIDA", "ai-platform/backend/src/modules/channel-control/__tests__/channel-control-internal.controller.spec.ts", "Queda fuera del gate core mientras la evidencia viva sólo en scope deferred de chat platform.", "2026-04-27"),
      c("SEC-016", "Validación", "Rechazar email malformado en cualquier formulario que lo requiera", "UI/API", "Formularios visibles", "Escribir un email inválido", "La validación corta el flujo y muestra un error entendible", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts; ecommerce/e2e/auth-email.spec.ts", "Mantener", "2026-04-27"),
      c("SEC-017", "Validación", "Rechazar teléfonos con letras o longitud inválida", "UI/API", "Formularios visibles", "Ingresar letras o un teléfono incompleto", "La validación bloquea el submit y no persiste el dato roto", "VERIFICADA", "ecommerce/e2e/form-validation-negative.spec.ts; ecommerce/e2e/auth-register-duplicate.spec.ts", "Mantener", "2026-04-27"),
      c("SEC-018", "Validación", "Rechazar puertos o credenciales de canal con tipos inválidos", "API/UI", "ChannelControl o settings abiertos", "Ingresar puerto no numérico o campo vacío", "El backend/UI devuelve error claro y no persiste config corrupta", "DEFINIDA", "ai-platform/backend/src/modules/api/__tests__/dto-validation.spec.ts", "Queda fuera del gate core mientras la evidencia viva sólo en scope deferred de chat platform.", "2026-04-27"),
      c("SEC-019", "Autorización", "Rechazar tokens inválidos o expirados", "API", "Servicios levantados", "Llamar endpoints protegidos con token roto", "La API responde 401/403 y no filtra datos", "VERIFICADA", "backend/src/auth/__tests__/auth.service.spec.ts; backend/src/auth/jwt.strategy.ts", "Mantener", "2026-04-27"),
      c("SEC-020", "Secretos", "No exponer secretos en payloads de canal ni en respuestas de settings", "API/UI", "Canales configurados", "Abrir settings y revisar payloads", "Las respuestas ocultan secretos y sólo exponen campos permitidos", "DEFINIDA", "ai-platform/backend/src/modules/channel-control/__tests__/channel-settings.service.spec.ts", "Queda fuera del gate core mientras la evidencia viva sólo en scope deferred de chat platform.", "2026-04-27"),
      c("SEC-021", "Runtime", "Error explícito cuando falta la config real", "API", "DB vacía o secreto ausente", "Resolver runtime/credencial", "El sistema falla con error claro y no cae en mock silencioso", "DEFINIDA", "ai-platform/backend/src/modules/runtime-config/ai-runtime-diagnostics.service.ts", "La evidencia actual es solo código fuente; sumar una validación ejecutable del error de runtime antes de volver a marcarla VERIFICADA.", "2026-04-27"),
    ],
  },
];
