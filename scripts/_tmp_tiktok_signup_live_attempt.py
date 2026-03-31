import json
import os
import re
import sys
import time
import traceback
import urllib.request
from datetime import datetime

from playwright.sync_api import sync_playwright

PHONE = "15097533407"
API_PHONE_URL = "https://api.sms8.net/api/record?token=3mf0dkdffnr4lkhfef4eqc53lvia9d74ri2s"
WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

# user-provided proxy: host:port:user:pass
PROXY_SERVER = "http://103.183.118.9:50081"
PROXY_USER = "ZXebhC"
PROXY_PASS = "8fiuX9L7"

TARGET_REGION = "United States (+1)"

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
out_dir = rf"E:\\bug-login\\tmp\\tiktok-signup-live-attempt-{stamp}"
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


def extract_digits(text: str):
    if not text:
        return None
    found = re.findall(r"\\b(\\d{4,8})\\b", text)
    return found[0] if found else None


def extract_code(payload):
    if isinstance(payload, dict):
        for k in ["code", "otp", "otp_code", "verification_code", "sms_code"]:
            v = payload.get(k)
            if isinstance(v, (str, int)):
                c = extract_digits(str(v))
                if c:
                    return c
        for v in payload.values():
            c = extract_code(v)
            if c:
                return c
    elif isinstance(payload, list):
        for x in payload:
            c = extract_code(x)
            if c:
                return c
    elif isinstance(payload, (str, int)):
        return extract_digits(str(payload))
    return None


def poll_otp(max_seconds=120, interval=5):
    deadline = time.time() + max_seconds
    last_preview = None
    while time.time() < deadline:
        try:
            req = urllib.request.Request(API_PHONE_URL, method="GET")
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
            last_preview = raw[:240]
            try:
                payload = json.loads(raw)
                code = extract_code(payload)
            except Exception:
                code = extract_digits(raw)
            if code:
                return code, last_preview
        except Exception as exc:
            last_preview = f"error={exc}"
        time.sleep(interval)
    return None, last_preview


def click_first(page, label, builders):
    for name, build in builders:
        try:
            loc = build(page)
            if loc.count() <= 0:
                continue
            loc.first.click(timeout=5000)
            log(f"[click] {label} via {name}")
            return True
        except Exception as exc:
            log(f"[miss] {label} via {name}: {exc}")
    return False


def set_dob(page):
    try:
        m = page.get_by_role("combobox", name=re.compile(r"month", re.I))
        d = page.get_by_role("combobox", name=re.compile(r"day", re.I))
        y = page.get_by_role("combobox", name=re.compile(r"year", re.I))
        if m.count() and d.count() and y.count():
            m.first.click(timeout=5000)
            page.get_by_text(re.compile(r"^jan$|january", re.I)).first.click(timeout=5000)
            d.first.click(timeout=5000)
            page.get_by_text(re.compile(r"^1$|^01$", re.I)).first.click(timeout=5000)
            y.first.click(timeout=5000)
            page.get_by_text(re.compile(r"2001", re.I)).first.click(timeout=5000)
            log("[dob] set via combobox")
            return True
    except Exception as exc:
        log(f"[dob] failed: {exc}")
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
            loc.first.click(timeout=3000)
            loc.first.fill(local, timeout=5000)
            log(f"[phone] filled via {name}: {local}")
            return True, local
        except Exception as exc:
            log(f"[phone] miss {name}: {exc}")
    return False, local


def fill_otp(page, code):
    try:
        one = page.locator("input[name*='code' i], input[id*='code' i], input[autocomplete='one-time-code']")
        if one.count() > 0:
            one.first.fill(code)
            log("[otp] filled single input")
            return True
    except Exception as exc:
        log(f"[otp] single input failed: {exc}")

    try:
        cells = page.locator("input[maxlength='1']")
        if cells.count() >= len(code):
            for i, ch in enumerate(code):
                cells.nth(i).fill(ch)
            log("[otp] filled split cells")
            return True
    except Exception as exc:
        log(f"[otp] split input failed: {exc}")
    return False


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

        senders = [
            ("button-send", lambda pg: pg.get_by_role("button", name=re.compile(r"send code|send sms|send|get code", re.I))),
            ("text-send", lambda pg: pg.get_by_text(re.compile(r"send code|get code", re.I))),
            ("button-next", lambda pg: pg.get_by_role("button", name=re.compile(r"next|continue", re.I))),
        ]
        sent = click_first(page, "send_code", senders)
        page.wait_for_timeout(2000)
        shot(page, "05_after_send_click.png")
        step("click_send_code", clicked=sent, url=page.url)

        code, preview = poll_otp(max_seconds=120, interval=5)
        step("poll_otp", found=bool(code), code=code, preview=preview)

        otp_filled = False
        if code:
            otp_filled = fill_otp(page, code)
            shot(page, "06_after_fill_otp.png")
            verifiers = [
                ("button-verify", lambda pg: pg.get_by_role("button", name=re.compile(r"next|continue|verify|submit", re.I))),
                ("text-verify", lambda pg: pg.get_by_text(re.compile(r"next|continue|verify|submit", re.I))),
            ]
            clicked = click_first(page, "submit_otp", verifiers)
            page.wait_for_timeout(2500)
            shot(page, "07_after_submit_otp.png")
            step("submit_otp", otp_filled=otp_filled, clicked=clicked, url=page.url, title=page.title())

        step(
            "final_state",
            url=page.url,
            title=page.title(),
            blocked=looks_blocked(page),
            otp_filled=otp_filled,
        )
        shot(page, "99_final.png")

        result["ended_at"] = datetime.now().isoformat()
        save_json("99_result.json", result)
        log(f"[done] result={os.path.join(out_dir, '99_result.json')}")

        page.wait_for_timeout(2000)
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
