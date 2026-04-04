const LANGUAGE_COOKIE_KEY = "buglogin_language";
const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function writeLanguageCookie(language: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${LANGUAGE_COOKIE_KEY}=${encodeURIComponent(language)}; Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}
