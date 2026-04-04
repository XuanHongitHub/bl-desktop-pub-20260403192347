import json
import os
import re
import sys
import traceback
import urllib.request
import urllib.parse
from datetime import datetime

from playwright.sync_api import sync_playwright

WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
PROXY_SERVER = "http://103.183.118.9:50081"
PROXY_USER = "ZXebhC"
PROXY_PASS = "8fiuX9L7"
TARGET_URL = "https://www.tiktok.com/signup/phone-or-email/phone"
API_PHONE_URL = "https://api.sms8.net/api/record?token=3mf0dkdffnr4lkhfef4eqc53lvia9d74ri2s"
MEMORY_PATH = r"E:\\bug-login\\tmp\\tiktok-flow-memory.json"

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
out_dir = rf"E:\\bug-login\\tmp\\tiktok-signup-resume-no-resend-{stamp}"
os.makedirs(out_dir, exist_ok=True)


def log(msg: str):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "ignore").decode("ascii"), flush=True)


def shot(page, name: str):
    path = os.path.join(out_dir, name)
    page.screenshot(path=path, full_page=True)
    log(f"[shot] {path}")


def save_json(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_json(path: str, fallback):
    if not os.path.exists(path):
        return fallback
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback


def extract_digits(text: str):
    found = re.findall(r"\b(\d{4,8})\b", text or "")
    return found[0] if found else None


def extract_code(payload):
    if isinstance(payload, dict):
        for key in ["code", "otp", "otp_code", "verification_code", "sms_code"]:
            value = payload.get(key)
            if isinstance(value, (str, int)):
                c = extract_digits(str(value))
                if c:
                    return c
        for value in payload.values():
            c = extract_code(value)
            if c:
                return c
    elif isinstance(payload, list):
        for item in payload:
            c = extract_code(item)
            if c:
                return c
    elif isinstance(payload, (str, int)):
        return extract_digits(str(payload))
    return None


def fetch_otp_once():
    proxy_url = f"http://{urllib.parse.quote(PROXY_USER)}:{urllib.parse.quote(PROXY_PASS)}@{PROXY_SERVER.replace('http://', '')}"
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler(
            {
                "http": proxy_url,
                "https": proxy_url,
            },
        ),
    )
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
        },
    )
    with opener.open(request, timeout=15) as resp:
        raw = resp.read().decode("utf-8", errors="ignore")
    try:
        payload = json.loads(raw)
        code = extract_code(payload)
    except Exception:
        payload = None
        code = extract_digits(raw)
    return code, raw[:240], payload


def try_fill_code(page, code: str, memory: dict):
    cached = memory.get("code_input_selector")
    selectors = []
    if cached == "placeholder-6digit":
        selectors.append(("placeholder-6digit", lambda pg: pg.get_by_placeholder(re.compile(r"6-?digit code|verification code|enter.*code", re.I))))
    if cached == "autocomplete-one-time-code":
        selectors.append(("autocomplete-one-time-code", lambda pg: pg.locator("input[autocomplete='one-time-code']")))
    if cached == "name-or-id-code":
        selectors.append(("name-or-id-code", lambda pg: pg.locator("input[name*='code' i], input[id*='code' i]")))

    selectors.extend([
        ("placeholder-6digit", lambda pg: pg.get_by_placeholder(re.compile(r"6-?digit code|verification code|enter.*code", re.I))),
        ("autocomplete-one-time-code", lambda pg: pg.locator("input[autocomplete='one-time-code']")),
        ("name-or-id-code", lambda pg: pg.locator("input[name*='code' i], input[id*='code' i]")),
    ])

    seen = set()
    unique = []
    for name, build in selectors:
        if name in seen:
            continue
        seen.add(name)
        unique.append((name, build))

    for name, build in unique:
        try:
            loc = build(page)
            if loc.count() <= 0:
                continue
            loc.first.click(timeout=2500)
            loc.first.fill(code, timeout=4000)
            log(f"[fill] success via {name}")
            return True, name
        except Exception as exc:
            log(f"[fill] miss via {name}: {exc}")

    return False, None


def main():
    memory = read_json(MEMORY_PATH, {})
    result = {
        "timestamp": datetime.now().isoformat(),
        "target_url": TARGET_URL,
        "proxy_server": PROXY_SERVER,
        "memory_before": memory,
        "send_code_action": "skipped",
    }

    code, preview, payload = fetch_otp_once()
    result["otp_code"] = code
    result["otp_preview"] = preview

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=WINDOWS_CHROME,
            headless=False,
            proxy={"server": PROXY_SERVER, "username": PROXY_USER, "password": PROXY_PASS},
            args=["--disable-blink-features=AutomationControlled"],
            slow_mo=70,
        )
        context = browser.new_context(viewport={"width": 1400, "height": 900}, locale="en-US")
        page = context.new_page()

        page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(1800)
        shot(page, "01_open.png")

        filled = False
        selector_used = None
        if code:
            filled, selector_used = try_fill_code(page, code, memory)
            page.wait_for_timeout(800)
        shot(page, "02_after_fill.png")

        clicked_next = False
        next_enabled = False
        try:
            next_btn = page.get_by_role("button", name=re.compile(r"next|continue", re.I)).first
            next_enabled = next_btn.is_enabled(timeout=1200)
            if next_enabled and filled:
                next_btn.click(timeout=3000)
                clicked_next = True
                page.wait_for_timeout(1800)
        except Exception as exc:
            log(f"[next] skip: {exc}")

        shot(page, "03_after_next.png")

        result.update(
            {
                "filled": filled,
                "selector_used": selector_used,
                "next_enabled": next_enabled,
                "clicked_next": clicked_next,
                "final_url": page.url,
                "title": page.title(),
            }
        )

        memory_update = dict(memory)
        memory_update["last_run_at"] = datetime.now().isoformat()
        memory_update["last_otp_code"] = code
        if selector_used:
            memory_update["code_input_selector"] = selector_used
        memory_update["last_out_dir"] = out_dir
        save_json(MEMORY_PATH, memory_update)

        result["memory_after"] = memory_update
        save_json(os.path.join(out_dir, "99_result.json"), result)
        log(f"[done] {os.path.join(out_dir, '99_result.json')}")

        page.wait_for_timeout(1200)
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
        save_json(os.path.join(out_dir, "99_error.json"), err)
        sys.exit(1)
