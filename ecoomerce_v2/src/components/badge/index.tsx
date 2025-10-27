import { CSSProperties } from "styled-components";
import { Span } from "@component/Typography";
import { BadgeContainer, StyledBadge } from "./styles";

// ==========================================================
interface Props {
  style?: CSSProperties;
  title: string | number;
  children: string | number;
}
// ==========================================================

export default function Badge({ title, children, style }: Props) {
  return (
    <BadgeContainer style={style}>
      {title && (
        <Span marginLeft="5px" className="nav-link">
          {children}
        </Span>
      )}

      <StyledBadge>{title}</StyledBadge>
    </BadgeContainer>
  );
}
