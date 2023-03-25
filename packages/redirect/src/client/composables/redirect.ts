import { useRouteLocale } from "@vuepress/client";
import { isLinkHttp } from "@vuepress/shared";
import { computed, watch } from "vue";
import { type RouteRecordNormalized, useRoute, useRouter } from "vue-router";
import { entries } from "vuepress-shared/client";

import { redirectConfig } from "@temp/redirect/config.js";

import { type RedirectLocaleConfig } from "../../shared/index.js";
import { normalizePath } from "../utils/index.js";

declare const REDIRECT_LOCALE_CONFIG: RedirectLocaleConfig | null;

const enableLocaleRedirect = Boolean(REDIRECT_LOCALE_CONFIG);

const {
  defaultBehavior,
  defaultLocale: defaultLocalePath,
  localeConfig,
  localeFallback,
} = enableLocaleRedirect
  ? REDIRECT_LOCALE_CONFIG!
  : ({} as RedirectLocaleConfig);

/**
 * @description devServer only function to handle redirects
 */
export const setupRedirect = (): void => {
  const router = useRouter();
  const route = useRoute();
  const routeLocale = useRouteLocale();

  const isRootLocale = computed(() => routeLocale.value === "/");

  const handleLocaleRedirect = (routes: RouteRecordNormalized[]): void => {
    const { languages } = window.navigator;

    const defaultLocale = routes.some(
      ({ path }) => path === route.path.replace("/", defaultLocalePath)
    )
      ? defaultLocalePath
      : routes.find(
          ({ path }) =>
            route.path.split("/").length >= 3 &&
            path === route.path.replace(/^\/[^/]+\//, "/")
        )?.path;

    let matchedLocalePath: string | null = null;

    // get matched locale
    findLanguage: for (const lang of languages)
      for (const [localePath, langs] of Object.entries(localeConfig))
        if (langs.includes(lang)) {
          if (
            localeFallback &&
            routes.every(({ path }) => path !== route.path.replace("/", path))
          )
            continue;

          matchedLocalePath = localePath;
          break findLanguage;
        }

    // default link
    const defaultRoute = defaultLocale
      ? route.fullPath.replace("/", defaultLocale)
      : null;

    // a locale matches
    if (matchedLocalePath) {
      const hasLocalePage = routes.some(
        ({ path }) => route.path.replace("/", matchedLocalePath!) == path
      );
      const localeRoute = route.fullPath.replace("/", matchedLocalePath);

      const routePath =
        // the locale page exists
        hasLocalePage
          ? localeRoute
          : // the page does not exist
          defaultBehavior === "homepage"
          ? // locale homepage
            matchedLocalePath
          : defaultBehavior === "defaultLocale" && defaultRoute
          ? // default locale page
            defaultRoute
          : // as is to get a 404 page of that locale
            localeRoute;

      void router.replace(routePath);
    }
    // we have a default page
    else if (defaultRoute) {
      void router.replace(defaultRoute);
    } else if (route.path !== "/404.html") {
      void router.replace("/404.html");
    }
  };

  watch(
    () => route.path,
    (path) => {
      // handle redirects
      for (const [from, to] of entries(redirectConfig))
        if (normalizePath(path.toLowerCase()) === from.toLowerCase())
          if (isLinkHttp(to)) window.open(to);
          else void router.replace(to);

      if (enableLocaleRedirect && isRootLocale.value)
        handleLocaleRedirect(router.getRoutes());
    },
    { immediate: true }
  );
};