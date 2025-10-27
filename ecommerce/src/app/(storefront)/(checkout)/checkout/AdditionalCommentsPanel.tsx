"use client";

import { useState } from "react";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import { Card1 } from "@component/Card1";
import TextArea from "@component/textarea";
import Typography from "@component/Typography";

import { useTranslation } from "@/state/i18n-context";

export default function AdditionalCommentsPanel() {
  const [notes, setNotes] = useState("");
  const t = useTranslation();

  return (
    <Card1 mt="1.5rem">
      <FlexBox alignItems="center" mb="1rem">
        <Typography fontWeight="600" mr="10px">
          Additional Comments
        </Typography>

        <Box p="3px 10px" bg="primary.light" borderRadius="3px">
          <Typography fontSize="12px" color="primary.main">
            Note
          </Typography>
        </Box>
      </FlexBox>

      <TextArea
        rows={6}
        fullWidth
        value={notes}
        placeholder={t("Add instructions for delivery or order handling")}
        onChange={(event) => setNotes(event.target.value)}
      />
    </Card1>
  );
}
