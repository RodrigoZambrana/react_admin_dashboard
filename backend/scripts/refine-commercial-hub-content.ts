import { PrismaClient, CmsPageSectionType } from "@prisma/client";

const prisma = new PrismaClient();

const HOB_PAGE_PATH = "productos/persianas";

const heroSlides = [
  {
    href: "/productos/cortinas-de-enrollar.html",
    title: "Elegí la solución adecuada",
    imageAlt: "Persianas",
    imageUrl: "/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg",
    linkLabel: "Ver producto",
    description:
      "Desde esta entrada podés pasar al producto, la comparativa o el servicio según lo que ya tengas definido.",
  },
];

async function main() {
  const page = await prisma.cmsPage.findUnique({
    where: { path: HOB_PAGE_PATH },
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
    throw new Error(`CMS page not found: ${HOB_PAGE_PATH}`);
  }

  const heroSection = page.sections.find((section) => section.type === CmsPageSectionType.HERO);
  const featureGridSection = page.sections.find(
    (section) => section.type === CmsPageSectionType.FEATURE_GRID,
  );
  const contentSplitSection = page.sections.find(
    (section) => section.type === CmsPageSectionType.CONTENT_SPLIT,
  );
  const faqSection = page.sections.find((section) => section.type === CmsPageSectionType.FAQ);
  const ctaSection = page.sections.find((section) => section.type === CmsPageSectionType.CTA_BANNER);

  if (!heroSection || !featureGridSection || !contentSplitSection || !faqSection || !ctaSection) {
    throw new Error(`CMS page ${HOB_PAGE_PATH} is missing one or more required sections`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({
      where: { id: page.id },
      data: {
        title: "Persianas",
        summary:
          "Entrada comercial para orientar entre producto, comparativa y reparación sin repetir el mismo mensaje en cada bloque.",
        seoTitle: "Persianas | Urucortinas",
        seoDescription:
          "Elegí el camino correcto para persianas de enrollar, comparativas de material o reparación según el estado real del frente.",
      },
    });

    await tx.cmsPageSection.update({
      where: { id: heroSection.id },
      data: {
        settings: {
          title: "Persianas",
          slides: heroSlides,
          eyebrow: "Entrada comercial",
          description:
            "Usá esta página cuando todavía no definiste si necesitás producto, comparativa o reparación.",
          headingLevel: "h1",
          primaryCtaHref: "/productos/cortinas-de-enrollar.html",
          primaryCtaLabel: "Ver cortinas de enrollar",
          secondaryCtaHref: "/guias/cortinas-pvc-vs-aluminio",
          secondaryCtaLabel: "Ver guía comparativa",
        },
      },
    });

    await tx.cmsPageSection.update({
      where: { id: featureGridSection.id },
      data: {
        settings: {
          title: "Elegí por necesidad",
          description:
            "Tres caminos claros para no repetir información ni perder tiempo entre páginas parecidas.",
          itemHeadingLevel: "h3",
        },
      },
    });

    const featureGridBlocks = featureGridSection.blocks
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id)
      .map((block) => {
        if (block.name === "Cortinas de enrollar") {
          return {
            id: block.id,
            data: {
              content: {
                title: "Producto",
                body: "Entrá acá si ya sabés que querés ver la familia de cortinas de enrollar y seguir con el material.",
                href: "/productos/cortinas-de-enrollar.html",
                linkLabel: "Ver producto",
                headingLevel: "h3",
              },
            },
          };
        }

        if (block.name === "Reparación") {
          return {
            id: block.id,
            data: {
              content: {
                title: "Reparación",
                body: "Si el sistema ya tiene una falla, este es el camino más rápido para resolverla.",
                href: "/servicios/reparacion-cortinas-y-persianas.html",
                linkLabel: "Ver servicio",
                headingLevel: "h3",
              },
            },
          };
        }

        return {
          id: block.id,
          data: {
            content: {
              title: "Comparativa",
              body: "La guía ordena la elección entre PVC y aluminio cuando todavía querés comparar materiales.",
              href: "/guias/cortinas-pvc-vs-aluminio",
              linkLabel: "Leer guía",
              headingLevel: "h3",
            },
          },
        };
      });

    for (const block of featureGridBlocks) {
      await tx.cmsPageBlock.update({
        where: { id: block.id },
        data: block.data,
      });
    }

    await tx.cmsPageSection.update({
      where: { id: contentSplitSection.id },
      data: {
        settings: {
          actions: [
            {
              href: "/productos/cortinas-de-enrollar.html",
              label: "Ver producto",
            },
            {
              href: "/guias/cortinas-pvc-vs-aluminio",
              label: "Ver guía comparativa",
            },
            {
              href: "/servicios/reparacion-cortinas-y-persianas.html",
              label: "Ver reparación",
            },
          ],
          imageAlt: "Persianas en contexto",
          imageUrl: "/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg",
          mediaPosition: "end",
        },
      },
    });

    await tx.cmsPageBlock.update({
      where: { id: contentSplitSection.blocks[0].id },
      data: {
        content: {
          richText: [
            {
              tag: "p",
              type: "element",
              children: [
                {
                  type: "text",
                  value:
                    "Esta página ordena el camino de entrada. Si ya sabés lo que buscás, pasá directo a producto, comparativa o reparación.",
                },
              ],
            },
            {
              tag: "p",
              type: "element",
              children: [
                {
                  type: "text",
                  value:
                    "Si todavía estás definiendo la mejor opción, empezá por la comparativa y seguí al bloque que corresponda.",
                },
              ],
            },
          ],
        },
      },
    });

    await tx.cmsPageSection.update({
      where: { id: faqSection.id },
      data: {
        settings: {
          title: "Preguntas frecuentes",
          description: "Dudas útiles antes de elegir producto, comparar materiales o pedir reparación.",
        },
      },
    });

    const faqBlocks = faqSection.blocks
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id)
      .map((block) => {
        if (block.name === "¿Qué es una persiana de enrollar?") {
          return {
            id: block.id,
            data: {
              content: {
                question: "¿Cuándo conviene entrar por esta página?",
                answerRichText: [
                  {
                    tag: "p",
                    type: "element",
                    children: [
                      {
                        type: "text",
                        value:
                          "Conviene cuando todavía no definiste si necesitás comprar, comparar o reparar, y querés ir al camino correcto sin recorrer el sitio de más.",
                      },
                    ],
                  },
                ],
              },
            },
          };
        }

        if (block.name === "¿Qué conviene: PVC o aluminio?") {
          return {
            id: block.id,
            data: {
              content: {
                question: "¿Dónde veo el producto?",
                answerRichText: [
                  {
                    tag: "p",
                    type: "element",
                    children: [
                      {
                        type: "text",
                        value:
                          "En la familia de cortinas de enrollar, donde vas a encontrar el material y la configuración que mejor encaja con tu frente.",
                      },
                    ],
                  },
                ],
              },
            },
          };
        }

        if (block.name === "¿Incluye instalación?") {
          return {
            id: block.id,
            data: {
              content: {
                question: "¿También llego a reparación?",
                answerRichText: [
                  {
                    tag: "p",
                    type: "element",
                    children: [
                      {
                        type: "text",
                        value:
                          "Sí. Si el sistema ya está instalado y presenta una falla, el enlace de reparación te lleva directo al servicio adecuado.",
                      },
                    ],
                  },
                ],
              },
            },
          };
        }

        return {
          id: block.id,
          data: {
            content: {
              question: "¿Qué hago si ya tengo una falla?",
              answerRichText: [
                {
                  tag: "p",
                  type: "element",
                  children: [
                    {
                      type: "text",
                      value:
                        "Entrá a reparación. Ese camino está pensado para resolver trabas, roturas y atascos sin mezclarlo con la comparación de materiales.",
                    },
                  ],
                },
              ],
            },
          },
        };
      });

    for (const block of faqBlocks) {
      await tx.cmsPageBlock.update({
        where: { id: block.id },
        data: block.data,
      });
    }

    await tx.cmsPageSection.update({
      where: { id: ctaSection.id },
      data: {
        settings: {
          title: "Entrá por el camino que necesitás",
          intent: "informational",
          actions: [
            {
              href: "/productos/cortinas-de-enrollar.html",
              label: "Ver producto",
            },
            {
              href: "/guias/cortinas-pvc-vs-aluminio",
              label: "Ver guía comparativa",
            },
          ],
          variant: "default",
          description:
            "Usá esta página como acceso rápido a la solución que más se acerca a tu caso.",
        },
      },
    });
  });

  console.log(`Refined commercial hub content for ${HOB_PAGE_PATH}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
