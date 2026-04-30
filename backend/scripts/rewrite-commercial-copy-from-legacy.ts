import { PrismaClient, CmsPageSectionType } from "@prisma/client";

const prisma = new PrismaClient();

const richText = (paragraphs: string[]) =>
  paragraphs.map((text) => ({
    tag: "p",
    type: "element",
    children: [{ type: "text", value: text }],
  })) as any;

const updateSectionSettings = async (
  tx: any,
  sectionId: number,
  settings: Record<string, unknown>,
) => {
  await tx.cmsPageSection.update({
    where: { id: sectionId },
    data: { settings: settings as any },
  });
};

const updateBlockContent = async (
  tx: any,
  blockId: number,
  content: Record<string, unknown>,
) => {
  await tx.cmsPageBlock.update({
    where: { id: blockId },
    data: { content: content as any },
  });
};

const findSection = (page: Awaited<ReturnType<typeof loadPage>>, type: CmsPageSectionType) =>
  page.sections.find((section) => section.type === type);

async function loadPage(path: string) {
  const page = await prisma.cmsPage.findUnique({
    where: { path },
    include: {
      sections: {
        include: {
          blocks: true,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!page) {
    throw new Error(`CMS page not found: ${path}`);
  }

  return page;
}

async function rewritePersianasHub() {
  const page = await loadPage("productos/persianas");
  const hero = findSection(page, CmsPageSectionType.HERO);
  const featureGrid = findSection(page, CmsPageSectionType.FEATURE_GRID);
  const contentSplit = findSection(page, CmsPageSectionType.CONTENT_SPLIT);
  const faq = findSection(page, CmsPageSectionType.FAQ);
  const cta = findSection(page, CmsPageSectionType.CTA_BANNER);

  if (!hero || !featureGrid || !contentSplit || !faq || !cta) {
    throw new Error("productos/persianas is missing required sections");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "Persianas de enrollar",
        summary:
          "Elegí producto, comparativa o reparación según el estado real del frente.",
        seoTitle: "Persianas de enrollar | Urucortinas",
        seoDescription:
          "Persianas de enrollar en PVC o aluminio, con reparación y comparativa para elegir la solución correcta según uso, exposición y mantenimiento.",
      },
    });

    await updateSectionSettings(tx, hero.id, {
      title: "Persianas de enrollar",
      slides: [
        {
          href: "/productos/cortinas-de-enrollar.html",
          title: "Elegí la solución correcta",
          imageAlt: "Persianas de enrollar",
          imageUrl: "/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg",
          linkLabel: "Ver producto",
          description:
            "Si vas a instalar, comparar o reparar, empezá por el camino que encaja con tu frente.",
        },
      ],
      eyebrow: "Soluciones para frentes",
      description:
        "Encontrá rápido la familia de producto, la comparativa de materiales o el servicio de reparación.",
      headingLevel: "h1",
      primaryCtaHref: "/productos/cortinas-de-enrollar.html",
      primaryCtaLabel: "Ver cortinas de enrollar",
      secondaryCtaHref: "/guias/cortinas-pvc-vs-aluminio",
      secondaryCtaLabel: "Comparar PVC y aluminio",
    });

    await updateSectionSettings(tx, featureGrid.id, {
      title: "Tres caminos útiles",
      description:
        "Producto, comparativa o reparación según lo que ya tengas resuelto.",
      itemHeadingLevel: "h3",
    });

    const featureBlocks = featureGrid.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, featureBlocks[0].id, {
      title: "Producto",
      body: "Entrá por acá si necesitás una instalación nueva o un recambio de persianas de enrollar.",
      href: "/productos/cortinas-de-enrollar.html",
      linkLabel: "Ver producto",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[1].id, {
      title: "Reparación",
      body: "Si ya la tenés instalada y falla, resolvemos trabas, cintas, ejes, guías y lamas.",
      href: "/servicios/reparacion-cortinas-y-persianas.html",
      linkLabel: "Ver servicio",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[2].id, {
      title: "Comparativa",
      body: "Si todavía dudás entre PVC y aluminio, compará uso, exposición y mantenimiento.",
      href: "/guias/cortinas-pvc-vs-aluminio",
      linkLabel: "Leer comparativa",
      headingLevel: "h3",
    });

    await updateSectionSettings(tx, contentSplit.id, {
      actions: [
        { href: "/productos/cortinas-de-enrollar.html", label: "Ver producto" },
        { href: "/guias/cortinas-pvc-vs-aluminio", label: "Ver comparativa" },
        { href: "/servicios/reparacion-cortinas-y-persianas.html", label: "Ver reparación" },
      ],
      imageAlt: "Persianas de enrollar",
      imageUrl: "/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg",
      mediaPosition: "end",
    });
    await updateBlockContent(tx, contentSplit.blocks[0].id, {
      richText: richText([
        "Las persianas de enrollar sirven para cerrar frentes, sumar privacidad y proteger el uso diario con una terminación prolija.",
        "PVC funciona muy bien cuando buscás practicidad y menos mantenimiento. Aluminio conviene cuando el frente pide más firmeza y una respuesta más robusta.",
        "Si el sistema actual ya existe y la falla es puntual, muchas veces conviene revisar reparación antes de cambiar todo.",
      ]),
    });

    await updateSectionSettings(tx, faq.id, {
      title: "Preguntas frecuentes",
      description: "Dudas útiles antes de elegir producto, comparar materiales o pedir reparación.",
    });
    const faqBlocks = faq.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, faqBlocks[0].id, {
      question: "¿PVC o aluminio?",
      answerRichText: richText([
        "PVC es una buena opción si priorizás practicidad y menor mantenimiento. Aluminio conviene cuando necesitás más resistencia y una sensación de cierre más sólida.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[1].id, {
      question: "¿Sirven para viviendas y comercios?",
      answerRichText: richText([
        "Sí. Funcionan en frentes residenciales y comerciales, y la elección del material cambia según uso, exposición y nivel de exigencia.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[2].id, {
      question: "¿Se puede reparar antes de reemplazar?",
      answerRichText: richText([
        "Sí. Si la estructura está bien y la falla está en cinta, eje, guías o lamas, reparar suele ser la salida más razonable.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[3].id, {
      question: "¿Puedo pedir una recomendación con medidas aproximadas?",
      answerRichText: richText([
        "Sí. Con una referencia de medidas y una foto del frente se puede orientar mejor la opción.",
      ]),
    });

    await updateSectionSettings(tx, cta.id, {
      title: "Pedí recomendación para tu frente",
      intent: "transactional",
      actions: [
        { href: "/contacto.html", label: "Contactar" },
        { href: "/precios/cortinas-de-enrollar", label: "Ver precios" },
      ],
      variant: "default",
      description:
        "Con medidas aproximadas y una foto del frente podemos orientarte mejor.",
    });
  });
}

async function rewriteCortinasGeneral() {
  const page = await loadPage("productos/cortinas-de-enrollar.html");
  const hero = findSection(page, CmsPageSectionType.HERO);
  const featureGrid = findSection(page, CmsPageSectionType.FEATURE_GRID);
  const contentSplit = findSection(page, CmsPageSectionType.CONTENT_SPLIT);
  const faq = findSection(page, CmsPageSectionType.FAQ);
  const cta = findSection(page, CmsPageSectionType.CTA_BANNER);

  if (!hero || !featureGrid || !contentSplit || !faq || !cta) {
    throw new Error("productos/cortinas-de-enrollar.html is missing required sections");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "Cortinas de enrollar a medida",
        summary:
          "Elegí PVC o aluminio, instalación nueva o recambio, y repará si ya tenés sistema.",
        seoTitle: "Cortinas de enrollar a medida | Urucortinas",
        seoDescription:
          "Cortinas de enrollar a medida en PVC o aluminio. Soluciones manuales o motorizadas, con instalación sin obra y reparación según el caso.",
      },
    });

    await updateSectionSettings(tx, hero.id, {
      title: "Cortinas de enrollar a medida",
      slides: [
        {
          href: "/guias/cortinas-pvc-vs-aluminio",
          title: "Elegí entre aluminio y PVC",
          imageAlt: "Cortinas de enrollar a medida",
          imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/aluminio/cortina_enrollar_aluminio_1.jpeg",
          linkLabel: "Ver comparativa",
          description:
            "Elegí el material según el uso, el frente y el mantenimiento que buscás.",
        },
      ],
      eyebrow: "Solución a medida",
      description:
        "Para cerrar, proteger y terminar mejor el frente con una opción que se adapta a obra nueva o recambio.",
      headingLevel: "h1",
      primaryCtaHref: "/contacto.html",
      primaryCtaLabel: "Pedir asesoramiento",
      secondaryCtaHref: "/guias/cortinas-pvc-vs-aluminio",
      secondaryCtaLabel: "Ver comparativa",
    });

    await updateSectionSettings(tx, featureGrid.id, {
      title: "Opciones para decidir",
      description:
        "Elegí aluminio, PVC, reparación o precio según la etapa en la que esté tu proyecto.",
      itemHeadingLevel: "h3",
    });
    const featureBlocks = featureGrid.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, featureBlocks[0].id, {
      title: "Aluminio",
      body: "Elegilas cuando necesitás más firmeza y una respuesta robusta en el frente.",
      href: "/productos/cortinas-de-enrollar-aluminio.html",
      linkLabel: "Ver aluminio",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[1].id, {
      title: "PVC",
      body: "Conviene cuando priorizás practicidad, menos mantenimiento y una solución más accesible.",
      href: "/productos/cortinas-de-enrollar-pvc.html",
      linkLabel: "Ver PVC",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[2].id, {
      title: "Reparación",
      body: "Si ya tenés una instalada, vale revisar si alcanza con ajustar o reparar antes de cambiar todo.",
      href: "/servicios/reparacion-cortinas-y-persianas.html",
      linkLabel: "Ver reparación",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[3].id, {
      title: "Precio",
      body: "El valor cambia según medidas, material e instalación. Pedí una referencia antes de decidir.",
      href: "/precios/cortinas-de-enrollar",
      linkLabel: "Ver precios",
      headingLevel: "h3",
    });

    await updateSectionSettings(tx, contentSplit.id, {
      actions: [
        { href: "/productos/cortinas-de-enrollar-aluminio.html", label: "Ver aluminio" },
        { href: "/productos/cortinas-de-enrollar-pvc.html", label: "Ver PVC" },
        { href: "/precios/cortinas-de-enrollar", label: "Ver precios" },
      ],
      imageAlt: "Cortina de enrollar",
      imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/aluminio/cortina_enrollar_aluminio_1.jpeg",
      mediaPosition: "start",
    });
    await updateBlockContent(tx, contentSplit.blocks[0].id, {
      richText: richText([
        "Las cortinas de enrollar resuelven privacidad, protección y cerramiento con una instalación prolija.",
        "Pueden ser manuales o motorizadas, y se adaptan a obra nueva o recambio.",
        "Cuando el frente da a la calle o recibe uso diario, el aluminio suele dar más firmeza. Cuando el objetivo es una solución práctica con menos mantenimiento, PVC suele ser el punto de partida.",
        "Si ya existe un sistema instalado, revisar reparación antes de cambiar todo ayuda a evitar un gasto innecesario.",
      ]),
    });

    await updateSectionSettings(tx, faq.id, {
      title: "Preguntas frecuentes",
      description: "Respuestas cortas para avanzar con más seguridad.",
    });
    const faqBlocks = faq.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, faqBlocks[0].id, {
      question: "¿Se instalan sin obra?",
      answerRichText: richText([
        "Sí, en muchos casos se instalan sin albañilería y se coordinan según el frente.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[1].id, {
      question: "¿Pueden ser manuales o motorizadas?",
      answerRichText: richText([
        "Sí, según el producto y el tipo de uso.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[2].id, {
      question: "¿Cuándo conviene aluminio?",
      answerRichText: richText([
        "Cuando necesitás más robustez, una respuesta más firme y mejor comportamiento en frentes expuestos.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[3].id, {
      question: "¿Cuándo conviene PVC?",
      answerRichText: richText([
        "Cuando priorizás practicidad, mantenimiento simple y un costo más accesible.",
      ]),
    });

    await updateSectionSettings(tx, cta.id, {
      title: "Pedí presupuesto con medidas aproximadas",
      intent: "transactional",
      actions: [
        { href: "/contacto.html", label: "Contactar" },
        { href: "/precios/cortinas-de-enrollar", label: "Ver precios" },
      ],
      variant: "default",
      description:
        "Si ya tenés una referencia del frente, podemos orientarte mejor.",
    });
  });
}

async function rewritePVCPage() {
  const page = await loadPage("productos/cortinas-de-enrollar-pvc.html");
  const hero = findSection(page, CmsPageSectionType.HERO);
  const featureGrid = findSection(page, CmsPageSectionType.FEATURE_GRID);
  const contentSplit = findSection(page, CmsPageSectionType.CONTENT_SPLIT);
  const faq = findSection(page, CmsPageSectionType.FAQ);
  const cta = findSection(page, CmsPageSectionType.CTA_BANNER);

  if (!hero || !featureGrid || !contentSplit || !faq || !cta) {
    throw new Error("productos/cortinas-de-enrollar-pvc.html is missing required sections");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "Cortinas de enrollar en PVC",
        summary:
          "Opción funcional y económica para cerramiento, privacidad y mantenimiento simple.",
        seoTitle: "Cortinas de enrollar en PVC | Urucortinas",
        seoDescription:
          "Cortinas de enrollar en PVC para frentes que buscan practicidad, bajo mantenimiento y buena relación costo-beneficio.",
      },
    });

    await updateSectionSettings(tx, hero.id, {
      title: "Cortinas de enrollar en PVC",
      slides: [
        {
          href: "/guias/cortinas-pvc-vs-aluminio",
          title: "PVC como opción práctica",
          imageAlt: "Cortinas de enrollar en PVC",
          imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/pvc/cortina_enrollar_pvc_1.jpeg",
          linkLabel: "Ver comparativa",
          description:
            "Menos mantenimiento, buena relación costo-beneficio y una decisión más simple cuando el uso no exige máxima robustez.",
        },
      ],
      eyebrow: "Solución práctica",
      description:
        "Una alternativa útil cuando buscás una solución funcional, estética y económica.",
      headingLevel: "h1",
      primaryCtaHref: "/contacto.html",
      primaryCtaLabel: "Pedir presupuesto",
      secondaryCtaHref: "/guias/cortinas-pvc-vs-aluminio",
      secondaryCtaLabel: "Comparar con aluminio",
    });

    await updateSectionSettings(tx, featureGrid.id, {
      title: "Puntos de decisión",
      description:
        "Cuando el frente exige menos complejidad, PVC suele ser un buen punto de partida.",
      itemHeadingLevel: "h3",
    });
    const featureBlocks = featureGrid.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, featureBlocks[0].id, {
      title: "Cuándo conviene PVC",
      body: "Funciona bien en viviendas y frentes donde buscás practicidad, privacidad y una solución simple de sostener.",
      href: "/guias/cortinas-pvc-vs-aluminio",
      linkLabel: "Ver comparativa",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[1].id, {
      title: "Terminación y color",
      body: "Se trabaja en blanco, con una terminación limpia que acompaña bien la mayoría de los frentes.",
      href: "/contacto.html",
      linkLabel: "Consultar",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[2].id, {
      title: "Comparar con aluminio",
      body: "Si el frente recibe más uso o pedís más firmeza, conviene revisar aluminio antes de decidir.",
      href: "/productos/cortinas-de-enrollar-aluminio.html",
      linkLabel: "Ver aluminio",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[3].id, {
      title: "Reparación",
      body: "Si ya tenés instalada la cortina, también podés revisar si conviene reparar antes de cambiar todo.",
      href: "/servicios/reparacion-cortinas-y-persianas.html",
      linkLabel: "Ver reparación",
      headingLevel: "h3",
    });

    await updateSectionSettings(tx, contentSplit.id, {
      actions: [
        { href: "/productos/cortinas-de-enrollar-aluminio.html", label: "Ver aluminio" },
        { href: "/guias/cortinas-pvc-vs-aluminio", label: "Ver comparativa" },
        { href: "/servicios/reparacion-cortinas-y-persianas.html", label: "Ver reparación" },
      ],
      imageAlt: "Detalle de cortina de enrollar en PVC",
      imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/pvc/cortina_enrollar_pvc_1.jpeg",
      mediaPosition: "end",
    });
    await updateBlockContent(tx, contentSplit.blocks[0].id, {
      richText: richText([
        "Las cortinas de enrollar en PVC resuelven cerramiento, privacidad y control de luz con una propuesta simple.",
        "Son una buena opción cuando el mantenimiento importa más que la máxima resistencia y cuando querés una compra más accesible.",
        "Si el frente pide otra respuesta, el aluminio puede ser una mejor alternativa. Y si el sistema ya está instalado y falla, vale la pena revisar reparación antes de reemplazar.",
      ]),
    });

    await updateSectionSettings(tx, faq.id, {
      title: "Preguntas frecuentes",
      description: "Preguntas concretas para decidir con tranquilidad.",
    });
    const faqBlocks = faq.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, faqBlocks[0].id, {
      question: "¿En qué color vienen?",
      answerRichText: richText([
        "Se trabajan en blanco, una terminación limpia que combina bien con la mayoría de los frentes.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[1].id, {
      question: "¿Cuándo conviene PVC?",
      answerRichText: richText([
        "Cuando priorizás practicidad, menos mantenimiento y una solución más económica.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[2].id, {
      question: "¿Se pueden instalar sin obra?",
      answerRichText: richText([
        "Sí. En muchos casos se resuelve sin albañilería y se adapta al frente existente.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[3].id, {
      question: "¿Conviene comparar con aluminio?",
      answerRichText: richText([
        "Sí. Si necesitás más firmeza o el frente tiene más exigencia, comparar con aluminio ayuda a tomar una mejor decisión.",
      ]),
    });

    await updateSectionSettings(tx, cta.id, {
      title: "Cotizá PVC con medidas aproximadas",
      intent: "transactional",
      actions: [
        { href: "/contacto.html", label: "Contactar" },
        { href: "/guias/cortinas-pvc-vs-aluminio", label: "Ver comparativa" },
      ],
      variant: "default",
      description:
        "Si ya sabés el tipo de frente y el uso, podemos ayudarte a cerrar una decisión más precisa.",
    });
  });
}

async function rewriteRepairPage() {
  const page = await loadPage("servicios/reparacion-cortinas-y-persianas.html");
  const hero = findSection(page, CmsPageSectionType.HERO);
  const featureGrid = findSection(page, CmsPageSectionType.FEATURE_GRID);
  const contentSplit = findSection(page, CmsPageSectionType.CONTENT_SPLIT);
  const faq = findSection(page, CmsPageSectionType.FAQ);
  const cta = findSection(page, CmsPageSectionType.CTA_BANNER);

  if (!hero || !featureGrid || !contentSplit || !faq || !cta) {
    throw new Error("servicios/reparacion-cortinas-y-persianas.html is missing required sections");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "Reparación de cortinas y persianas",
        summary:
          "Servicio de reparación con respuesta rápida para trabas, roturas y fallas que necesitan solución.",
        seoTitle: "Reparación de cortinas y persianas | Urucortinas",
        seoDescription:
          "Reparación de cortinas y persianas con visita rápida en Montevideo y coordinación para trabas, roturas, ejes, guías y mecanismos.",
      },
    });

    await updateSectionSettings(tx, hero.id, {
      title: "Reparación de cortinas y persianas",
      slides: [
        {
          href: "/contacto.html",
          title: "Reparación rápida",
          imageAlt: "Reparación de cortinas y persianas",
          imageUrl: "/uploads/cms/legacy-assets/img/contacto/contacto.jpeg",
          linkLabel: "Coordinar visita",
          description:
            "Cinta, eje, lamas o guías dañadas: revisamos la falla y te proponemos la mejor salida.",
        },
      ],
      eyebrow: "Servicio urgente",
      description:
        "Cuando la cortina quedó trabada, rota o fuera de uso, coordinamos una visita para resolverlo cuanto antes.",
      headingLevel: "h1",
      primaryCtaHref: "/contacto.html",
      primaryCtaLabel: "Coordinar visita",
      secondaryCtaHref: "/servicios/reparacion-urgente",
      secondaryCtaLabel: "Ver urgencia",
    });

    await updateSectionSettings(tx, featureGrid.id, {
      title: "Qué resolvemos",
      description: "Atendemos trabas, roturas y fallas que impiden abrir o cerrar bien.",
      itemHeadingLevel: "h3",
    });
    const featureBlocks = featureGrid.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, featureBlocks[0].id, {
      title: "Qué reparamos",
      body: "Cinta, eje, lamas, guías, rodamientos, mecanismos y motores.",
      href: "/contacto.html",
      linkLabel: "Coordinar",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[1].id, {
      title: "Respuesta rápida",
      body: "Cuando la urgencia lo pide, priorizamos la visita para recuperar uso y seguridad.",
      href: "/servicios/reparacion-urgente",
      linkLabel: "Ver urgente",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[2].id, {
      title: "Reparar o reemplazar",
      body: "Si la estructura sigue aprovechable, reparar suele ser la mejor salida.",
      href: "/guias/cortinas-pvc-vs-aluminio",
      linkLabel: "Ver comparativa",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[3].id, {
      title: "Pedir visita",
      body: "Pasanos foto y una breve descripción para acelerar el diagnóstico.",
      href: "/contacto.html",
      linkLabel: "Contactar",
      headingLevel: "h3",
    });

    await updateSectionSettings(tx, contentSplit.id, {
      actions: [
        { href: "/contacto.html", label: "Coordinar visita" },
        { href: "/servicios/reparacion-urgente", label: "Ver reparación urgente" },
        { href: "/guias/cortinas-pvc-vs-aluminio", label: "Ver comparativa" },
      ],
      imageAlt: "Servicio de reparación",
      imageUrl: "/uploads/cms/legacy-assets/img/contacto/contacto.jpeg",
      mediaPosition: "start",
    });
    await updateBlockContent(tx, contentSplit.blocks[0].id, {
      richText: richText([
        "La reparación apunta a resolver trabas, roturas y atascos sin reemplazar todo el sistema si no hace falta.",
        "En muchas cortinas y persianas, el problema está en un componente puntual y no en el conjunto. Ahí reparar ahorra tiempo y dinero.",
        "Si la falla es más grande, te lo decimos para que avances con la solución que realmente conviene.",
      ]),
    });

    await updateSectionSettings(tx, faq.id, {
      title: "Preguntas frecuentes",
      description: "Respuestas cortas para avanzar con más rapidez.",
    });
    const faqBlocks = faq.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, faqBlocks[0].id, {
      question: "¿Qué reparan?",
      answerRichText: richText([
        "Reparamos cinta, eje, guías, lamas, rodamientos, mecanismos y motores.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[1].id, {
      question: "¿Atienden urgencias?",
      answerRichText: richText([
        "Sí. Cuando la falla deja el frente fuera de uso priorizamos la coordinación rápida.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[2].id, {
      question: "¿Conviene reparar o reemplazar?",
      answerRichText: richText([
        "Si el sistema todavía tiene estructura aprovechable, reparar suele ser el primer paso.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[3].id, {
      question: "¿Qué ayuda a acelerar la visita?",
      answerRichText: richText([
        "Una foto, medidas aproximadas y una breve descripción de la falla.",
      ]),
    });

    await updateSectionSettings(tx, cta.id, {
      title: "Coordiná la reparación",
      intent: "urgent",
      actions: [
        { href: "/contacto.html", label: "Coordinar visita" },
        { href: "/servicios/reparacion-urgente", label: "Ver urgente" },
      ],
      variant: "default",
      description: "Cuanto antes se vea la falla, antes se define la mejor salida.",
    });
  });
}

async function rewriteGuidePage() {
  const page = await loadPage("guias/cortinas-pvc-vs-aluminio");
  const hero = findSection(page, CmsPageSectionType.HERO);
  const featureGrid = findSection(page, CmsPageSectionType.FEATURE_GRID);
  const contentSplit = findSection(page, CmsPageSectionType.CONTENT_SPLIT);
  const faq = findSection(page, CmsPageSectionType.FAQ);
  const cta = findSection(page, CmsPageSectionType.CTA_BANNER);

  if (!hero || !featureGrid || !contentSplit || !faq || !cta) {
    throw new Error("guias/cortinas-pvc-vs-aluminio is missing required sections");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "PVC vs aluminio: cuál te conviene",
        summary:
          "Compará materiales, exposición y mantenimiento para elegir mejor.",
        seoTitle: "PVC vs aluminio | Urucortinas",
        seoDescription:
          "Compará cortinas de enrollar en PVC y aluminio según uso, exposición, mantenimiento y precio para elegir la mejor opción.",
      },
    });

    await updateSectionSettings(tx, hero.id, {
      title: "PVC vs aluminio: cuál te conviene",
      slides: [
        {
          href: "/productos/cortinas-de-enrollar-pvc.html",
          title: "Comparación real",
          imageAlt: "Comparación PVC vs aluminio",
          imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/pvc/cortina_enrollar_pvc_1.jpeg",
          linkLabel: "Ver PVC",
          description:
            "No hay una única respuesta: depende de cómo se use la cortina, dónde está instalada y qué nivel de resistencia necesitás.",
        },
      ],
      eyebrow: "Comparación útil",
      description:
        "Elegí con más contexto y menos intuición según el uso real del frente.",
      headingLevel: "h1",
      primaryCtaHref: "/productos/cortinas-de-enrollar-pvc.html",
      primaryCtaLabel: "Ver PVC",
      secondaryCtaHref: "/productos/cortinas-de-enrollar-aluminio.html",
      secondaryCtaLabel: "Ver aluminio",
    });

    await updateSectionSettings(tx, featureGrid.id, {
      title: "Qué revisar antes de decidir",
      description:
        "Elegí el material según el frente, el uso diario y el balance entre costo y mantenimiento.",
      itemHeadingLevel: "h3",
    });
    const featureBlocks = featureGrid.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, featureBlocks[0].id, {
      title: "PVC",
      body: "Funciona muy bien cuando priorizás practicidad, menos mantenimiento y una solución más simple.",
      href: "/productos/cortinas-de-enrollar-pvc.html",
      linkLabel: "Ver PVC",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[1].id, {
      title: "Aluminio",
      body: "Conviene cuando el frente da a la calle, recibe uso diario o necesitás más firmeza.",
      href: "/productos/cortinas-de-enrollar-aluminio.html",
      linkLabel: "Ver aluminio",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[2].id, {
      title: "Si ya está instalado",
      body: "Si la cortina ya existe, vale revisar reparación antes de pensar en reemplazo.",
      href: "/servicios/reparacion-cortinas-y-persianas.html",
      linkLabel: "Ver reparación",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[3].id, {
      title: "Precio",
      body: "El material cambia el valor y también cambia la prestación que recibís.",
      href: "/precios/cortinas-de-enrollar",
      linkLabel: "Ver precios",
      headingLevel: "h3",
    });

    await updateSectionSettings(tx, contentSplit.id, {
      actions: [
        { href: "/productos/cortinas-de-enrollar-pvc.html", label: "Ver PVC" },
        { href: "/productos/cortinas-de-enrollar-aluminio.html", label: "Ver aluminio" },
        { href: "/servicios/reparacion-cortinas-y-persianas.html", label: "Ver reparación" },
      ],
      imageAlt: "Comparación de materiales",
      imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/pvc/cortina_enrollar_pvc_1.jpeg",
      mediaPosition: "start",
    });
    await updateBlockContent(tx, contentSplit.blocks[0].id, {
      richText: richText([
        "No hay una opción única: depende de cómo se use la cortina, dónde está instalada y qué nivel de resistencia necesitás.",
        "PVC suele ser la opción más práctica cuando buscás mantenimiento simple y una compra más accesible. Aluminio suele ser la mejor respuesta cuando el frente exige más firmeza.",
        "Si el sistema ya está instalado, revisar reparación antes de reemplazar sigue siendo una alternativa válida.",
      ]),
    });

    await updateSectionSettings(tx, faq.id, {
      title: "Preguntas frecuentes",
      description: "Preguntas útiles para comparar sin perder tiempo.",
    });
    const faqBlocks = faq.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, faqBlocks[0].id, {
      question: "¿Cómo elijo entre PVC y aluminio?",
      answerRichText: richText([
        "Elegí PVC si priorizás mantenimiento simple y una solución más liviana. Elegí aluminio si necesitás mayor robustez o el frente tiene más exigencia.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[1].id, {
      question: "¿Aplica a viviendas y comercios?",
      answerRichText: richText([
        "Sí. La comparación sirve en ambos casos, aunque el peso relativo de resistencia, mantenimiento y apariencia puede cambiar según el uso.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[2].id, {
      question: "¿Qué hago si ya tengo una falla?",
      answerRichText: richText([
        "Si la cortina ya está instalada, primero vale revisar si conviene reparar antes de reemplazar.",
      ]),
    });

    await updateSectionSettings(tx, cta.id, {
      title: "Pasá de la comparación a una decisión concreta",
      intent: "informational",
      actions: [
        { href: "/productos/cortinas-de-enrollar-pvc.html", label: "Ver PVC" },
        { href: "/productos/cortinas-de-enrollar-aluminio.html", label: "Ver aluminio" },
      ],
      variant: "default",
      description:
        "Si ya sabés qué material te interesa, el siguiente paso es mirar el producto o pedir presupuesto.",
    });
  });
}

async function rewritePricePage() {
  const page = await loadPage("precios/cortinas-de-enrollar");
  const hero = findSection(page, CmsPageSectionType.HERO);
  const featureGrid = findSection(page, CmsPageSectionType.FEATURE_GRID);
  const contentSplit = findSection(page, CmsPageSectionType.CONTENT_SPLIT);
  const faq = findSection(page, CmsPageSectionType.FAQ);
  const cta = findSection(page, CmsPageSectionType.CTA_BANNER);

  if (!hero || !featureGrid || !contentSplit || !faq || !cta) {
    throw new Error("precios/cortinas-de-enrollar is missing required sections");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "Precio de cortinas de enrollar",
        summary:
          "Entendé qué cambia el valor y cómo llevarlo a una cotización real.",
        seoTitle: "Precio de cortinas de enrollar | Urucortinas",
        seoDescription:
          "El precio de las cortinas de enrollar cambia por material, medidas e instalación. Pedí una referencia útil antes de comprar.",
      },
    });

    await updateSectionSettings(tx, hero.id, {
      title: "Precio de cortinas de enrollar",
      slides: [
        {
          href: "/contacto.html",
          title: "Precio con contexto",
          imageAlt: "Precio de cortinas de enrollar",
          imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/aluminio/cortina_enrollar_aluminio_1.jpeg",
          linkLabel: "Pedir presupuesto",
          description:
            "El valor cambia según material, medidas e instalación. Pedí una referencia útil antes de comprar.",
        },
      ],
      eyebrow: "Precio y variables",
      description:
        "El valor depende del material, las medidas y el tipo de instalación.",
      headingLevel: "h1",
      primaryCtaHref: "/contacto.html",
      primaryCtaLabel: "Pedir presupuesto",
      secondaryCtaHref: "/guias/cortinas-pvc-vs-aluminio",
      secondaryCtaLabel: "Ver comparativa",
    });

    await updateSectionSettings(tx, featureGrid.id, {
      title: "Qué cambia el valor",
      description:
        "Material, medidas, instalación y si ya existe una cortina instalada son las variables principales.",
      itemHeadingLevel: "h3",
    });
    const featureBlocks = featureGrid.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, featureBlocks[0].id, {
      title: "Material",
      body: "PVC suele ser más accesible. Aluminio suma firmeza y otra prestación para el frente.",
      href: "/guias/cortinas-pvc-vs-aluminio",
      linkLabel: "Comparar materiales",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[1].id, {
      title: "Medidas",
      body: "Las medidas reales del frente son la base para cualquier cotización seria.",
      href: "/contacto.html",
      linkLabel: "Pasar medidas",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[2].id, {
      title: "Instalación",
      body: "La instalación nueva, el recambio y la complejidad del frente cambian el valor final.",
      href: "/productos/cortinas-de-enrollar.html",
      linkLabel: "Ver producto",
      headingLevel: "h3",
    });
    await updateBlockContent(tx, featureBlocks[3].id, {
      title: "Reparación",
      body: "Si ya existe una cortina instalada, a veces conviene reparar antes de reemplazar.",
      href: "/servicios/reparacion-cortinas-y-persianas.html",
      linkLabel: "Ver reparación",
      headingLevel: "h3",
    });

    await updateSectionSettings(tx, contentSplit.id, {
      actions: [
        { href: "/productos/cortinas-de-enrollar-aluminio.html", label: "Ver aluminio" },
        { href: "/productos/cortinas-de-enrollar-pvc.html", label: "Ver PVC" },
        { href: "/servicios/reparacion-cortinas-y-persianas.html", label: "Ver reparación" },
      ],
      imageAlt: "Variables de precio",
      imageUrl: "/uploads/cms/legacy-assets/img/portfolio/shutters/aluminio/cortina_enrollar_aluminio_1.jpeg",
      mediaPosition: "end",
    });
    await updateBlockContent(tx, contentSplit.blocks[0].id, {
      richText: richText([
        "El precio cambia por material, medidas, tipo de instalación y complejidad del frente.",
        "PVC suele ser más accesible; aluminio suele sumar una prestación más robusta para el uso diario.",
        "Si ya tenés una cortina instalada, revisar reparación antes de cambiar todo puede evitar un gasto innecesario.",
      ]),
    });

    await updateSectionSettings(tx, faq.id, {
      title: "Preguntas frecuentes",
      description: "Dudas habituales sobre precio y presupuesto.",
    });
    const faqBlocks = faq.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, faqBlocks[0].id, {
      question: "¿Qué hace variar el precio?",
      answerRichText: richText([
        "El precio cambia por material, medidas, tipo de instalación, terminación y complejidad del frente.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[1].id, {
      question: "¿Puedo comparar precios entre PVC y aluminio?",
      answerRichText: richText([
        "Sí. Comparar materiales ayuda a ver dónde está el salto de valor y si aporta lo que el frente necesita.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[2].id, {
      question: "¿Conviene pedir presupuesto o mirar primero las opciones?",
      answerRichText: richText([
        "Si ya tenés medidas o un frente definido, pedir presupuesto te acerca más rápido a una decisión útil.",
      ]),
    });

    await updateSectionSettings(tx, cta.id, {
      title: "Pedí presupuesto con la medida correcta",
      intent: "transactional",
      actions: [
        { href: "/contacto.html", label: "Contactar" },
        { href: "/guias/cortinas-pvc-vs-aluminio", label: "Ver comparativa" },
      ],
      variant: "default",
      description:
        "Si ya comparaste materiales, estás más cerca de una cotización real.",
    });
  });
}

async function rewriteUrgentPage() {
  const page = await loadPage("servicios/reparacion-urgente");
  const hero = findSection(page, CmsPageSectionType.HERO);
  const contentSplit = findSection(page, CmsPageSectionType.CONTENT_SPLIT);
  const faq = findSection(page, CmsPageSectionType.FAQ);
  const cta = findSection(page, CmsPageSectionType.CTA_BANNER);

  if (!hero || !contentSplit || !faq || !cta) {
    throw new Error("servicios/reparacion-urgente is missing required sections");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "Reparación urgente",
        summary:
          "Respuesta rápida para fallas que dejan el frente fuera de uso.",
        seoTitle: "Reparación urgente | Urucortinas",
        seoDescription:
          "Reparación urgente de cortinas y persianas para trabas, roturas y atascos. Coordiná rápido y resolvé la falla.",
      },
    });

    await updateSectionSettings(tx, hero.id, {
      title: "Reparación urgente de cortinas y persianas",
      slides: [
        {
          href: "/contacto.html",
          title: "Urgencia con respuesta",
          imageAlt: "Reparación urgente",
          imageUrl: "/uploads/cms/legacy-assets/img/contacto/contacto.jpeg",
          linkLabel: "Coordinar",
          description:
            "Si la cortina quedó trabada o no cierra, coordinamos rápido para recuperar funcionamiento y seguridad.",
        },
      ],
      eyebrow: "Urgencia real",
      description:
        "Cuando el sistema quedó trabado o no cierra, coordinamos rápido para recuperar funcionamiento y seguridad.",
      headingLevel: "h1",
      primaryCtaHref: "/contacto.html",
      primaryCtaLabel: "Coordinar ahora",
      secondaryCtaHref: "/servicios/reparacion-cortinas-y-persianas.html",
      secondaryCtaLabel: "Ver servicio completo",
    });

    await updateSectionSettings(tx, contentSplit.id, {
      actions: [
        { href: "/contacto.html", label: "Coordinar ahora" },
        { href: "/servicios/reparacion-cortinas-y-persianas.html", label: "Ver servicio completo" },
        { href: "/precios/cortinas-de-enrollar", label: "Ver precios" },
      ],
      imageAlt: "Atención urgente",
      imageUrl: "/uploads/cms/legacy-assets/img/contacto/contacto.jpeg",
      mediaPosition: "end",
    });
    await updateBlockContent(tx, contentSplit.blocks[0].id, {
      richText: richText([
        "La urgencia aparece cuando la cortina no abre, no baja o deja el frente expuesto.",
        "Con una foto y una breve descripción de la falla podemos orientar la visita con más precisión.",
        "Si hace falta repuesto o cambio de pieza, lo definimos en el momento.",
      ]),
    });

    await updateSectionSettings(tx, faq.id, {
      title: "Preguntas frecuentes",
      description: "Preguntas cortas para una consulta urgente.",
    });
    const faqBlocks = faq.blocks.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    await updateBlockContent(tx, faqBlocks[0].id, {
      question: "¿Cuándo conviene pedir reparación urgente?",
      answerRichText: richText([
        "Conviene cuando la cortina quedó trabada, no cierra, no abre o expone el interior de forma que afecta seguridad o actividad.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[1].id, {
      question: "¿Qué información ayuda a acelerar la visita?",
      answerRichText: richText([
        "Enviar foto, ubicación, tipo de cortina o persiana y una breve descripción de la falla reduce el tiempo de diagnóstico.",
      ]),
    });
    await updateBlockContent(tx, faqBlocks[2].id, {
      question: "¿Pueden evaluar si hace falta repuesto?",
      answerRichText: richText([
        "Sí. El diagnóstico inicial apunta a detectar si alcanza con ajuste, reparación o sustitución de piezas.",
      ]),
    });

    await updateSectionSettings(tx, cta.id, {
      title: "Si necesitás respuesta rápida, contactá ahora",
      intent: "urgent",
      actions: [
        { href: "/contacto.html", label: "Coordinar ahora" },
        { href: "/servicios/reparacion-cortinas-y-persianas.html", label: "Ver servicio" },
      ],
      variant: "default",
      description:
        "Cuanto antes se vea la falla, antes se define si alcanza con reparación, ajuste o cambio de pieza.",
    });
  });
}

async function main() {
  await rewritePersianasHub();
  await rewriteCortinasGeneral();
  await rewritePVCPage();
  await rewriteRepairPage();
  await rewriteGuidePage();
  await rewritePricePage();
  await rewriteUrgentPage();
  console.log("Commercial copy rewritten from legacy and internal knowledge sources.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
