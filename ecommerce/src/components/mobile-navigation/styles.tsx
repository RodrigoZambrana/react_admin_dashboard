import styled from "styled-components";

export const StyledMobileAccordionDropdown = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border-radius: 12px;
`;

export const StyledMobileAccordionItem = styled.div`
  .mobile-accordion-row {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-height: 48px;
    padding: 0.7rem 0.9rem;
    border-radius: 12px;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.text.primary};
    transition:
      background-color 180ms ease,
      color 180ms ease,
      transform 120ms ease,
      box-shadow 180ms ease;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      background: ${({ theme }) => theme.colors.primary[100]};
      color: ${({ theme }) => theme.colors.primary.main};
    }

    &:active {
      transform: scale(0.985);
      background: ${({ theme }) => theme.colors.primary[100]};
      box-shadow: inset 0 0 0 1px ${({ theme }) => theme.colors.primary[200]};
    }

    &[data-depth="1"] {
      min-height: 42px;
      padding: 0.55rem 0.8rem;
      gap: 0.65rem;
      border-radius: 10px;
    }

    &[data-depth="2"] {
      min-height: 40px;
      padding: 0.5rem 0.75rem;
      gap: 0.6rem;
      border-radius: 10px;
    }

    &[data-active="true"] {
      background: ${({ theme }) => theme.colors.primary.light};
      color: ${({ theme }) => theme.colors.primary.main};
    }

    &[data-branch-active="true"][data-active="false"] {
      background: ${({ theme }) => theme.colors.primary.light};
      color: ${({ theme }) => theme.colors.primary.main};
    }
  }

  .mobile-accordion-row-split {
    padding: 0;
    gap: 0;
    overflow: hidden;
  }

  .mobile-accordion-select {
    all: unset;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-height: inherit;
    padding: inherit;
    cursor: pointer;
    color: inherit;
  }

  .mobile-accordion-chevron-trigger {
    all: unset;
    box-sizing: border-box;
    width: 44px;
    min-width: 44px;
    align-self: stretch;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: inherit;
    border-left: 1px solid ${({ theme }) => theme.colors.gray[300]};
  }

  .mobile-accordion-icon {
    width: 18px;
    min-width: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 18px;
  }

  .mobile-accordion-label {
    flex: 1 1 auto;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    line-height: 1.2;
  }

  .mobile-accordion-chevron {
    margin-left: auto;
    flex: 0 0 auto;
    transition: transform 200ms ease, color 180ms ease;
  }
`;
