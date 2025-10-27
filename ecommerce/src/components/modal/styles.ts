import { motion } from "framer-motion";
import styled from "styled-components";
import { isValidProp } from "@utils/utils";

export const MotionModal = styled(motion.div).withConfig({
  shouldForwardProp: isValidProp
})`
  inset: 0;
  z-index: 1000;
  display: flex;
  position: fixed;
  background-color: rgba(0, 0, 0, 0.5);

  .container {
    margin: auto;
  }
`;
