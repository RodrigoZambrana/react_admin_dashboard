import Link from "next/link";
import { ReactNode } from "react";
import { StyledCategoryMenuItem } from "./styles";
import CategoryNavigationRow from "./CategoryNavigationRow";

// ===============================================================
interface CategoryMenuItemProps {
  href: string;
  icon?: string;
  title: string;
  caret?: boolean;
  showChevron?: boolean;
  onNavigate?: () => void;
  children: ReactNode;
}
// ===============================================================

export default function CategoryMenuItem({
  href,
  icon,
  title,
  children,
  caret = true,
  showChevron = true,
  onNavigate
}: CategoryMenuItemProps) {
  return (
    <StyledCategoryMenuItem>
      <Link href={href} onClick={onNavigate}>
        <CategoryNavigationRow icon={icon} title={title} caret={caret} showChevron={showChevron} />
      </Link>

      {children}
    </StyledCategoryMenuItem>
  );
}
