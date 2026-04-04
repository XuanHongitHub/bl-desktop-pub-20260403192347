#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium, firefox } from "playwright";

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      args[key.slice(2)] = "true";
      continue;
    }
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function parseProxyValue(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^socks5?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const protocol = String(url.protocol || "http:").replace(":", "");
      const host = url.hostname;
      const port = url.port ? `:${url.port}` : "";
      if (!host) return null;
      return {
        server: `${protocol}://${host}${port}`,
        username: decodeURIComponent(url.username || ""),
        password: decodeURIComponent(url.password || ""),
      };
    } catch {
      return null;
    }
  }
  const atIndex = value.lastIndexOf("@");
  if (atIndex > 0) {
    const creds = value.slice(0, atIndex);
    const hostPort = value.slice(atIndex + 1);
    const [username = "", password = ""] = creds.split(":");
    if (hostPort.includes(":")) {
      return {
        server: `http://${hostPort}`,
        username,
        password,
      };
    }
  }
  const parts = value.split(":");
  if (parts.length === 2) {
    const [host, port] = parts;
    if (host && port) {
      return { server: `http://${host}:${port}`, username: "", password: "" };
    }
  }
  if (parts.length >= 4) {
    const host = parts[0];
    const port = parts[1];
    const username = parts[2];
    const password = parts.slice(3).join(":");
    if (host && port) {
      return {
        server: `http://${host}:${port}`,
        username,
        password,
      };
    }
  }
  return null;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

class JsonlWriter {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await ensureDir(path.dirname(this.filePath));
  }

  async write(event) {
    const payload = { at: nowIso(), ...event };
    await fs.appendFile(this.filePath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}

function toSlug(input) {
  const normalized = String(input || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "page";
}

function shortHash(input) {
  const text = String(input || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function toUrlFileSlug(rawUrl) {
  const value = String(rawUrl || "");
  try {
    const url = new URL(value);
    const host = toSlug(url.host || "host");
    const pathPart = toSlug(url.pathname || "path");
    return `${host}_${pathPart}_${shortHash(value)}`.slice(0, 140);
  } catch {
    return `${toSlug(value).slice(0, 120)}_${shortHash(value)}`;
  }
}

function normalizeDigits(input) {
  return String(input || "")
    .replace(/[^\d]+/g, "")
    .trim();
}

function normalizeEmail(input) {
  const value = String(input || "").trim();
  return value.includes("@") ? value : "";
}

function extractPrimaryEmail(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  const first = value.split("|")[0]?.trim() || "";
  return normalizeEmail(first);
}

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function looksLikeUuid(value) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

function pickSeedValue(seed, keys) {
  for (const key of keys) {
    const value = seed?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return "";
}

function deriveSeedContext(seed) {
  const payload = seed?.seedPayload && typeof seed.seedPayload === "object" ? seed.seedPayload : {};
  const raw = payload.raw && typeof payload.raw === "object" ? payload.raw : {};
  const hotmailBundle = pickSeedValue(payload, ["hotmail", "email", "mail", "apiMail"]);
  const hotmailParts = splitPipe(hotmailBundle);
  const email =
    extractPrimaryEmail(pickSeedValue(payload, ["email", "mail", "hotmail"])) ||
    normalizeEmail(hotmailParts[0]) ||
    extractPrimaryEmail(pickSeedValue(raw, ["hotmail", "mail", "email"]));
  const phoneFromPayload = pickSeedValue(payload, ["phone", "phoneNumber"]);
  const phone = normalizeDigits(
    phoneFromPayload.includes("----")
      ? phoneFromPayload.split("----")[0]
      : phoneFromPayload,
  );
  const apiPhone =
    pickSeedValue(payload, ["apiPhone", "api_phone"]) ||
    (phoneFromPayload.includes("----") ? phoneFromPayload.split("----").slice(1).join("----").trim() : "");
  let apiMail =
    pickSeedValue(payload, ["apiMail", "api_mail", "mailApiEndpoint"]) ||
    pickSeedValue(raw, ["api_mail", "mail_api", "email_api"]);
  if (looksLikeUuid(apiMail) && hotmailBundle.includes("|")) {
    apiMail = hotmailBundle;
  }
  const ein =
    normalizeDigits(pickSeedValue(payload, ["ein"])) ||
    normalizeDigits(pickSeedValue(raw, ["ein", "tax_id", "taxid", "tin"]));
  const ssn =
    normalizeDigits(pickSeedValue(payload, ["ssn", "socialSecurity"])) ||
    normalizeDigits(pickSeedValue(raw, ["ssn", "social_security", "social_security_number"]));
  const zip =
    normalizeDigits(
      pickSeedValue(raw, ["zip", "zip_llc", "zip_code", "postal_code"]),
    ) || pickSeedValue(payload, ["zip", "zipCode"]);
  const dob =
    pickSeedValue(payload, ["dob", "dateOfBirth", "birthDate"]) ||
    pickSeedValue(raw, ["dob", "date_of_birth", "birth_date"]);
  const gender =
    pickSeedValue(payload, ["gender", "sex"]) || pickSeedValue(raw, ["gender", "sex"]);
  const address =
    pickSeedValue(payload, ["address", "streetAddress"]) ||
    pickSeedValue(raw, ["address", "address_llc", "street_address", "business_address"]);
  const city =
    pickSeedValue(payload, ["city", "citi"]) ||
    pickSeedValue(raw, ["city", "citi", "city_llc", "citi_llc"]);
  const state =
    pickSeedValue(payload, ["state", "bang"]) ||
    pickSeedValue(raw, ["state", "bang", "state_llc", "bang_llc"]);
  const file =
    pickSeedValue(payload, [
      "file",
      "pdf",
      "document",
      "documentPath",
      "docPath",
      "einPdf",
      "ssnPdf",
    ]) ||
    pickSeedValue(raw, [
      "file",
      "pdf",
      "document",
      "document_path",
      "doc_path",
      "pdf_path",
      "ein_pdf",
      "ssn_pdf",
      "info_llc",
    ]);
  const docType =
    pickSeedValue(payload, ["type", "docType", "documentType"]) ||
    pickSeedValue(raw, ["type", "doc_type", "file_type", "document_type"]);
  const documentRoot = pickSeedValue(payload, ["documentRoot", "fileRoot", "docRoot"]);
  const documentRootsRaw = pickSeedValue(payload, ["documentRoots", "fileRoots", "docRoots"]);
  const accountPassword =
    pickSeedValue(payload, ["passTiktok", "pass_tiktok", "tiktokPassword", "password", "pass tiktok"]) ||
    pickSeedValue(raw, ["pass_tiktok", "tiktok_password", "password", "pass tiktok"]) ||
    (hotmailParts.length >= 2 ? hotmailParts[1] : "");
  const explicitUsername =
    pickSeedValue(payload, ["username", "userName", "tiktokUsername"]) ||
    pickSeedValue(raw, ["username", "user_name", "tiktok_username"]);
  const explicitLoginPassword =
    pickSeedValue(payload, ["loginPassword", "tiktokLoginPassword"]) ||
    pickSeedValue(raw, ["login_password", "tiktok_login_password"]);
  const username = explicitUsername || (phone ? `${phone}.bug` : "");
  const loginPassword = explicitLoginPassword || accountPassword || (phone ? `${phone}bug!` : "");
  const firstName =
    pickSeedValue(payload, ["firstName", "first_name", "fname"]) ||
    pickSeedValue(raw, ["first_name", "firstname", "fname"]);
  const lastName =
    pickSeedValue(payload, ["lastName", "last_name", "lname"]) ||
    pickSeedValue(raw, ["last_name", "lastname", "lname"]);

  return {
    email,
    emailPassword:
      pickSeedValue(payload, ["mailPassword", "passMail"]) ||
      (hotmailParts.length >= 2 ? hotmailParts[1] : ""),
    phone,
    apiPhone,
    apiMail,
    phoneApiEndpoint:
      pickSeedValue(payload, ["phoneApiEndpoint", "apiPhone"]) ||
      pickSeedValue(raw, ["phone_api", "api_phone"]) ||
      (phoneFromPayload.includes("----") ? phoneFromPayload.split("----").slice(1).join("----").trim() : ""),
    emailApiEndpoint: (() => {
      const direct =
        pickSeedValue(payload, ["emailApiEndpoint", "apiMail", "api_mail"]) ||
        pickSeedValue(raw, ["email_api", "api_mail", "mail_api"]) ||
        pickSeedValue(raw, ["hotmail", "hot_mail", "outlook"]) ||
        apiMail;
      if (looksLikeUuid(direct) && hotmailBundle.includes("|")) {
        return hotmailBundle;
      }
      return direct;
    })(),
    accountPassword,
    username,
    loginUsername: username,
    loginPassword,
    firstName,
    lastName,
    ein,
    ssn,
    dob,
    gender,
    fullName:
      pickSeedValue(payload, ["fullName", "name", "companyName"]) ||
      pickSeedValue(raw, ["name", "full_name", "name_llc", "company_name"]),
    companyName:
      pickSeedValue(payload, ["companyName", "nameLlc"]) ||
      pickSeedValue(raw, ["name_llc", "company_name"]),
    address,
    city,
    state,
    zip,
    file,
    docType,
    documentRoot,
    documentRootsRaw,
    raw,
  };
}

function createAutoState() {
  return {
    attempts: Object.create(null),
    blockedReason: "",
    lastActionAt: 0,
    recordedContact: false,
    continueClicks: 0,
    einInputAttempted: false,
    einSubmitAttempted: false,
    otpAttempted: false,
    otpFilled: false,
    otpSubmitted: false,
    otpLastSubmittedCode: "",
    otpCandidateCode: "",
    otpStepEnteredAt: 0,
    otpWarmupLogged: false,
    registerSubmitted: false,
    businessInfoFilled: false,
    businessSubmitted: false,
    businessVerifyClickedAt: 0,
    businessVerifyDone: false,
    businessVerifyInProgress: false,
    businessVerifyCompletedAt: 0,
    einFieldsFilled: false,
    passwordFilled: false,
    passwordSubmitted: false,
    businessDocumentUploadAttempted: false,
    businessDocumentUploaded: false,
    einLastFillAt: 0,
    einStablePasses: 0,
    lastTickAt: 0,
    stepLastSeen: "",
    stepAttempts: Object.create(null),
    forcedContactMode: "",
    loginMethodOpened: false,
    loginIdentifierFilled: false,
    loginPasswordFilled: false,
    loginSubmitted: false,
    loginSubmittedAt: 0,
    loginOtpFilled: false,
    loginOtpSubmitted: false,
    loginOtpLastSubmittedCode: "",
    loginOtpCandidateCode: "",
    loginOtpStepEnteredAt: 0,
    loginOtpWarmupLogged: false,
    loginVerifyPhoneSelected: false,
    lastBlockedReasonEmitted: "",
    primaryRepresentativeBackAttempted: false,
    wrongBiztypeBackAttempted: false,
    callbackTicketExpiredRecoveredAt: 0,
    lastStepDiagnosticAt: Object.create(null),
    stepDiagnosticCount: 0,
    shopNameRetryCount: 0,
    shopContactVerified: false,
    shopContactType: "",
    shopContactCodeRequestedAt: 0,
    shopContactOtpLastSubmittedCode: "",
  };
}

function canAttempt(state, key, cooldownMs) {
  const now = Date.now();
  const last = state.attempts[key] || 0;
  if (now - last < cooldownMs) return false;
  state.attempts[key] = now;
  return true;
}

async function safeCount(locator) {
  try {
    return await locator.count();
  } catch {
    return 0;
  }
}

async function safeFill(locator, value) {
  try {
    await locator.first().click({ timeout: 1200 });
    await locator.first().fill("");
    await locator.first().fill(value, { timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Force-set a React controlled input value using the native setter so React
 * picks up the change event. Falls back to direct .value assignment.
 * Must be called inside page.evaluate().
 */
function forceReactInputValue(input, value) {
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
  try {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input),
      "value",
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return String(input.value || "") === String(value);
  } catch {
    return false;
  }
}

async function safeClick(locator) {
  try {
    await locator.first().click({ timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

async function safeClickVisible(locator) {
  try {
    const item = locator.first();
    const visible = await item.isVisible();
    if (!visible) return false;
    await item.click({ timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

async function fallbackClickButtonByText(page, candidates) {
  return page
    .evaluate((texts) => {
      const list = Array.from(document.querySelectorAll("button"));
      for (const button of list) {
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) continue;
        const content = String(button.textContent || "").trim().toLowerCase();
        if (!content) continue;
        const disabled = button.disabled || button.getAttribute("aria-disabled") === "true";
        if (disabled) continue;
        for (const text of texts) {
          if (content.includes(String(text).toLowerCase())) {
            button.click();
            return true;
          }
        }
      }
      return false;
    }, candidates)
    .catch(() => false);
}

async function fallbackClickAnyByText(page, candidates) {
  return page
    .evaluate((texts) => {
      const normalized = Array.isArray(texts)
        ? texts.map((item) => String(item || "").toLowerCase())
        : [];
      const nodes = Array.from(
        document.querySelectorAll("button,a,[role='tab'],[role='button'],div,span"),
      );
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        const content = String(node.textContent || "").trim().toLowerCase();
        if (!content) continue;
        const disabled =
          node.getAttribute("aria-disabled") === "true" ||
          node.getAttribute("disabled") != null;
        if (disabled) continue;
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const rect = node.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 10) continue;
        for (const text of normalized) {
          if (content.includes(text)) {
            node.click();
            return true;
          }
        }
      }
      return false;
    }, candidates)
    .catch(() => false);
}

async function chooseSellerIntentOption(page) {
  return page
    .evaluate(() => {
      const root = document.querySelector("[data-tid='intent_question']");
      if (!(root instanceof HTMLElement)) return false;

      const cards = Array.from(
        root.querySelectorAll("[data-uid^='intentquestions:optiondiv'], .IntentQuestions__OptionDiv-hTcgct"),
      );
      for (const card of cards) {
        if (!(card instanceof HTMLElement)) continue;
        const text = String(card.innerText || card.textContent || "").toLowerCase();
        if (!text.includes("seller")) continue;
        if (text.includes("reseller")) continue;
        card.click();
        card.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    })
    .catch(() => false);
}

async function clickEnabledIntentNext(page) {
  return page
    .evaluate(() => {
      const scope = document.querySelector("[data-tid='right-button']") || document;
      const buttons = Array.from(scope.querySelectorAll("button"));
      for (const button of buttons) {
        if (!(button instanceof HTMLButtonElement)) continue;
        const text = String(button.innerText || button.textContent || "").trim().toLowerCase();
        if (!(text.includes("next") || text.includes("continue"))) continue;
        const disabled = button.disabled || button.getAttribute("aria-disabled") === "true";
        if (disabled) return false;
        button.click();
        return true;
      }
      return false;
    })
    .catch(() => false);
}

async function clickPasswordContinueButton(page) {
  const textClicked = await page
    .evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const button of buttons) {
        if (!(button instanceof HTMLButtonElement)) continue;
        const text = String(button.innerText || button.textContent || "").trim().toLowerCase();
        if (!text.includes("continue")) continue;
        const disabled = button.disabled || button.getAttribute("aria-disabled") === "true";
        if (disabled) continue;
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (rect.width < 12 || rect.height < 12) continue;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
      }
      return false;
    })
    .catch(() => false);
  if (textClicked) return true;

  const selectorClicked = await page
    .evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll(
          "button[data-tid='m4b_button'],button[data-uid*='twostepspc:button'],button.theme-m4b-button",
        ),
      );
      for (const button of candidates) {
        if (!(button instanceof HTMLButtonElement)) continue;
        const text = String(button.innerText || button.textContent || "").trim().toLowerCase();
        if (!text.includes("continue") && !text.includes("next")) continue;
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) continue;
        const disabled = button.disabled || button.getAttribute("aria-disabled") === "true";
        if (disabled) continue;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    })
    .catch(() => false);
  if (selectorClicked) return true;

  const locators = [
    page.locator("button[data-tid='m4b_button']"),
    page.locator("button[data-uid*='twostepspc:button']"),
    page.locator("button.theme-m4b-button"),
    page.locator("button", { hasText: "Continue" }),
    page.locator("button", { hasText: "Next" }),
  ];
  for (const locator of locators) {
    if ((await safeCount(locator)) === 0) continue;
    const clicked = await safeClick(locator);
    if (clicked) return true;
  }
  return fallbackClickButtonByText(page, ["continue", "next"]);
}

async function isPasswordFormValidForSubmit(page) {
  return page
    .evaluate(() => {
      const bodyText = String(document.body?.innerText || "").toLowerCase();
      if (!bodyText.includes("set your password")) return false;

      const hasHardError =
        bodyText.includes("password is required") ||
        bodyText.includes("confirm the password") ||
        bodyText.includes("must be 6-20 characters long") && bodyText.includes("not");
      if (hasHardError) return false;

      const passwordInputs = Array.from(document.querySelectorAll("input[type='password']"))
        .filter((el) => el instanceof HTMLInputElement);
      if (passwordInputs.length < 2) return false;
      const first = String(passwordInputs[0].value || "").trim();
      const second = String(passwordInputs[1].value || "").trim();
      if (!first || !second || first !== second) return false;

      const checks = Array.from(document.querySelectorAll("li,div,span,p"));
      const greenHints = checks.filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        const text = String(el.innerText || el.textContent || "").toLowerCase();
        if (!text) return false;
        if (!text.includes("must contain numbers") && !text.includes("must be 6-20")) return false;
        const color = window.getComputedStyle(el).color || "";
        return /rgb\(\s*34,\s*197,\s*94\s*\)|rgb\(\s*22,\s*163,\s*74\s*\)|rgb\(\s*16,\s*185,\s*129\s*\)/.test(color);
      });
      return greenHints.length >= 1;
    })
    .catch(() => false);
}

async function hasVisiblePasswordError(page) {
  return page
    .evaluate(() => {
      const rootCandidates = Array.from(document.querySelectorAll("form,div,section"));
      let root = null;
      for (const node of rootCandidates) {
        if (!(node instanceof HTMLElement)) continue;
        const text = String(node.innerText || "").toLowerCase();
        if (text.includes("set your password")) {
          root = node;
          break;
        }
      }
      if (!root) root = document.body;
      const nodes = Array.from(root.querySelectorAll("div,span,p,li"));
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        const text = String(node.innerText || node.textContent || "").trim().toLowerCase();
        if (!text) continue;
        const isErrorText =
          text.includes("password is required") ||
          text.includes("confirm the password") ||
          text.includes("does not match") ||
          text.includes("invalid password");
        if (!isErrorText) continue;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (rect.width < 4 || rect.height < 4) continue;
        return true;
      }
      return false;
    })
    .catch(() => false);
}

async function chooseBusinessTypeForEin(page) {
  return page
    .evaluate(() => {
      const rootCandidates = Array.from(document.querySelectorAll("div,section,form"));
      let root = null;
      for (const node of rootCandidates) {
        if (!(node instanceof HTMLElement)) continue;
        const text = String(node.innerText || "").toLowerCase();
        if (text.includes("what type of business do you operate")) {
          root = node;
          break;
        }
      }
      if (!root) root = document.body;
      const cards = Array.from(root.querySelectorAll("div,label,button"));
      for (const card of cards) {
        if (!(card instanceof HTMLElement)) continue;
        const text = String(card.innerText || card.textContent || "").toLowerCase();
        if (!text.includes("sole proprietorship")) continue;
        const input =
          card.querySelector("input[type='radio']") ||
          card.closest("label")?.querySelector("input[type='radio']") ||
          card.parentElement?.querySelector("input[type='radio']");
        if (input instanceof HTMLInputElement) {
          input.focus();
          input.click();
          input.checked = true;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        card.click();
        card.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        card.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        card.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    })
    .catch(() => false);
}

async function isSoleProprietorshipSelected(page) {
  return page
    .evaluate(() => {
      const root = document.querySelector("[data-tid='intent_question']") || document.body;
      const cards = Array.from(root.querySelectorAll("div,label"));
      for (const card of cards) {
        if (!(card instanceof HTMLElement)) continue;
        const text = String(card.innerText || card.textContent || "").toLowerCase();
        if (!text.includes("sole proprietorship")) continue;

        const radio =
          card.querySelector("input[type='radio']") ||
          card.closest("label")?.querySelector("input[type='radio']") ||
          card.parentElement?.querySelector("input[type='radio']");
        if (radio instanceof HTMLInputElement && radio.checked) {
          return true;
        }
        const ariaChecked = card.getAttribute("aria-checked");
        if (ariaChecked === "true") return true;
        if (card.className && /selected|active|checked/i.test(card.className)) return true;
      }
      return false;
    })
    .catch(() => false);
}

async function fallbackFillContact(page, value) {
  return page
    .evaluate((contactValue) => {
      const selectors = [
        "#phone_email_input",
        "#phone_email",
        "input[placeholder*='phone number or email' i]",
        "input[type='email']",
        "input[type='tel']",
      ];
      for (const selector of selectors) {
        const input = document.querySelector(selector);
        if (!(input instanceof HTMLInputElement)) continue;
        input.focus();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.value = String(contactValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }, value)
    .catch(() => false);
}

async function fallbackFillLoginIdentifier(page, value) {
  return page
    .evaluate((loginValue) => {
      const selectors = [
        "input[name*='username' i]",
        "input[id*='username' i]",
        "input[placeholder*='phone' i]",
        "input[placeholder*='email' i]",
        "input[placeholder*='username' i]",
        "input[type='text']",
        "input[type='email']",
        "input[type='tel']",
      ];
      for (const selector of selectors) {
        const nodes = Array.from(document.querySelectorAll(selector));
        for (const input of nodes) {
          if (!(input instanceof HTMLInputElement)) continue;
          if (input.offsetParent === null) continue;
          if (String(input.type || "").toLowerCase() === "password") continue;
          input.focus();
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.value = String(loginValue);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      return false;
    }, value)
    .catch(() => false);
}

function extractOtpCode(text) {
  const source = String(text || "");
  const contextual = source.match(
    /\b(?:verification\s*code|verify\s*code|otp|code)\b[^\d]{0,24}(\d{4,8})\b/i,
  );
  if (contextual) {
    return contextual[1];
  }
  const reverseContextual = source.match(
    /\b(\d{4,8})\b[^\n\r]{0,48}\b(?:verification\s*code|verify\s*code|otp|code)\b/i,
  );
  if (reverseContextual) {
    return reverseContextual[1];
  }
  const all = Array.from(source.matchAll(/\b(\d{4,8})\b/g));
  if (all.length > 0) {
    return all[0]?.[1] || "";
  }
  return "";
}

function parseMailOauth2Bundle(rawSource) {
  const source = String(rawSource || "").trim();
  if (!source || !source.includes("@")) {
    return null;
  }
  const parts = source
    .split("|")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const email = parts.find((part) => part.includes("@")) || "";
  if (!email) {
    return null;
  }

  let refreshToken = "";
  let clientId = "";
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const part of parts) {
    if (!refreshToken && /^M\./.test(part)) {
      refreshToken = part;
    }
    if (!clientId && uuidRegex.test(part)) {
      clientId = part;
    }
  }
  if (!refreshToken || !clientId) {
    return null;
  }
  return {
    email,
    refreshToken,
    clientId,
  };
}

async function fetchDongvanOauth2Code(bundle, type = "tiktok") {
  const response = await fetch("https://tools.dongvanfb.net/api/get_code_oauth2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json,text/plain,*/*",
    },
    body: JSON.stringify({
      email: bundle.email,
      refresh_token: bundle.refreshToken,
      client_id: bundle.clientId,
      type,
    }),
  });
  if (!response.ok) {
    return "";
  }
  const payload = await response.json().catch(() => null);
  if (!payload) {
    return "";
  }
  const directCode = extractOtpCode(payload.code || payload.content || payload.message || "");
  if (directCode) {
    return directCode;
  }
  return extractOtpCode(JSON.stringify(payload));
}

function extractOtpCodeFromDongvanMessages(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const value = payload;
  const parseMessageTime = (message) => {
    const raw = String(message?.date || message?.time || "").trim();
    if (!raw) return 0;
    const direct = Date.parse(raw);
    if (Number.isFinite(direct)) return direct;
    const m = raw.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const hour = Number(m[1] || 0);
      const minute = Number(m[2] || 0);
      const day = Number(m[3] || 1);
      const month = Number(m[4] || 1);
      const year = Number(m[5] || 1970);
      return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
    }
    return 0;
  };

  const messages = (Array.isArray(value.messages) ? value.messages : [])
    .slice()
    .sort((a, b) => {
      const diff = parseMessageTime(b) - parseMessageTime(a);
      if (diff !== 0) return diff;
      return Number(b?.uid || 0) - Number(a?.uid || 0);
    });
  for (const message of messages) {
    const sender = Array.isArray(message?.from)
      ? message.from
          .map((entry) => `${entry?.address || ""} ${entry?.name || ""}`.toLowerCase())
          .join(" ")
      : "";
    const subject = String(message?.subject || "").toLowerCase();
    const isTiktok = sender.includes("tiktok") || subject.includes("tiktok");
    if (!isTiktok) {
      continue;
    }
    const fromCode = extractOtpCode(message?.code || "");
    if (fromCode) {
      return fromCode;
    }
    const fromContent = extractOtpCode(
      `${message?.subject || ""} ${message?.message || ""} ${message?.content || ""}`,
    );
    if (fromContent) {
      return fromContent;
    }
  }
  return extractOtpCode(JSON.stringify(payload));
}

async function fetchOtpCode(endpoint) {
  const source = String(endpoint || "").trim();
  if (!source) {
    return "";
  }

  try {
    const oauth2Bundle = parseMailOauth2Bundle(source);
    if (oauth2Bundle) {
      // Prefer dedicated code endpoint first (faster/cleaner for TikTok OTP),
      // then fall back to mailbox listing endpoint.
      const directTiktokCode = await fetchDongvanOauth2Code(oauth2Bundle, "tiktok").catch(
        () => "",
      );
      if (directTiktokCode) {
        return directTiktokCode;
      }
      const directAnyCode = await fetchDongvanOauth2Code(oauth2Bundle, "all").catch(() => "");
      if (directAnyCode) {
        return directAnyCode;
      }

      const response = await fetch("https://tools.dongvanfb.net/api/get_messages_oauth2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json,text/plain,*/*",
        },
        body: JSON.stringify({
          email: oauth2Bundle.email,
          refresh_token: oauth2Bundle.refreshToken,
          client_id: oauth2Bundle.clientId,
          list_mail: "all",
        }),
      });
      if (!response.ok) {
        return "";
      }
      const payload = await response.json().catch(() => null);
      if (!payload) {
        return "";
      }
      return extractOtpCodeFromDongvanMessages(payload);
    }

    if (!/^https?:\/\//i.test(source)) {
      return extractOtpCode(source);
    }

    const target = source;
    const response = await fetch(target, {
      method: "GET",
      headers: { accept: "application/json,text/plain,*/*" },
    });
    if (!response.ok) {
      return "";
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => null);
      if (!json) return "";
      const candidates = [
        json.code,
        json.otp,
        json.pin,
        json.sms,
        json.message,
        json.data?.code,
        json.data?.otp,
        json.data?.pin,
        json.result?.code,
        json.result?.otp,
      ];
      for (const candidate of candidates) {
        const code = extractOtpCode(candidate);
        if (code) return code;
      }
      const fromPayload = extractOtpCode(JSON.stringify(json));
      if (fromPayload) {
        return fromPayload;
      }
      return "";
    }
    const text = await response.text();
    return extractOtpCode(text);
  } catch {
    return "";
  }
}

async function fillFirstMatch(inputs, value) {
  for (const input of inputs) {
    if ((await safeCount(input)) === 0) continue;
    const done = await safeFill(input, value);
    if (done) return true;
  }
  return false;
}

async function readFirstInputValue(locator) {
  try {
    if ((await safeCount(locator)) === 0) return "";
    return String((await locator.first().inputValue().catch(() => "")) || "").trim();
  } catch {
    return "";
  }
}

function normalizeSimpleText(input) {
  return String(input || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDigitsOnly(input) {
  return String(input || "").replace(/\D+/g, "");
}

function isLikelyPersonName(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (!/[a-z]/i.test(text)) return false;
  if (/\d/.test(text)) return false;
  return true;
}

async function fillFirstMatchIfNeeded(inputs, value, options = {}) {
  const targetRaw = String(value || "");
  if (!targetRaw.trim()) return false;

  const normalize =
    typeof options.normalize === "function" ? options.normalize : (v) => String(v || "").trim();
  const isValidCurrent = typeof options.isValidCurrent === "function" ? options.isValidCurrent : null;
  const forceOverwriteInvalid = options.forceOverwriteInvalid !== false;
  const target = normalize(targetRaw);

  for (const input of inputs) {
    if ((await safeCount(input)) === 0) continue;
    const current = await readFirstInputValue(input);
    const normalizedCurrent = normalize(current);
    if (normalizedCurrent && normalizedCurrent === target) {
      return true;
    }
    if (isValidCurrent && isValidCurrent(current)) {
      // Already valid enough, do not overwrite to avoid reset loops.
      return true;
    }
    if (!forceOverwriteInvalid && normalizedCurrent) {
      continue;
    }
    const done = await safeFill(input, targetRaw);
    if (done) return true;
  }
  return false;
}

async function fillOtpInputs(page, otpCode) {
  const code = String(otpCode || "").replace(/[^\d]/g, "").slice(0, 8);
  if (!code || code.length < 4) return false;

  // Strategy 1 (preferred): focus the left-most OTP cell and type naturally.
  // Most OTP widgets auto-advance caret; this keeps strict left-to-right input.
  const typedFromFirstCell = await page
    .evaluate((rawCode) => {
      const allInputs = Array.from(document.querySelectorAll("input"));
      const otpLike = allInputs.filter((input) => {
        if (!(input instanceof HTMLInputElement)) return false;
        const type = String(input.type || "").toLowerCase();
        const maxLength = Number(input.maxLength || 0);
        const inputMode = String(input.getAttribute("inputmode") || "").toLowerCase();
        const name = String(input.getAttribute("name") || "").toLowerCase();
        const id = String(input.getAttribute("id") || "").toLowerCase();
        const placeholder = String(input.getAttribute("placeholder") || "").toLowerCase();
        const ariaLabel = String(input.getAttribute("aria-label") || "").toLowerCase();
        const rect = input.getBoundingClientRect();
        const visibleEnough = rect.width >= 10 && rect.height >= 10;
        return (
          input.offsetParent !== null &&
          visibleEnough &&
          (maxLength === 1 ||
            inputMode.includes("numeric") ||
            name.includes("otp") ||
            name.includes("code") ||
            id.includes("otp") ||
            id.includes("code") ||
            placeholder.includes("code") ||
            ariaLabel.includes("code")) &&
          (type === "text" || type === "tel" || type === "number" || type === "")
        );
      });
      if (otpLike.length < 4) {
        return false;
      }
      otpLike.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        if (Math.abs(aRect.top - bRect.top) > 2) {
          return aRect.top - bRect.top;
        }
        return aRect.left - bRect.left;
      });
      const first = otpLike[0];
      if (!(first instanceof HTMLInputElement)) {
        return false;
      }
      first.focus();
      first.click();
      first.value = "";
      first.dispatchEvent(new Event("input", { bubbles: true }));
      first.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, code)
    .catch(() => false);
  if (typedFromFirstCell) {
    try {
      await page.keyboard.type(code, { delay: 45 });
      const looksFilled = await page
        .evaluate((rawCode) => {
          const targetDigits = String(rawCode || "")
            .replace(/[^\d]/g, "")
            .slice(0, 8);
          const allInputs = Array.from(document.querySelectorAll("input"));
          const otpLike = allInputs.filter((input) => {
            if (!(input instanceof HTMLInputElement)) return false;
            const rect = input.getBoundingClientRect();
            const visibleEnough = rect.width >= 10 && rect.height >= 10;
            const maxLength = Number(input.maxLength || 0);
            const inputMode = String(input.getAttribute("inputmode") || "").toLowerCase();
            const name = String(input.getAttribute("name") || "").toLowerCase();
            const id = String(input.getAttribute("id") || "").toLowerCase();
            const placeholder = String(input.getAttribute("placeholder") || "").toLowerCase();
            return (
              input.offsetParent !== null &&
              visibleEnough &&
              (maxLength === 1 ||
                inputMode.includes("numeric") ||
                name.includes("otp") ||
                name.includes("code") ||
                id.includes("otp") ||
                id.includes("code") ||
                placeholder.includes("code"))
            );
          });
          otpLike.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            if (Math.abs(aRect.top - bRect.top) > 2) return aRect.top - bRect.top;
            return aRect.left - bRect.left;
          });
          const collected = otpLike
            .slice(0, Math.min(otpLike.length, targetDigits.length))
            .map((input) => String(input.value || "").trim())
            .join("");
          if (!collected) return false;
          return collected.length >= Math.min(4, targetDigits.length);
        }, code)
        .catch(() => false);
      if (looksFilled) return true;
    } catch {
      // Continue with direct assignment fallback below.
    }
  }

  const filledGrouped = await page
    .evaluate((rawCode) => {
      const digits = rawCode.split("");
      const allInputs = Array.from(document.querySelectorAll("input"));
      const otpLike = allInputs.filter((input) => {
        if (!(input instanceof HTMLInputElement)) return false;
        const type = String(input.type || "").toLowerCase();
        const maxLength = Number(input.maxLength || 0);
        const inputMode = String(input.getAttribute("inputmode") || "").toLowerCase();
        const name = String(input.getAttribute("name") || "").toLowerCase();
        const id = String(input.getAttribute("id") || "").toLowerCase();
        const placeholder = String(input.getAttribute("placeholder") || "").toLowerCase();
        const ariaLabel = String(input.getAttribute("aria-label") || "").toLowerCase();
        const rect = input.getBoundingClientRect();
        const visibleEnough = rect.width >= 10 && rect.height >= 10;
        return (
          input.offsetParent !== null &&
          visibleEnough &&
          (maxLength === 1 ||
            inputMode.includes("numeric") ||
            name.includes("otp") ||
            name.includes("code") ||
            id.includes("otp") ||
            id.includes("code") ||
            placeholder.includes("code") ||
            ariaLabel.includes("code")) &&
          (type === "text" || type === "tel" || type === "number" || type === "")
        );
      });
      if (otpLike.length < 4) {
        return false;
      }
      otpLike.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        if (Math.abs(aRect.top - bRect.top) > 2) {
          return aRect.top - bRect.top;
        }
        return aRect.left - bRect.left;
      });
      for (let i = 0; i < otpLike.length && i < digits.length; i += 1) {
        const input = otpLike[i];
        input.focus();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.value = digits[i];
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }, code)
    .catch(() => false);
  if (filledGrouped) return true;

  const singleInputFallback = [
    page.locator("input[name*='otp' i]"),
    page.locator("input[id*='otp' i]"),
    page.locator("input[autocomplete='one-time-code']"),
    page.locator("input[placeholder*='code' i]"),
    page.locator("input[inputmode='numeric']"),
  ];
  return fillFirstMatch(singleInputFallback, code);
}

async function hasBlockingCaptchaModal(page) {
  return page
    .evaluate(() => {
      const captchaHints = [
        "verify you are human",
        "security check",
        "slide to verify",
        "drag the slider",
        "complete puzzle",
        "captcha",
      ];
      const dialogs = Array.from(document.querySelectorAll("div,section"));
      for (const node of dialogs) {
        if (!(node instanceof HTMLElement)) continue;
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const text = String(node.innerText || "").toLowerCase();
        if (!text) continue;
        if (captchaHints.some((hint) => text.includes(hint)) && text.length < 2600) {
          const rect = node.getBoundingClientRect();
          if (rect.width > 260 && rect.height > 140) {
            return true;
          }
        }
      }
      return false;
    })
    .catch(() => false);
}

async function fillPasswordPair(page, password) {
  const value = String(password || "").trim();
  if (!value) return false;
  const filledByDom = await page
    .evaluate((pass) => {
      const passwordInputs = Array.from(
        document.querySelectorAll(
          [
            "input[type='password']",
            "input[name*='password' i]",
            "input[id*='password' i]",
            "input[placeholder*='password' i]",
            "input[autocomplete*='password' i]",
            "input[data-testid*='password' i]",
          ].join(", "),
        ),
      ).filter((node) => {
        if (!(node instanceof HTMLInputElement)) return false;
        if (node.offsetParent === null) return false;
        if (node.disabled || node.readOnly) return false;
        const rect = node.getBoundingClientRect();
        return rect.width >= 10 && rect.height >= 10;
      });
      if (passwordInputs.length === 0) return false;
      passwordInputs.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
        return ra.left - rb.left;
      });
      const targets = passwordInputs.slice(0, 2);
      let filledCount = 0;
      for (const input of targets) {
        input.focus();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.value = pass;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        if (String(input.value || "").trim()) {
          filledCount += 1;
        }
      }
      if (targets.length < 2) {
        // In some builds, confirm field appears slightly later. Retry on next tick.
        return false;
      }
      return filledCount >= 2;
    }, value)
    .catch(() => false);
  if (filledByDom) return true;

  // Fallback for controlled inputs that ignore direct DOM value assignment.
  const fallbackSelector = [
    "input[type='password']",
    "input[name*='password' i]",
    "input[id*='password' i]",
    "input[placeholder*='password' i]",
    "input[autocomplete*='password' i]",
    "input[data-testid*='password' i]",
  ].join(", ");
  const candidates = page.locator(fallbackSelector);
  const total = await safeCount(candidates);
  if (total < 2) return false;
  let filled = 0;
  for (let i = 0; i < total; i += 1) {
    const input = candidates.nth(i);
    const isVisible = await input.isVisible().catch(() => false);
    if (!isVisible) continue;
    const isEnabled = await input.isEnabled().catch(() => false);
    if (!isEnabled) continue;
    const ok = await safeFill(input, value);
    if (ok) filled += 1;
    if (filled >= 2) break;
  }
  return filled >= 2;
}

function splitNameParts(fullName) {
  const value = String(fullName || "").trim();
  if (!value) return { firstName: "", lastName: "" };
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function splitCandidateValues(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return String(value || "")
    .split(/[|;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function looksLikeFilePath(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^[a-zA-Z]:[\\/]/.test(text)) return true;
  if (text.startsWith("\\\\")) return true;
  if (text.startsWith("/")) return true;
  if (text.includes("\\") || text.includes("/")) return true;
  return /\.(pdf|png|jpe?g)$/i.test(text);
}

async function fileExists(targetPath) {
  if (!targetPath) return false;
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function defaultDocumentRoots() {
  const roots = [
    "F:\\herd\\fox-auto",
    "F:\\herd\\fox-auto\\outputs",
    "F:\\herd\\fox-auto\\tmp",
    "F:\\SWare\\Cloud\\OneDrive",
    "E:\\bug-login",
    "E:\\bug-login\\tmp",
    process.cwd(),
  ];
  const envRoots = splitCandidateValues(process.env.BUGLOGIN_SELLER_DOC_ROOTS || "");
  return uniqueNonEmpty([...roots, ...envRoots]);
}

function normalizeDocumentName(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
}

async function findFileByName(rootDir, fileName, depth = 0) {
  if (depth > 4) return "";
  let entries = [];
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    return "";
  }
  for (const entry of entries) {
    if (!entry) continue;
    const entryName = String(entry.name || "");
    if (!entryName) continue;
    const fullPath = path.join(rootDir, entryName);
    if (entry.isFile()) {
      if (entryName.toLowerCase() === fileName.toLowerCase()) {
        return fullPath;
      }
      continue;
    }
    if (!entry.isDirectory()) continue;
    if ([".git", "node_modules", "target", "dist", "build"].includes(entryName)) {
      continue;
    }
    const nested = await findFileByName(fullPath, fileName, depth + 1);
    if (nested) return nested;
  }
  return "";
}

async function resolveBusinessDocumentPath(seedContext) {
  const raw = seedContext?.raw && typeof seedContext.raw === "object" ? seedContext.raw : {};
  const syntheticByEin =
    seedContext?.companyName && seedContext?.ein
      ? `${String(seedContext.companyName).trim()} - ${String(seedContext.ein).trim()}.pdf`
      : "";
  const directCandidates = uniqueNonEmpty([
    ...splitCandidateValues(seedContext.file),
    ...splitCandidateValues(seedContext.documentPath),
    ...splitCandidateValues(raw.file),
    ...splitCandidateValues(raw.pdf),
    ...splitCandidateValues(raw.document),
    ...splitCandidateValues(raw.document_path),
    ...splitCandidateValues(raw.doc_path),
    ...splitCandidateValues(raw.pdf_path),
    ...splitCandidateValues(raw.ein_pdf),
    ...splitCandidateValues(raw.ssn_pdf),
    ...splitCandidateValues(raw.info_llc),
    syntheticByEin,
  ]);

  for (const candidate of directCandidates) {
    if (!looksLikeFilePath(candidate)) continue;
    const normalized = normalizeDocumentName(candidate);
    if (!normalized) continue;
    if (await fileExists(normalized)) {
      return path.resolve(normalized);
    }
  }

  const roots = uniqueNonEmpty([
    ...splitCandidateValues(seedContext.documentRoot),
    ...splitCandidateValues(seedContext.documentRootsRaw),
    ...defaultDocumentRoots(),
  ]);
  const fileNames = uniqueNonEmpty(
    directCandidates
      .map((candidate) => normalizeDocumentName(candidate))
      .filter(Boolean)
      .map((candidate) => path.basename(candidate)),
  );

  for (const candidate of directCandidates) {
    const normalized = normalizeDocumentName(candidate);
    if (!normalized) continue;
    if (!looksLikeFilePath(normalized)) continue;
    for (const root of roots) {
      const joined = path.join(root, normalized);
      if (await fileExists(joined)) {
        return path.resolve(joined);
      }
      const joinedByBase = path.join(root, path.basename(normalized));
      if (await fileExists(joinedByBase)) {
        return path.resolve(joinedByBase);
      }
    }
  }

  for (const root of roots) {
    for (const fileName of fileNames) {
      const match = await findFileByName(root, fileName, 0);
      if (match) return path.resolve(match);
    }
  }

  return "";
}

async function fillVisibleEinFormFields(page, seedContext) {
  const einRaw = String(seedContext.ein || "").replace(/\D+/g, "");
  if (einRaw.length < 9) {
    return { filledCount: 0 };
  }

  const einLeft = einRaw.slice(0, 2);
  const einRight = einRaw.slice(2, 9);

  const firstSplitLocator = page
    .locator("input[placeholder='XX'], input[placeholder='xx']")
    .first();
  const secondSplitLocator = page
    .locator("input[placeholder='XXXXXXX'], input[placeholder='xxxxxxx'], input[placeholder='XXXXXXXX'], input[placeholder='xxxxxxxx']")
    .first();

  const hasFirstSplit = (await safeCount(firstSplitLocator)) > 0;
  const hasSecondSplit = (await safeCount(secondSplitLocator)) > 0;
  if (hasFirstSplit && hasSecondSplit) {
    const fillSplit = async () => {
      const first = firstSplitLocator;
      const second = secondSplitLocator;

      await first.click({ timeout: 1500 }).catch(() => {});
      await first.fill("").catch(() => {});
      await first.fill(einLeft).catch(() => {});
      await page.waitForTimeout(120).catch(() => {});

      await second.click({ timeout: 1500 }).catch(() => {});
      await second.fill("").catch(() => {});
      await second.fill(einRight).catch(() => {});
      await second.blur().catch(() => {});
      await page.waitForTimeout(160).catch(() => {});

      const firstValue = (await first.inputValue().catch(() => "")).replace(/\D+/g, "");
      const secondValue = (await second.inputValue().catch(() => "")).replace(/\D+/g, "");
      const firstOk = firstValue === einLeft;
      const secondOk = secondValue === einRight;
      return { firstOk, secondOk };
    };

    let splitResult = await fillSplit();
    if (!splitResult.firstOk || !splitResult.secondOk) {
      await firstSplitLocator.click({ timeout: 1500 }).catch(() => {});
      await page.keyboard.press("Control+A").catch(() => {});
      await page.keyboard.type(einRaw, { delay: 45 }).catch(() => {});
      await page.waitForTimeout(220).catch(() => {});
      splitResult = await fillSplit();
    }

    return {
      filledCount: Number(splitResult.firstOk) + Number(splitResult.secondOk),
    };
  }

  // Strict mode: no generic fallback to avoid touching non-EIN inputs.
  return { filledCount: 0 };
}

async function fillBusinessDetailsFields(page, seedContext) {
  const values = {
    companyName: String(seedContext.companyName || seedContext.fullName || "").trim(),
    address: String(seedContext.address || "").trim(),
    city: String(seedContext.city || "").trim(),
    state: String(seedContext.state || "").trim(),
    zip: String(seedContext.zip || "").trim(),
    ein: String(seedContext.ein || "").trim(),
    ssn: String(seedContext.ssn || "").trim(),
    dob: String(seedContext.dob || "").trim(),
    gender: String(seedContext.gender || "").trim(),
  };
  return page
    .evaluate((payload) => {
      const norm = (value) => String(value || "").trim().toLowerCase();
      const usStateByAbbr = {
        al: "alabama",
        ak: "alaska",
        az: "arizona",
        ar: "arkansas",
        ca: "california",
        co: "colorado",
        ct: "connecticut",
        de: "delaware",
        dc: "district of columbia",
        fl: "florida",
        ga: "georgia",
        hi: "hawaii",
        id: "idaho",
        il: "illinois",
        in: "indiana",
        ia: "iowa",
        ks: "kansas",
        ky: "kentucky",
        la: "louisiana",
        me: "maine",
        md: "maryland",
        ma: "massachusetts",
        mi: "michigan",
        mn: "minnesota",
        ms: "mississippi",
        mo: "missouri",
        mt: "montana",
        ne: "nebraska",
        nv: "nevada",
        nh: "new hampshire",
        nj: "new jersey",
        nm: "new mexico",
        ny: "new york",
        nc: "north carolina",
        nd: "north dakota",
        oh: "ohio",
        ok: "oklahoma",
        or: "oregon",
        pa: "pennsylvania",
        ri: "rhode island",
        sc: "south carolina",
        sd: "south dakota",
        tn: "tennessee",
        tx: "texas",
        ut: "utah",
        vt: "vermont",
        va: "virginia",
        wa: "washington",
        wv: "west virginia",
        wi: "wisconsin",
        wy: "wyoming",
      };
      const normalizedState = norm(payload.state);
      const normalizedStateExpanded =
        normalizedState.length === 2 && usStateByAbbr[normalizedState]
          ? usStateByAbbr[normalizedState]
          : normalizedState;
      const fillControl = (control, value) => {
        if (!value) return false;
        if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) return false;
        if (control.offsetParent === null) return false;
        const type = norm(control.getAttribute("type"));
        if (type === "hidden" || type === "checkbox" || type === "radio") return false;
        control.focus();
        control.value = "";
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.value = value;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };

      const fillSelectControl = (control, value) => {
        if (!value) return false;
        if (!(control instanceof HTMLSelectElement)) return false;
        if (control.offsetParent === null) return false;
        const target = norm(value);
        if (!target) return false;
        const option = Array.from(control.options).find((item) => {
          const optionValue = norm(item.value);
          const optionText = norm(item.textContent || "");
          return (
            optionValue === target ||
            optionText === target ||
            optionValue.includes(target) ||
            optionText.includes(target)
          );
        });
        if (!option) return false;
        control.value = option.value;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };

      const controls = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea"));
      const selects = Array.from(document.querySelectorAll("select"));
      let filledCount = 0;
      let selectCount = 0;

      for (const control of controls) {
        if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) continue;
        const current = String(control.value || "").trim();
        if (current) continue;

        const descriptor = [
          control.getAttribute("name"),
          control.getAttribute("id"),
          control.getAttribute("placeholder"),
          control.getAttribute("aria-label"),
          control.closest("label")?.textContent || "",
          control.closest("[data-b-form-item]")?.textContent || "",
          control.closest(".theme-arco-form-item")?.textContent || "",
        ]
          .map((v) => norm(v))
          .join(" ");

        let value = "";
        if (descriptor.includes("legal business name") || descriptor.includes("business name")) {
          value = payload.companyName;
        } else if (
          descriptor.includes("street address") ||
          descriptor.includes("business address") ||
          descriptor.includes("address on irs")
        ) {
          value = payload.address;
        } else if (descriptor.includes("city")) {
          value = payload.city;
        } else if (descriptor.includes("zip")) {
          value = payload.zip;
        } else if (descriptor.includes("state")) {
          value = payload.state;
        }
        if (!value) continue;
        if (fillControl(control, value)) filledCount += 1;
      }

      for (const select of selects) {
        if (!(select instanceof HTMLSelectElement)) continue;
        const descriptor = [
          select.getAttribute("name"),
          select.getAttribute("id"),
          select.getAttribute("aria-label"),
          select.closest("label")?.textContent || "",
          select.closest("[data-b-form-item]")?.textContent || "",
          select.closest(".theme-arco-form-item")?.textContent || "",
        ]
          .map((v) => norm(v))
          .join(" ");
        if (!descriptor) continue;

        let value = "";
        if (descriptor.includes("state")) {
          value = normalizedStateExpanded || payload.state;
        } else if (descriptor.includes("country")) {
          value = "united states";
        } else if (descriptor.includes("gender")) {
          value = payload.gender;
        }
        if (!value) continue;
        if (fillSelectControl(select, value)) {
          selectCount += 1;
        }
      }

      const chooseBusinessAddressOption = () => {
        const labels = Array.from(document.querySelectorAll("label,div,span"));
        for (const label of labels) {
          if (!(label instanceof HTMLElement)) continue;
          const text = norm(label.innerText || label.textContent || "");
          if (!text) continue;
          if (!text.includes("business-only address")) continue;
          const radio =
            label.querySelector("input[type='radio']") ||
            label.closest("label")?.querySelector("input[type='radio']") ||
            label.parentElement?.querySelector("input[type='radio']");
          if (radio instanceof HTMLInputElement) {
            radio.focus();
            radio.click();
            radio.checked = true;
            radio.dispatchEvent(new Event("input", { bubbles: true }));
            radio.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          label.click();
          return true;
        }
        return false;
      };
      const addressOptionChosen = chooseBusinessAddressOption();
      return { filledCount, addressOptionChosen, selectCount };
    }, values)
    .catch(() => ({ filledCount: 0, addressOptionChosen: false, selectCount: 0 }));
}

async function fillBusinessDetailsWithPlaywright(page, seedContext) {
  const companyName = String(seedContext.companyName || seedContext.fullName || "").trim();
  const address = String(seedContext.address || "").trim();
  const city = String(seedContext.city || "").trim();
  const state = String(seedContext.state || "").trim();
  const zip = String(seedContext.zip || "").trim();

  let filledCount = 0;
  let addressOptionChosen = false;
  let stateChosen = false;

  const selectArcoOption = async (placeholder, value, aliases = []) => {
    if (!placeholder || !value) return false;
    const candidates = [String(value), ...aliases.filter(Boolean)].map((item) => String(item).trim());
    const searchInput = page.locator(`input[placeholder='${placeholder}']`).first();
    if ((await safeCount(searchInput)) === 0) return false;

    const opened = (await safeClick(searchInput)) || (await safeClick(searchInput.locator("xpath=ancestor::*[@role='combobox'][1]").first()));
    if (!opened) return false;
    await page.waitForTimeout(120).catch(() => {});

    const toType = candidates[0] || "";
    const typed = await safeFill(searchInput, toType);
    if (!typed) return false;
    await page.waitForTimeout(220).catch(() => {});

    const optionRoot = page.locator("[role='option'], .arco-select-option, .theme-arco-select-option");
    for (const text of candidates) {
      const exact = optionRoot.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, "i") }).first();
      if ((await safeCount(exact)) > 0 && (await safeClick(exact))) {
        return true;
      }
      const loose = optionRoot.filter({ hasText: new RegExp(escapeRegExp(text), "i") }).first();
      if ((await safeCount(loose)) > 0 && (await safeClick(loose))) {
        return true;
      }
    }

    await page.keyboard.press("Enter").catch(() => {});
    await page.waitForTimeout(120).catch(() => {});
    const current = await searchInput.inputValue().catch(() => "");
    if (candidates.some((text) => String(current || "").toLowerCase().includes(text.toLowerCase()))) {
      return true;
    }
    const selectedTitle = await searchInput
      .locator("xpath=ancestor::*[contains(@class,'theme-arco-select-view')][1]")
      .first()
      .getAttribute("title")
      .catch(() => "");
    return candidates.some((text) => String(selectedTitle || "").toLowerCase().includes(text.toLowerCase()));
  };

  if (companyName) {
    const done = await fillFirstMatch(
      [
        page.locator("input[placeholder*='business name' i]"),
        page.locator("input[name*='business' i]"),
      ],
      companyName,
    );
    if (done) filledCount += 1;
  }
  if (address) {
    const done = await fillFirstMatch(
      [
        page.locator("input[placeholder*='street address' i]"),
        page.locator("input[placeholder*='business address' i]"),
      ],
      address,
    );
    if (done) filledCount += 1;
  }
  if (city) {
    let done = await selectArcoOption("City", city);
    if (!done) {
      const currentCity = await page
        .locator("input[placeholder='City']")
        .first()
        .inputValue()
        .catch(() => "");
      done = String(currentCity || "").trim().length > 0;
    }
    if (done) filledCount += 1;
  }
  if (zip) {
    const done = await fillFirstMatch(
      [page.locator("input[placeholder='ZIP code']"), page.locator("input[placeholder*='zip' i]")],
      zip,
    );
    if (done) filledCount += 1;
  }

  if (state) {
    const fullState = usStateName(state) || state;
    stateChosen = await selectArcoOption("State", fullState, [state]);
    if (!stateChosen) {
      const currentState = await page
        .locator("input[placeholder='State']")
        .first()
        .inputValue()
        .catch(() => "");
      stateChosen = String(currentState || "").trim().length > 0;
    }
    if (stateChosen) filledCount += 1;
  }

  const businessOnlyRadio =
    (await safeClick(page.locator("label", { hasText: /business-only address/i }).first())) ||
    (await safeClick(page.locator("text=This is a business-only address").first()));
  if (businessOnlyRadio) {
    addressOptionChosen = true;
  }

  return { filledCount, addressOptionChosen, stateChosen };
}

async function fillBusinessDetailsFallbackByDescriptor(page, seedContext) {
  const generic = await fillBusinessDetailsFields(page, seedContext);
  return {
    filledCount: Number(generic?.filledCount || 0),
    addressOptionChosen: Boolean(generic?.addressOptionChosen),
    stateChosen:
      Boolean(generic?.stateChosen) ||
      Boolean(generic?.selectCount) ||
      false,
  };
}

async function fillPrimaryRepresentativeStep(page, seedContext) {
  const raw = seedContext?.raw && typeof seedContext.raw === "object" ? seedContext.raw : {};
  const fullNameRaw = String(seedContext.fullName || "").trim();
  const companyNameRaw = String(seedContext.companyName || "").trim();
  const hasLetters = (value) => /[a-z]/i.test(String(value || ""));
  const preferredNameSource = hasLetters(fullNameRaw)
    ? fullNameRaw
    : hasLetters(companyNameRaw)
      ? companyNameRaw
      : "";
  const splitPreferred = splitNameParts(preferredNameSource);
  const safeName = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (!hasLetters(text)) return "";
    return text;
  };
  const seededFirstName = safeName(seedContext.firstName || raw.first_name || "");
  const seededLastName = safeName(seedContext.lastName || raw.last_name || "");
  const firstName = seededFirstName || safeName(splitPreferred.firstName);
  const lastName = seededLastName || safeName(splitPreferred.lastName);
  const dob = String(seedContext.dob || "").trim();
  const ssnDigits = String(seedContext.ssn || "").replace(/\D+/g, "");
  const address = String(seedContext.address || "").trim();
  const city = String(seedContext.city || "").trim();
  const zip = String(seedContext.zip || "").trim();
  const state = String(seedContext.state || "").trim();

  let filledCount = 0;
  const selectArcoOption = async (placeholder, value, aliases = []) => {
    if (!placeholder || !value) return false;
    const candidates = [String(value), ...aliases.filter(Boolean)].map((item) => String(item).trim());
    const searchInput = page.locator(`input[placeholder='${placeholder}']`).first();
    if ((await safeCount(searchInput)) === 0) return false;

    const currentBefore = String((await searchInput.inputValue().catch(() => "")) || "").trim();
    const placeholderNorm = String(placeholder || "").trim().toLowerCase();
    const currentNorm = normalizeSimpleText(currentBefore);
    const candidatesNorm = candidates.map((item) => normalizeSimpleText(item)).filter(Boolean);
    const isPlaceholderValue =
      !currentBefore ||
      currentNorm === placeholderNorm ||
      (placeholderNorm === "month" && currentNorm === "month") ||
      (placeholderNorm === "day" && currentNorm === "day") ||
      (placeholderNorm === "year" && currentNorm === "year");
    if (!isPlaceholderValue && candidatesNorm.some((item) => currentNorm === item || currentNorm.includes(item))) {
      return true;
    }

    const combobox =
      searchInput.locator("xpath=ancestor::*[@role='combobox'][1]").first();
    const opened = (await safeClick(searchInput)) || (await safeClick(combobox));
    if (!opened) return false;
    await page.waitForTimeout(140).catch(() => {});

    // First try pure option click flow (works for readonly selects like Month/Day/Year).
    const optionRoot = page.locator("[role='option'], .arco-select-option, .theme-arco-select-option");
    for (const text of candidates) {
      const exact = optionRoot
        .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, "i") })
        .first();
      if ((await safeCount(exact)) > 0 && (await safeClick(exact))) {
        await page.waitForTimeout(120).catch(() => {});
        const current = await searchInput.inputValue().catch(() => "");
        if (String(current || "").trim().length > 0) return true;
      }
      const loose = optionRoot.filter({ hasText: new RegExp(escapeRegExp(text), "i") }).first();
      if ((await safeCount(loose)) > 0 && (await safeClick(loose))) {
        await page.waitForTimeout(120).catch(() => {});
        const current = await searchInput.inputValue().catch(() => "");
        if (String(current || "").trim().length > 0) return true;
      }
    }

    // Fallback to typing for searchable selects.
    const toType = candidates[0] || "";
    if (await safeFill(searchInput, toType)) {
      await page.waitForTimeout(220).catch(() => {});
      for (const text of candidates) {
        const exact = optionRoot
          .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, "i") })
          .first();
        if ((await safeCount(exact)) > 0 && (await safeClick(exact))) return true;
        const loose = optionRoot.filter({ hasText: new RegExp(escapeRegExp(text), "i") }).first();
        if ((await safeCount(loose)) > 0 && (await safeClick(loose))) return true;
      }
    }
    await page.keyboard.press("Enter").catch(() => {});
    await page.waitForTimeout(120).catch(() => {});
    const current = await searchInput.inputValue().catch(() => "");
    return candidates.some((text) => String(current || "").toLowerCase().includes(text.toLowerCase()));
  };
  const hasSelectValue = async (placeholder) => {
    const input = page.locator(`input[placeholder='${placeholder}']`).first();
    if ((await safeCount(input)) === 0) return false;
    const value = String((await input.inputValue().catch(() => "")) || "").trim();
    if (!value) return false;
    const normalized = normalizeSimpleText(value);
    const p = normalizeSimpleText(placeholder);
    if (normalized === p) return false;
    return true;
  };

  const normalizePersonName = (value) =>
    String(value || "")
      .replace(/[^a-zA-Z\s.'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  await safeClick(page.locator("label", { hasText: /provide ssn/i }).first());
  await page.waitForTimeout(150).catch(() => {});

  if (ssnDigits.length >= 4) {
    const ssnLeft = ssnDigits.length >= 9 ? ssnDigits.slice(0, 5) : "";
    const ssnRight = ssnDigits.slice(-4);
    const ssnFillResult = await page
      .evaluate((payload) => {
        const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
        const applyValue = (input, value) => {
          if (!(input instanceof HTMLInputElement)) return false;
          const currentDigits = String(input.value || "").replace(/\D+/g, "");
          if (currentDigits === value) return true;
          input.focus();
          try {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              Object.getPrototypeOf(input),
              "value",
            )?.set;
            if (nativeSetter) {
              nativeSetter.call(input, "");
              input.dispatchEvent(new Event("input", { bubbles: true }));
              nativeSetter.call(input, value);
            } else {
              input.value = "";
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.value = value;
            }
          } catch {
            input.value = "";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.value = value;
          }
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.blur();
          return String(input.value || "").replace(/\D+/g, "") === value;
        };
        const allInputs = Array.from(document.querySelectorAll("input")).filter(
          (node) => node instanceof HTMLInputElement && visible(node),
        );
        const findByPlaceholder = (ph) =>
          allInputs.find(
            (node) => String(node.getAttribute("placeholder") || "").trim().toLowerCase() === ph,
          ) || null;
        // Split-field SSN: left side "xxx-xx-" and right side "xxxx"
        const leftInput = findByPlaceholder("xxx-xx-");
        const rightInput =
          findByPlaceholder("xxxx") ||
          allInputs.find((node) => {
            const ph = String(node.getAttribute("placeholder") || "").trim().toLowerCase();
            const ml = Number(node.maxLength || 0);
            return ph === "xxxx" || ml === 4;
          }) ||
          null;
        let leftOk = false;
        let rightOk = false;
        if (leftInput && payload.left) {
          leftOk = applyValue(leftInput, payload.left);
        }
        if (rightInput) {
          rightOk = applyValue(rightInput, payload.right);
        }
        return { leftOk, rightOk, hasLeft: !!leftInput, hasRight: !!rightInput };
      }, { left: ssnLeft, right: ssnRight })
      .catch(() => ({ leftOk: false, rightOk: false, hasLeft: false, hasRight: false }));
    if (ssnFillResult?.rightOk) filledCount += 1;
    if (ssnFillResult?.leftOk) filledCount += 1;
  }

  if (firstName) {
    const normalized = normalizePersonName(firstName);
    const done = await fillFirstMatchIfNeeded([page.locator("input[placeholder*='first name' i]")], normalized, {
      normalize: normalizeSimpleText,
      isValidCurrent: (value) => isLikelyPersonName(value),
    });
    if (done) filledCount += 1;
  }
  if (lastName) {
    const normalized = normalizePersonName(lastName);
    const done = await fillFirstMatchIfNeeded([page.locator("input[placeholder*='last name' i]")], normalized, {
      normalize: normalizeSimpleText,
      isValidCurrent: (value) => isLikelyPersonName(value),
    });
    if (done) filledCount += 1;
  }

  // Guard against accidental numeric pollution (e.g. ZIP/EIN leaking into name fields).
  await page
    .evaluate((payload) => {
      const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
      const patchName = (selector, expected) => {
        const input = document.querySelector(selector);
        if (!(input instanceof HTMLInputElement) || !visible(input)) return false;
        const current = String(input.value || "").trim();
        const hasLetters = /[a-z]/i.test(current);
        if (hasLetters) return false;
        const safe = String(expected || "").trim();
        if (!safe || !/[a-z]/i.test(safe)) return false;
        input.focus();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.value = safe;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };
      patchName("input[placeholder*='first name' i]", payload.firstName);
      patchName("input[placeholder*='last name' i]", payload.lastName);
    }, { firstName: normalizePersonName(firstName), lastName: normalizePersonName(lastName) })
    .catch(() => {});
  // Disable single-field legal-name fallback for this step:
  // it can mis-map values when the page is still hydrating.

  if (dob) {
    const parsedDob = parseUsDateForDropdown(dob);
    if (parsedDob) {
      const monthName = monthIndexToName(parsedDob.month);
      const monthAliases = [
        String(parsedDob.month),
        String(parsedDob.month).padStart(2, "0"),
        monthName,
        monthName.slice(0, 3),
        `${parsedDob.month}.`,
        `${String(parsedDob.month).padStart(2, "0")}.`,
      ].filter(Boolean);
      const dayAliases = [
        String(parsedDob.day),
        String(parsedDob.day).padStart(2, "0"),
      ];
      const monthDoneFirst = await selectArcoOption(
        "Month",
        monthName || String(parsedDob.month),
        monthAliases,
      );
      const dayDone = await selectArcoOption("Day", String(parsedDob.day), dayAliases);
      const yearDone = await selectArcoOption("Year", String(parsedDob.year), []);
      let monthDone = monthDoneFirst || (await hasSelectValue("Month"));
      if (!monthDone) {
        // Retry month after day/year because some TikTok forms only unlock month option list lazily.
        monthDone = await selectArcoOption(
          "Month",
          monthName || String(parsedDob.month),
          monthAliases,
        );
      }
      monthDone = monthDone || (await hasSelectValue("Month"));
      if (!monthDone || !dayDone || !yearDone) {
        const dobFallback = await page
          .evaluate((payload) => {
            const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
            const root =
              Array.from(document.querySelectorAll("div,section,form")).find((node) => {
                if (!visible(node)) return false;
                const text = String(node.textContent || "").toLowerCase();
                return text.includes("date of birth");
              }) || document.body;
            const selects = Array.from(root.querySelectorAll("select")).filter(visible);
            if (selects.length < 3) return { month: false, day: false, year: false };
            const monthSelect = selects[0];
            const daySelect = selects[1];
            const yearSelect = selects[2];
            const setSelect = (sel, candidates) => {
              if (!(sel instanceof HTMLSelectElement)) return false;
              const options = Array.from(sel.options || []);
              const normalized = candidates.map((v) => String(v || "").trim().toLowerCase());
              let matched = null;
              for (const option of options) {
                const v = String(option.value || "").trim().toLowerCase();
                const t = String(option.text || "").trim().toLowerCase();
                if (normalized.includes(v) || normalized.includes(t)) {
                  matched = option;
                  break;
                }
              }
              if (!matched) return false;
              sel.value = matched.value;
              sel.dispatchEvent(new Event("input", { bubbles: true }));
              sel.dispatchEvent(new Event("change", { bubbles: true }));
              return true;
            };
            const monthCandidates = [
              payload.month,
              payload.monthPad,
              payload.monthName,
              payload.monthShort,
            ];
            const dayCandidates = [payload.day, payload.dayPad];
            const yearCandidates = [payload.year];
            return {
              month: setSelect(monthSelect, monthCandidates),
              day: setSelect(daySelect, dayCandidates),
              year: setSelect(yearSelect, yearCandidates),
            };
          }, {
            month: String(parsedDob.month),
            monthPad: String(parsedDob.month).padStart(2, "0"),
            monthName,
            monthShort: monthName.slice(0, 3),
            day: String(parsedDob.day),
            dayPad: String(parsedDob.day).padStart(2, "0"),
            year: String(parsedDob.year),
          })
          .catch(() => ({ month: false, day: false, year: false }));
        if (dobFallback.month) monthDone = true;
      }
      const dobDoneNow =
        monthDone && (dayDone || (await hasSelectValue("Day"))) && (yearDone || (await hasSelectValue("Year")));
      if (dobDoneNow) filledCount += 1;
    }
  }

  if (address) {
    const done = await fillFirstMatchIfNeeded(
      [page.locator("input[placeholder*='street address' i]"), page.locator("input[placeholder*='residential address' i]")],
      address,
      {
        normalize: normalizeSimpleText,
        isValidCurrent: (value) => String(value || "").trim().length >= 8,
      },
    );
    if (done) filledCount += 1;
  }
  if (city) {
    const cityInput = page.locator("input[placeholder='City']").first();
    const currentCity = await readFirstInputValue(cityInput);
    if (currentCity && normalizeSimpleText(currentCity) === normalizeSimpleText(city)) {
      filledCount += 1;
    } else if (currentCity && normalizeSimpleText(currentCity).length >= 2) {
      filledCount += 1;
    } else {
    let done = await selectArcoOption("City", city);
    if (!done) {
      done = await fillFirstMatchIfNeeded(
        [page.locator("input[placeholder='City']"), page.locator("input[placeholder*='city' i]")],
        city,
        { normalize: normalizeSimpleText, isValidCurrent: (value) => String(value || "").trim().length >= 2 },
      );
    }
    if (done) filledCount += 1;
    }
  }
  if (zip) {
    const done = await fillFirstMatchIfNeeded(
      [page.locator("input[placeholder='ZIP code']"), page.locator("input[placeholder*='zip' i]")],
      zip,
      { normalize: normalizeDigitsOnly, isValidCurrent: (value) => normalizeDigitsOnly(value).length === 5 },
    );
    if (done) filledCount += 1;
  }
  if (state) {
    const fullState = usStateName(state) || state;
    const stateInput = page.locator("input[placeholder='State']").first();
    const currentState = await readFirstInputValue(stateInput);
    let chosen = false;
    if (currentState) {
      const now = normalizeSimpleText(currentState);
      const t1 = normalizeSimpleText(fullState);
      const t2 = normalizeSimpleText(state);
      if (now === t1 || now.includes(t1) || now === t2) {
        chosen = true;
      }
    }
    if (!chosen) {
      chosen = await selectArcoOption("State", fullState, [state]);
    }
    if (chosen) filledCount += 1;
  }

  // Click UBO "Yes" scoped to the UBO question section to avoid clicking wrong Yes.
  const uboYes = await page
    .evaluate(() => {
      const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
      // Find the UBO section container by its heading text.
      const uboRoot = Array.from(document.querySelectorAll("div,section,fieldset")).find((node) => {
        if (!visible(node)) return false;
        const text = String(node.textContent || "").toLowerCase();
        return (
          text.includes("beneficial owner") ||
          text.includes("ultimate beneficial") ||
          text.includes("ubo") ||
          text.includes("25% or more") ||
          text.includes("owns 25") ||
          text.includes("significant control")
        );
      });
      const scope = uboRoot || document.body;
      // Find a label/button containing exactly "Yes" within that scope.
      const yesLabel = Array.from(scope.querySelectorAll("label,button,div[role='radio']")).find(
        (node) => visible(node) && /^\s*yes\s*$/i.test(String(node.textContent || "")),
      );
      if (yesLabel instanceof HTMLElement) {
        yesLabel.click();
        return true;
      }
      return false;
    })
    .catch(() => false);

  const nationalityUsOpened =
    (await selectArcoOption("select your region", "United States", ["US", "U.S.", "United States of America"])) ||
    (await selectArcoOption("Nationality", "United States", ["US", "U.S.", "United States of America"])) ||
    (await safeClick(page.locator("[role='combobox']").filter({ hasText: /nationality|region/i }).first())) ||
    (await safeClick(page.locator("div", { hasText: /^Nationality$|^Region$/i }).first()));
  if (nationalityUsOpened) {
    await page.waitForTimeout(200).catch(() => {});
    await safeClick(
      page
        .locator("[role='option'], .arco-select-option, .theme-arco-select-option")
        .filter({ hasText: /\bUnited States\b|\bUS\b/i })
        .first(),
    );
  }

  return { filledCount, uboYes: Boolean(uboYes) };
}

async function fillShopInformationStep(page, seedContext) {
  const shopName = sanitizeShopName(seedContext.companyName || seedContext.fullName || "");
  const email = String(seedContext.email || "").trim();
  const phone = String(seedContext.phone || "").trim();

  let filledCount = 0;
  if (shopName) {
    const done = await fillFirstMatch(
      [
        page.locator("input[placeholder*='shop name' i]"),
        page.locator("input[placeholder='Enter a shop name']"),
        page.locator("input[placeholder*='store name' i]"),
        page.locator("input[name*='shop' i]"),
      ],
      shopName,
    );
    if (done) filledCount += 1;
  }
  if (email) {
    const done = await fillFirstMatch(
      [
        page.locator("input[placeholder*='contact email' i]"),
        page.locator("input[placeholder*='email' i]"),
        page.locator("input[type='email']"),
      ],
      email,
    );
    if (done) filledCount += 1;
  }
  if (phone) {
    const done = await fillFirstMatch(
      [
        page.locator("input[placeholder*='phone number' i]"),
        page.locator("input[placeholder*='contact number' i]"),
        page.locator("input[type='tel']"),
      ],
      phone,
    );
    if (done) filledCount += 1;
  }

  const productOpened =
    (await safeClick(page.locator("[role='combobox']").filter({ hasText: /primary product|product\/service type/i }).first())) ||
    (await safeClick(page.locator("div", { hasText: /primary product|product\/service type/i }).first()));
  let productChosen = false;
  if (productOpened) {
    await page.waitForTimeout(200).catch(() => {});
    productChosen =
      (await safeClick(
        page
          .locator("[role='option'], .arco-select-option, .theme-arco-select-option")
          .filter({ hasText: /fashion|accessories|assoc|apparel|beauty|health|home/i })
          .first(),
      )) ||
      (await safeClick(page.locator("[role='option'], .arco-select-option, .theme-arco-select-option").first()));
  }

  return { filledCount, productChosen: Boolean(productChosen) };
}

async function readShopInformationStatus(page) {
  return page
    .evaluate(() => {
      const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
      const textOf = (node) => String(node?.textContent || "").trim();
      const normalize = (value) => String(value || "").trim().toLowerCase();
      const digits = (value) => String(value || "").replace(/\D+/g, "");
      const hasErrorText = Array.from(document.querySelectorAll("div,span,p"))
        .filter(visible)
        .some((node) => /required|invalid|correct format|please enter/i.test(textOf(node)));
      const shopNameIssueText = Array.from(document.querySelectorAll("div,span,p"))
        .filter(visible)
        .map((node) => textOf(node))
        .find((text) =>
          /shop name/i.test(text) &&
          /already exists|already taken|unavailable|not available|invalid|not meet|not allowed|required/i.test(text),
        ) || "";

      const getFirstInput = (selector) =>
        Array.from(document.querySelectorAll(selector)).find(
          (node) => node instanceof HTMLInputElement && visible(node),
        ) || null;

      const shopInput = getFirstInput("input[placeholder*='shop name' i],input[placeholder*='store name' i],input[name*='shop' i]");
      const emailInput = getFirstInput("input[placeholder*='contact email' i],input[placeholder*='email' i],input[type='email']");
      const phoneInput = getFirstInput("input[placeholder*='phone number' i],input[placeholder*='contact number' i],input[type='tel']");
      const productInput = getFirstInput("input[placeholder*='primary product' i],input[placeholder*='product/service type' i],input[placeholder*='product' i]");

      const shopVal = String(shopInput?.value || "").trim();
      const emailVal = String(emailInput?.value || "").trim();
      const phoneVal = String(phoneInput?.value || "").trim();
      const productVal = String(productInput?.value || "").trim();
      const emailOk = !emailInput || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
      const phoneOk = !phoneInput || digits(phoneVal).length >= 7;
      const productPlaceholder = normalize(productInput?.getAttribute("placeholder") || "");
      const productOk =
        !productInput ||
        (normalize(productVal).length >= 2 &&
          normalize(productVal) !== productPlaceholder &&
          !normalize(productVal).includes("select"));

      const shopOk = !shopInput || shopVal.length >= 2;

      return {
        shopOk,
        emailOk,
        phoneOk,
        productOk,
        hasErrorText,
        shopNameIssue: shopNameIssueText,
        ready: shopOk && emailOk && phoneOk && productOk && !hasErrorText,
      };
    })
    .catch(() => ({
      shopOk: false,
      emailOk: false,
      phoneOk: false,
      productOk: false,
      hasErrorText: true,
      shopNameIssue: "",
      ready: false,
    }));
}

async function readReviewApplicationStatus(page) {
  return page
    .evaluate(() => {
      const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
      const text = String(document.body?.innerText || "").toLowerCase();
      const hasUnderReview = text.includes("under review");
      const hasInformationRequired = text.includes("information required");
      const hasApplicationRejected = text.includes("application rejected");
      const hasReviewHeading =
        text.includes("review application") ||
        text.includes("review your application") ||
        text.includes("submit application");

      const checkboxInputs = Array.from(document.querySelectorAll("input[type='checkbox']"))
        .filter((node) => node instanceof HTMLInputElement && visible(node));
      const requiredUnchecked = checkboxInputs.filter((node) => {
        if (node.checked) return false;
        const container = node.closest("label,div,section,fieldset") || node.parentElement;
        const line = String(container?.textContent || "").toLowerCase();
        return (
          line.includes("i confirm") ||
          line.includes("i agree") ||
          line.includes("information on this page is true") ||
          line.includes("accurate")
        );
      }).length;

      const buttons = Array.from(document.querySelectorAll("button"))
        .filter((node) => node instanceof HTMLButtonElement && visible(node));
      const submitButton = buttons.find((btn) => {
        const label = String(btn.textContent || "").toLowerCase();
        return (
          label.includes("submit application") ||
          label === "submit" ||
          label.includes("continue") ||
          label === "next"
        );
      });
      const submitEnabled = Boolean(submitButton && !submitButton.disabled);

      return {
        hasUnderReview,
        hasInformationRequired,
        hasApplicationRejected,
        hasReviewHeading,
        requiredUnchecked,
        submitEnabled,
        readyToSubmit:
          hasReviewHeading &&
          !hasUnderReview &&
          !hasInformationRequired &&
          !hasApplicationRejected &&
          requiredUnchecked === 0 &&
          submitEnabled,
      };
    })
    .catch(() => ({
      hasUnderReview: false,
      hasInformationRequired: false,
      hasApplicationRejected: false,
      hasReviewHeading: false,
      requiredUnchecked: 0,
      submitEnabled: false,
      readyToSubmit: false,
    }));
}

async function readShopContactVerificationStatus(page, targetType = "phone") {
  return page
    .evaluate((kind) => {
      const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
      const lower = (value) => String(value || "").trim().toLowerCase();
      const target = String(kind || "phone").toLowerCase() === "email" ? "email" : "phone";
      const keywords = target === "email" ? ["email address", "email"] : ["phone number", "phone"];
      const allRoots = Array.from(document.querySelectorAll("div,section,fieldset,label"));
      const section =
        allRoots.find((node) => {
          if (!visible(node)) return false;
          const text = lower(node.textContent || "");
          return keywords.some((key) => text.includes(key)) && text.includes("use below");
        }) ||
        allRoots.find((node) => {
          if (!visible(node)) return false;
          const text = lower(node.textContent || "");
          return keywords.some((key) => text.includes(key));
        }) ||
        null;
      if (!section) {
        return {
          sectionFound: false,
          verified: true,
          canUseAnother: false,
          usingAnother: false,
          canRequestCode: false,
          codeInputVisible: false,
          canSubmitCode: false,
          contactValue: "",
          placeholder: "",
        };
      }

      const sectionText = lower(section.textContent || "");
      const verified =
        sectionText.includes("verified") ||
        sectionText.includes("verification successful") ||
        sectionText.includes("successfully verified");
      const canUseAnother = sectionText.includes("use another");
      const usingAnother = (() => {
        const labels = Array.from(section.querySelectorAll("label")).filter(visible);
        const targetLabel = labels.find((label) => lower(label.textContent || "").includes("use another"));
        if (!targetLabel) return false;
        const radio = targetLabel.querySelector("input[type='radio']") || null;
        if (radio instanceof HTMLInputElement) return Boolean(radio.checked);
        return lower(targetLabel.className || "").includes("checked");
      })();

      const allInputs = Array.from(section.querySelectorAll("input")).filter(
        (node) => node instanceof HTMLInputElement && visible(node),
      );
      const codeInput = allInputs.find((input) => {
        const name = lower(input.getAttribute("name"));
        const id = lower(input.getAttribute("id"));
        const placeholder = lower(input.getAttribute("placeholder"));
        const aria = lower(input.getAttribute("aria-label"));
        const maxLength = Number(input.maxLength || 0);
        return (
          placeholder.includes("code") ||
          aria.includes("code") ||
          name.includes("otp") ||
          name.includes("code") ||
          id.includes("otp") ||
          id.includes("code") ||
          maxLength === 1
        );
      });
      const contactInput = allInputs.find((input) => {
        const type = lower(input.getAttribute("type"));
        const placeholder = lower(input.getAttribute("placeholder"));
        const name = lower(input.getAttribute("name"));
        if (codeInput && input === codeInput) return false;
        if (target === "email") {
          return type === "email" || placeholder.includes("email") || name.includes("email");
        }
        return type === "tel" || placeholder.includes("phone") || placeholder.includes("number") || name.includes("phone");
      }) || allInputs.find((input) => input !== codeInput) || null;
      const contactValue = String(contactInput?.value || "").trim();
      const placeholder = String(contactInput?.getAttribute("placeholder") || "").trim();

      const buttons = Array.from(section.querySelectorAll("button")).filter(
        (btn) => btn instanceof HTMLButtonElement && visible(btn),
      );
      const canRequestCode = buttons.some((btn) => {
        if (btn.disabled) return false;
        const label = lower(btn.textContent || "");
        return (
          label.includes("send code") ||
          label.includes("get code") ||
          label.includes("resend") ||
          label.includes("request code")
        );
      });
      const canSubmitCode = buttons.some((btn) => {
        if (btn.disabled) return false;
        const label = lower(btn.textContent || "");
        return (
          label.includes("verify") ||
          label.includes("confirm") ||
          label.includes("continue")
        );
      });

      return {
        sectionFound: true,
        verified,
        canUseAnother,
        usingAnother,
        canRequestCode,
        codeInputVisible: Boolean(codeInput),
        canSubmitCode,
        contactValue,
        placeholder,
      };
    }, targetType)
    .catch(() => ({
      sectionFound: false,
      verified: false,
      canUseAnother: false,
      usingAnother: false,
      canRequestCode: false,
      codeInputVisible: false,
      canSubmitCode: false,
      contactValue: "",
      placeholder: "",
    }));
}

async function clickShopContactAction(page, targetType = "phone", action = "switch_use_another") {
  return page
    .evaluate((kind, desiredAction) => {
      const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
      const lower = (value) => String(value || "").trim().toLowerCase();
      const target = String(kind || "phone").toLowerCase() === "email" ? "email" : "phone";
      const keywords = target === "email" ? ["email address", "email"] : ["phone number", "phone"];
      const section =
        Array.from(document.querySelectorAll("div,section,fieldset,label")).find((node) => {
          if (!visible(node)) return false;
          const text = lower(node.textContent || "");
          return keywords.some((key) => text.includes(key));
        }) || null;
      if (!section) return false;

      const clickByMatcher = (matcher) => {
        const buttons = Array.from(section.querySelectorAll("button,label,div[role='button']"));
        for (const node of buttons) {
          if (!(node instanceof HTMLElement) || !visible(node)) continue;
          const label = lower(node.textContent || "");
          if (!matcher(label)) continue;
          node.click();
          return true;
        }
        return false;
      };

      if (desiredAction === "switch_use_another") {
        return clickByMatcher((label) => label.includes("use another"));
      }
      if (desiredAction === "request_code") {
        return clickByMatcher((label) =>
          label.includes("send code") ||
          label.includes("get code") ||
          label.includes("resend") ||
          label.includes("request code"),
        );
      }
      if (desiredAction === "submit_code") {
        return clickByMatcher((label) =>
          label.includes("verify") ||
          label.includes("confirm") ||
          label.includes("continue"),
        );
      }
      return false;
    }, targetType, action)
    .catch(() => false);
}

async function fillShopContactValue(page, targetType = "phone", value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const locatorCandidates =
    targetType === "email"
      ? [
          page.locator("input[placeholder*='email' i]"),
          page.locator("input[type='email']"),
          page.locator("input[name*='email' i]"),
        ]
      : [
          page.locator("input[placeholder*='phone number' i]"),
          page.locator("input[placeholder*='contact number' i]"),
          page.locator("input[type='tel']"),
          page.locator("input[name*='phone' i]"),
        ];
  return fillFirstMatch(locatorCandidates, raw);
}

async function setAlternateShopName(page, seedContext, state) {
  const candidates = buildShopNameCandidates(seedContext, state);
  const index = Number(state.shopNameRetryCount || 0);
  const pick = candidates[index % Math.max(candidates.length, 1)] || "";
  if (!pick) return { changed: false, value: "" };
  const changed = await fillFirstMatch(
    [
      page.locator("input[placeholder*='shop name' i]"),
      page.locator("input[placeholder='Enter a shop name']"),
      page.locator("input[name*='shop_name' i]"),
    ],
    pick,
  );
  if (changed) {
    state.shopNameRetryCount = index + 1;
  }
  return { changed, value: pick };
}

function usStateName(value) {
  const lookup = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    DC: "District of Columbia",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
  };
  const key = String(value || "").trim().toUpperCase();
  return lookup[key] || "";
}

function parseUsDateForDropdown(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const month = Number(match[1] || 0);
  const day = Number(match[2] || 0);
  const year = Number(match[3] || 0);
  if (!month || month < 1 || month > 12) return null;
  if (!day || day < 1 || day > 31) return null;
  if (!year || year < 1900 || year > 2100) return null;
  return { month, day, year };
}

function monthIndexToName(index) {
  const months = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const value = Number(index || 0);
  if (value < 1 || value > 12) return "";
  return months[value] || "";
}

function sanitizeShopName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\s&.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildShopNameCandidates(seedContext, state) {
  const legalBase = sanitizeShopName(seedContext.companyName || seedContext.fullName || "");
  const base = legalBase || "US Seller Shop";
  const suffix = String((state?.shopNameRetryCount || 0) + 1).padStart(2, "0");
  const candidates = [
    base,
    /llc\b/i.test(base) ? base : `${base} LLC`,
    `${base} Shop`,
    `${base} ${suffix}`,
  ].map((item) => sanitizeShopName(item).slice(0, 40).trim());
  return Array.from(new Set(candidates.filter(Boolean)));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function uploadSupportingDocument(page, absolutePath) {
  const filePath = String(absolutePath || "").trim();
  if (!filePath) {
    return { uploaded: false, reason: "no_file_path" };
  }
  if (!(await fileExists(filePath))) {
    return { uploaded: false, reason: "file_not_found" };
  }
  const readUploadInfo = async () =>
    page
      .evaluate(() => {
        const isVisible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
        const heading = Array.from(document.querySelectorAll("div,span,p,h1,h2,h3,h4"))
          .find((node) => {
            if (!isVisible(node)) return false;
            const text = String(node.textContent || "").toLowerCase();
            return text.includes("provide proof of business");
          });
        const roots = [];
        if (heading instanceof HTMLElement) {
          let current = heading;
          for (let depth = 0; depth < 8 && current; depth += 1) {
            roots.push(current);
            current = current.parentElement;
          }
        }
        if (roots.length === 0) roots.push(document.body);

        const readCounterFromRoot = (root) => {
          const text = String(root?.textContent || "");
          const match = text.match(/\(([0-3])\/3\)/);
          return match ? Number(match[1] || 0) : 0;
        };
        const readPdfCountFromRoot = (root) =>
          Array.from(root.querySelectorAll("img.imgUploadPdf")).filter(
            (node) => node instanceof HTMLImageElement && node.offsetParent !== null,
          ).length;
        const readDeleteCountFromRoot = (root) =>
          Array.from(
            root.querySelectorAll(
              "[data-uid*='icondelete_oncancel'], .theme-arco-icon-delete, .arco-icon-delete",
            ),
          ).filter((node) => node instanceof HTMLElement && node.offsetParent !== null).length;

        let counter = 0;
        let pdfCount = 0;
        let deleteCount = 0;
        for (const root of roots) {
          if (!(root instanceof HTMLElement || root instanceof HTMLBodyElement)) continue;
          counter = Math.max(counter, readCounterFromRoot(root));
          pdfCount = Math.max(pdfCount, readPdfCountFromRoot(root));
          deleteCount = Math.max(deleteCount, readDeleteCountFromRoot(root));
        }
        return { count: Math.max(counter, pdfCount), counter, pdfCount, deleteCount };
      })
      .catch(() => ({ count: 0, counter: 0, pdfCount: 0, deleteCount: 0 }));

  const waitUntilUploaded = async (beforeCount) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 25000) {
      const currentInfo = await readUploadInfo();
      if (currentInfo.count >= 1 && currentInfo.count >= beforeCount) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    return false;
  };

  const existingUploadInfo = await readUploadInfo();
  if (existingUploadInfo.count > 1) {
    // Keep exactly one uploaded file to avoid noisy duplicates across retries.
    let guard = 0;
    while (guard < 3) {
      guard += 1;
      const deleteButton = page
        .locator(
          "[data-uid*='icondelete_oncancel'], .theme-arco-icon-delete, .arco-icon-delete",
        )
        .first();
      if ((await safeCount(deleteButton)) === 0) break;
      const clicked = await safeClick(deleteButton);
      if (!clicked) break;
      await page.waitForTimeout(800).catch(() => {});
      const afterDelete = await readUploadInfo();
      if (afterDelete.count <= 1) break;
    }
  }
  const normalizedUploadInfo = await readUploadInfo();
  if (normalizedUploadInfo.count >= 1) {
    return { uploaded: true, reason: "already_uploaded" };
  }

  const trySetOnSingleFileInput = async (scope, beforeCount) => {
    try {
      const uploadCard = scope.locator("[data-uid*='addfile'], [data-tid='m4b_upload']").first();
      if ((await safeCount(uploadCard)) > 0) {
        await safeClick(uploadCard);
      }
    } catch {
      // Best-effort only.
    }
    const inputLocator = scope.locator("input[type='file']");
    const count = await safeCount(inputLocator);
    if (count <= 0) return { uploaded: false, reason: "file_input_not_found" };
    const input = inputLocator.first();
    try {
      await input.setInputFiles(filePath, { timeout: 6000 });
      const uploaded = await waitUntilUploaded(Math.max(1, Number(beforeCount || 0) + 1));
      return { uploaded, reason: uploaded ? "uploaded" : "upload_failed" };
    } catch {
      return { uploaded: false, reason: "upload_failed" };
    }
  };

  const directPageUpload = await trySetOnSingleFileInput(page, normalizedUploadInfo.count);
  if (directPageUpload.uploaded) return directPageUpload;

  // Fallback to child frames (some uploader widgets mount there), still one-shot only.
  for (const frame of page.frames()) {
    try {
      const frameUpload = await trySetOnSingleFileInput(frame, normalizedUploadInfo.count);
      if (frameUpload.uploaded) return frameUpload;
    } catch {
      // Continue scanning other frames.
    }
  }

  return {
    uploaded: false,
    reason:
      directPageUpload.reason === "file_input_not_found"
        ? "file_input_not_found"
        : directPageUpload.reason || "upload_failed",
  };
}

function stepAttemptKey(step, action) {
  return `${step || "unknown"}:${action}`;
}

function canAttemptStep(state, step, action, cooldownMs, maxAttempts = 2) {
  const key = stepAttemptKey(step, action);
  const attempts = state.stepAttempts[key] || { count: 0, at: 0 };
  const now = Date.now();
  if (attempts.count >= maxAttempts) return false;
  if (now - attempts.at < cooldownMs) return false;
  state.stepAttempts[key] = { count: attempts.count + 1, at: now };
  return true;
}

async function detectSellerStep(page) {
  return page
    .evaluate(() => {
      const href = String(window.location?.href || "").toLowerCase();
      const params = new URLSearchParams(String(window.location?.search || ""));
      const gyq = String(params.get("gyq") || "").toLowerCase();
      const body = String(document.body?.innerText || "").toLowerCase();
      const has = (selector) => !!document.querySelector(selector);
      const isVisible = (selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) return false;
        const rect = node.getBoundingClientRect();
        return node.offsetParent !== null && rect.width > 0 && rect.height > 0;
      };
      const hasVisibleText = (text) => {
        const target = String(text || "").toLowerCase();
        if (!target) return false;
        const nodes = Array.from(document.querySelectorAll("body *"));
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.offsetParent === null) continue;
          const content = String(node.innerText || node.textContent || "").toLowerCase();
          if (content.includes(target)) return true;
        }
        return false;
      };

      const onVerification = href.includes("/settle/verification");
      if (onVerification) {
        const businessKeys = new Set(["business_name", "business_address", "ein", "biztype"]);
        const primaryKeys = new Set([
          "legal_name", "ssn", "ssn_itin", "itin", "passport",
          "residence_address", "ssn_or_itin",
        ]);
        const shopKeys = new Set(["shop_name", "shop_info", "category", "product"]);
        const reviewKeys = new Set(["review", "review_application", "submit"]);
        const looksPrimaryByDomEarly =
          isVisible("input[placeholder='XXXX']") ||
          isVisible("input[placeholder='xxxx']") ||
          isVisible("input[placeholder*='first name' i]") ||
          hasVisibleText("primary representative");
        const looksBusinessByDomEarly =
          isVisible("input[placeholder*='business name' i]") ||
          hasVisibleText("verify business details");

        // gyq is useful, but DOM can be fresher during TikTok step transitions.
        if (primaryKeys.has(gyq)) return "primary_representative";
        if (shopKeys.has(gyq)) return "shop_information";
        if (reviewKeys.has(gyq)) return "review_application";
        if (businessKeys.has(gyq)) {
          if (looksPrimaryByDomEarly && !looksBusinessByDomEarly) {
            return "primary_representative";
          }
          return "business_details";
        }
      }
      const looksBusinessDetailsByDom =
        isVisible("input[placeholder*='business name' i]") ||
        isVisible("input[placeholder*='street address' i]") ||
        isVisible("input[placeholder*='zip code' i]") ||
        isVisible("input[placeholder*='city' i]") ||
        isVisible("input[placeholder*='state' i]") ||
        hasVisibleText("business details");

      // Guard: Primary representative form also has city/zip/address.
      // Use SSN input or first-name input as the tiebreaker.
      const looksLikePrimaryRep =
        isVisible("input[placeholder='XXXX']") ||
        isVisible("input[placeholder='xxxx']") ||
        isVisible("input[placeholder*='first name' i]") ||
        hasVisibleText("primary representative");

      if (onVerification && looksLikePrimaryRep) {
        return "primary_representative";
      }

      if (onVerification && looksBusinessDetailsByDom) {
        return "business_details";
      }

      const looksBusinessTypeByDom =
        hasVisibleText("what type of business do you operate") ||
        hasVisibleText("sole proprietorship");

      if (looksBusinessTypeByDom && !looksBusinessDetailsByDom) {
        return "business_type";
      }
      if (
        body.includes("business details") &&
        (body.includes("legal business name") || body.includes("verify business details"))
      ) {
        return "business_details";
      }
      if (
        body.includes("primary representative") &&
        (body.includes("verify your identity") ||
          body.includes("provide ssn") ||
          body.includes("legal name") ||
          body.includes("date of birth"))
      ) {
        return "primary_representative";
      }
      if (
        body.includes("which option describes your business the best") ||
        body.includes("to get started, tell us about yourself")
      ) {
        return "intent_question";
      }
      if (
        body.includes("shop information") &&
        (body.includes("shop name") || body.includes("primary product") || body.includes("contact email"))
      ) {
        return "shop_information";
      }
      if (
        body.includes("review application") &&
        (body.includes("submit application") ||
          body.includes("information on this page is true") ||
          body.includes("i confirm") ||
          body.includes("i agree"))
      ) {
        return "review_application";
      }
      if (body.includes("under review") || body.includes("information required")) {
        return "review_application";
      }
      if (body.includes("enter verification code")) return "otp";
      if (body.includes("set your password")) return "password";
      if (
        has("#phone_email_input") ||
        has("input[placeholder*='phone number or email' i]") ||
        body.includes("phone number or email") ||
        (href.includes("/account/register") && body.includes("sign up"))
      ) {
        return "register";
      }
      if (
        body.includes("business information") ||
        body.includes("business name") ||
        body.includes("legal business name")
      ) {
        return "business_info";
      }
      if (
        has("input[name*='ein' i]") ||
        has("input[id*='ein' i]") ||
        body.includes("ein") ||
        body.includes("tax id")
      ) {
        return "ein_verify";
      }
      if (href.includes("/account/register")) return "register";
      return "unknown";
    })
    .catch(() => "unknown");
}

async function emitAutoEvent(events, payload) {
  await events.write({ kind: "auto_action", ...payload });
}

async function collectVisibleFormDiagnostics(page) {
  return page
    .evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll("input,textarea,select,[role='combobox'],button"),
      ).filter((node) => node instanceof HTMLElement && node.offsetParent !== null);
      const summarize = (node) => {
        if (!(node instanceof HTMLElement)) return null;
        const tag = String(node.tagName || "").toLowerCase();
        const text = String(node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
        const placeholder = node.getAttribute("placeholder") || "";
        const role = node.getAttribute("role") || "";
        const id = node.getAttribute("id") || "";
        const name = node.getAttribute("name") || "";
        const type = node.getAttribute("type") || "";
        const ariaDisabled = node.getAttribute("aria-disabled") === "true";
        const disabled =
          ariaDisabled ||
          (node instanceof HTMLButtonElement && node.disabled) ||
          (node instanceof HTMLInputElement && node.disabled) ||
          (node instanceof HTMLSelectElement && node.disabled) ||
          (node instanceof HTMLTextAreaElement && node.disabled);
        let value = "";
        if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
          value = String(node.value || "");
        } else if (node instanceof HTMLSelectElement) {
          value = String(node.value || "");
        } else {
          value = String(node.getAttribute("value") || "");
        }
        if (String(type).toLowerCase() === "password") {
          value = value ? "__masked__" : "";
        }
        return {
          tag,
          role,
          id,
          name,
          type,
          placeholder,
          text,
          value,
          valueLength: String(value || "").length,
          disabled,
        };
      };

      const requiredErrors = Array.from(document.querySelectorAll("div,span,p"))
        .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
        .map((node) => String(node.textContent || "").trim())
        .filter((text) =>
          /required|invalid|please verify business detail|couldn't verify your information/i.test(
            text,
          ),
        )
        .slice(0, 80);

      return {
        url: String(window.location?.href || ""),
        title: String(document.title || ""),
        controls: nodes.map((node) => summarize(node)).filter(Boolean).slice(0, 300),
        requiredErrors,
      };
    })
    .catch(() => ({ url: page.url(), title: "", controls: [], requiredErrors: [] }));
}

async function maybeCaptureStepDiagnostics(page, outputDir, events, state, step, reason) {
  if (!outputDir) return;
  const maxDiagnosticsPerSession = 80;
  if (Number(state.stepDiagnosticCount || 0) >= maxDiagnosticsPerSession) return;
  const key = `${String(step || "unknown")}::${String(reason || "unknown")}`;
  const now = Date.now();
  const last = Number(state.lastStepDiagnosticAt[key] || 0);
  if (now - last < 15000) return;
  state.lastStepDiagnosticAt[key] = now;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const diagPath = path.join(outputDir, "diagnostics", `${stamp}-${toSlug(step)}-${toSlug(reason)}.json`);
  const formDiagnostics = await collectVisibleFormDiagnostics(page);
  await writeJson(diagPath, {
    capturedAt: nowIso(),
    step,
    reason,
    ...formDiagnostics,
  }).catch(() => {});
  state.stepDiagnosticCount = Number(state.stepDiagnosticCount || 0) + 1;
  await events
    .write({
      kind: "step_diagnostic",
      step,
      reason,
      diagPath,
      url: page.url(),
    })
    .catch(() => {});
}

async function readPrimaryRepresentativeStatus(page) {
  return page
    .evaluate(() => {
      const getInput = (selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLInputElement)) return null;
        if (node.offsetParent === null) return null;
        return node;
      };
      const normalize = (value) => String(value || "").trim().toLowerCase();
      const digits = (value) => String(value || "").replace(/\D+/g, "");
      const hasLetterOnly = (value) => /^[a-z][a-z\s.'-]*$/i.test(String(value || "").trim());
      const isPlaceholderLike = (value, placeholder) => {
        const v = normalize(value);
        const p = normalize(placeholder);
        return !v || v === p;
      };
      const hasErrorText = Array.from(document.querySelectorAll("div,span,p"))
        .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
        .some((node) => {
          const text = normalize(node.textContent || "");
          return (
            text.includes("this field is required") ||
            text.includes("doesn't follow the correct format") ||
            text.includes("information you provided doesn't follow") ||
            text.includes("invalid")
          );
        });

      const firstNameInput = getInput("input[placeholder*='First name' i]");
      const lastNameInput = getInput("input[placeholder*='Last name' i]");
      const ssnLast4Input = getInput("input[placeholder='XXXX'],input[placeholder='xxxx']");
      const monthInput = getInput("input[placeholder='Month']");
      const dayInput = getInput("input[placeholder='Day']");
      const yearInput = getInput("input[placeholder='Year']");
      const streetInput = getInput("input[placeholder*='Street address' i]");
      const cityInput = getInput("input[placeholder='City']");
      const stateInput = getInput("input[placeholder='State']");
      const zipInput = getInput("input[placeholder='ZIP code']");
      const regionInput = getInput("input[placeholder='select your region'],input[placeholder*='nationality' i]");

      const firstName = String(firstNameInput?.value || "").trim();
      const lastName = String(lastNameInput?.value || "").trim();
      const month = String(monthInput?.value || "").trim();
      const day = String(dayInput?.value || "").trim();
      const year = String(yearInput?.value || "").trim();
      const zip = String(zipInput?.value || "").trim();
      const street = String(streetInput?.value || "").trim();
      const city = String(cityInput?.value || "").trim();
      const state = String(stateInput?.value || "").trim();
      const ssnLast4 = digits(ssnLast4Input?.value || "");
      const region = String(regionInput?.value || "").trim();

      const firstNameOk = hasLetterOnly(firstName);
      const lastNameOk = hasLetterOnly(lastName);
      const monthOk = !isPlaceholderLike(month, "Month");
      const dayOk = !isPlaceholderLike(day, "Day");
      const yearOk = !isPlaceholderLike(year, "Year");
      const streetOk = street.length >= 8;
      const cityOk = city.length >= 2;
      const stateOk = state.length >= 2 && !isPlaceholderLike(state, "State");
      const zipOk = digits(zip).length === 5;
      const ssnOk = ssnLast4.length === 4;
      const regionPlaceholder = String(regionInput?.getAttribute("placeholder") || "").trim();
      const regionOk =
        !regionInput ||
        (region.length >= 2 && !isPlaceholderLike(region, regionPlaceholder));

      const uboRoot = Array.from(document.querySelectorAll("div,section,fieldset")).find((node) => {
        if (!(node instanceof HTMLElement) || node.offsetParent === null) return false;
        const text = normalize(node.textContent || "");
        return (
          text.includes("beneficial owner") ||
          text.includes("ultimate beneficial") ||
          text.includes("ubo") ||
          text.includes("25% or more") ||
          text.includes("owns 25") ||
          text.includes("significant control")
        );
      });
      const uboRequired = Boolean(uboRoot);
      const uboSelected =
        !uboRequired ||
        Boolean(
          uboRoot?.querySelector("input[type='radio']:checked,[role='radio'][aria-checked='true']"),
        );

      return {
        firstNameOk,
        lastNameOk,
        monthOk,
        dayOk,
        yearOk,
        streetOk,
        cityOk,
        stateOk,
        zipOk,
        ssnOk,
        regionOk,
        uboOk: uboSelected,
        hasErrorText,
        ready:
          firstNameOk &&
          lastNameOk &&
          monthOk &&
          dayOk &&
          yearOk &&
          streetOk &&
          cityOk &&
          stateOk &&
          zipOk &&
          ssnOk &&
          regionOk &&
          uboSelected &&
          !hasErrorText,
      };
    })
    .catch(() => ({
      firstNameOk: false,
      lastNameOk: false,
      monthOk: false,
      dayOk: false,
      yearOk: false,
      streetOk: false,
      cityOk: false,
      stateOk: false,
      zipOk: false,
      ssnOk: false,
      regionOk: false,
      uboOk: false,
      hasErrorText: true,
      ready: false,
    }));
}

async function bestEffortAutomationTick(page, events, seedContext, state, options = {}) {
  const manualGated = Boolean(options.manualGated);
  const configuredContactMode = String(options.contactMode || "auto").toLowerCase();
  const entryMode = String(options.entryMode || "register").toLowerCase();
  const allowEinSubmit = Boolean(options.allowEinSubmit);
  const outputDir = String(options.outputDir || "").trim();
  const resolvePreferredContactMode = () =>
    state.forcedContactMode ||
    (configuredContactMode === "phone" || configuredContactMode === "email"
      ? configuredContactMode
      : seedContext.email
        ? "email"
        : seedContext.phone
          ? "phone"
          : "");
  if (!page || page.isClosed()) return;
  const currentUrl = page.url();
  const isSellerRegister = /seller-us\.tiktok\.com\/account\/register/i.test(currentUrl);
  const isTiktokLogin = /www\.tiktok\.com\/login/i.test(currentUrl);
  const isSellerAccountLogin = /seller-us\.tiktok\.com\/account\/login/i.test(currentUrl);
  const isPhonePasswordLogin = /\/login\/phone-or-email\/phone-password/i.test(currentUrl);
  const isSellerSsoCallback = /seller-us\.tiktok\.com\/passport\/sso\/login\/callback/i.test(currentUrl);
  const now = Date.now();
  if (now - state.lastTickAt >= 5000) {
    state.lastTickAt = now;
    await emitAutoEvent(events, {
      stage: "automation",
      action: "tick",
      result: "alive",
      url: page.url(),
    });
  }

  const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();

  if (isSellerSsoCallback) {
    const hasTicketExpired = /ticket expired|error_code["']?\s*:\s*["']?1042|\"message\"\s*:\s*\"error\"/i.test(
      bodyText,
    );
    if (
      hasTicketExpired &&
      canAttemptStep(state, "seller_sso_callback", "recover_ticket_expired", 5000, 20)
    ) {
      const nowMs = Date.now();
      if (nowMs - (state.callbackTicketExpiredRecoveredAt || 0) > 4000) {
        state.callbackTicketExpiredRecoveredAt = nowMs;
        let resumeUrl = "https://seller-us.tiktok.com/";
        try {
          const parsed = new URL(currentUrl);
          const nextRaw = parsed.searchParams.get("next");
          if (nextRaw) {
            const decoded = decodeURIComponent(nextRaw);
            if (/^https:\/\/seller-us\.tiktok\.com\//i.test(decoded)) {
              resumeUrl = decoded;
            }
          }
        } catch {
          // keep default resume URL
        }
        await emitAutoEvent(events, {
          stage: "seller_sso_callback",
          action: "ticket_expired_recover",
          result: "navigate_resume_url",
          resumeUrl,
          url: currentUrl,
        });
        await page.goto(resumeUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(
          () => null,
        );
        await page.waitForTimeout(1800);
      }
      return;
    }
  }
  const clearBlockedStateIfRecovered = async () => {
    if (!state.blockedReason) return;
    const previous = state.blockedReason;
    state.blockedReason = "";
    state.lastBlockedReasonEmitted = "";
    await emitAutoEvent(events, {
      stage: "automation",
      action: "resume_after_block",
      result: "resumed",
      previousReason: previous,
      url: page.url(),
    });
  };

  if (/maximum number of attempts reached|try again later/i.test(bodyText)) {
    const activeMode = resolvePreferredContactMode();
    if (
      activeMode === "phone" &&
      seedContext.email &&
      (configuredContactMode === "auto" || configuredContactMode === "phone")
    ) {
      state.forcedContactMode = "email";
      state.recordedContact = false;
      state.registerSubmitted = false;
      await emitAutoEvent(events, {
        stage: "register_entry",
        action: "switch_contact_mode",
        result: "rate_limited_phone_switch_to_email",
        url: page.url(),
      });
      return;
    }
    if (
      activeMode === "email" &&
      seedContext.phone &&
      (configuredContactMode === "auto" || configuredContactMode === "email")
    ) {
      state.forcedContactMode = "phone";
      state.recordedContact = false;
      state.registerSubmitted = false;
      await emitAutoEvent(events, {
        stage: "register_entry",
        action: "switch_contact_mode",
        result: "rate_limited_email_switch_to_phone",
        url: page.url(),
      });
      return;
    }
    state.blockedReason = "rate_limited";
    if (state.lastBlockedReasonEmitted !== state.blockedReason) {
      state.lastBlockedReasonEmitted = state.blockedReason;
      await emitAutoEvent(events, {
        stage: "blocked",
        reason: state.blockedReason,
        url: page.url(),
      });
    }
    return;
  }
  const blockingCaptcha = await hasBlockingCaptchaModal(page);
  const skipCaptchaBlockForAuthFlow = isSellerAccountLogin || isTiktokLogin || isPhonePasswordLogin;
  if (!skipCaptchaBlockForAuthFlow && blockingCaptcha) {
    state.blockedReason = "captcha_or_human_verify";
    if (state.lastBlockedReasonEmitted !== state.blockedReason) {
      state.lastBlockedReasonEmitted = state.blockedReason;
      await emitAutoEvent(events, {
        stage: "blocked",
        reason: state.blockedReason,
        action: "awaiting_manual_solve",
        url: page.url(),
      });
    }
    return;
  }
  await clearBlockedStateIfRecovered();

  if (isSellerAccountLogin) {
    const inSellerLoginOtp = await page
      .evaluate(() => {
        const body = String(document.body?.innerText || "").toLowerCase();
        const inputs = Array.from(document.querySelectorAll("input")).filter((el) => {
          if (!(el instanceof HTMLInputElement)) return false;
          const maxLength = Number(el.maxLength || 0);
          const mode = String(el.getAttribute("inputmode") || "").toLowerCase();
          const type = String(el.type || "").toLowerCase();
          const rect = el.getBoundingClientRect();
          return (
            el.offsetParent !== null &&
            rect.width >= 10 &&
            rect.height >= 10 &&
            (maxLength === 1 || mode.includes("numeric")) &&
            (type === "text" || type === "tel" || type === "number" || type === "")
          );
        });
        return (
          body.includes("log in verification") ||
          body.includes("verification code has been sent") ||
          inputs.length >= 4
        );
      })
      .catch(() => false);

    if (inSellerLoginOtp) {
      if (!state.loginOtpStepEnteredAt) {
        state.loginOtpStepEnteredAt = Date.now();
        state.loginOtpWarmupLogged = false;
      }
      if (!state.loginOtpFilled && canAttemptStep(state, "seller_login_otp", "fill_otp", 3500, 30)) {
        const otpWarmupMs = 12000;
        const sinceEntered = state.loginOtpStepEnteredAt
          ? Date.now() - state.loginOtpStepEnteredAt
          : otpWarmupMs;
        if (sinceEntered < otpWarmupMs) {
          if (!state.loginOtpWarmupLogged || canAttemptStep(state, "seller_login_otp", "warmup_log", 3000, 20)) {
            state.loginOtpWarmupLogged = true;
            await emitAutoEvent(events, {
              stage: "seller_login_otp",
              action: "wait_fresh_otp",
              result: "warming_up",
              waitMs: otpWarmupMs - sinceEntered,
              url: currentUrl,
            });
          }
          return;
        }
        const otpEndpoint = seedContext.emailApiEndpoint || seedContext.apiMail || seedContext.phoneApiEndpoint || seedContext.apiPhone || "";
        const otpCode = await fetchOtpCode(otpEndpoint);
        await emitAutoEvent(events, {
          stage: "seller_login_otp",
          action: "fetch_otp",
          result: otpCode ? "received" : "empty",
          endpoint: otpEndpoint ? String(otpEndpoint).slice(0, 120) : "",
          codePreview: otpCode ? `${String(otpCode).slice(0, 2)}**` : "",
          url: currentUrl,
        });
        if (otpCode) {
          const normalizedOtpCode = String(otpCode || "").replace(/[^\d]/g, "");
          if (normalizedOtpCode && normalizedOtpCode === state.loginOtpLastSubmittedCode) {
            const hasOtpError = await page
              .locator("text=/verification code is expired|incorrect|invalid|try again/i")
              .first()
              .isVisible()
              .catch(() => false);
            if (
              hasOtpError &&
              canAttemptStep(state, "seller_login_otp", "resend_on_stale", 3000, 20)
            ) {
              const clickedResend = await fallbackClickButtonByText(page, [
                "resend the code",
                "resend code",
                "send code again",
              ]);
              if (clickedResend) {
                state.loginOtpLastSubmittedCode = "";
                await emitAutoEvent(events, {
                  stage: "seller_login_otp",
                  action: "resend_after_stale_code",
                  result: "resend_clicked",
                  url: currentUrl,
                });
              }
            }
            await emitAutoEvent(events, {
              stage: "seller_login_otp",
              action: "skip_stale_otp",
              result: hasOtpError ? "same_as_last_submitted_with_error" : "same_as_last_submitted",
              codePreview: `${normalizedOtpCode.slice(0, 2)}**`,
              url: currentUrl,
            });
            return;
          }
          const filled = await fillOtpInputs(page, otpCode);
          if (filled) {
            state.loginOtpFilled = true;
            state.loginOtpCandidateCode = normalizedOtpCode;
            await emitAutoEvent(events, {
              stage: "seller_login_otp",
              action: "fill_otp",
              result: "filled",
              url: currentUrl,
            });
          }
        }
      }

      if (
        !manualGated &&
        state.loginOtpFilled &&
        !state.loginOtpSubmitted &&
        canAttemptStep(state, "seller_login_otp", "submit_otp", 4500, 20)
      ) {
        const submitted =
          (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
          (await safeClick(page.locator("button", { hasText: "Verify" }))) ||
          (await fallbackClickButtonByText(page, ["continue", "verify", "submit"]));
        if (submitted) {
          state.loginOtpSubmitted = true;
          state.loginOtpLastSubmittedCode = String(state.loginOtpCandidateCode || "");
          await emitAutoEvent(events, {
            stage: "seller_login_otp",
            action: "submit_otp",
            result: "clicked",
            url: currentUrl,
          });
        }
      }

      if (
        state.loginOtpSubmitted &&
        canAttemptStep(state, "seller_login_otp", "retry_after_submit", 7000, 10)
      ) {
        const stillOtpVisible = await page
          .evaluate(() => {
            const body = String(document.body?.innerText || "").toLowerCase();
            const inputs = Array.from(document.querySelectorAll("input")).filter((el) => {
              if (!(el instanceof HTMLInputElement)) return false;
              const maxLength = Number(el.maxLength || 0);
              const mode = String(el.getAttribute("inputmode") || "").toLowerCase();
              const type = String(el.type || "").toLowerCase();
              return (
                (maxLength === 1 || mode.includes("numeric")) &&
                (type === "text" || type === "tel" || type === "number" || type === "")
              );
            });
            return (
              body.includes("log in verification") ||
              body.includes("verification code has been sent") ||
              inputs.length >= 4
            );
          })
          .catch(() => false);
        if (stillOtpVisible) {
          const clickedResend = await fallbackClickButtonByText(page, [
            "resend the code",
            "resend code",
            "send code again",
          ]);
          state.loginOtpFilled = false;
          state.loginOtpSubmitted = false;
          state.loginOtpCandidateCode = "";
          state.loginOtpLastSubmittedCode = "";
          await emitAutoEvent(events, {
            stage: "seller_login_otp",
            action: "retry_after_submit",
            result: clickedResend ? "resend_clicked" : "reset_without_resend",
            url: currentUrl,
          });
        }
      }
      return;
    }
    state.loginOtpStepEnteredAt = 0;
    state.loginOtpWarmupLogged = false;

    const sellerLoginMode = await page
      .evaluate(() => {
        const root = document.body;
        const activeTab =
          document.querySelector("[role='tab'][aria-selected='true']") ||
          document.querySelector(".arco-tabs-tab-active");
        const activeText = String(activeTab?.textContent || "").toLowerCase();
        const rootText = String(root?.innerText || "").toLowerCase();
        if (activeText.includes("phone")) return "phone";
        if (activeText.includes("email")) return "email";
        if (rootText.includes("enter your email address")) return "email";
        return "email";
      })
      .catch(() => "email");

    const preferredContactMode = resolvePreferredContactMode();
    const wantPhone = preferredContactMode === "phone" && Boolean(seedContext.phone);
    if (wantPhone && sellerLoginMode !== "phone" && canAttemptStep(state, "seller_login", "switch_to_phone", 2500, 4)) {
      const switched =
        (await safeClick(page.locator("[role='tab']", { hasText: "Phone" }))) ||
        (await safeClick(page.locator("text=Phone"))) ||
        (await fallbackClickAnyByText(page, ["phone"]));
      await emitAutoEvent(events, {
        stage: "seller_login",
        action: "switch_to_phone",
        result: switched ? "clicked" : "not_found",
        url: currentUrl,
      });
      return;
    }

    const loginIdentifier = wantPhone
      ? seedContext.phone
      : seedContext.email || seedContext.loginUsername || seedContext.username || seedContext.phone;
    if (loginIdentifier && canAttemptStep(state, "seller_login", "fill_identifier", 2500, 8)) {
      const candidates = wantPhone
        ? [
            page.locator("input[placeholder*='phone' i]"),
            page.locator("input[type='tel']"),
            page.locator("input[type='text']"),
          ]
        : [
            page.locator("input[placeholder*='email address' i]"),
            page.locator("input[placeholder*='email' i]"),
            page.locator("input[type='email']"),
            page.locator("input[type='text']"),
          ];
      const filled = await fillFirstMatch(candidates, String(loginIdentifier));
      if (filled) {
        state.loginIdentifierFilled = true;
        await emitAutoEvent(events, {
          stage: "seller_login",
          action: "fill_identifier",
          mode: wantPhone ? "phone" : "email",
          result: "filled",
          url: currentUrl,
        });
      }
    }

    const loginPassword = seedContext.loginPassword || seedContext.accountPassword || "";
    if (loginPassword && canAttemptStep(state, "seller_login", "fill_password", 2500, 8)) {
      const filled = await fillFirstMatch(
        [page.locator("input[type='password']"), page.locator("input[placeholder*='password' i]")],
        String(loginPassword),
      );
      if (filled) {
        state.loginPasswordFilled = true;
        await emitAutoEvent(events, {
          stage: "seller_login",
          action: "fill_password",
          result: "filled",
          url: currentUrl,
        });
      }
    }

    if (
      !manualGated &&
      !state.loginSubmitted &&
      state.loginIdentifierFilled &&
      state.loginPasswordFilled &&
      canAttemptStep(state, "seller_login", "submit_continue", 3500, 10)
    ) {
      const clicked = await safeClick(
        page.locator("button[data-tid='m4b_button'],button", { hasText: "Continue" }).first(),
      );
      if (clicked) {
        state.loginSubmitted = true;
        state.loginSubmittedAt = Date.now();
        await emitAutoEvent(events, {
          stage: "seller_login",
          action: "submit_continue",
          result: "clicked",
          url: currentUrl,
        });
      }
    }

    if (state.loginSubmitted && canAttemptStep(state, "seller_login", "retry_after_submit", 9000, 6)) {
      const stillOnSellerLogin = /seller-us\.tiktok\.com\/account\/login/i.test(page.url());
      const elapsedSinceSubmit = Date.now() - Number(state.loginSubmittedAt || 0);
      if (stillOnSellerLogin && elapsedSinceSubmit >= 12000) {
        state.loginSubmitted = false;
        state.loginSubmittedAt = 0;
        state.loginIdentifierFilled = false;
        state.loginPasswordFilled = false;
        await emitAutoEvent(events, {
          stage: "seller_login",
          action: "retry_after_submit",
          result: "still_on_login_form_after_timeout_reset_state",
          elapsedMs: elapsedSinceSubmit,
          url: currentUrl,
        });
      }
    }
    return;
  }

  if (entryMode === "tiktok_existing" && isTiktokLogin) {
    const inIdentityVerifyModal =
      /verify it['’]s really you|verify your identity|enter verification code/i.test(bodyText);
    if (inIdentityVerifyModal) {
      if (
        !state.loginVerifyPhoneSelected &&
        canAttemptStep(state, "tiktok_login_verify", "choose_phone_method", 3000, 4)
      ) {
        const clickedPhone =
          (await safeClick(page.locator("button", { hasText: "Phone" }))) ||
          (await safeClick(page.locator("text=Phone"))) ||
          (await fallbackClickAnyByText(page, ["phone"]));
        if (clickedPhone) {
          state.loginVerifyPhoneSelected = true;
          await emitAutoEvent(events, {
            stage: "tiktok_login_verify",
            action: "choose_phone_method",
            result: "clicked",
            url: currentUrl,
          });
          return;
        }
      }

      if (
        !state.loginOtpFilled &&
        canAttemptStep(state, "tiktok_login_verify", "fill_otp", 4000, 6)
      ) {
        const otpEndpoint = seedContext.phoneApiEndpoint || seedContext.apiPhone || "";
        const otpCode = await fetchOtpCode(otpEndpoint);
        if (otpCode) {
          const filled = await fillOtpInputs(page, otpCode);
          if (filled) {
            state.loginOtpFilled = true;
            await emitAutoEvent(events, {
              stage: "tiktok_login_verify",
              action: "fill_otp",
              result: "filled",
              url: currentUrl,
            });
            return;
          }
        }
      }

      if (
        !manualGated &&
        state.loginOtpFilled &&
        !state.loginOtpSubmitted &&
        canAttemptStep(state, "tiktok_login_verify", "submit_otp", 5000, 3)
      ) {
        const submitted =
          (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
          (await safeClick(page.locator("button", { hasText: "Verify" }))) ||
          (await safeClick(page.locator("button", { hasText: "Submit" }))) ||
          (await fallbackClickButtonByText(page, ["continue", "verify", "submit"]));
        if (submitted) {
          state.loginOtpSubmitted = true;
          await emitAutoEvent(events, {
            stage: "tiktok_login_verify",
            action: "submit_otp",
            result: "clicked",
            url: currentUrl,
          });
          return;
        }
      }
    }

    const loginInputMode = await page
      .evaluate(() => {
        const body = String(document.body?.innerText || "").toLowerCase();
        const activeTab = document.querySelector("[role='tab'][aria-selected='true'], [aria-current='true']");
        const activeText = String(activeTab?.textContent || "").toLowerCase();
        const input = document.querySelector("input:not([type='password'])");
        const placeholder = String(input?.getAttribute("placeholder") || "").toLowerCase();
        if (
          activeText.includes("email or username") ||
          placeholder.includes("email") ||
          placeholder.includes("username")
        ) {
          return "email_username";
        }
        if (
          activeText.includes("phone") ||
          body.includes("enter a valid phone number") ||
          placeholder.includes("phone")
        ) {
          return "phone";
        }
        return "unknown";
      })
      .catch(() => "unknown");

    const mustSwitchToEmailUsername = loginInputMode !== "email_username";
    if (mustSwitchToEmailUsername && canAttemptStep(state, "tiktok_login", "switch_identifier_tab", 3000, 5)) {
      const switchedTab =
        (await safeClick(page.locator("[role='tab']", { hasText: "Log in with email or username" }))) ||
        (await safeClick(page.locator("button", { hasText: "Log in with email or username" }))) ||
        (await safeClick(page.locator("text=Log in with email or username"))) ||
        (await safeClick(page.locator("text=Email / Username"))) ||
        (await fallbackClickAnyByText(page, ["log in with email or username", "email or username"]));
      await emitAutoEvent(events, {
        stage: "tiktok_login",
        action: "switch_identifier_tab",
        result: switchedTab ? "clicked" : "not_found",
        url: currentUrl,
      });
      return;
    }

    if (canAttemptStep(state, "tiktok_login", "switch_password_mode", 5000, 2)) {
      const switched =
        (await safeClick(page.locator("text=Log in with password"))) ||
        (await safeClick(page.locator("text=Log in with password?"))) ||
        (await safeClick(page.locator("text=Use password"))) ||
        (await fallbackClickButtonByText(page, ["log in with password", "use password"]));
      if (switched) {
        await emitAutoEvent(events, {
          stage: "tiktok_login",
          action: "switch_password_mode",
          result: "clicked",
          url: currentUrl,
        });
      }
    }

    if (!state.loginMethodOpened && canAttemptStep(state, "tiktok_login", "open_method", 5000, 2)) {
      const opened =
        (await safeClick(page.locator("text=Use phone / email / username"))) ||
        (await fallbackClickButtonByText(page, ["use phone / email / username", "use phone / email"]));
      if (opened) {
        state.loginMethodOpened = true;
        await emitAutoEvent(events, {
          stage: "tiktok_login",
          action: "open_login_method",
          result: "clicked",
          url: currentUrl,
        });
      }
    }

    const loginIdentifier = seedContext.loginUsername || seedContext.username || seedContext.email || seedContext.phone;
    if (loginIdentifier && canAttemptStep(state, "tiktok_login", "fill_identifier", 3500, 4)) {
      const candidates = [
        page.locator("input[placeholder*='email or username' i]"),
        page.locator("input[placeholder*='email' i]"),
        page.locator("input[placeholder*='username' i]"),
        page.locator("input[name*='username' i]"),
        page.locator("input[id*='username' i]"),
        page.locator("input[type='text']"),
        page.locator("input[type='email']"),
      ];
      let done = await fillFirstMatch(candidates, String(loginIdentifier));
      if (!done) {
        done = await fallbackFillLoginIdentifier(page, String(loginIdentifier));
      }
      if (done) {
        state.loginIdentifierFilled = true;
        await emitAutoEvent(events, {
          stage: "tiktok_login",
          action: "fill_identifier",
          result: "filled",
          url: currentUrl,
        });
      }
    }

    const loginPassword = seedContext.loginPassword || seedContext.accountPassword || "";
    if (loginPassword && canAttemptStep(state, "tiktok_login", "fill_password", 3500, 4)) {
      const filled = await fillFirstMatch(
        [page.locator("input[type='password']"), page.locator("input[name*='password' i]")],
        String(loginPassword),
      );
      if (filled) {
        state.loginPasswordFilled = true;
        await emitAutoEvent(events, {
          stage: "tiktok_login",
          action: "fill_password",
          result: "filled",
          url: currentUrl,
        });
      }
    }

    if (
      !manualGated &&
      !state.loginSubmitted &&
      (state.loginPasswordFilled || state.loginIdentifierFilled) &&
      canAttemptStep(state, "tiktok_login", "submit_login", 7000, 2)
    ) {
      const clicked =
        (await safeClick(page.locator("button", { hasText: "Log in" }))) ||
        (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
        (await fallbackClickButtonByText(page, ["log in", "continue"]));
      if (clicked) {
        state.loginSubmitted = true;
        await emitAutoEvent(events, {
          stage: "tiktok_login",
          action: "submit_login",
          result: "clicked",
          url: currentUrl,
        });
      } else {
        const pressed = await page
          .locator("input[type='password']")
          .first()
          .press("Enter")
          .then(() => true)
          .catch(() => false);
        if (pressed) {
          state.loginSubmitted = true;
          await emitAutoEvent(events, {
            stage: "tiktok_login",
            action: "submit_login_enter",
            result: "pressed_enter",
            url: currentUrl,
          });
        }
      }
    }

    if (
      state.loginSubmitted &&
      canAttemptStep(state, "tiktok_login", "retry_after_submit", 9000, 6)
    ) {
      const stillOnLoginForm = await page
        .evaluate(() => {
          const href = String(window.location?.href || "").toLowerCase();
          const body = String(document.body?.innerText || "").toLowerCase();
          const hasPassword = Boolean(document.querySelector("input[type='password']"));
          const hasIdentifier = Boolean(
            document.querySelector(
              "input[placeholder*='email' i],input[placeholder*='username' i],input[type='email'],input[type='text']",
            ),
          );
          const onKnownLoginUrl =
            href.includes("/account/login") || href.includes("/login/phone-or-email");
          return (onKnownLoginUrl || body.includes("log in")) && hasPassword && hasIdentifier;
        })
        .catch(() => false);

      if (stillOnLoginForm) {
        state.loginSubmitted = false;
        state.loginIdentifierFilled = false;
        state.loginPasswordFilled = false;
        state.loginOtpFilled = false;
        state.loginOtpSubmitted = false;
        await emitAutoEvent(events, {
          stage: "tiktok_login",
          action: "retry_after_submit",
          result: "still_on_login_form_reset_state",
          url: currentUrl,
        });
      }
    }
    return;
  }

  const currentStep = await detectSellerStep(page);
  const urlNow = page.url();
  const isWrongBiztypeBranch =
    /seller-us\.tiktok\.com\/settle\/verification/i.test(urlNow) &&
    /[?&]biztype=1(?:&|$)/i.test(urlNow);
  if (
    isWrongBiztypeBranch &&
    !state.wrongBiztypeBackAttempted &&
    canAttemptStep(state, "wrong_biztype_guard", "back_once", 4500, 1)
  ) {
    const didBack =
      (await safeClick(page.locator("button", { hasText: "Back" }))) ||
      (await fallbackClickButtonByText(page, ["back"]));
    state.wrongBiztypeBackAttempted = true;
    await emitAutoEvent(events, {
      stage: "wrong_biztype_guard",
      action: "force_back_from_biztype_1",
      result: didBack ? "clicked" : "not_found",
      url: urlNow,
    });
    return;
  }

  if (currentStep !== state.stepLastSeen) {
    state.stepLastSeen = currentStep;
    if (currentStep === "otp") {
      state.otpStepEnteredAt = Date.now();
      state.otpWarmupLogged = false;
      state.otpFilled = false;
      state.otpSubmitted = false;
      state.otpCandidateCode = "";
    }
    await emitAutoEvent(events, {
      stage: "step",
      action: "changed",
      step: currentStep,
      url: page.url(),
    });
    await maybeCaptureStepDiagnostics(
      page,
      outputDir,
      events,
      state,
      currentStep,
      "step_changed",
    );
  }

  if (currentStep === "intent_question") {
    if (canAttemptStep(state, currentStep, "choose_seller_intent", 3000, 3)) {
      const picked =
        (await chooseSellerIntentOption(page)) ||
        (await safeClick(page.locator("[data-tid='intent_question'] text=Seller").first())) ||
        (await fallbackClickAnyByText(page, ["seller"]));
      if (picked) {
        await emitAutoEvent(events, {
          stage: "intent_question",
          action: "choose_intent_seller",
          result: "clicked",
          url: page.url(),
        });
      }
    }
    if (canAttemptStep(state, currentStep, "intent_next", 4000, 3)) {
      if (manualGated) {
        await emitAutoEvent(events, {
          stage: "intent_question",
          action: "ready_to_submit_intent",
          result: "manual_required",
          url: page.url(),
        });
        return;
      }
      const nextClicked =
        (await clickEnabledIntentNext(page)) ||
        (await safeClick(page.locator("button", { hasText: "Next" }))) ||
        (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
        (await fallbackClickButtonByText(page, ["next", "continue"]));
      if (nextClicked) {
        await emitAutoEvent(events, {
          stage: "intent_question",
          action: "submit_intent",
          result: "clicked",
          url: page.url(),
        });
      }
    }
    return;
  }

  if (currentStep === "business_type") {
    if (canAttemptStep(state, currentStep, "select_sole_proprietorship", 3000, 4)) {
      const picked =
        (await chooseBusinessTypeForEin(page)) ||
        (await fallbackClickAnyByText(page, ["sole proprietorship"]));
      if (picked) {
        await emitAutoEvent(events, {
          stage: "business_type",
          action: "select_sole_proprietorship",
          result: "clicked",
          url: page.url(),
        });
      }
    }
    if (canAttemptStep(state, currentStep, "business_type_next", 3500, 4)) {
      const soleSelected = await isSoleProprietorshipSelected(page);
      if (!soleSelected) {
        await emitAutoEvent(events, {
          stage: "business_type",
          action: "submit_business_type",
          result: "blocked_not_selected_sole",
          url: page.url(),
        });
        return;
      }
      if (manualGated) {
        await emitAutoEvent(events, {
          stage: "business_type",
          action: "ready_to_submit_business_type",
          result: "manual_required",
          url: page.url(),
        });
        return;
      }
      const nextClicked =
        (await clickEnabledIntentNext(page)) ||
        (await safeClick(page.locator("button", { hasText: "Next" }))) ||
        (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
        (await fallbackClickButtonByText(page, ["next", "continue"]));
      if (nextClicked) {
        await emitAutoEvent(events, {
          stage: "business_type",
          action: "submit_business_type",
          result: "clicked",
          url: page.url(),
        });
      }
    }
    return;
  }

  if (currentStep === "business_details") {
    const hasProofSectionEarly = await page
      .locator("text=Provide proof of business")
      .first()
      .isVisible()
      .catch(() => false);
    if (hasProofSectionEarly) {
      state.businessVerifyDone = true;
      state.businessVerifyInProgress = false;
      state.businessVerifyCompletedAt = Date.now();
      state.businessInfoFilled = true;
    }

    const readEinStatus = async () =>
      page
        .evaluate(() => {
          const countX = (value) =>
            String(value || "")
              .split("")
              .filter((char) => char.toLowerCase() === "x").length;
          const isVisibleInput = (node) =>
            node instanceof HTMLInputElement && node.offsetParent !== null;
          const normalizedPlaceholder = (node) =>
            String(node?.getAttribute("placeholder") || "").trim().toLowerCase();
          const einContainer =
            document.querySelector("[data-tid='entity_info.company_info.company_register_num']") ||
            Array.from(document.querySelectorAll("div,section,form")).find((node) => {
              if (!(node instanceof HTMLElement) || node.offsetParent === null) return false;
              const text = String(node.innerText || node.textContent || "").toLowerCase();
              return text.includes("employer identification number") || text.includes("(ein)");
            }) ||
            document.body;
          const scopedInputs = Array.from(einContainer.querySelectorAll("input")).filter(isVisibleInput);
          const getByPlaceholder = (placeholder) => {
            const target = String(placeholder || "").trim().toLowerCase();
            const candidates = scopedInputs.filter(
              (node) => normalizedPlaceholder(node) === target,
            );
            if (candidates.length === 0) return null;
            candidates.sort((a, b) => {
              const ar = a.getBoundingClientRect();
              const br = b.getBoundingClientRect();
              if (Math.abs(ar.top - br.top) > 2) return ar.top - br.top;
              return ar.left - br.left;
            });
            return candidates[0] || null;
          };
          const first = getByPlaceholder("xx");
          const second = getByPlaceholder("xxxxxxx");
          const secondAlt = getByPlaceholder("xxxxxxxx");
          const secondResolved = second || secondAlt;
          const hasEinInputs = Boolean(first || secondResolved);
          const expectedFirstLen = Math.max(1, countX(first?.getAttribute("placeholder")) || 2);
          const expectedSecondLen = Math.max(
            1,
            countX(secondResolved?.getAttribute("placeholder")) || 7,
          );
          const firstDigits = first ? String(first.value || "").replace(/\D+/g, "") : "";
          const secondDigits = secondResolved
            ? String(secondResolved.value || "").replace(/\D+/g, "")
            : "";
          const errorVisible = Array.from(document.querySelectorAll("div,span,p"))
            .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
            .some((node) => /this field is required|invalid ein|please enter/i.test(String(node.textContent || "")));
          return {
            firstLen: firstDigits.length,
            secondLen: secondDigits.length,
            expectedFirstLen,
            expectedSecondLen,
            hasEinInputs,
            complete:
              hasEinInputs &&
              firstDigits.length === expectedFirstLen &&
              secondDigits.length === expectedSecondLen,
            errorVisible,
          };
        })
        .catch(() => ({
          hasEinInputs: false,
          firstLen: 0,
          secondLen: 0,
          expectedFirstLen: 2,
          expectedSecondLen: 7,
          complete: false,
          errorVisible: false,
        }));

    const verifyCouldNotMessageVisible = await page
      .locator("text=/we couldn't verify your information/i")
      .first()
      .isVisible()
      .catch(() => false);
    if (verifyCouldNotMessageVisible) {
      state.businessVerifyDone = true;
      state.businessVerifyInProgress = false;
      state.businessVerifyCompletedAt = Date.now();
    }

    const topFormStatus = await page
      .evaluate(() => {
        const visibleInputByPlaceholder = (placeholder) => {
          const list = Array.from(document.querySelectorAll("input")).filter(
            (node) =>
              node instanceof HTMLInputElement &&
              String(node.getAttribute("placeholder") || "").trim().toLowerCase() ===
                String(placeholder || "").trim().toLowerCase(),
          );
          return list.find((node) => node.offsetParent !== null) || null;
        };
        const visibleFieldValueByLabel = (labelText) => {
          const target = String(labelText || "").trim().toLowerCase();
          if (!target) return "";
          const blocks = Array.from(document.querySelectorAll("div,section,fieldset,label"));
          for (const block of blocks) {
            if (!(block instanceof HTMLElement) || block.offsetParent === null) continue;
            const text = String(block.innerText || block.textContent || "").toLowerCase();
            if (!text.includes(target)) continue;
            const input =
              block.querySelector("input") ||
              block.parentElement?.querySelector("input") ||
              null;
            if (!(input instanceof HTMLInputElement) || input.offsetParent === null) continue;
            const value = String(input.value || "").trim();
            if (value) return value;
          }
          return "";
        };
        const legal = visibleInputByPlaceholder("Enter the business name");
        const street = visibleInputByPlaceholder("Street address");
        const zip = visibleInputByPlaceholder("ZIP code");
        const cityInput = visibleInputByPlaceholder("City");
        const stateInput = visibleInputByPlaceholder("State");
        const legalValue = String(legal?.value || "").trim();
        const streetValue = String(street?.value || "").trim();
        const zipValue = String(zip?.value || "").replace(/\D+/g, "");
        const cityValue = String(cityInput?.value || "").trim() || visibleFieldValueByLabel("City");
        const stateValue = String(stateInput?.value || "").trim() || visibleFieldValueByLabel("State");
        const hasCityError = Array.from(document.querySelectorAll("div,span,p"))
          .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
          .some((node) => /city is required/i.test(String(node.textContent || "")));
        const hasStateError = Array.from(document.querySelectorAll("div,span,p"))
          .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
          .some((node) => /state is required/i.test(String(node.textContent || "")));
        return {
          legalFilled: legalValue.length > 0,
          streetFilled: streetValue.length > 0,
          zipFilled: zipValue.length === 5,
          cityFilled: cityValue.length > 0 || !hasCityError,
          stateFilled: stateValue.length > 0 || !hasStateError,
          topComplete:
            legalValue.length > 0 &&
            streetValue.length > 0 &&
            zipValue.length === 5 &&
            (cityValue.length > 0 || !hasCityError) &&
            (stateValue.length > 0 || !hasStateError) &&
            !hasCityError &&
            !hasStateError,
          hasCityError,
          hasStateError,
        };
      })
      .catch(() => ({
        legalFilled: false,
        streetFilled: false,
        zipFilled: false,
        cityFilled: false,
        stateFilled: false,
        topComplete: false,
        hasCityError: false,
        hasStateError: false,
      }));

    const runBusinessTopFillPass = async (passLabel) => {
      const playwrightFill = await fillBusinessDetailsWithPlaywright(page, seedContext);
      const genericFill = await fillBusinessDetailsFallbackByDescriptor(page, seedContext);
      const filledCount =
        Number(playwrightFill?.filledCount || 0) +
        Number(genericFill?.filledCount || 0);
      if (filledCount > 0) {
        state.businessInfoFilled = true;
      }
      await emitAutoEvent(events, {
        stage: "business_details",
        action: `fill_business_details_${passLabel}`,
        result: filledCount > 0 ? "filled" : "no_fill_target",
        filledCount,
        selectCount: 0,
        addressOptionChosen:
          Boolean(playwrightFill?.addressOptionChosen) ||
          Boolean(genericFill?.addressOptionChosen),
        stateChosen: Boolean(playwrightFill?.stateChosen) || Boolean(genericFill?.stateChosen),
        url: page.url(),
      });
    };

    if (
      !hasProofSectionEarly &&
      (
        (!state.businessInfoFilled &&
          canAttemptStep(state, currentStep, "fill_business_details_pass_1", 2200, 30)) ||
        (!state.businessVerifyDone &&
          canAttemptStep(state, currentStep, "refill_business_details_before_verify_pass_1", 6000, 30))
      )
    ) {
      await runBusinessTopFillPass("pass_1");
    }

    if (topFormStatus.topComplete) {
      state.businessInfoFilled = true;
    }
    if (!hasProofSectionEarly && !topFormStatus.topComplete && !state.businessVerifyDone) {
      if (canAttemptStep(state, currentStep, "fill_business_details_pass_2", 2200, 30)) {
        await runBusinessTopFillPass("pass_2");
      }
      state.businessInfoFilled = false;
      state.businessVerifyDone = false;
      state.businessVerifyInProgress = false;
      state.businessVerifyClickedAt = 0;
      if (canAttemptStep(state, currentStep, "wait_refill_business_top_fields", 2500, 30)) {
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "wait_refill_business_top_fields",
          result: "required_before_verify",
          legalFilled: Boolean(topFormStatus.legalFilled),
          streetFilled: Boolean(topFormStatus.streetFilled),
          zipFilled: Boolean(topFormStatus.zipFilled),
          cityFilled: Boolean(topFormStatus.cityFilled),
          stateFilled: Boolean(topFormStatus.stateFilled),
          hasCityRequiredError: Boolean(topFormStatus.hasCityError),
          hasStateRequiredError: Boolean(topFormStatus.hasStateError),
          url: page.url(),
        });
      }
      await maybeCaptureStepDiagnostics(
        page,
        outputDir,
        events,
        state,
        currentStep,
        "wait_refill_business_top_fields",
      );
      return;
    }

    const verifyButton = page.locator("button", { hasText: "Verify business details" }).first();
    const verifyVisible = await verifyButton.isVisible().catch(() => false);
    if (!hasProofSectionEarly && verifyVisible && !state.businessVerifyDone) {
      if (state.businessVerifyClickedAt > 0) {
        const elapsed = Date.now() - state.businessVerifyClickedAt;
        const busy = await page
          .locator(
            "button:has-text('Verify business details') .theme-arco-icon-loading, button:has-text('Verify business details') .arco-btn-loading",
          )
          .first()
          .isVisible()
          .catch(() => false);
        const disabled = await verifyButton.isDisabled().catch(() => false);
        const isWorking = busy || disabled;
        if (isWorking && elapsed < 45000) {
          state.businessVerifyInProgress = true;
          if (canAttemptStep(state, currentStep, "wait_verify_business_details", 2500, 20)) {
            await emitAutoEvent(events, {
              stage: "business_details",
              action: "wait_verify_business_details",
              result: "in_progress",
              elapsedMs: elapsed,
              url: page.url(),
            });
          }
          await maybeCaptureStepDiagnostics(
            page,
            outputDir,
            events,
            state,
            currentStep,
            "wait_verify_business_details",
          );
          return;
        }
        if (!state.businessVerifyInProgress && elapsed < 7000) {
          if (canAttemptStep(state, currentStep, "wait_verify_business_details_start", 2000, 6)) {
            await emitAutoEvent(events, {
              stage: "business_details",
              action: "wait_verify_business_details_start",
              result: "waiting_start",
              elapsedMs: elapsed,
              url: page.url(),
            });
          }
          return;
        }
        state.businessVerifyDone = true;
        state.businessVerifyInProgress = false;
        state.businessVerifyCompletedAt = Date.now();
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "verify_business_details",
          result: isWorking ? "timeout_continue" : "completed_or_idle",
          elapsedMs: elapsed,
          url: page.url(),
        });
        return;
      } else if (canAttemptStep(state, currentStep, "verify_business_details", 5000, 12)) {
        if (manualGated) {
          await emitAutoEvent(events, {
            stage: "business_details",
            action: "ready_to_verify_business_details",
            result: "manual_required",
            url: page.url(),
          });
        } else {
          const verifyClicked = await safeClick(verifyButton);
          if (verifyClicked) {
            state.businessVerifyClickedAt = Date.now();
            state.businessVerifyInProgress = false;
          }
          await emitAutoEvent(events, {
            stage: "business_details",
            action: "verify_business_details",
            result: verifyClicked ? "clicked" : "button_disabled_or_not_found",
            url: page.url(),
          });
        }
        return;
      }
    } else if (!verifyVisible) {
      // Do not mark verify done just because the button is currently not visible.
      // Only transition to done when proof section is visible.
      if (hasProofSectionEarly) {
        state.businessVerifyDone = true;
        state.businessVerifyInProgress = false;
        state.businessVerifyCompletedAt = Date.now();
      }
    }

    let einStatus = await readEinStatus();
    if (einStatus.complete) {
      state.einStablePasses = Math.min(Number(state.einStablePasses || 0) + 1, 10);
      state.einFieldsFilled = true;
    } else {
      state.einStablePasses = 0;
    }
    const einExpectedFirst = Number(einStatus.expectedFirstLen || 2);
    const einExpectedSecond = Number(einStatus.expectedSecondLen || 7);
    const einInvalidFirst = Number(einStatus.firstLen || 0) !== einExpectedFirst;
    const einInvalidSecond = Number(einStatus.secondLen || 0) !== einExpectedSecond;
    const shouldAttemptEinFill = !einStatus.complete && (einInvalidFirst || einInvalidSecond);
    const sinceLastEinFill = Date.now() - Number(state.einLastFillAt || 0);
    if (
      shouldAttemptEinFill &&
      sinceLastEinFill >= 7000 &&
      canAttemptStep(state, currentStep, "fill_post_verify_fields", 2500, 80)
    ) {
      const extra = await fillVisibleEinFormFields(page, seedContext);
      if (Number(extra?.filledCount || 0) > 0) {
        state.einLastFillAt = Date.now();
      }
      einStatus = await readEinStatus();
      state.einFieldsFilled = Boolean(einStatus.complete);
      await emitAutoEvent(events, {
        stage: "business_details",
        action: "fill_post_verify_fields",
        result:
          Number(extra?.filledCount || 0) > 0
            ? einStatus.complete
              ? "filled_complete"
              : "filled_partial"
            : "no_fill_target",
        filledCount: Number(extra?.filledCount || 0),
        einFirstLen: Number(einStatus.firstLen || 0),
        einSecondLen: Number(einStatus.secondLen || 0),
        einComplete: Boolean(einStatus.complete),
        url: page.url(),
      });
    } else if (shouldAttemptEinFill && sinceLastEinFill < 7000) {
      if (canAttemptStep(state, currentStep, "wait_ein_settle", 2000, 60)) {
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "wait_ein_settle",
          result: "cooldown_after_fill",
          sinceLastEinFill,
          einFirstLen: Number(einStatus.firstLen || 0),
          einSecondLen: Number(einStatus.secondLen || 0),
          url: page.url(),
        });
      }
      return;
    }

    const hasProofSection = await page
      .locator("text=Provide proof of business")
      .first()
      .isVisible()
      .catch(() => false);
    const uploadCounterText = await page
      .locator("text=/\\([0-3]\\/3\\)/")
      .first()
      .textContent()
      .catch(() => "");
    const uploadedMatch = String(uploadCounterText || "").match(/\(([0-3])\/3\)/);
    const uploadedCount = uploadedMatch ? Number(uploadedMatch[1] || 0) : 0;
    const hasUploadedProof =
      uploadedCount > 0 ||
      (await page
        .locator(
          "text=/uploaded|upload successful|remove file|replace file|delete file|file uploaded/i",
        )
        .first()
        .isVisible()
        .catch(() => false));
    if (hasUploadedProof) {
      state.businessDocumentUploaded = true;
    }

    if (
      hasProofSection &&
      !state.businessDocumentUploaded &&
      !state.businessDocumentUploadAttempted &&
      uploadedCount === 0 &&
      canAttemptStep(state, currentStep, "upload_document", 4500, 12)
    ) {
      state.businessDocumentUploadAttempted = true;
      const upload = await uploadSupportingDocument(page, seedContext.documentPath || seedContext.file || "");
      if (upload.uploaded) {
        state.businessDocumentUploaded = true;
      }
      await emitAutoEvent(events, {
        stage: "business_details",
        action: "upload_supporting_document",
        result: upload.reason,
        uploaded: upload.uploaded,
        documentPath: seedContext.documentPath || "",
        url: page.url(),
      });
    }

    if (hasProofSection && !state.businessDocumentUploaded) {
      if (canAttemptStep(state, currentStep, "wait_business_document_upload", 2500, 30)) {
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "wait_business_document_upload",
          result: state.businessDocumentUploadAttempted
            ? "required_before_next_upload_attempted_once"
            : "required_before_next",
          uploadAttempted: Boolean(state.businessDocumentUploadAttempted),
          uploadCounterText: String(uploadCounterText || ""),
          url: page.url(),
        });
      }
      await maybeCaptureStepDiagnostics(
        page,
        outputDir,
        events,
        state,
        currentStep,
        "wait_business_document_upload",
      );
      return;
    }

    einStatus = await readEinStatus();
    if (!einStatus.complete || einStatus.errorVisible) {
      if (canAttemptStep(state, currentStep, "wait_ein_complete", 2500, 40)) {
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "wait_ein_complete",
          result: "required_before_next",
          firstLen: Number(einStatus.firstLen || 0),
          secondLen: Number(einStatus.secondLen || 0),
          expectedFirstLen: Number(einStatus.expectedFirstLen || 2),
          expectedSecondLen: Number(einStatus.expectedSecondLen || 7),
          errorVisible: Boolean(einStatus.errorVisible),
          hasEinInputs: Boolean(einStatus.hasEinInputs),
          url: page.url(),
        });
      }
      await maybeCaptureStepDiagnostics(
        page,
        outputDir,
        events,
        state,
        currentStep,
        "wait_ein_complete",
      );
      return;
    }

    const readyToSubmitBusinessDetails =
      hasProofSection
        ? Boolean(state.businessDocumentUploaded) && Boolean(einStatus.complete)
        : Boolean(state.businessVerifyDone) && Boolean(einStatus.complete);
    if (
      canAttemptStep(state, currentStep, "ready_to_submit_business_details", 1500, 30) &&
      readyToSubmitBusinessDetails
    ) {
      if (!hasProofSection || !state.businessDocumentUploaded || !einStatus.complete) {
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "ready_to_submit_business_details",
          result: "blocked_missing_proof_or_ein",
          hasProofSection: Boolean(hasProofSection),
          businessDocumentUploaded: Boolean(state.businessDocumentUploaded),
          einComplete: Boolean(einStatus.complete),
          url: page.url(),
        });
        return;
      }
      if (manualGated) {
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "ready_to_submit_business_details",
          result: "manual_required",
          url: page.url(),
        });
      } else {
        const clicked =
          (await safeClick(page.locator("button", { hasText: "Next" }))) ||
          (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
          (await fallbackClickButtonByText(page, ["next", "continue"]));
        await emitAutoEvent(events, {
          stage: "business_details",
          action: "submit_business_details",
          result: clicked ? "clicked" : "submit_disabled_or_not_found",
          url: page.url(),
        });
      }
    }
    return;
  }

  if (
    currentStep === "unknown" &&
    /seller-us\.tiktok\.com\/settle\/verification/i.test(page.url())
  ) {
    if (!state.businessInfoFilled && canAttemptStep(state, "unknown_verification", "fill_business_details_fallback", 3000, 10)) {
      const playwrightFill = await fillBusinessDetailsWithPlaywright(page, seedContext);
      const genericFill = await fillBusinessDetailsFallbackByDescriptor(page, seedContext);
      const extra = await fillVisibleEinFormFields(page, seedContext);
      const filledCount =
        Number(playwrightFill?.filledCount || 0) +
        Number(genericFill?.filledCount || 0) +
        Number(extra?.filledCount || 0);
      if (filledCount > 0) {
        state.businessInfoFilled = true;
      }
      await emitAutoEvent(events, {
        stage: "business_details",
        action: "fill_business_details_fallback",
        result: filledCount > 0 ? "filled" : "no_fill_target",
        filledCount,
        selectCount: 0,
        addressOptionChosen:
          Boolean(playwrightFill?.addressOptionChosen) ||
          Boolean(genericFill?.addressOptionChosen),
        stateChosen: Boolean(playwrightFill?.stateChosen) || Boolean(genericFill?.stateChosen),
        url: page.url(),
      });
    }
    return;
  }

  if (currentStep === "primary_representative") {
    // Phase 1: Fill fields — run up to 5 times with a 2.5s cooldown between attempts.
    if (canAttemptStep(state, currentStep, "fill_primary_representative", 2500, 5)) {
      const playwrightFill = await fillPrimaryRepresentativeStep(page, seedContext);
      const repStatus = await readPrimaryRepresentativeStatus(page);
      await emitAutoEvent(events, {
        stage: "primary_representative",
        action: "fill_primary_representative",
        result: Number(playwrightFill?.filledCount || 0) > 0 ? "filled" : "no_fill_target",
        filledCount: Number(playwrightFill?.filledCount || 0),
        uboYes: Boolean(playwrightFill?.uboYes),
        hasRequiredError: Boolean(repStatus?.hasErrorText),
        formReady: Boolean(repStatus?.ready),
        firstNameOk: Boolean(repStatus?.firstNameOk),
        lastNameOk: Boolean(repStatus?.lastNameOk),
        ssnOk: Boolean(repStatus?.ssnOk),
        dobOk: Boolean(repStatus?.monthOk && repStatus?.dayOk && repStatus?.yearOk),
        addressOk: Boolean(repStatus?.streetOk && repStatus?.cityOk && repStatus?.stateOk && repStatus?.zipOk),
        regionOk: Boolean(repStatus?.regionOk),
        uboOk: Boolean(repStatus?.uboOk),
        url: page.url(),
      });
    }
    // Phase 2: Check status and submit — runs every 600ms, unlimited times until step changes.
    // This fires rapidly so we never sit idle after the form becomes valid.
    if (canAttemptStep(state, currentStep, "submit_primary_representative", 600, 9999)) {
      const repStatus = await readPrimaryRepresentativeStatus(page);
      if (!repStatus?.ready) {
        // Form not ready yet — emit a compact status event (rate-limited to avoid log spam).
        if (canAttemptStep(state, currentStep, "log_primary_rep_wait", 4000, 9999)) {
          await emitAutoEvent(events, {
            stage: "primary_representative",
            action: "submit_primary_representative",
            result: "blocked_invalid_or_incomplete",
            firstNameOk: Boolean(repStatus?.firstNameOk),
            lastNameOk: Boolean(repStatus?.lastNameOk),
            monthOk: Boolean(repStatus?.monthOk),
            dayOk: Boolean(repStatus?.dayOk),
            yearOk: Boolean(repStatus?.yearOk),
            streetOk: Boolean(repStatus?.streetOk),
            cityOk: Boolean(repStatus?.cityOk),
            stateOk: Boolean(repStatus?.stateOk),
            zipOk: Boolean(repStatus?.zipOk),
            ssnOk: Boolean(repStatus?.ssnOk),
            regionOk: Boolean(repStatus?.regionOk),
            uboOk: Boolean(repStatus?.uboOk),
            hasErrorText: Boolean(repStatus?.hasErrorText),
            url: page.url(),
          });
          await maybeCaptureStepDiagnostics(
            page,
            outputDir,
            events,
            state,
            currentStep,
            "wait_primary_representative_complete",
          );
        }
        return;
      }
      if (manualGated) {
        await emitAutoEvent(events, {
          stage: "primary_representative",
          action: "ready_to_submit_primary_representative",
          result: "manual_required",
          url: page.url(),
        });
      } else {
        const clicked =
          (await safeClick(page.locator("button", { hasText: "Next" }))) ||
          (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
          (await fallbackClickButtonByText(page, ["next", "continue"]));
        await emitAutoEvent(events, {
          stage: "primary_representative",
          action: "submit_primary_representative",
          result: clicked ? "clicked" : "submit_disabled_or_not_found",
          url: page.url(),
        });
      }
    }
    return;
  }

  if (currentStep === "shop_information") {
    const signupContactMode =
      preferredContactMode === "phone" || preferredContactMode === "email"
        ? preferredContactMode
        : seedContext.email
          ? "email"
          : "phone";
    const requiredContactType = signupContactMode === "email" ? "phone" : "email";
    const requiredContactValue =
      requiredContactType === "phone"
        ? String(seedContext.phone || "").trim()
        : String(seedContext.email || "").trim();
    const requiredOtpEndpoint =
      requiredContactType === "phone"
        ? String(seedContext.phoneApiEndpoint || seedContext.apiPhone || "").trim()
        : String(seedContext.emailApiEndpoint || seedContext.apiMail || "").trim();
    state.shopContactType = requiredContactType;

    if (canAttemptStep(state, currentStep, "fill_shop_information", 3000, 10)) {
      const info = await fillShopInformationStep(page, seedContext);
      const status = await readShopInformationStatus(page);
      const contactStatus = await readShopContactVerificationStatus(page, requiredContactType);
      state.shopContactVerified = Boolean(contactStatus?.verified);
      await emitAutoEvent(events, {
        stage: "shop_information",
        action: "fill_shop_information",
        result: Number(info?.filledCount || 0) > 0 || Boolean(info?.productChosen) ? "filled" : "no_fill_target",
        filledCount: Number(info?.filledCount || 0),
        productChosen: Boolean(info?.productChosen),
        formReady: Boolean(status?.ready),
        shopOk: Boolean(status?.shopOk),
        emailOk: Boolean(status?.emailOk),
        phoneOk: Boolean(status?.phoneOk),
        productOk: Boolean(status?.productOk),
        hasErrorText: Boolean(status?.hasErrorText),
        shopNameIssue: String(status?.shopNameIssue || ""),
        requiredContactType,
        contactVerified: Boolean(contactStatus?.verified),
        url: page.url(),
      });
    }

    const statusBeforeSubmit = await readShopInformationStatus(page);
    const contactStatus = await readShopContactVerificationStatus(page, requiredContactType);
    state.shopContactVerified = Boolean(contactStatus?.verified);

    if (
      String(statusBeforeSubmit?.shopNameIssue || "").trim() &&
      canAttemptStep(state, currentStep, "retry_shop_name", 2500, 8)
    ) {
      const rename = await setAlternateShopName(page, seedContext, state);
      await emitAutoEvent(events, {
        stage: "shop_information",
        action: "retry_shop_name",
        result: rename.changed ? "renamed" : "rename_failed",
        shopNameIssue: String(statusBeforeSubmit?.shopNameIssue || ""),
        candidate: String(rename.value || ""),
        url: page.url(),
      });
      return;
    }

    if (!requiredContactValue && canAttemptStep(state, currentStep, "wait_required_contact_value", 3500, 80)) {
      await emitAutoEvent(events, {
        stage: "shop_information",
        action: "wait_required_contact_value",
        result: "missing_contact_seed",
        requiredContactType,
        url: page.url(),
      });
      return;
    }

    if (!contactStatus?.verified) {
      if (
        contactStatus?.canUseAnother &&
        !contactStatus?.usingAnother &&
        canAttemptStep(state, currentStep, "switch_contact_use_another", 2200, 8)
      ) {
        const switched = await clickShopContactAction(page, requiredContactType, "switch_use_another");
        await emitAutoEvent(events, {
          stage: "shop_information",
          action: "switch_contact_use_another",
          result: switched ? "clicked" : "not_found",
          requiredContactType,
          url: page.url(),
        });
        return;
      }

      const currentContactValue = String(contactStatus?.contactValue || "").trim();
      const placeholderValue = String(contactStatus?.placeholder || "").trim();
      const shouldFillContact =
        !currentContactValue ||
        (placeholderValue &&
          normalizeSimpleText(currentContactValue) === normalizeSimpleText(placeholderValue)) ||
        (requiredContactType === "email"
          ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentContactValue)
          : normalizeDigitsOnly(currentContactValue).length < 7);
      if (
        shouldFillContact &&
        canAttemptStep(state, currentStep, "fill_required_contact", 2200, 12)
      ) {
        const filled = await fillShopContactValue(page, requiredContactType, requiredContactValue);
        await emitAutoEvent(events, {
          stage: "shop_information",
          action: "fill_required_contact",
          result: filled ? "filled" : "no_fill_target",
          requiredContactType,
          contactPreview:
            requiredContactType === "email"
              ? `${requiredContactValue.slice(0, 2)}***`
              : `${normalizeDigitsOnly(requiredContactValue).slice(0, 3)}***`,
          url: page.url(),
        });
        return;
      }

      if (contactStatus?.canRequestCode && canAttemptStep(state, currentStep, "request_contact_code", 5000, 12)) {
        const requested = await clickShopContactAction(page, requiredContactType, "request_code");
        if (requested) {
          state.shopContactCodeRequestedAt = Date.now();
        }
        await emitAutoEvent(events, {
          stage: "shop_information",
          action: "request_contact_code",
          result: requested ? "clicked" : "not_found_or_disabled",
          requiredContactType,
          url: page.url(),
        });
        return;
      }

      if (contactStatus?.codeInputVisible) {
        const otpWarmupMs = 12000;
        const sinceRequested = state.shopContactCodeRequestedAt
          ? Date.now() - state.shopContactCodeRequestedAt
          : otpWarmupMs;
        if (sinceRequested < otpWarmupMs) {
          if (canAttemptStep(state, currentStep, "wait_contact_code", 2500, 50)) {
            await emitAutoEvent(events, {
              stage: "shop_information",
              action: "wait_contact_code",
              result: "waiting_fresh_otp",
              requiredContactType,
              waitMs: otpWarmupMs - sinceRequested,
              url: page.url(),
            });
          }
          return;
        }

        if (canAttemptStep(state, currentStep, "fill_contact_otp", 3500, 20)) {
          const otpCode = await fetchOtpCode(requiredOtpEndpoint);
          await emitAutoEvent(events, {
            stage: "shop_information",
            action: "fetch_contact_otp",
            result: otpCode ? "received" : "empty",
            requiredContactType,
            endpoint: requiredOtpEndpoint ? requiredOtpEndpoint.slice(0, 120) : "",
            codePreview: otpCode ? `${String(otpCode).slice(0, 2)}**` : "",
            url: page.url(),
          });
          if (otpCode) {
            const filled = await fillOtpInputs(page, otpCode);
            if (filled) {
              state.shopContactOtpLastSubmittedCode = String(otpCode).replace(/\D+/g, "");
            }
            await emitAutoEvent(events, {
              stage: "shop_information",
              action: "fill_contact_otp",
              result: filled ? "filled" : "input_not_found",
              requiredContactType,
              url: page.url(),
            });
          }
        }

        if (canAttemptStep(state, currentStep, "submit_contact_otp", 5000, 20)) {
          const submitted =
            (await clickShopContactAction(page, requiredContactType, "submit_code")) ||
            (await fallbackClickButtonByText(page, ["verify", "confirm", "continue"]));
          await emitAutoEvent(events, {
            stage: "shop_information",
            action: "submit_contact_otp",
            result: submitted ? "clicked" : "submit_not_found",
            requiredContactType,
            url: page.url(),
          });
        }
        return;
      }

      if (canAttemptStep(state, currentStep, "wait_contact_verification", 2500, 60)) {
        await emitAutoEvent(events, {
          stage: "shop_information",
          action: "wait_contact_verification",
          result: "required_before_next",
          requiredContactType,
          sectionFound: Boolean(contactStatus?.sectionFound),
          usingAnother: Boolean(contactStatus?.usingAnother),
          canRequestCode: Boolean(contactStatus?.canRequestCode),
          codeInputVisible: Boolean(contactStatus?.codeInputVisible),
          url: page.url(),
        });
      }
      return;
    }

    if (canAttemptStep(state, currentStep, "submit_shop_information", 4500, 8)) {
      const status = await readShopInformationStatus(page);
      if (!status?.ready || !state.shopContactVerified) {
        if (canAttemptStep(state, currentStep, "wait_shop_information_complete", 3000, 40)) {
          await emitAutoEvent(events, {
            stage: "shop_information",
            action: "submit_shop_information",
            result: "blocked_invalid_or_incomplete",
            shopOk: Boolean(status?.shopOk),
            emailOk: Boolean(status?.emailOk),
            phoneOk: Boolean(status?.phoneOk),
            productOk: Boolean(status?.productOk),
            hasErrorText: Boolean(status?.hasErrorText),
            shopNameIssue: String(status?.shopNameIssue || ""),
            requiredContactType,
            contactVerified: Boolean(state.shopContactVerified),
            url: page.url(),
          });
          await maybeCaptureStepDiagnostics(
            page,
            outputDir,
            events,
            state,
            currentStep,
            "wait_shop_information_complete",
          );
        }
        return;
      }
      if (manualGated) {
        await emitAutoEvent(events, {
          stage: "shop_information",
          action: "ready_to_submit_shop_information",
          result: "manual_required",
          url: page.url(),
        });
      } else {
        const clicked =
          (await safeClick(page.locator("button", { hasText: "Next" }))) ||
          (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
          (await fallbackClickButtonByText(page, ["next", "continue"]));
        await emitAutoEvent(events, {
          stage: "shop_information",
          action: "submit_shop_information",
          result: clicked ? "clicked" : "submit_disabled_or_not_found",
          url: page.url(),
        });
      }
    }
    return;
  }

  if (currentStep === "review_application") {
    const reviewStatus = await readReviewApplicationStatus(page);
    if (reviewStatus.hasUnderReview) {
      await emitAutoEvent(events, {
        stage: "review_application",
        action: "review_status",
        result: "under_review",
        url: page.url(),
      });
      return;
    }
    if (reviewStatus.hasInformationRequired) {
      await emitAutoEvent(events, {
        stage: "review_application",
        action: "review_status",
        result: "information_required",
        url: page.url(),
      });
      return;
    }
    if (reviewStatus.hasApplicationRejected) {
      await emitAutoEvent(events, {
        stage: "review_application",
        action: "review_status",
        result: "application_rejected",
        url: page.url(),
      });
      return;
    }

    if (reviewStatus.requiredUnchecked > 0 && canAttemptStep(state, currentStep, "accept_review_checkboxes", 3000, 8)) {
      await page
        .evaluate(() => {
          const visible = (node) => node instanceof HTMLElement && node.offsetParent !== null;
          const boxes = Array.from(document.querySelectorAll("input[type='checkbox']"))
            .filter((node) => node instanceof HTMLInputElement && visible(node) && !node.checked);
          for (const box of boxes) {
            const container = box.closest("label,div,section,fieldset") || box.parentElement;
            const line = String(container?.textContent || "").toLowerCase();
            if (
              line.includes("i confirm") ||
              line.includes("i agree") ||
              line.includes("information on this page is true") ||
              line.includes("accurate")
            ) {
              box.click();
              box.checked = true;
              box.dispatchEvent(new Event("input", { bubbles: true }));
              box.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        })
        .catch(() => {});
      await emitAutoEvent(events, {
        stage: "review_application",
        action: "accept_review_checkboxes",
        result: "attempted",
        requiredUnchecked: Number(reviewStatus.requiredUnchecked || 0),
        url: page.url(),
      });
      return;
    }

    if (manualGated) {
      await emitAutoEvent(events, {
        stage: "review_application",
        action: "ready_to_submit_review_application",
        result: reviewStatus.readyToSubmit ? "manual_required" : "waiting_review_ready",
        requiredUnchecked: Number(reviewStatus.requiredUnchecked || 0),
        submitEnabled: Boolean(reviewStatus.submitEnabled),
        url: page.url(),
      });
      return;
    }

    if (reviewStatus.readyToSubmit && canAttemptStep(state, currentStep, "submit_review_application", 5000, 6)) {
      const clicked =
        (await safeClick(page.locator("button", { hasText: "Submit application" }))) ||
        (await safeClick(page.locator("button", { hasText: "Submit" }))) ||
        (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
        (await safeClick(page.locator("button", { hasText: "Next" }))) ||
        (await fallbackClickButtonByText(page, ["submit application", "submit", "continue", "next"]));
      await emitAutoEvent(events, {
        stage: "review_application",
        action: "submit_review_application",
        result: clicked ? "clicked" : "submit_disabled_or_not_found",
        url: page.url(),
      });
      return;
    }

    await emitAutoEvent(events, {
      stage: "review_application",
      action: "reached_review_application",
      result: "waiting_ready",
      requiredUnchecked: Number(reviewStatus.requiredUnchecked || 0),
      submitEnabled: Boolean(reviewStatus.submitEnabled),
      url: page.url(),
    });
    return;
  }

  // Cookie banners should not block form actions.
  if (canAttempt(state, "cookie_banner", 5000)) {
    const cookieButtons = [
      page.locator("button", { hasText: "Allow all" }),
      page.locator("button", { hasText: "Decline optional cookies" }),
      page.locator("button", { hasText: "Accept all" }),
      page.locator("button", { hasText: "Accept" }),
    ];
    for (const button of cookieButtons) {
      if ((await safeCount(button)) > 0) {
        const clicked = await safeClick(button);
        if (clicked) {
          await emitAutoEvent(events, {
            stage: "cookie_banner",
            action: "click",
            result: "clicked",
            url: page.url(),
          });
          break;
        }
      }
    }
  }

  // Country pre-confirm modal on first entry.
  if (isSellerRegister && canAttempt(state, "country_confirm", 2500)) {
    const isCountryModalVisible = await page
      .locator("[data-uid*='confirmmarketmodal'], .theme-arco-modal-wrapper")
      .first()
      .isVisible()
      .catch(() => false);
    if (!isCountryModalVisible) {
      // No modal shown, skip country-confirm logic to avoid misclick loops.
    } else {
    let didConfirm = false;
    const confirmButtons = [
      page.locator("button", { hasText: "Confirm" }),
      page.locator("button[data-e2e='country-confirm-btn']"),
    ];
    for (const button of confirmButtons) {
      if ((await safeCount(button)) === 0) continue;
      const clicked = await safeClickVisible(button);
      if (clicked) {
        didConfirm = true;
        await emitAutoEvent(events, {
          stage: "country_select",
          action: "confirm_country",
          result: "clicked",
          url: page.url(),
        });
        break;
      }
    }
    const clickedFallback = !didConfirm
      ? await fallbackClickButtonByText(page, ["confirm"])
      : false;
    if (clickedFallback) {
      didConfirm = true;
      await emitAutoEvent(events, {
        stage: "country_select",
        action: "confirm_country_fallback",
        result: "clicked",
        url: page.url(),
      });
    }
    }
  }

  // Step 1: account register input.
  const preferredContactMode = resolvePreferredContactMode();
  if (currentStep === "register" && entryMode === "tiktok_existing") {
    if (manualGated) {
      await emitAutoEvent(events, {
        stage: "register_entry",
        action: "ready_to_login_existing_tiktok",
        result: "manual_required",
        url: page.url(),
      });
      return;
    }
    if (canAttemptStep(state, currentStep, "continue_with_tiktok", 6000, 2)) {
      const clicked =
        (await safeClick(page.locator("button", { hasText: "Continue with TikTok" }))) ||
        (await fallbackClickButtonByText(page, ["continue with tiktok"]));
      if (clicked) {
        await emitAutoEvent(events, {
          stage: "register_entry",
          action: "continue_with_tiktok",
          result: "clicked",
          url: page.url(),
        });
      }
    }
    return;
  }
  const contactValue =
    preferredContactMode === "phone" ? seedContext.phone : seedContext.email;
  if (
    currentStep === "register" &&
    !state.registerSubmitted &&
    contactValue &&
    canAttempt(state, "register_contact", 2500)
  ) {
    const contactInputs = [
      page.locator("#phone_email_input"),
      page.locator("#phone_email"),
      page.locator("input[placeholder*='phone number or email' i]"),
      page.locator("input[type='email']"),
      page.locator("input[type='tel']"),
    ];
    for (const input of contactInputs) {
      if ((await safeCount(input)) > 0) {
        const done = await safeFill(input, contactValue);
        if (done) {
          state.recordedContact = true;
          await emitAutoEvent(events, {
            stage: "register_entry",
            action: "fill_contact",
            valueType: preferredContactMode || (seedContext.email ? "email" : "phone"),
            result: "filled",
            url: page.url(),
          });
          break;
        }
      }
    }
    if (!state.recordedContact) {
      const fallbackFilled = await fallbackFillContact(page, contactValue);
      if (fallbackFilled) {
        state.recordedContact = true;
        await emitAutoEvent(events, {
          stage: "register_entry",
          action: "fill_contact_fallback",
          valueType: preferredContactMode || (seedContext.email ? "email" : "phone"),
          result: "filled",
          url: page.url(),
        });
      }
    }
  }

  if (
    currentStep === "register" &&
    !state.registerSubmitted &&
    state.recordedContact &&
    canAttemptStep(state, currentStep, "register_continue", 4500, 2)
  ) {
    if (manualGated) {
      await emitAutoEvent(events, {
        stage: "register_entry",
        action: "ready_to_submit_register",
        result: "manual_required",
        url: page.url(),
      });
      return;
    }
    const continueButtons = [
      page.locator("#signupformwithoutttsprimary\\:redbutton\\:535a4"),
      page.locator("button", { hasText: "Continue" }),
    ];
    let didSubmit = false;
    for (const button of continueButtons) {
      if ((await safeCount(button)) > 0) {
        const clicked = await safeClick(button);
        if (clicked) {
          didSubmit = true;
          state.continueClicks += 1;
          state.registerSubmitted = true;
          await emitAutoEvent(events, {
            stage: "register_entry",
            action: "click_continue",
            result: "clicked",
            clickCount: state.continueClicks,
            url: page.url(),
          });
          break;
        }
      }
    }
    const clickedFallback = !didSubmit
      ? await fallbackClickButtonByText(page, ["continue"])
      : false;
    if (clickedFallback) {
      state.continueClicks += 1;
      state.registerSubmitted = true;
      await emitAutoEvent(events, {
        stage: "register_entry",
        action: "click_continue_fallback",
        result: "clicked",
        clickCount: state.continueClicks,
        url: page.url(),
      });
    }
  }

  // Step 2: OTP best-effort fill from phone API endpoint.
  if (currentStep === "otp" && !state.otpFilled && canAttempt(state, "otp_fill", 4000)) {
    const otpWarmupMs = 12000;
    const sinceEntered = state.otpStepEnteredAt ? Date.now() - state.otpStepEnteredAt : otpWarmupMs;
    if (sinceEntered < otpWarmupMs) {
      if (!state.otpWarmupLogged || canAttempt(state, "otp_warmup_log", 3000)) {
        state.otpWarmupLogged = true;
        await emitAutoEvent(events, {
          stage: "otp",
          action: "wait_fresh_otp",
          result: "warming_up",
          waitMs: otpWarmupMs - sinceEntered,
          url: page.url(),
        });
      }
      return;
    }
    const otpEndpoint =
      preferredContactMode === "phone"
        ? seedContext.phoneApiEndpoint || seedContext.apiPhone
        : seedContext.emailApiEndpoint || seedContext.apiMail;
    const otpCode = await fetchOtpCode(otpEndpoint);
    await emitAutoEvent(events, {
      stage: "otp",
      action: "fetch_otp",
      result: otpCode ? "received" : "empty",
      source: preferredContactMode,
      endpoint: otpEndpoint ? String(otpEndpoint).slice(0, 120) : "",
      codePreview: otpCode ? `${String(otpCode).slice(0, 2)}**` : "",
      url: page.url(),
    });
    if (otpCode) {
      const normalizedOtpCode = String(otpCode || "").replace(/[^\d]/g, "");
      if (normalizedOtpCode && normalizedOtpCode === state.otpLastSubmittedCode) {
        const hasOtpError = await page
          .locator("text=/verification code is expired|incorrect|invalid|try again/i")
          .first()
          .isVisible()
          .catch(() => false);
        if (hasOtpError && canAttemptStep(state, currentStep, "otp_resend_on_stale", 3000, 20)) {
          const clickedResend = await fallbackClickButtonByText(page, [
            "resend the code",
            "resend code",
            "send code again",
          ]);
          if (clickedResend) {
            state.otpLastSubmittedCode = "";
            await emitAutoEvent(events, {
              stage: "otp",
              action: "resend_after_stale_code",
              result: "resend_clicked",
              url: page.url(),
            });
          }
        }
        await emitAutoEvent(events, {
          stage: "otp",
          action: "skip_stale_otp",
          result: hasOtpError ? "same_as_last_submitted_with_error" : "same_as_last_submitted",
          codePreview: `${normalizedOtpCode.slice(0, 2)}**`,
          url: page.url(),
        });
        return;
      }
      const filled = await fillOtpInputs(page, otpCode);
      if (filled) {
        state.otpAttempted = true;
        state.otpFilled = true;
        state.otpCandidateCode = normalizedOtpCode;
        await emitAutoEvent(events, {
          stage: "otp",
          action: "fill_otp",
          result: "filled",
          url: page.url(),
        });
      }
    }
  }

  if (
    currentStep === "otp" &&
    !state.otpSubmitted &&
    state.otpFilled &&
    canAttemptStep(state, currentStep, "otp_continue", 4500, 2)
  ) {
    if (manualGated) {
      await emitAutoEvent(events, {
        stage: "otp",
        action: "ready_to_submit_otp",
        result: "manual_required",
        url: page.url(),
      });
      return;
    }
    const otpButtons = [
      page.locator("button", { hasText: "Verify" }),
      page.locator("button", { hasText: "Submit" }),
      page.locator("button", { hasText: "Continue" }),
      page.locator("button", { hasText: "Next" }),
    ];
    for (const button of otpButtons) {
      if ((await safeCount(button)) === 0) continue;
      const clicked = await safeClick(button);
      if (clicked) {
        state.otpSubmitted = true;
        state.otpLastSubmittedCode = String(state.otpCandidateCode || "");
        await emitAutoEvent(events, {
          stage: "otp",
          action: "submit_otp",
          result: "clicked",
          url: page.url(),
        });
        break;
      }
    }
  }

  if (
    currentStep === "otp" &&
    state.otpSubmitted &&
    canAttemptStep(state, currentStep, "otp_retry_after_submit", 7000, 4)
  ) {
    const stillOtpVisible = await page
      .evaluate(() => {
        const text = String(document.body?.innerText || "").toLowerCase();
        const inputs = Array.from(document.querySelectorAll("input")).filter((el) => {
          if (!(el instanceof HTMLInputElement)) return false;
          const id = String(el.id || "").toLowerCase();
          const name = String(el.name || "").toLowerCase();
          const placeholder = String(el.placeholder || "").toLowerCase();
          const type = String(el.type || "").toLowerCase();
          return (
            (id.includes("otp") ||
              id.includes("code") ||
              name.includes("otp") ||
              name.includes("code") ||
              placeholder.includes("code")) &&
            (type === "text" || type === "tel" || type === "number" || type === "")
          );
        });
        return text.includes("enter verification code") || inputs.length >= 4;
      })
      .catch(() => false);

    if (stillOtpVisible) {
      const clickedResend = await fallbackClickButtonByText(page, [
        "resend the code",
        "resend code",
        "send code again",
      ]);
      state.otpFilled = false;
      state.otpSubmitted = false;
      state.otpCandidateCode = "";
      state.otpLastSubmittedCode = "";
      await emitAutoEvent(events, {
        stage: "otp",
        action: "retry_after_submit",
        result: clickedResend ? "resend_clicked" : "reset_without_resend",
        url: page.url(),
      });
    }
  }

  if (
    currentStep === "password" &&
    !state.passwordFilled &&
    seedContext.accountPassword &&
    canAttempt(state, "password_fill", 3000)
  ) {
    const filled = await fillPasswordPair(page, seedContext.accountPassword);
    if (filled) {
      state.passwordFilled = true;
      await emitAutoEvent(events, {
        stage: "account_setup",
        action: "fill_password_pair",
        result: "filled",
        url: page.url(),
      });
    }
  }

  if (
    currentStep === "password" &&
    !state.passwordSubmitted &&
    state.passwordFilled &&
    canAttemptStep(state, currentStep, "password_submit", 2500, 8)
  ) {
    if (manualGated) {
      await emitAutoEvent(events, {
        stage: "account_setup",
        action: "ready_to_submit_password",
        result: "manual_required",
        url: page.url(),
      });
      return;
    }
    const passwordReady = await isPasswordFormValidForSubmit(page);
    const hasPasswordValidationError = await hasVisiblePasswordError(page);
    if (hasPasswordValidationError && !passwordReady) {
      await emitAutoEvent(events, {
        stage: "account_setup",
        action: "submit_password",
        result: "blocked_validation",
        url: page.url(),
      });
      return;
    }
    let clicked = await clickPasswordContinueButton(page);
    if (!clicked && passwordReady) {
      clicked = await page
        .evaluate(() => {
          const btn = document.querySelector(
            "button[data-tid='m4b_button'],button[data-uid*='twostepspc:button'],button.theme-m4b-button",
          );
          if (!(btn instanceof HTMLButtonElement)) return false;
          if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return false;
          btn.click();
          return true;
        })
        .catch(() => false);
    }
    if (!clicked) {
      const passwordInputs = page.locator("input[type='password']");
      if ((await safeCount(passwordInputs)) > 0) {
        clicked = await passwordInputs
          .nth(Math.min((await safeCount(passwordInputs)) - 1, 1))
          .press("Enter")
          .then(() => true)
          .catch(() => false);
      }
    }
    if (clicked) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const stepAfterSubmit = await detectSellerStep(page);
      const stillPassword = stepAfterSubmit === "password";
      if (stillPassword && passwordReady) {
        await clickPasswordContinueButton(page).catch(() => false);
        await page.keyboard.press("Enter").catch(() => false);
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      const stepAfterRetry = stillPassword ? await detectSellerStep(page) : stepAfterSubmit;
      state.passwordSubmitted = stepAfterRetry !== "password";
      await emitAutoEvent(events, {
        stage: "account_setup",
        action: "submit_password",
        result: stepAfterRetry === "password" ? "clicked_but_no_transition" : "clicked",
        nextStep: stepAfterRetry,
        url: page.url(),
      });
    }
  }

  // Step 3: business details best-effort fill.
  if (currentStep === "business_info" && !state.businessInfoFilled && canAttempt(state, "business_fill", 3500)) {
    let filledAny = false;
    const businessName = seedContext.companyName || seedContext.fullName;
    if (businessName) {
      const businessNameInputs = [
        page.locator("input[name*='business' i]"),
        page.locator("input[id*='business' i]"),
        page.locator("input[name*='company' i]"),
        page.locator("input[id*='company' i]"),
      ];
      filledAny =
        (await fillFirstMatch(businessNameInputs, businessName)) || filledAny;
    }
    if (seedContext.address) {
      const addressInputs = [
        page.locator("input[name*='address' i]"),
        page.locator("input[id*='address' i]"),
        page.locator("input[placeholder*='address' i]"),
      ];
      filledAny = (await fillFirstMatch(addressInputs, seedContext.address)) || filledAny;
    }
    if (seedContext.city) {
      const cityInputs = [
        page.locator("input[name*='city' i]"),
        page.locator("input[id*='city' i]"),
        page.locator("input[placeholder*='city' i]"),
      ];
      filledAny = (await fillFirstMatch(cityInputs, seedContext.city)) || filledAny;
    }
    if (seedContext.state) {
      const stateInputs = [
        page.locator("input[name*='state' i]"),
        page.locator("input[id*='state' i]"),
        page.locator("input[placeholder*='state' i]"),
      ];
      filledAny = (await fillFirstMatch(stateInputs, seedContext.state)) || filledAny;
    }
    if (seedContext.zip) {
      const zipInputs = [
        page.locator("input[name*='zip' i]"),
        page.locator("input[id*='zip' i]"),
        page.locator("input[placeholder*='zip' i]"),
        page.locator("input[placeholder*='postal' i]"),
      ];
      filledAny = (await fillFirstMatch(zipInputs, seedContext.zip)) || filledAny;
    }
    if (filledAny) {
      state.businessInfoFilled = true;
      await emitAutoEvent(events, {
        stage: "business_info",
        action: "fill_business_fields",
        result: "filled_partial_or_full",
        url: page.url(),
      });
    }
  }

  if (
    currentStep === "business_info" &&
    !state.businessSubmitted &&
    state.businessInfoFilled &&
    canAttemptStep(state, currentStep, "business_continue", 5000, 2)
  ) {
    if (manualGated) {
      await emitAutoEvent(events, {
        stage: "business_info",
        action: "ready_to_submit_business",
        result: "manual_required",
        url: page.url(),
      });
      return;
    }
    const businessButtons = [
      page.locator("button", { hasText: "Continue" }),
      page.locator("button", { hasText: "Next" }),
      page.locator("button", { hasText: "Submit" }),
    ];
    for (const button of businessButtons) {
      if ((await safeCount(button)) === 0) continue;
      const clicked = await safeClick(button);
      if (clicked) {
        state.businessSubmitted = true;
        await emitAutoEvent(events, {
          stage: "business_info",
          action: "submit_business_step",
          result: "clicked",
          url: page.url(),
        });
        break;
      }
    }
  }

  // Step EIN (best-effort): fill if a likely EIN input appears.
  if (currentStep === "ein_verify" && canAttempt(state, "ein_fill", 4000)) {
    let filledCount = 0;
    const filledForm = await fillVisibleEinFormFields(page, seedContext);
    filledCount += Number(filledForm?.filledCount || 0);

    const einInputs = [
      page.locator("input[name*='ein' i]"),
      page.locator("input[id*='ein' i]"),
      page.locator("input[placeholder*='EIN' i]"),
      page.locator("input[placeholder*='tax id' i]"),
      page.locator("input[placeholder*='TIN' i]"),
    ];
    if (seedContext.ein) {
      for (const input of einInputs) {
        if ((await safeCount(input)) > 0) {
          const done = await safeFill(input, seedContext.ein);
          if (done) {
            filledCount += 1;
            break;
          }
        }
      }
    }
    if (filledCount > 0) {
      state.einInputAttempted = true;
      state.einFieldsFilled = true;
      await emitAutoEvent(events, {
        stage: "ein_verify",
        action: "fill_ein_step_fields",
        result: "filled",
        filledCount,
        url: page.url(),
      });
    }
  }

  if (
    currentStep === "ein_verify" &&
    !state.businessDocumentUploaded &&
    !state.businessDocumentUploadAttempted &&
    canAttemptStep(state, currentStep, "upload_document", 5000, 4)
  ) {
    const alreadyUploaded = await page
      .evaluate(() => {
        const counterNode = Array.from(document.querySelectorAll("*"))
          .find((node) => {
            if (!(node instanceof HTMLElement) || node.offsetParent === null) return false;
            return /\([0-3]\/3\)/.test(String(node.textContent || ""));
          });
        const match = String(counterNode?.textContent || "").match(/\(([0-3])\/3\)/);
        const count = match ? Number(match[1] || 0) : 0;
        const pdfTiles = Array.from(document.querySelectorAll("img.imgUploadPdf"))
          .filter((node) => node instanceof HTMLImageElement && node.offsetParent !== null).length;
        return Math.max(count, pdfTiles) >= 1;
      })
      .catch(() => false);
    if (alreadyUploaded) {
      state.businessDocumentUploaded = true;
      return;
    }
    state.businessDocumentUploadAttempted = true;
    const upload = await uploadSupportingDocument(page, seedContext.documentPath || seedContext.file || "");
    if (upload.uploaded) {
      state.businessDocumentUploaded = true;
    }
    await emitAutoEvent(events, {
      stage: "ein_verify",
      action: "upload_supporting_document",
      result: upload.reason,
      uploaded: upload.uploaded,
      documentPath: seedContext.documentPath || "",
      url: page.url(),
    });
  }

  if (
    currentStep === "ein_verify" &&
    state.einInputAttempted &&
    canAttemptStep(state, currentStep, "ein_submit", 6000, 2)
  ) {
    if (!allowEinSubmit) {
      await emitAutoEvent(events, {
        stage: "ein_verify",
        action: "ready_to_submit_ein",
        result: "submit_disabled",
        url: page.url(),
      });
      return;
    }
    if (manualGated) {
      await emitAutoEvent(events, {
        stage: "ein_verify",
        action: "ready_to_submit_ein",
        result: "manual_required",
        url: page.url(),
      });
      return;
    }
    const verifyButtons = [
      page.locator("button", { hasText: "Verify" }),
      page.locator("button", { hasText: "Submit" }),
      page.locator("button", { hasText: "Continue" }),
    ];
    for (const button of verifyButtons) {
      if ((await safeCount(button)) > 0) {
        const clicked = await safeClick(button);
        if (clicked) {
          state.einSubmitAttempted = true;
          await emitAutoEvent(events, {
            stage: "ein_verify",
            action: "submit_verify",
            result: "clicked",
            url: page.url(),
          });
          break;
        }
      }
    }
  }

  if (currentStep === "unknown" && canAttemptStep(state, currentStep, "generic_progress", 4500, 12)) {
    if (isSellerRegister) {
      await emitAutoEvent(events, {
        stage: "unknown",
        action: "generic_progress",
        result: "skipped_register_guard",
        url: page.url(),
      });
      return;
    }
    const isBusinessTypePage = await page
      .evaluate(() =>
        String(document.body?.innerText || "")
          .toLowerCase()
          .includes("what type of business do you operate"),
      )
      .catch(() => false);
    const isBusinessVerifyLikePage = await page
      .evaluate(() => {
        const text = String(document.body?.innerText || "").toLowerCase();
        return (
          text.includes("verify business details") ||
          text.includes("business details") ||
          text.includes("employer identification number") ||
          text.includes("tax id")
        );
      })
      .catch(() => false);
    if (isBusinessTypePage) {
      await emitAutoEvent(events, {
        stage: "unknown",
        action: "generic_progress",
        result: "skipped_business_type_guard",
        url: page.url(),
      });
      return;
    }
    if (isBusinessVerifyLikePage) {
      await emitAutoEvent(events, {
        stage: "unknown",
        action: "generic_progress",
        result: "skipped_business_verify_guard",
        url: page.url(),
      });
      return;
    }
    const progressed =
      (await safeClick(page.locator("button", { hasText: "Next" }))) ||
      (await safeClick(page.locator("button", { hasText: "Continue" }))) ||
      (await safeClick(page.locator("button", { hasText: "Confirm" }))) ||
      (await safeClick(page.locator("button", { hasText: "Get started" }))) ||
      (await safeClick(page.locator("button", { hasText: "Start" }))) ||
      (await fallbackClickButtonByText(page, ["next", "continue", "confirm", "get started", "start"]));
    await emitAutoEvent(events, {
      stage: "unknown",
      action: "generic_progress",
      result: progressed ? "clicked" : "waiting_page_ready",
      url: page.url(),
    });
    return;
  }
}

async function captureSnapshot(page, outputDir, events) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = toUrlFileSlug(page.url() || "page");
  const base = `${stamp}-${slug}`;
  const htmlPath = path.join(outputDir, "html", `${base}.html`);
  const screenshotPath = path.join(outputDir, "screenshots", `${base}.png`);
  const metaPath = path.join(outputDir, "meta", `${base}.json`);

  await ensureDir(path.dirname(htmlPath));
  await ensureDir(path.dirname(screenshotPath));
  await ensureDir(path.dirname(metaPath));

  const html = await page.content();
  await fs.writeFile(htmlPath, html, "utf8");
  // Keep viewport-only capture to avoid full-page auto-scroll side effects.
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const meta = {
    capturedAt: nowIso(),
    url: page.url(),
    title: await page.title(),
    htmlPath,
    screenshotPath,
  };
  await writeJson(metaPath, meta);
  await events.write({
    kind: "snapshot",
    url: meta.url,
    title: meta.title,
    htmlPath,
    screenshotPath,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args["output-dir"] || path.join(process.cwd(), "tmp/probe-output"));
  const startUrl = args["start-url"] || "https://seller-us.tiktok.com/account/register";
  const browserType = String(args["browser-type"] || "firefox").toLowerCase();
  const executablePath = args["executable-path"]?.trim();
  const extensionPath = args["extension-path"]?.trim();
  const omoKey = args["omo-key"]?.trim();
  const proxyValue = args.proxy?.trim() || "";
  const maxDurationSeconds = Number(args["max-duration-seconds"] || 0);
  const snapshotIntervalSeconds = Number(args["snapshot-interval-seconds"] || 20);
  const seedFile = args["seed-file"]?.trim();
  const headless = String(args.headless || "false").toLowerCase() === "true";
  const autoBestEffortEnabled =
    String(args["auto-best-effort"] ?? "true").toLowerCase() !== "false";
  const manualGated = String(args["manual-gated"] || "false").toLowerCase() === "true";
  const contactMode = String(args["contact-mode"] || "auto").toLowerCase();
  const entryMode = String(args["entry-mode"] || "register").toLowerCase();
  const allowEinSubmit = String(args["ein-submit"] || "false").toLowerCase() === "true";
  const userDataDir = args["user-data-dir"]?.trim() || "";
  const autoIntervalSeconds = Math.max(
    1,
    Number(args["auto-interval-seconds"] || 2),
  );
  const keepOpen = String(args["keep-open"] || "true").toLowerCase() === "true";
  const unlockScroll = String(args["unlock-scroll"] || "true").toLowerCase() !== "false";
  const logNetworkEvents = String(args["log-network"] || "false").toLowerCase() === "true";
  const logConsoleEvents = String(args["log-console"] || "true").toLowerCase() !== "false";

  await ensureDir(outputDir);
  const events = new JsonlWriter(path.join(outputDir, "events.jsonl"));
  await events.init();

  let seed = {};
  if (seedFile) {
    try {
      seed = JSON.parse(await fs.readFile(seedFile, "utf8"));
    } catch {
      seed = {};
    }
  }
  const seedContext = deriveSeedContext(seed);
  const resolvedDocumentPath = await resolveBusinessDocumentPath(seedContext);
  if (resolvedDocumentPath) {
    seedContext.documentPath = resolvedDocumentPath;
  }
  const autoState = createAutoState();

  await writeJson(path.join(outputDir, "session.json"), {
    startedAt: nowIso(),
    startUrl,
    browserType,
    headless,
    executablePath: executablePath || "",
    extensionPath: extensionPath || "",
    omoKeySet: Boolean(omoKey),
    proxy: proxyValue || "",
    maxDurationSeconds,
    snapshotIntervalSeconds,
    autoBestEffortEnabled,
    autoIntervalSeconds,
    manualGated,
    contactMode,
    entryMode,
    allowEinSubmit,
    userDataDir,
    keepOpen,
    logNetworkEvents,
    logConsoleEvents,
    resolvedDocumentPath: resolvedDocumentPath || "",
    seedContext,
    seed,
  });
  await events.write({
    kind: "document_resolve",
    sourceHint: seedContext.file || "",
    resolvedPath: resolvedDocumentPath || "",
    result: resolvedDocumentPath ? "resolved" : "missing",
  });

  const launchOptions = {
    headless,
    ...(executablePath ? { executablePath } : {}),
  };
  const resolvedExtensionPath = browserType === "chromium" && extensionPath ? path.resolve(extensionPath) : "";
  if (browserType === "chromium") {
    launchOptions.args = launchOptions.args || [];
    launchOptions.args.push("--remote-debugging-port=9222");
    if (extensionPath) {
      launchOptions.args.push(`--disable-extensions-except=${resolvedExtensionPath}`);
      launchOptions.args.push(`--load-extension=${resolvedExtensionPath}`);
    }
  }
  const parsedProxy = parseProxyValue(proxyValue);
  if (parsedProxy?.server) {
    launchOptions.proxy = {
      server: parsedProxy.server,
      ...(parsedProxy.username ? { username: parsedProxy.username } : {}),
      ...(parsedProxy.password ? { password: parsedProxy.password } : {}),
    };
  }

  const contextOptions = {
    viewport: null,
    locale: "en-US",
    timezoneId: "America/New_York",
  };
  let browser = null;
  let context = null;
  if (userDataDir) {
    const persistentPath = path.resolve(userDataDir);
    context =
      browserType === "chromium"
        ? await chromium.launchPersistentContext(persistentPath, { ...launchOptions, ...contextOptions })
        : await firefox.launchPersistentContext(persistentPath, { ...launchOptions, ...contextOptions });
    browser = context.browser();
  } else {
    browser = browserType === "chromium" ? await chromium.launch(launchOptions) : await firefox.launch(launchOptions);
    context = await browser.newContext(contextOptions);
  }
  await context.grantPermissions(["notifications"], {
    origin: "https://seller-us.tiktok.com",
  }).catch(() => {});

  await context.addInitScript(() => {
    if (window.__bugloginProbeReady__) return;
    window.__bugloginProbeReady__ = true;
    const short = (value, max = 220) => {
      const text = String(value ?? "");
      return text.length > max ? `${text.slice(0, max - 3)}...` : text;
    };
    const pick = (el) => {
      if (!(el instanceof Element)) return {};
      const type = String(el.getAttribute("type") || "").toLowerCase();
      let value = "";
      try {
        value = String(el.value ?? "");
      } catch {
        value = "";
      }
      if (type === "password") value = "__masked__";
      return {
        tag: String(el.tagName || "").toLowerCase(),
        id: el.getAttribute("id") || "",
        name: el.getAttribute("name") || "",
        type,
        placeholder: el.getAttribute("placeholder") || "",
        role: el.getAttribute("role") || "",
        text: short(el.innerText || el.textContent || "", 180),
        value: short(value),
      };
    };
    const emit = (eventType, ev) => {
      try {
        if (window.bugloginProbeRecord) {
          window.bugloginProbeRecord({
            kind: "dom_event",
            eventType,
            href: location.href,
            title: document.title,
            target: pick(ev?.target),
          });
        }
      } catch {}
    };
    ["input", "change", "click", "submit", "blur"].forEach((eventName) => {
      document.addEventListener(eventName, (ev) => emit(eventName, ev), true);
    });
  });

  if (unlockScroll) {
    await context.addInitScript(() => {
      try {
        const unlock = () => {
          const html = document.documentElement;
          const body = document.body;
          if (html) html.style.overflow = "auto";
          if (body) body.style.overflow = "auto";
        };
        unlock();
        document.addEventListener("DOMContentLoaded", unlock, { once: false });
      } catch {}
    });
  }

  await context.exposeBinding("bugloginProbeRecord", async (_source, payload) => {
    if (payload && typeof payload === "object") {
      await events.write(payload);
    }
  });

  const page = context.pages()[0] ?? (await context.newPage());

  // Ensure OMO key is applied inside the same automation context.
  // This avoids launching a second temporary browser session that can race and
  // trigger "already running" profile locks.
  if (omoKey && (browserType === "firefox" || (browserType === "chromium" && resolvedExtensionPath))) {
    try {
      const keyPage = await context.newPage();
      const keyUrl = `https://omocaptcha.com/set-key/?api_key=${encodeURIComponent(omoKey)}`;
      await keyPage.goto(keyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await keyPage.waitForTimeout(1500);
      await events.write({
        kind: "extension_key_apply_context",
        status: "ok",
        browserType,
        keyUrl,
      });
      await keyPage.close().catch(() => {});
    } catch (error) {
      await events.write({
        kind: "extension_key_apply_context",
        status: "error",
        browserType,
        error: String(error?.message || error || "unknown"),
      });
    }
  }

  if (logNetworkEvents) {
    page.on("request", async (request) => {
      await events.write({
        kind: "request",
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
      });
    });
    page.on("response", async (response) => {
      await events.write({
        kind: "response",
        status: response.status(),
        url: response.url(),
        method: response.request().method(),
        resourceType: response.request().resourceType(),
      });
    });
  }
  if (logConsoleEvents) {
    page.on("console", async (msg) => {
      await events.write({
        kind: "console",
        level: msg.type(),
        text: msg.text().slice(0, 1000),
      });
    });
  }
  page.on("pageerror", async (error) => {
    await events.write({
      kind: "pageerror",
      message: String(error).slice(0, 1200),
    });
  });

  await events.write({ kind: "session_start", startUrl, browserType });
  await events.write({
    kind: "auto_config",
    autoBestEffortEnabled,
    autoIntervalSeconds,
    seedContext,
  });
  if (browserType === "chromium" && extensionPath) {
    await events.write({
      kind: "extension_config",
      extensionPath: path.resolve(extensionPath),
      omoKeySet: Boolean(omoKey),
    });
  }
  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await events.write({ kind: "first_page_ready", url: page.url(), title: await page.title() });
  await captureSnapshot(page, outputDir, events);

  const hasDurationLimit = Number.isFinite(maxDurationSeconds) && maxDurationSeconds > 0;
  const endAt = hasDurationLimit ? Date.now() + maxDurationSeconds * 1000 : Number.POSITIVE_INFINITY;
  let lastSnapshot = Date.now();
  let lastAutomationTick = 0;

  while (Date.now() < endAt) {
    if (context.pages().length === 0) {
      await events.write({ kind: "no_open_pages" });
      if (keepOpen) {
        try {
          const recoveredPage = await context.newPage();
          await recoveredPage.goto(startUrl, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          await events.write({
            kind: "page_recovered",
            url: recoveredPage.url(),
          });
          lastSnapshot = 0;
          lastAutomationTick = 0;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        } catch (recoveryError) {
          await events.write({
            kind: "page_recover_failed",
            error: String(recoveryError?.message || recoveryError),
          });
        }
      }
      break;
    }
    if (
      snapshotIntervalSeconds > 0 &&
      Date.now() - lastSnapshot >= snapshotIntervalSeconds * 1000
    ) {
      for (const openPage of context.pages()) {
        if (openPage.isClosed()) continue;
        await captureSnapshot(openPage, outputDir, events);
      }
      lastSnapshot = Date.now();
    }
    if (
      autoBestEffortEnabled &&
      Date.now() - lastAutomationTick >= autoIntervalSeconds * 1000
    ) {
      for (const openPage of context.pages()) {
        if (openPage.isClosed()) continue;
        await bestEffortAutomationTick(openPage, events, seedContext, autoState, {
          manualGated,
          contactMode,
          entryMode,
          allowEinSubmit,
          outputDir,
        });
      }
      lastAutomationTick = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (hasDurationLimit && Date.now() >= endAt) {
    await events.write({
      kind: "session_timeout",
      maxDurationSeconds,
    });
  }

  if (keepOpen) {
    await events.write({
      kind: "hold_open",
      message: "Session held open by --keep-open=true",
    });
    // Hold session for live manual/automation debugging until process is terminated.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (context.pages().length === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  await events.write({ kind: "session_end" });
  await context.close();
  if (browser && browser.isConnected()) {
    await browser.close().catch(() => {});
  }
}

main().catch(async (error) => {
  try {
    const args = parseArgs(process.argv.slice(2));
    const outputDir = path.resolve(args["output-dir"] || path.join(process.cwd(), "tmp/probe-output"));
    const events = new JsonlWriter(path.join(outputDir, "events.jsonl"));
    await events.init();
    await events.write({
      kind: "session_error",
      error: String(error?.message || error || "unknown error"),
    });
  } catch {}
  process.exit(1);
});
