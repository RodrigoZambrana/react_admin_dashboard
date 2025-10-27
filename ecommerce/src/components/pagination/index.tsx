"use client";

import ReactPaginate from "react-paginate";
import { SpaceProps } from "styled-system";
import { IconArrowNarrowLeft, IconArrowNarrowRight, IconLineDotted } from "@tabler/icons-react";

import { Button } from "@component/buttons";
import { StyledPagination } from "./styles";

// ==============================================================
export interface PaginationProps extends SpaceProps {
  pageCount: number;
  pageRangeDisplayed?: number;
  marginPagesDisplayed?: number;
  onChange?: (data: number) => void;
}
// ==============================================================

export default function Pagination({
  onChange,
  pageCount,
  pageRangeDisplayed,
  marginPagesDisplayed,
  ...props
}: PaginationProps) {
  const handlePageChange = async (page: any) => {
    if (onChange) onChange(page.selected);
  };

  const PREVIOUS_BUTTON = (
    <Button
      height="auto"
      padding="6px"
      color="primary"
      overflow="hidden"
      className="control-button">
      <IconArrowNarrowLeft size={18} />
    </Button>
  );

  const NEXT_BUTTON = (
    <Button
      height="auto"
      padding="6px"
      color="primary"
      overflow="hidden"
      className="control-button">
      <IconArrowNarrowRight size={18} />
    </Button>
  );

  const BREAK_LABEL = <IconLineDotted size={20} />;

  return (
    <StyledPagination {...props}>
      <ReactPaginate
        pageCount={pageCount}
        nextLabel={NEXT_BUTTON}
        breakLabel={BREAK_LABEL}
        activeClassName="active"
        disabledClassName="disabled"
        containerClassName="pagination"
        previousLabel={PREVIOUS_BUTTON}
        onPageChange={handlePageChange}
        pageRangeDisplayed={pageRangeDisplayed}
        marginPagesDisplayed={marginPagesDisplayed}
        // subContainerClassName="pages pagination"
      />
    </StyledPagination>
  );
}
