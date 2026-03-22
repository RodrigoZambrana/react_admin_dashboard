"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";

import Box from "@component/Box";
import Icon from "@component/icon/Icon";
import { H4 } from "@component/Typography";
import type { AccordionMenuNode } from "@/lib/storefront/menu-nodes";
import {
  StyledMobileAccordionDropdown,
  StyledMobileAccordionItem,
} from "./styles";

type AccordionMenuProps = {
  items: AccordionMenuNode[];
  heading?: string;
  onNavigate?: () => void;
  onSelectItem?: (item: AccordionMenuNode) => void;
  selectedHref?: string;
};

const normalizeHref = (href?: string) => {
  if (!href) return null;
  try {
    return new URL(href, "http://localhost");
  } catch {
    return null;
  }
};

const matchesCurrentLocation = (
  href: string | undefined,
  pathname: string,
  searchParams: ReadonlyURLSearchParams | null,
) => {
  const target = normalizeHref(href);
  if (!target) return false;
  if (target.pathname !== pathname) return false;

  const targetEntries = Array.from(target.searchParams.entries());
  if (targetEntries.length === 0) {
    return true;
  }

  return targetEntries.every(([key, value]) => searchParams?.get(key) === value);
};

const findInitiallyExpandedKeys = (
  items: AccordionMenuNode[],
  pathname: string,
  searchParams: ReadonlyURLSearchParams | null,
  depth = 0,
) => {
  const expanded = new Set<string>();

  items.forEach((item) => {
    const hasChildren = (item.children?.length ?? 0) > 0;
    const childExpanded = hasChildren
      ? findInitiallyExpandedKeys(item.children ?? [], pathname, searchParams, depth + 1)
      : new Set<string>();
    childExpanded.forEach((key) => expanded.add(key));

    const selfActive = matchesCurrentLocation(item.href, pathname, searchParams);
    const branchActive = childExpanded.size > 0;

    if ((depth === 0 && hasChildren) || (hasChildren && (selfActive || branchActive))) {
      expanded.add(item.key);
    }
  });

  return expanded;
};

const hasActiveDescendant = (
  items: AccordionMenuNode[] | undefined,
  pathname: string,
  searchParams: ReadonlyURLSearchParams | null,
  selectedHref?: string,
): boolean => {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  return items.some((item) => {
    if (
      matchesCurrentLocation(item.href, pathname, searchParams) ||
      (selectedHref && item.href === selectedHref)
    ) {
      return true;
    }

    return hasActiveDescendant(item.children, pathname, searchParams, selectedHref);
  });
};

const RowContent = ({
  title,
  icon,
  depth,
  active,
}: {
  title: string;
  icon?: string;
  depth: number;
  active: boolean;
}) => {
  const isRoot = depth === 0;

  return (
    <>
      {icon ? (
        <span className="mobile-accordion-icon">
          <Icon variant="small">{icon}</Icon>
        </span>
      ) : null}
      <span
        className="mobile-accordion-label"
        style={{
          fontSize: isRoot ? "0.98rem" : depth === 1 ? "0.9rem" : "0.84rem",
          fontWeight: isRoot ? 700 : depth === 1 ? 600 : 500,
          letterSpacing: isRoot ? "0.01em" : "normal",
          color: active || isRoot ? "inherit" : "var(--text-muted, inherit)",
        }}
      >
        {title}
      </span>
    </>
  );
};

const AccordionRow = ({
  item,
  depth,
  expanded,
  active,
  branchActive,
  onNavigate,
  onToggle,
  onSelectItem,
}: {
  item: AccordionMenuNode;
  depth: number;
  expanded: boolean;
  active: boolean;
  branchActive: boolean;
  onNavigate?: () => void;
  onToggle: () => void;
  onSelectItem?: (item: AccordionMenuNode) => void;
}) => {
  const hasChildren = (item.children?.length ?? 0) > 0;

  return (
    <StyledMobileAccordionItem>
      {hasChildren && onSelectItem ? (
        <div
          className="mobile-accordion-row mobile-accordion-row-split"
          data-depth={depth}
          data-active={active}
          data-branch-active={branchActive}
        >
          <button
            type="button"
            onClick={() => onSelectItem(item)}
            className="mobile-accordion-select"
          >
            <RowContent title={item.title} icon={item.icon} depth={depth} active={active || branchActive} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
            className="mobile-accordion-chevron-trigger"
          >
            <IconChevronRight
              className="mobile-accordion-chevron"
              stroke={1.5}
              size={16}
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          </button>
        </div>
      ) : hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
          className="mobile-accordion-row"
          data-depth={depth}
          data-active={active}
          data-branch-active={branchActive}
        >
          <RowContent title={item.title} icon={item.icon} depth={depth} active={active || branchActive} />
          <IconChevronRight
            className="mobile-accordion-chevron"
            stroke={1.5}
            size={16}
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </button>
      ) : item.href ? (
        onSelectItem ? (
          <button
            type="button"
            onClick={() => onSelectItem(item)}
            className="mobile-accordion-row"
            data-depth={depth}
            data-active={active}
            data-branch-active={branchActive}
          >
            <RowContent title={item.title} icon={item.icon} depth={depth} active={active} />
          </button>
        ) : (
          <Link
            href={item.href}
            onClick={onNavigate}
            className="mobile-accordion-row"
            data-depth={depth}
            data-active={active}
            data-branch-active={branchActive}
          >
            <RowContent title={item.title} icon={item.icon} depth={depth} active={active} />
          </Link>
        )
      ) : (
        <div className="mobile-accordion-row" data-depth={depth} data-active={active} data-branch-active={branchActive}>
          <RowContent title={item.title} icon={item.icon} depth={depth} active={active} />
        </div>
      )}
    </StyledMobileAccordionItem>
  );
};

export default function AccordionMenu({
  items,
  heading,
  onNavigate,
  onSelectItem,
  selectedHref,
}: AccordionMenuProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() =>
    findInitiallyExpandedKeys(items, pathname, searchParams),
  );

  useEffect(() => {
    setExpandedKeys(findInitiallyExpandedKeys(items, pathname, searchParams));
  }, [items, pathname, searchParams]);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderItems = (nodes: AccordionMenuNode[], depth = 0): ReactNode =>
    nodes.map((item) => {
      const expanded = expandedKeys.has(item.key);
      const hasChildren = (item.children?.length ?? 0) > 0;
      const active =
        matchesCurrentLocation(item.href, pathname, searchParams) ||
        (Boolean(selectedHref) && item.href === selectedHref);
      const childContent = item.children ? renderItems(item.children, depth + 1) : null;
      const branchActive =
        !active && hasActiveDescendant(item.children, pathname, searchParams, selectedHref);

      return (
        <Box key={item.key}>
          <AccordionRow
            item={item}
            depth={depth}
            expanded={expanded}
            active={active}
            branchActive={Boolean(branchActive)}
            onNavigate={onNavigate}
            onToggle={() => toggleExpanded(item.key)}
            onSelectItem={onSelectItem}
          />

          {hasChildren && expanded ? (
            <Box pl={depth === 0 ? "1rem" : "1.35rem"} mt="0.15rem" mb={depth === 0 ? "0.5rem" : "0.25rem"}>
              <StyledMobileAccordionDropdown>
                {childContent}
              </StyledMobileAccordionDropdown>
            </Box>
          ) : null}
        </Box>
      );
    });

  return (
    <Box>
      {heading ? (
        <H4 mb="0.75rem" fontWeight={600}>
          {heading}
        </H4>
      ) : null}
      <StyledMobileAccordionDropdown>
        {renderItems(items)}
      </StyledMobileAccordionDropdown>
    </Box>
  );
}
