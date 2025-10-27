import styled, { css, keyframes } from "styled-components";

const rotate = keyframes`
  0% {transform: rotate(0deg);}
  100% {transform: rotate(360deg);}
`;

const Spinner = styled.div(
  {
    width: 24,
    height: 24,
    border: "4px solid",
    borderRadius: "50%",
    borderTop: "3px solid white",
    borderColor: "primary",
    transitionProperty: "transform"
  },
  css`
    animation: ${rotate} 1.2s infinite linear;
  `
);

export default Spinner;
