const SCRIPT_ID = "recaptcha-enterprise-script";

let loadPromise: Promise<void> | null = null;

type RecaptchaEnterprise = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

type WindowWithRecaptcha = Window & {
  grecaptcha?: {
    enterprise?: RecaptchaEnterprise;
  };
};

function getWindow(): WindowWithRecaptcha | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as WindowWithRecaptcha;
}

function ensureRecaptchaLoaded(siteKey: string): Promise<void> {
  const currentWindow = getWindow();
  if (!currentWindow) {
    return Promise.resolve();
  }

  if (currentWindow.grecaptcha?.enterprise) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load reCAPTCHA script.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Unable to load reCAPTCHA script."));
    };
    document.head.appendChild(script);
  }).finally(() => {
    loadPromise = null;
  });

  return loadPromise ?? Promise.resolve();
}

export async function executeRecaptchaAction(siteKey: string, action: string): Promise<string> {
  await ensureRecaptchaLoaded(siteKey);

  const enterprise = getWindow()?.grecaptcha?.enterprise;
  if (!enterprise) {
    throw new Error("reCAPTCHA is not available in this environment.");
  }

  await new Promise<void>((resolve) => enterprise.ready(resolve));
  return enterprise.execute(siteKey, { action });
}

export function preloadRecaptcha(siteKey: string): Promise<void> {
  return ensureRecaptchaLoaded(siteKey);
}
