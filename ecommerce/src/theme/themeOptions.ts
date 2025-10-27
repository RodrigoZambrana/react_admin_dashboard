import merge from "lodash/merge";
import shadows from "./shadows";
import { colors } from "./colors";
import { deviceSize } from "@utils/constants";
import { Breakpoints, ThemeOption } from "./type";

const enum THEMES {
  GIFT = "GIFT",
  HEALTH = "HEALTH",
  DEFAULT = "DEFAULT",
  GROCERY = "GROCERY",
  FURNITURE = "FURNITURE"
}

const breakpoints: Breakpoints = Object.keys(deviceSize).map((key) => deviceSize[key] + "px");

breakpoints.sm = breakpoints[0];
breakpoints.md = breakpoints[1];
breakpoints.lg = breakpoints[2];
breakpoints.xl = breakpoints[3];

const themesOptions = {
  [THEMES.DEFAULT]: {
    colors,
    shadows,
    breakpoints
  },
  [THEMES.GROCERY]: {
    colors,
    shadows,
    breakpoints
  },
  [THEMES.FURNITURE]: {
    shadows,
    breakpoints,
    colors: {
      ...colors,
      primary: {
        ...colors.primary,
        main: colors.paste.main
      }
    }
  },
  [THEMES.HEALTH]: {
    shadows,
    breakpoints,
    colors: {
      ...colors,
      primary: merge({}, colors.primary, colors.blue)
    }
  },
  [THEMES.GIFT]: {
    shadows,
    breakpoints,
    colors: {
      ...colors,
      primary: {
        ...colors.primary,
        main: colors.marron.main
      }
    }
  }
};

const routeThemeMap: Record<string, THEMES> = {
  "/furniture-shop": THEMES.FURNITURE,
  "/health-beauty": THEMES.HEALTH,
  "/gift-shop": THEMES.GIFT
};

export default function getThemeOptions(pathname: string): ThemeOption {
  const themeKey = routeThemeMap[pathname] || THEMES.DEFAULT;
  const themeOption = themesOptions[themeKey];
  return themeOption;
}
