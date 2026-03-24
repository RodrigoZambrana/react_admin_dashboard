"use client";

import Link from "next/link";
import Grid from "@component/grid/Grid";
import Box from "@component/Box";
import LazyImage from "@component/LazyImage";
import Typography from "@component/Typography";
import { Button } from "@component/buttons";
import { Card1 } from "@component/Card1";
import type { CmsContentSection } from "@/types/storefront";

type Props = {
  section: CmsContentSection | null;
};

export default function SectionCmsHighlights({ section }: Props) {
  if (!section || !section.entries.length) {
    return null;
  }

  return (
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
              <Card1 height="100%" overflow="hidden">
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
                    <Link href={entry.cta.href}>
                      <Button variant="contained" color="primary">
                        {entry.cta.label ?? "Ver más"}
                      </Button>
                    </Link>
                  ) : null}
                </Box>
              </Card1>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
