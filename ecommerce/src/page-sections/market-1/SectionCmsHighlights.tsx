"use client";

import { usePathname } from "next/navigation";
import Grid from "@component/grid/Grid";
import Box from "@component/Box";
import LazyImage from "@component/LazyImage";
import Typography from "@component/Typography";
import { Button } from "@component/buttons";
import { Card1 } from "@component/Card1";
import type { CmsContentSection } from "@/types/storefront";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";
import { resolvePageType } from "@/lib/analytics/pageType";
import TrackedLink from "@component/TrackedLink";

type Props = {
  section: CmsContentSection | null;
};

export default function SectionCmsHighlights({ section }: Props) {
  const pathname = usePathname();
  const pageType = resolvePageType(pathname);
  const highlightsRef = useComponentTracking({
    pageType,
    componentType: "cms_highlights",
    componentId: "home_cms_highlights",
    metadata: {
      section_name: section?.name ?? null,
      entry_count: section?.entries.length ?? 0,
    },
  });

  if (!section || !section.entries.length) {
    return null;
  }

  return (
    <div ref={highlightsRef}>
      <Box mb="4rem" mt="1.5rem">
        <Box mb="1.5rem" textAlign="center">
        <Typography fontSize="28px" fontWeight={700} mb="0.5rem">
          {section.name}
        </Typography>
        {section.description ? (
          <Typography color="text.muted" maxWidth="640px" mx="auto">
            {section.description}
          </Typography>
        ) : null}
      </Box>

        <Grid container spacing={4}>
        {section.entries.map((entry) => {
          const image = entry.thumbnail?.url ?? entry.assets[0]?.posterUrl ?? entry.assets[0]?.mediaUrl ?? null;
          return (
            <Grid item md={6} xs={12} key={`cms-highlight-${entry.id}`}>
              <Card1 height="100%" overflow="hidden" position="relative">
                {entry.cta?.href ? (
                  <TrackedLink
                    aria-label={entry.cta.label ?? entry.title}
                    href={entry.cta.href}
                    pageType={pageType}
                    componentType="cms_highlights"
                    componentId="home_cms_highlights"
                    ctaId="cms.highlights.card.open"
                    ctaName="open_content"
                    ctaType="primary"
                    ctaContext="content"
                    ctaLocation="highlight_card"
                    metadata={{
                      entry_id: entry.id,
                      entry_title: entry.title,
                      href: entry.cta?.href ?? null,
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 1,
                      display: "block",
                      borderRadius: "inherit",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        margin: -1,
                        padding: 0,
                        overflow: "hidden",
                        clip: "rect(0, 0, 0, 0)",
                        clipPath: "inset(50%)",
                        whiteSpace: "nowrap",
                        border: 0,
                      }}
                    >
                      {entry.cta.label ?? entry.title}
                    </span>
                  </TrackedLink>
                ) : null}
                {image ? (
                  <LazyImage
                    src={image}
                    alt={entry.thumbnail?.alt ?? entry.title}
                    width={640}
                    height={360}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                ) : null}

                <Box p="1.5rem">
                  <Typography fontSize="22px" fontWeight={700} mb="0.5rem">
                    {entry.title}
                  </Typography>
                  {entry.subtitle ? (
                    <Typography color="primary.main" fontWeight={600} mb="0.75rem">
                      {entry.subtitle}
                    </Typography>
                  ) : null}
                  {entry.description ? (
                    <Typography color="text.muted" mb="1rem">
                      {entry.description}
                    </Typography>
                  ) : null}
                  {entry.cta?.href ? (
                    <Box style={{ position: "relative", zIndex: 2, display: "inline-flex" }}>
                      <TrackedLink
                        href={entry.cta.href}
                        pageType={pageType}
                        componentType="cms_highlights"
                        componentId="home_cms_highlights"
                        ctaId="cms.highlights.card.primary"
                        ctaName="open_content"
                        ctaType="primary"
                        ctaContext="content"
                        ctaLocation="highlight_card_actions"
                        metadata={{
                          entry_id: entry.id,
                          entry_title: entry.title,
                          href: entry.cta.href,
                        }}
                      >
                        <Button variant="contained" color="primary">
                          {entry.cta.label ?? "Ver más"}
                        </Button>
                      </TrackedLink>
                    </Box>
                  ) : null}
                </Box>
              </Card1>
            </Grid>
          );
        })}
        </Grid>
      </Box>
    </div>
  );
}
