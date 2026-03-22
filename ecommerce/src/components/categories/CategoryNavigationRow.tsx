import type { CSSProperties, ReactNode } from "react";
import { IconChevronRight } from "@tabler/icons-react";

import Icon from "@component/icon/Icon";
import { CategoryDropdownRow } from "./styles";

type CategoryNavigationRowProps = {
  icon?: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  caret?: boolean;
  showChevron?: boolean;
  active?: boolean;
  minWidth?: string;
  style?: CSSProperties;
  onClick?: () => void;
};

export default function CategoryNavigationRow({
  icon,
  title,
  eyebrow,
  description,
  trailing,
  caret = true,
  showChevron = true,
  active = false,
  minWidth,
  style,
  onClick,
}: CategoryNavigationRowProps) {
  const chevronClassName = caret ? "chevron-icon has-children" : "chevron-icon";

  return (
    <CategoryDropdownRow $active={active} $minWidth={minWidth} style={style} onClick={onClick}>
      {icon ? <Icon variant="small">{icon}</Icon> : null}

      <div className="row-content">
        {eyebrow ? <span className="row-eyebrow">{eyebrow}</span> : null}
        <span className="row-title">{title}</span>
        {description ? <span className="row-description">{description}</span> : null}
      </div>

      {trailing ? <div className="row-aside">{trailing}</div> : null}

      {showChevron ? (
        <IconChevronRight className={`row-chevron ${chevronClassName}`} stroke={1.5} size={16} />
      ) : null}
    </CategoryDropdownRow>
  );
}
