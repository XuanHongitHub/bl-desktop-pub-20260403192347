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

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
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
    normalizeEmail(pickSeedValue(payload, ["email", "mail", "hotmail"])) ||
    normalizeEmail(hotmailParts[0]) ||
    normalizeEmail(pickSeedValue(raw, ["hotmail", "mail", "email"]));
  const phoneFromPayload = pickSeedValue(payload, ["phone", "phoneNumber"]);
  const phone = normalizeDigits(
    phoneFromPayload.includes("----")
      ? phoneFromPayload.split("----")[0]
      : phoneFromPayload,
  );
  const apiPhone =
    pickSeedValue(payload, ["apiPhone", "api_phone"]) ||
    (phoneFromPayload.includes("----") ? phoneFromPayload.split("----").slice(1).join("----").trim() : "");
  const apiMail =
    pickSeedValue(payload, ["apiMail", "api_mail", "mailApiEndpoint"]) ||
    pickSeedValue(raw, ["api_mail", "mail_api", "email_api"]);
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
    emailApiEndpoint:
      pickSeedValue(payload, ["emailApiEndpoint", "apiMail", "api_mail"]) ||
      pickSeedValue(raw, ["email_api", "api_mail", "mail_api"]) ||
      apiMail,
    accountPassword,
    username,
    loginUsername: username,
    loginPassword,
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
    registerSubmitted: false,
    businessInfoFilled: false,
    businessSubmitted: false,
    einFieldsFilled: false,
    passwordFilled: false,
    passwordSubmitted: false,
    businessDocumentUploadAttempted: false,
    businessDocumentUploaded: false,
    lastTickAt: 0,
    stepLastSeen: "",
    stepAttempts: Object.create(null),
    forcedContactMode: "",
    loginMethodOpened: false,
    loginIdentifierFilled: false,
    loginPasswordFilled: false,
    loginSubmitted: false,
    loginOtpFilled: false,
    loginOtpSubmitted: false,
    loginVerifyPhoneSelected: false,
    lastBlockedReasonEmitted: "",
    primaryRepresentativeBackAttempted: false,
    wrongBiztypeBackAttempted: false,
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

async function safeClick(locator) {
  try {
    await locator.first().click({ timeout: 1500 });
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
  const direct = source.match(/\b(\d{4,8})\b/);
  if (direct) {
    return direct[1];
  }
  return "";
}

async function fetchOtpCode(endpoint) {
  const target = String(endpoint || "").trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return "";
  }
  try {
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

async function fillOtpInputs(page, otpCode) {
  const code = String(otpCode || "").replace(/[^\d]/g, "").slice(0, 8);
  if (!code || code.length < 4) return false;

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
        return (
          input.offsetParent !== null &&
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
        "captcha",
        "verify",
        "security check",
        "slide",
        "puzzle",
      ];
      const dialogs = Array.from(document.querySelectorAll("div,section"));
      for (const node of dialogs) {
        if (!(node instanceof HTMLElement)) continue;
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const text = String(node.innerText || "").toLowerCase();
        if (!text) continue;
        if (captchaHints.some((hint) => text.includes(hint)) && text.length < 4000) {
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
  return page
    .evaluate((pass) => {
      const passwordInputs = Array.from(
        document.querySelectorAll("input[type='password'], input[name*='password' i], input[id*='password' i]"),
      ).filter((node) => node instanceof HTMLInputElement && node.offsetParent !== null);
      if (passwordInputs.length === 0) return false;
      const targets = passwordInputs.slice(0, 2);
      for (const input of targets) {
        input.focus();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.value = pass;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }, value)
    .catch(() => false);
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
  const { firstName, lastName } = splitNameParts(seedContext.fullName);
  const values = {
    ein: String(seedContext.ein || "").trim(),
    ssn: String(seedContext.ssn || "").trim(),
    dob: String(seedContext.dob || "").trim(),
    gender: String(seedContext.gender || "").trim(),
    companyName: String(seedContext.companyName || seedContext.fullName || "").trim(),
    fullName: String(seedContext.fullName || "").trim(),
    firstName,
    lastName,
    address: String(seedContext.address || "").trim(),
    city: String(seedContext.city || "").trim(),
    state: String(seedContext.state || "").trim(),
    zip: String(seedContext.zip || "").trim(),
    phone: String(seedContext.phone || "").trim(),
    email: String(seedContext.email || "").trim(),
  };
  return page
    .evaluate((payload) => {
      const normalized = (value) => String(value || "").trim().toLowerCase();
      const controls = Array.from(
        document.querySelectorAll("input:not([type='hidden']), textarea"),
      ).filter((node) => node instanceof HTMLElement && node.offsetParent !== null);
      let filledCount = 0;
      const usedKeys = new Set();

      const pickValue = (key) => {
        const k = normalized(key);
        if (!k) return "";
        if (k.includes("ein") || k.includes("tax id") || k.includes("tin")) return payload.ein;
        if (k.includes("ssn") || k.includes("social security")) return payload.ssn;
        if (k.includes("legal business") || k.includes("business name") || k.includes("company name")) {
          return payload.companyName || payload.fullName;
        }
        if (k.includes("full name")) return payload.fullName;
        if (k.includes("first name")) return payload.firstName || payload.fullName;
        if (k.includes("last name")) return payload.lastName || payload.fullName;
        if (k.includes("date of birth") || k.includes("birth date") || k.includes("dob")) {
          return payload.dob;
        }
        if (k.includes("gender") || k.includes("sex")) return payload.gender;
        if (k.includes("address")) return payload.address;
        if (k.includes("city")) return payload.city;
        if (k.includes("state")) return payload.state;
        if (k.includes("zip") || k.includes("postal")) return payload.zip;
        if (k.includes("phone")) return payload.phone;
        if (k.includes("email")) return payload.email;
        return "";
      };

      for (const control of controls) {
        if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) continue;
        const type = normalized(control.getAttribute("type"));
        if (type === "checkbox" || type === "radio" || type === "button" || type === "submit") continue;
        const current = String(control.value || "").trim();
        if (current) continue;

        const candidates = [
          control.getAttribute("name"),
          control.getAttribute("id"),
          control.getAttribute("placeholder"),
          control.getAttribute("aria-label"),
          control.getAttribute("data-e2e"),
          control.getAttribute("data-testid"),
          control.className,
        ];
        let selected = "";
        let selectedKey = "";
        for (const candidate of candidates) {
          const chosen = pickValue(candidate);
          if (chosen) {
            selected = chosen;
            selectedKey = normalized(candidate);
            break;
          }
        }
        if (!selected) continue;
        if (selectedKey && usedKeys.has(selectedKey)) continue;

        control.focus();
        control.value = "";
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.value = selected;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        filledCount += 1;
        if (selectedKey) usedKeys.add(selectedKey);
      }

      return { filledCount };
    }, values)
    .catch(() => ({ filledCount: 0 }));
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
        } else if (descriptor.includes("ein") || descriptor.includes("tax id") || descriptor.includes("tin")) {
          value = payload.ein;
        } else if (descriptor.includes("ssn") || descriptor.includes("social security")) {
          value = payload.ssn;
        } else if (
          descriptor.includes("date of birth") ||
          descriptor.includes("birth date") ||
          descriptor.includes("dob")
        ) {
          value = payload.dob;
        } else if (descriptor.includes("gender") || descriptor.includes("sex")) {
          value = payload.gender;
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

async function uploadSupportingDocument(page, absolutePath) {
  const filePath = String(absolutePath || "").trim();
  if (!filePath) {
    return { uploaded: false, reason: "no_file_path" };
  }
  if (!(await fileExists(filePath))) {
    return { uploaded: false, reason: "file_not_found" };
  }

  await fallbackClickButtonByText(page, [
    "upload",
    "browse",
    "choose file",
    "attach",
    "add file",
    "select file",
  ]).catch(() => false);

  const inputLocator = page.locator("input[type='file']");
  const count = await safeCount(inputLocator);
  if (count <= 0) {
    return { uploaded: false, reason: "file_input_not_found" };
  }

  for (let index = 0; index < count; index += 1) {
    const input = inputLocator.nth(index);
    try {
      await input.setInputFiles(filePath, { timeout: 3000 });
      const accepted = await input
        .evaluate((element) => {
          if (!(element instanceof HTMLInputElement)) return false;
          return Boolean(element.files && element.files.length > 0);
        })
        .catch(() => false);
      if (accepted) {
        return { uploaded: true, reason: "uploaded" };
      }
    } catch {
      // Try the next file input if any.
    }
  }
  return { uploaded: false, reason: "upload_failed" };
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
      const body = String(document.body?.innerText || "").toLowerCase();
      const has = (selector) => !!document.querySelector(selector);
      if (body.includes("what type of business do you operate")) {
        return "business_type";
      }
      if (
        body.includes("business details") &&
        (body.includes("legal business name") || body.includes("verify business details"))
      ) {
        return "business_details";
      }
      if (body.includes("primary representative") && body.includes("type of id")) {
        return "primary_representative";
      }
      if (
        body.includes("which option describes your business the best") ||
        body.includes("to get started, tell us about yourself")
      ) {
        return "intent_question";
      }
      if (body.includes("enter verification code")) return "otp";
      if (body.includes("set your password")) return "password";
      if (has("#phone_email_input") || has("input[placeholder*='phone number or email' i]")) {
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
      return "unknown";
    })
    .catch(() => "unknown");
}

async function emitAutoEvent(events, payload) {
  await events.write({ kind: "auto_action", ...payload });
}

async function bestEffortAutomationTick(page, events, seedContext, state, options = {}) {
  const manualGated = Boolean(options.manualGated);
  const configuredContactMode = String(options.contactMode || "auto").toLowerCase();
  const entryMode = String(options.entryMode || "register").toLowerCase();
  const allowEinSubmit = Boolean(options.allowEinSubmit);
  if (!page || page.isClosed()) return;
  const currentUrl = page.url();
  const isSellerRegister = /seller-us\.tiktok\.com\/account\/register/i.test(currentUrl);
  const isTiktokLogin = /www\.tiktok\.com\/login/i.test(currentUrl);
  const isPhonePasswordLogin = /\/login\/phone-or-email\/phone-password/i.test(currentUrl);
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
    if (
      !state.forcedContactMode &&
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
  if (
    /captcha|verify you are human|security check|puzzle/i.test(
      bodyText,
    ) || blockingCaptcha
  ) {
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
    await emitAutoEvent(events, {
      stage: "step",
      action: "changed",
      step: currentStep,
      url: page.url(),
    });
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
    if (canAttemptStep(state, currentStep, "fill_business_details", 3000, 8)) {
      const result = await fillBusinessDetailsFields(page, seedContext);
      const extra = await fillVisibleEinFormFields(page, seedContext);
      const filledCount = Number(result?.filledCount || 0) + Number(extra?.filledCount || 0);
      await emitAutoEvent(events, {
        stage: "business_details",
        action: "fill_business_details",
        result: filledCount > 0 ? "filled" : "no_fill_target",
        filledCount,
        selectCount: Number(result?.selectCount || 0),
        addressOptionChosen: Boolean(result?.addressOptionChosen),
        url: page.url(),
      });
    }
    if (
      !state.businessDocumentUploaded &&
      canAttemptStep(state, currentStep, "upload_document", 4500, 5)
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
    if (canAttemptStep(state, currentStep, "ready_to_verify_business_details", 5000, 6)) {
      await emitAutoEvent(events, {
        stage: "business_details",
        action: "ready_to_verify_business_details",
        result: "submit_disabled",
        url: page.url(),
      });
    }
    return;
  }

  if (currentStep === "primary_representative") {
    if (!state.primaryRepresentativeBackAttempted && canAttemptStep(state, currentStep, "force_back_to_business_type", 4000, 1)) {
      const didBack =
        (await safeClick(page.locator("button", { hasText: "Back" }))) ||
        (await fallbackClickButtonByText(page, ["back"]));
      state.primaryRepresentativeBackAttempted = true;
      await emitAutoEvent(events, {
        stage: "primary_representative",
        action: "force_back_to_business_type",
        result: didBack ? "clicked" : "not_found",
        url: page.url(),
      });
      return;
    }
    await emitAutoEvent(events, {
      stage: "primary_representative",
      action: "waiting_manual_or_next_rules",
      result: "holding",
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
    let didConfirm = false;
    const confirmButtons = [
      page.locator("button", { hasText: "Confirm" }),
      page.locator("button[data-e2e='country-confirm-btn']"),
    ];
    for (const button of confirmButtons) {
      if ((await safeCount(button)) === 0) continue;
      const clicked = await safeClick(button);
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

  // Step 1: account register input.
  const preferredContactMode =
    state.forcedContactMode ||
    (configuredContactMode === "phone" || configuredContactMode === "email"
      ? configuredContactMode
      : seedContext.phone
        ? "phone"
        : seedContext.email
          ? "email"
          : "");
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
    const otpEndpoint =
      preferredContactMode === "phone"
        ? seedContext.phoneApiEndpoint || seedContext.apiPhone
        : seedContext.emailApiEndpoint || seedContext.apiMail;
    const otpCode = await fetchOtpCode(otpEndpoint);
    if (otpCode) {
      const filled = await fillOtpInputs(page, otpCode);
      if (filled) {
        state.otpAttempted = true;
        state.otpFilled = true;
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
    canAttemptStep(state, currentStep, "password_submit", 6000, 2)
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
    const hasPasswordValidationError = await page
      .locator("text=/password is required|confirm the password|required/i")
      .first()
      .isVisible()
      .catch(() => false);
    if (hasPasswordValidationError) {
      await emitAutoEvent(events, {
        stage: "account_setup",
        action: "submit_password",
        result: "blocked_validation",
        url: page.url(),
      });
      return;
    }
    let clicked = false;
    const submitButtons = [
      page.locator("button", { hasText: "Continue" }),
      page.locator("button", { hasText: "Next" }),
      page.locator("button", { hasText: "Submit" }),
      page.locator("button", { hasText: "Create" }),
    ];
    for (const button of submitButtons) {
      if ((await safeCount(button)) === 0) continue;
      clicked = await safeClick(button);
      if (clicked) break;
    }
    if (!clicked) {
      clicked = await fallbackClickButtonByText(page, [
        "continue",
        "next",
        "submit",
        "create",
      ]);
    }
    if (clicked) {
      state.passwordSubmitted = true;
      await emitAutoEvent(events, {
        stage: "account_setup",
        action: "submit_password",
        result: "clicked",
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
    canAttemptStep(state, currentStep, "upload_document", 5000, 4)
  ) {
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
  const proxyValue = args.proxy?.trim() || "";
  const maxDurationSeconds = Number(args["max-duration-seconds"] || 0);
  const snapshotIntervalSeconds = Number(args["snapshot-interval-seconds"] || 8);
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
  page.on("console", async (msg) => {
    await events.write({
      kind: "console",
      level: msg.type(),
      text: msg.text().slice(0, 1000),
    });
  });
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
      break;
    }
    if (Date.now() - lastSnapshot >= snapshotIntervalSeconds * 1000) {
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
        });
      }
      lastAutomationTick = Date.now();
    }
    await page.waitForTimeout(1000);
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
      await page.waitForTimeout(1000);
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
