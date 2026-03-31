import base64
import json
import os
import random
import re
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from datetime import timedelta

from playwright.sync_api import sync_playwright

PHONE = os.getenv("PHONE_NUMBER", "15097533407")
API_PHONE_URL = os.getenv(
    "API_PHONE_URL",
    "https://api.sms8.net/api/record?token=3mf0dkdffnr4lkhfef4eqc53lvia9d74ri2s",
)
WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

# user-provided proxy: host:port:user:pass
PROXY_HOST = os.getenv("PROXY_HOST", "103.183.118.9")
PROXY_PORT = int(os.getenv("PROXY_PORT", "50081"))
PROXY_USER = os.getenv("PROXY_USER", "ZXebhC")
PROXY_PASS = os.getenv("PROXY_PASS", "8fiuX9L7")
PROXY_SERVER = f"http://{PROXY_HOST}:{PROXY_PORT}"

TARGET_REGION = "United States (+1)"
AUTO_CLICK_SEND_CODE = True
AUTO_CLICK_NEXT = True
AUTO_FILL_PASSWORD_USERNAME = True
KEEP_OPEN_IF_NOT_ADVANCED_MS = 120000
KEEP_OPEN_AFTER_SUCCESS_MS = int(os.getenv("KEEP_OPEN_AFTER_SUCCESS_MS", "180000"))
SEND_CODE_MAX_ATTEMPTS = 4
SIGNUP_PASSWORD = os.getenv("SIGNUP_PASSWORD", "BugLogin@2026!")
SIGNUP_USERNAME = os.getenv("SIGNUP_USERNAME", "")
HUMAN_MIN_DELAY_MS = int(os.getenv("HUMAN_MIN_DELAY_MS", "180"))
HUMAN_MAX_DELAY_MS = int(os.getenv("HUMAN_MAX_DELAY_MS", "620"))

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
out_dir = rf"E:\\bug-login\\tmp\\tiktok-signup-live-proxy-{stamp}"
os.makedirs(out_dir, exist_ok=True)


def log(msg: str):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "ignore").decode("ascii"), flush=True)


def save_json(name: str, data):
    with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def shot(page, name: str):
    path = os.path.join(out_dir, name)
    page.screenshot(path=path, full_page=True)
    log(f"[shot] {path}")


def human_pause(page, lo_ms=HUMAN_MIN_DELAY_MS, hi_ms=HUMAN_MAX_DELAY_MS):
    lo = max(50, int(lo_ms))
    hi = max(lo, int(hi_ms))
    page.wait_for_timeout(random.randint(lo, hi))


def human_type(locator, value: str):
    locator.fill("")
    for ch in value:
        locator.type(ch, delay=random.randint(45, 130))


def extract_digits(text: str):
    if not text:
        return None
    found = re.findall(r"\b(\d{4,8})\b", text)
    return found[0] if found else None


def extract_code(payload):
    if not isinstance(payload, dict):
        return None

    # sms8 contract: top-level `code=1` means there is an OTP message.
    top_status = payload.get("code")
    if f"{top_status}" != "1":
        return None

    data_value = payload.get("data")
    if not isinstance(data_value, dict):
        return None

    raw_message_candidates = [
        data_value.get("code"),
        data_value.get("message"),
        data_value.get("sms"),
        payload.get("msg"),
    ]
    for raw in raw_message_candidates:
        if not isinstance(raw, str):
            continue
        matched = re.search(r"\b(\d{4,8})\b", raw)
        if matched:
            return matched.group(1)
    return None


def parse_sms_payload(payload):
    if not isinstance(payload, dict):
        return {
            "ok": False,
            "code": None,
            "code_time": None,
            "message": None,
            "status": None,
        }

    top_status = payload.get("code")
    if f"{top_status}" != "1":
        return {
            "ok": False,
            "code": None,
            "code_time": None,
            "message": None,
            "status": top_status,
        }

    data_value = payload.get("data")
    if not isinstance(data_value, dict):
        return {
            "ok": False,
            "code": None,
            "code_time": None,
            "message": None,
            "status": top_status,
        }

    message = None
    for value in [
        data_value.get("code"),
        data_value.get("message"),
        data_value.get("sms"),
        payload.get("msg"),
    ]:
        if isinstance(value, str) and value.strip():
            message = value
            break

    parsed_code = None
    if message:
        matched = re.search(r"\b(\d{4,8})\b", message)
        if matched:
            parsed_code = matched.group(1)

    code_time_raw = data_value.get("code_time")
    code_time = None
    if isinstance(code_time_raw, str) and code_time_raw.strip():
        try:
            code_time = datetime.strptime(code_time_raw.strip(), "%Y-%m-%d %H:%M:%S")
        except Exception:
            code_time = None

    return {
        "ok": parsed_code is not None,
        "code": parsed_code,
        "code_time": code_time,
        "message": message,
        "status": top_status,
    }


def build_proxy_opener():
    proxy_url = f"http://{urllib.parse.quote(PROXY_USER)}:{urllib.parse.quote(PROXY_PASS)}@{PROXY_HOST}:{PROXY_PORT}"
    proxy_handler = urllib.request.ProxyHandler({
        "http": proxy_url,
        "https": proxy_url,
    })
    return urllib.request.build_opener(proxy_handler)


def fetch_sms_once(opener):
    request = urllib.request.Request(
        API_PHONE_URL,
        method="GET",
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json,text/plain,*/*",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    with opener.open(request, timeout=20) as response:
        body = response.read().decode("utf-8", errors="ignore")
        return response.status, body


def poll_otp(max_seconds=120, interval=5):
    deadline = time.time() + max_seconds
    attempt = 0
    last_preview = None
    opener = build_proxy_opener()

    while time.time() < deadline:
        attempt += 1
        try:
            status, body = fetch_sms_once(opener)
            last_preview = body[:240]
            log(f"[otp] attempt={attempt} status={status} preview={last_preview[:120]}")
            try:
                payload = json.loads(body)
                code = extract_code(payload)
            except Exception:
                code = None
            if code:
                return code, last_preview, attempt
        except urllib.error.HTTPError as exc:
            preview = ""
            try:
                preview = exc.read().decode("utf-8", errors="ignore")[:160]
            except Exception:
                preview = ""
            last_preview = f"HTTP {exc.code} {preview}".strip()
            log(f"[otp] attempt={attempt} http_error={exc.code} preview={preview}")
        except Exception as exc:
            last_preview = str(exc)
            log(f"[otp] attempt={attempt} error={exc}")

        time.sleep(interval)

    return None, last_preview, attempt


def poll_otp_after_send(
    *,
    sent_at: datetime,
    previous_code: str | None,
    previous_code_time: datetime | None,
    max_seconds=150,
    interval=5,
):
    deadline = time.time() + max_seconds
    attempt = 0
    last_preview = None
    opener = build_proxy_opener()

    while time.time() < deadline:
        attempt += 1
        try:
            status, body = fetch_sms_once(opener)
            last_preview = body[:240]
            try:
                payload = json.loads(body)
            except Exception:
                payload = None
            parsed = parse_sms_payload(payload)
            log(f"[otp] attempt={attempt} status={status} parsed_ok={parsed['ok']} preview={last_preview[:120]}")

            if not parsed["ok"]:
                time.sleep(interval)
                continue

            code = parsed["code"]
            code_time = parsed["code_time"]
            if not code:
                time.sleep(interval)
                continue

            # Never reuse exactly the same code observed before current send action.
            if previous_code and code == previous_code:
                log("[otp] skip old code (same as before send)")
                time.sleep(interval)
                continue

            # If provider exposes code_time, require it to be newer than the send action (allow 3s drift).
            if code_time:
                if code_time < (sent_at - timedelta(seconds=3)):
                    log("[otp] skip old code_time before send")
                    time.sleep(interval)
                    continue
                if previous_code_time and code_time <= previous_code_time:
                    log("[otp] skip old code_time not newer than previous snapshot")
                    time.sleep(interval)
                    continue

            return code, last_preview, attempt
        except urllib.error.HTTPError as exc:
            preview = ""
            try:
                preview = exc.read().decode("utf-8", errors="ignore")[:160]
            except Exception:
                preview = ""
            last_preview = f"HTTP {exc.code} {preview}".strip()
            log(f"[otp] attempt={attempt} http_error={exc.code} preview={preview}")
        except Exception as exc:
            last_preview = str(exc)
            log(f"[otp] attempt={attempt} error={exc}")

        time.sleep(interval)

    return None, last_preview, attempt


def detect_send_code_status(page):
    body_text = ""
    try:
        body_text = page.locator("body").inner_text(timeout=1500).lower()
    except Exception:
        body_text = ""

    for pattern in [
        "too many attempts",
        "try again later",
        "rate limit",
        "reach limit",
        "max attempts",
        "maximum number of attempts",
        "too many requests",
        "please try again",
        "something went wrong",
        "network error",
    ]:
        if pattern in body_text:
            return "failed", pattern

    for pattern in [
        "security check",
        "verify to continue",
        "captcha",
        "drag the puzzle piece",
    ]:
        if pattern in body_text:
            return "blocked", pattern

    # Successful send typically shows resend timer/button near code input.
    try:
        resend = page.get_by_text(re.compile(r"resend(?: code)?[:\\s]*([0-9]{1,3})s", re.I))
        if resend.count() > 0:
            text = (resend.first.inner_text(timeout=600) or "").strip()
            m = re.search(r"([0-9]{1,3})s", text, re.I)
            if m:
                secs = int(m.group(1))
                if secs >= 40:
                    return "sent", f"resend_countdown_{secs}s"
                return "pending", f"resend_countdown_low_{secs}s"
            return "sent", "resend_countdown_visible"
    except Exception:
        pass

    try:
        send_button = page.get_by_role(
            "button",
            name=re.compile(r"send code|send sms|get code", re.I),
        ).first
        label = (send_button.inner_text(timeout=500) or "").strip().lower()
        enabled = send_button.is_enabled(timeout=500)
        if "resend" in label:
            m = re.search(r"([0-9]{1,3})s", label, re.I)
            if m:
                secs = int(m.group(1))
                if secs >= 40:
                    return "sent", f"button_resend_{secs}s"
                return "pending", f"button_resend_low_{secs}s"
            return "sent", "button_resend_label"
        if "send" in label and not enabled:
            return "pending", "button_disabled_waiting"
        if "send" in label and enabled:
            return "pending", "button_enabled_no_confirmation"
    except Exception:
        pass

    return "pending", "no_signal"


def wait_send_code_success(page, timeout_ms=25000):
    deadline = time.time() + timeout_ms / 1000.0
    last_reason = "unknown"
    while time.time() < deadline:
        state, reason = detect_send_code_status(page)
        last_reason = reason
        if state in {"sent", "failed", "blocked"}:
            return state, reason
        page.wait_for_timeout(500)
    return "timeout", last_reason


def wait_send_button_ready(page, timeout_ms=30000):
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        try:
            send_button = page.get_by_role(
                "button",
                name=re.compile(r"send code|send sms|get code", re.I),
            ).first
            if send_button.count() <= 0:
                page.wait_for_timeout(400)
                continue
            if not send_button.is_visible(timeout=400):
                page.wait_for_timeout(400)
                continue
            enabled = send_button.is_enabled(timeout=400)
            if enabled:
                return True, "send_button_ready"
            page.wait_for_timeout(400)
        except Exception:
            page.wait_for_timeout(400)
    return False, "send_button_not_ready"


def trigger_send_code_with_retries(page, max_attempts=SEND_CODE_MAX_ATTEMPTS):
    last_state = "failed"
    last_reason = "unknown"
    last_send_requested_at = datetime.now()
    attempts_used = 0

    for attempt in range(1, max_attempts + 1):
        attempts_used = attempt
        ready, ready_reason = wait_send_button_ready(page, timeout_ms=20000)
        if not ready:
            last_state, last_reason = "failed", ready_reason
            log(f"[send] attempt={attempt} not ready: {ready_reason}")
            continue

        sent = click_first(
            page,
            "send_code",
            [
                ("button-send", lambda pg: pg.get_by_role("button", name=re.compile(r"send code|send sms|get code", re.I))),
                ("text-send", lambda pg: pg.get_by_text(re.compile(r"send code|get code", re.I))),
            ],
        )
        last_send_requested_at = datetime.now()
        if not sent:
            last_state, last_reason = "failed", "send_click_not_found"
            log(f"[send] attempt={attempt} click not found")
            continue

        page.wait_for_timeout(700)
        state, reason = wait_send_code_success(page, timeout_ms=20000)
        last_state, last_reason = state, reason
        log(f"[send] attempt={attempt} state={state} reason={reason}")

        if state == "sent":
            return {
                "clicked": True,
                "state": state,
                "reason": reason,
                "send_requested_at": last_send_requested_at,
                "attempts_used": attempts_used,
            }
        if state in {"failed", "blocked"}:
            return {
                "clicked": True,
                "state": state,
                "reason": reason,
                "send_requested_at": last_send_requested_at,
                "attempts_used": attempts_used,
            }
        # timeout/pending => keep retrying to trigger challenge/send.
        page.wait_for_timeout(1200)

    return {
        "clicked": True,
        "state": last_state if last_state != "pending" else "timeout",
        "reason": last_reason,
        "send_requested_at": last_send_requested_at,
        "attempts_used": attempts_used,
    }


def has_advanced_from_phone_step(page):
    url = (page.url or "").lower()
    if "chrome-error://" in url or "chromewebdata" in url:
        return False
    if "tiktok.com" not in url:
        return False
    if "signup/phone-or-email/phone" not in url:
        return True
    try:
        password_input = page.locator("input[type='password']")
        if password_input.count() > 0:
            return True
    except Exception:
        pass
    try:
        password_text = page.get_by_text(re.compile(r"password|create password|set password", re.I))
        if password_text.count() > 0:
            return True
    except Exception:
        pass
    return False


def wait_advance_after_next(page, timeout_ms=20000):
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        if has_advanced_from_phone_step(page):
            return True
        page.wait_for_timeout(500)
    return False


def click_first(page, label, builders):
    for name, build in builders:
        try:
            loc = build(page)
            if loc.count() <= 0:
                continue
            human_pause(page, 120, 380)
            loc.first.click(timeout=5000)
            log(f"[click] {label} via {name}")
            human_pause(page, 150, 450)
            return True
        except Exception as exc:
            log(f"[miss] {label} via {name}: {exc}")
    return False


def wait_signup_form_ready(page, timeout_ms=35000):
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        try:
            heading_ok = page.get_by_text(re.compile(r"sign up", re.I)).count() > 0
            phone_input_ok = (
                page.locator("input[type='tel'], input[placeholder*='phone' i]").count()
                > 0
            )
            combo_count = page.locator("[role='combobox']").count()
            if heading_ok and phone_input_ok and combo_count >= 3:
                return True
        except Exception:
            pass
        page.wait_for_timeout(400)
    return False


def set_dob(page):
    try:
        m = page.get_by_role("combobox", name=re.compile(r"month", re.I))
        d = page.get_by_role("combobox", name=re.compile(r"day", re.I))
        y = page.get_by_role("combobox", name=re.compile(r"year", re.I))
        if m.count() and d.count() and y.count():
            human_pause(page)
            m.first.click(timeout=5000)
            human_pause(page, 120, 350)
            page.get_by_text(re.compile(r"^jan$|january", re.I)).first.click(timeout=5000)
            human_pause(page, 120, 350)
            d.first.click(timeout=5000)
            human_pause(page, 120, 350)
            page.get_by_text(re.compile(r"^1$|^01$", re.I)).first.click(timeout=5000)
            human_pause(page, 120, 350)
            y.first.click(timeout=5000)
            human_pause(page, 120, 350)
            page.get_by_text(re.compile(r"2001", re.I)).first.click(timeout=5000)
            log("[dob] set via combobox")
            return True
    except Exception as exc:
        log(f"[dob] failed: {exc}")

    # Fallback: choose by combobox order (Month, Day, Year) when aria labels are missing.
    try:
        boxes = page.locator("[role='combobox']")
        if boxes.count() >= 3:
            human_pause(page)
            boxes.nth(0).click(timeout=4000)
            page.get_by_text(re.compile(r"^jan$|january", re.I)).first.click(timeout=5000)
            human_pause(page, 120, 350)
            boxes.nth(1).click(timeout=4000)
            page.get_by_text(re.compile(r"^1$|^01$", re.I)).first.click(timeout=5000)
            human_pause(page, 120, 350)
            boxes.nth(2).click(timeout=4000)
            page.get_by_text(re.compile(r"2001", re.I)).first.click(timeout=5000)
            log("[dob] set via combobox-order fallback")
            return True
    except Exception as exc:
        log(f"[dob] order-fallback failed: {exc}")
    return False


def select_region(page):
    openers = [
        ("combobox-country", lambda pg: pg.get_by_role("combobox", name=re.compile(r"country|region|code", re.I))),
        ("button-country", lambda pg: pg.get_by_role("button", name=re.compile(r"country|region|\+\d+", re.I))),
        ("text-code", lambda pg: pg.get_by_text(re.compile(r"\+\d{1,3}"))),
    ]
    if not click_first(page, "open_region", openers):
        return False

    us = re.compile(r"united\s*states.*\+?1|\+1.*united\s*states", re.I)
    options = [
        ("option-us", lambda pg: pg.get_by_role("option", name=us)),
        ("text-us", lambda pg: pg.get_by_text(us)),
        ("text-united", lambda pg: pg.get_by_text(re.compile(r"United States", re.I))),
    ]
    ok = click_first(page, "choose_us", options)
    if ok:
        page.wait_for_timeout(700)
        log(f"[region] selected {TARGET_REGION}")
    return ok


def fill_phone(page, raw):
    local = re.sub(r"\D", "", raw)
    if len(local) == 11 and local.startswith("1"):
        local = local[1:]

    fields = [
        ("tel", lambda pg: pg.locator("input[type='tel']")),
        ("name-phone", lambda pg: pg.locator("input[name*='phone' i], input[id*='phone' i]")),
        ("placeholder", lambda pg: pg.get_by_placeholder(re.compile(r"phone", re.I))),
    ]
    for name, build in fields:
        try:
            loc = build(page)
            if loc.count() <= 0:
                continue
            human_pause(page)
            loc.first.click(timeout=3000)
            human_type(loc.first, local)
            log(f"[phone] filled via {name}: {local}")
            return True, local
        except Exception as exc:
            log(f"[phone] miss {name}: {exc}")
    return False, local


def fill_otp(page, code):
    try:
        by_placeholder = page.get_by_placeholder(
            re.compile(r"6-?digit code|verification code|enter.*code", re.I),
        )
        if by_placeholder.count() > 0:
            human_pause(page)
            by_placeholder.first.click(timeout=3000)
            human_type(by_placeholder.first, code)
            log("[otp] filled placeholder input")
            return True
    except Exception as exc:
        log(f"[otp] placeholder input failed: {exc}")

    try:
        one = page.locator("input[name*='code' i], input[id*='code' i], input[autocomplete='one-time-code']")
        if one.count() > 0:
            human_pause(page)
            human_type(one.first, code)
            log("[otp] filled single input")
            return True
    except Exception as exc:
        log(f"[otp] single input failed: {exc}")

    try:
        cells = page.locator("input[maxlength='1']")
        if cells.count() >= len(code):
            for i, ch in enumerate(code):
                cells.nth(i).fill(ch)
                page.wait_for_timeout(random.randint(40, 120))
            log("[otp] filled split cells")
            return True
    except Exception as exc:
        log(f"[otp] split input failed: {exc}")
    return False


def fill_password_step(page, password):
    filled = False
    try:
        pwd = page.locator("input[type='password']")
        if pwd.count() > 0:
            human_pause(page)
            pwd.first.click(timeout=3000)
            human_type(pwd.first, password)
            filled = True
            log("[password] filled input[type=password]")
    except Exception as exc:
        log(f"[password] fill failed: {exc}")

    clicked = False
    if filled:
        try:
            clicked = click_first(
                page,
                "submit_password",
                [
                    ("button-next", lambda pg: pg.get_by_role("button", name=re.compile(r"next|continue|sign up|submit", re.I))),
                    ("text-next", lambda pg: pg.get_by_text(re.compile(r"next|continue|sign up|submit", re.I))),
                ],
            )
            page.wait_for_timeout(1200)
        except Exception as exc:
            log(f"[password] submit failed: {exc}")
    return filled, clicked


def fill_username_step(page, username):
    target = (username or "").strip()
    if not target:
        target = f"bug{int(time.time()) % 100000000}"

    try:
        user = page.locator(
            "input[name*='username' i], input[id*='username' i], input[placeholder*='username' i]"
        )
        if user.count() <= 0:
            return False, False, target
        human_pause(page)
        user.first.click(timeout=3000)
        human_type(user.first, target)
        log(f"[username] filled: {target}")
    except Exception as exc:
        log(f"[username] fill failed: {exc}")
        return False, False, target

    clicked = False
    try:
        clicked = click_first(
            page,
            "submit_username",
            [
                ("button-next", lambda pg: pg.get_by_role("button", name=re.compile(r"next|continue|sign up|submit", re.I))),
                ("text-next", lambda pg: pg.get_by_text(re.compile(r"next|continue|sign up|submit", re.I))),
            ],
        )
        page.wait_for_timeout(1200)
    except Exception as exc:
        log(f"[username] submit failed: {exc}")
    return True, clicked, target


def looks_blocked(page):
    try:
        title = (page.title() or "").lower()
        body = page.locator("body").inner_text(timeout=1500).lower()
        return (
            "security check" in title
            or "verify to continue" in body
            or "drag the puzzle piece" in body
            or "captcha" in body
        )
    except Exception:
        return False


def detect_logged_in_phone_only_case(page):
    """
    Special case:
    - OTP login succeeded and account is accessible
    - TikTok does not continue to password/username completion flow
    """
    info = {
        "logged_in_profile_like": False,
        "reason": "",
    }
    try:
        url = (page.url or "").lower()
    except Exception:
        url = ""

    try:
        body = page.locator("body").inner_text(timeout=1500).lower()
    except Exception:
        body = ""

    # Strong signals for logged-in state outside signup flow
    has_profile_url = "tiktok.com/@" in url
    has_feed_or_profile_nav = (
        ("for you" in body and "following" in body)
        or ("messages" in body and "profile" in body)
    )
    still_on_signup = "signup/" in url or "sign up" in body

    if (has_profile_url or has_feed_or_profile_nav) and not still_on_signup:
        info["logged_in_profile_like"] = True
        info["reason"] = "logged_in_without_password_username_step"
        return True, info

    return False, info


def main():
    if not os.path.exists(WINDOWS_CHROME):
        raise RuntimeError(f"Chrome not found at {WINDOWS_CHROME}")

    log(f"[info] out_dir={out_dir}")
    log(f"[info] proxy={PROXY_SERVER}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=WINDOWS_CHROME,
            headless=False,
            proxy={"server": PROXY_SERVER, "username": PROXY_USER, "password": PROXY_PASS},
            args=["--disable-blink-features=AutomationControlled"],
            slow_mo=120,
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            timezone_id="America/New_York",
        )
        page = context.new_page()

        result = {
            "started_at": datetime.now().isoformat(),
            "phone": PHONE,
            "api_phone_url": API_PHONE_URL,
            "region": TARGET_REGION,
            "proxy_server": PROXY_SERVER,
            "steps": [],
        }

        def step(name, **kwargs):
            entry = {"step": name, "ts": datetime.now().isoformat()}
            entry.update(kwargs)
            result["steps"].append(entry)
            log(f"[step] {name} | {kwargs}")

        page.goto("https://www.tiktok.com/signup/phone-or-email/phone", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(2500)
        shot(page, "01_signup_page.png")
        step("open_signup", url=page.url, title=page.title())
        form_ready = wait_signup_form_ready(page, timeout_ms=35000)
        step("form_ready_check", ready=form_ready)
        if not form_ready:
            step("abort_flow", reason="signup_form_not_ready")
            shot(page, "99_final.png")
            result["ended_at"] = datetime.now().isoformat()
            save_json("99_result.json", result)
            log(f"[done] result={os.path.join(out_dir, '99_result.json')}")
            page.wait_for_timeout(KEEP_OPEN_IF_NOT_ADVANCED_MS)
            context.close()
            browser.close()
            return

        step("security_check_detect", blocked=looks_blocked(page))

        dob_ok = set_dob(page)
        shot(page, "02_after_dob.png")
        step("set_dob", ok=dob_ok)

        region_ok = select_region(page)
        shot(page, "03_after_region.png")
        step("select_region", ok=region_ok, target=TARGET_REGION)

        phone_ok, local_phone = fill_phone(page, PHONE)
        shot(page, "04_after_phone.png")
        step("fill_phone", ok=phone_ok, local_phone=local_phone)

        # Snapshot OTP state before sending to avoid reusing old code.
        previous_code = None
        previous_code_time = None
        try:
            opener = build_proxy_opener()
            _, before_body = fetch_sms_once(opener)
            before_payload = json.loads(before_body)
            before_parsed = parse_sms_payload(before_payload)
            previous_code = before_parsed["code"]
            previous_code_time = before_parsed["code_time"]
            step(
                "otp_pre_send_snapshot",
                previous_code=previous_code,
                previous_code_time=str(previous_code_time) if previous_code_time else None,
            )
        except Exception as exc:
            step("otp_pre_send_snapshot", error=str(exc))

        sent = False
        send_state = "skipped"
        send_reason = "auto_send_disabled"
        send_requested_at = datetime.now()
        send_attempts_used = 0
        if AUTO_CLICK_SEND_CODE:
            send_result = trigger_send_code_with_retries(
                page,
                max_attempts=SEND_CODE_MAX_ATTEMPTS,
            )
            sent = bool(send_result["clicked"])
            send_state = f"{send_result['state']}"
            send_reason = f"{send_result['reason']}"
            send_requested_at = send_result["send_requested_at"]
            send_attempts_used = int(send_result["attempts_used"])
        shot(page, "05_ready_for_send_code.png")
        step(
            "send_code_mode",
            auto_click_send_code=AUTO_CLICK_SEND_CODE,
            clicked=sent,
            send_state=send_state,
            send_reason=send_reason,
            send_attempts_used=send_attempts_used,
            url=page.url,
        )

        hard_send_failure = send_state in {"failed", "blocked"}
        if AUTO_CLICK_SEND_CODE and hard_send_failure:
            step("abort_flow", reason="send_code_not_confirmed")
            step(
                "final_state",
                url=page.url,
                title=page.title(),
                blocked=looks_blocked(page),
                otp_filled=False,
                advanced=False,
            )
            shot(page, "99_final.png")
            result["ended_at"] = datetime.now().isoformat()
            save_json("99_result.json", result)
            log(f"[done] result={os.path.join(out_dir, '99_result.json')}")
            page.wait_for_timeout(KEEP_OPEN_IF_NOT_ADVANCED_MS)
            context.close()
            browser.close()
            return

        code, preview, attempts = poll_otp_after_send(
            sent_at=send_requested_at,
            previous_code=previous_code,
            previous_code_time=previous_code_time,
            max_seconds=150,
            interval=5,
        )
        if send_state != "sent":
            send_state = "sent_by_otp" if code else send_state
            send_reason = "otp_arrived" if code else send_reason
            step(
                "send_code_reconcile",
                reconciled_send_state=send_state,
                reconciled_send_reason=send_reason,
            )
        step("poll_otp", found=bool(code), code=code, attempts=attempts, preview=preview)

        otp_filled = False
        special_phone_only_done = False
        special_phone_only_reason = ""
        if code:
            otp_filled = fill_otp(page, code)
            shot(page, "06_after_fill_otp.png")
            clicked = False
            if AUTO_CLICK_NEXT:
                verifiers = [
                    ("button-verify", lambda pg: pg.get_by_role("button", name=re.compile(r"next|continue|verify|submit", re.I))),
                    ("text-verify", lambda pg: pg.get_by_text(re.compile(r"next|continue|verify|submit", re.I))),
                ]
                clicked = click_first(page, "submit_otp", verifiers)
                page.wait_for_timeout(1200)
                advanced = wait_advance_after_next(page, timeout_ms=22000)
            else:
                advanced = False

            # Special outcome: logged in, but TikTok skips password/username completion
            if not advanced:
                special_phone_only_done, special_info = detect_logged_in_phone_only_case(page)
                special_phone_only_reason = special_info.get("reason", "")

            shot(page, "07_after_submit_otp.png")
            step(
                "submit_otp",
                otp_filled=otp_filled,
                auto_click_next=AUTO_CLICK_NEXT,
                clicked=clicked,
                advanced=advanced,
                special_phone_only_done=special_phone_only_done,
                special_phone_only_reason=special_phone_only_reason,
                url=page.url,
                title=page.title(),
            )
        else:
            advanced = False

        step(
            "final_state",
            url=page.url,
            title=page.title(),
            blocked=looks_blocked(page),
            otp_filled=otp_filled,
            advanced=advanced,
            special_phone_only_done=special_phone_only_done,
            special_phone_only_reason=special_phone_only_reason,
        )

        password_filled = False
        password_submitted = False
        username_filled = False
        username_submitted = False
        username_used = None
        if AUTO_FILL_PASSWORD_USERNAME and advanced:
            password_filled, password_submitted = fill_password_step(page, SIGNUP_PASSWORD)
            shot(page, "08_after_password.png")
            step(
                "password_step",
                password_filled=password_filled,
                password_submitted=password_submitted,
                url=page.url,
                title=page.title(),
            )

            username_filled, username_submitted, username_used = fill_username_step(page, SIGNUP_USERNAME)
            shot(page, "09_after_username.png")
            step(
                "username_step",
                username_filled=username_filled,
                username_submitted=username_submitted,
                username_used=username_used,
                url=page.url,
                title=page.title(),
            )

            step(
                "post_profile_steps_state",
                url=page.url,
                title=page.title(),
                blocked=looks_blocked(page),
            )
        elif special_phone_only_done:
            step(
                "special_outcome",
                status="completed_special_phone_only",
                reason=special_phone_only_reason,
                url=page.url,
                title=page.title(),
            )

        shot(page, "99_final.png")

        result["outcome"] = (
            "completed_full"
            if advanced
            else ("completed_special_phone_only" if special_phone_only_done else "incomplete")
        )
        result["ended_at"] = datetime.now().isoformat()
        save_json("99_result.json", result)
        log(f"[done] result={os.path.join(out_dir, '99_result.json')}")

        if not advanced and not special_phone_only_done:
            # Keep the browser open for operator inspection/intervention instead of closing too early.
            page.wait_for_timeout(KEEP_OPEN_IF_NOT_ADVANCED_MS)
        else:
            page.wait_for_timeout(KEEP_OPEN_AFTER_SUCCESS_MS)
        context.close()
        browser.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        err = {
            "error": str(exc),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat(),
            "out_dir": out_dir,
        }
        print(json.dumps(err, ensure_ascii=False), flush=True)
        try:
            with open(os.path.join(out_dir, "99_error.json"), "w", encoding="utf-8") as f:
                json.dump(err, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        sys.exit(1)
