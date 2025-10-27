import Link from "next/link";
import { ReactNode } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import Icon from "@component/icon/Icon";
import { StyledCategoryMenuItem } from "./styles";

// ===============================================================
interface CategoryMenuItemProps {
  href: string;
  icon?: string;
  title: string;
  caret?: boolean;
  children: ReactNode;
}
// ===============================================================

export default function CategoryMenuItem({
  href,
  icon,
  title,
  children,
  caret = true
}: CategoryMenuItemProps) {
  return (
    <StyledCategoryMenuItem>
      <Link href={href}>
        <div className="category-dropdown-link">
          {icon && <Icon variant="small">{icon}</Icon>}
          <span className="title">{title}</span>
          {caret && <IconChevronRight stroke={1.5} size={16} />}
        </div>
      </Link>

      {children}
    </StyledCategoryMenuItem>
  );
}
