import json
import os
import re
import sys
import traceback
from datetime import datetime

from playwright.sync_api import sync_playwright

WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
PROXY_SERVER = "http://103.183.118.9:50081"
PROXY_USER = "ZXebhC"
PROXY_PASS = "8fiuX9L7"
TARGET_URL = "https://www.tiktok.com/signup/phone-or-email/phone"
DRY_CODE = "123456"

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
out_dir = rf"E:\\bug-login\\tmp\\tiktok-code-dry-smoke-{stamp}"
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


def save(name: str, data):
    with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def try_fill_code(page, code: str):
    selectors = [
        (
            "placeholder-6digit",
            lambda pg: pg.get_by_placeholder(
                re.compile(r"6-?digit code|verification code|enter.*code", re.I),
            ),
        ),
        (
            "autocomplete-one-time-code",
            lambda pg: pg.locator("input[autocomplete='one-time-code']"),
        ),
        (
            "name-or-id-code",
            lambda pg: pg.locator("input[name*='code' i], input[id*='code' i]"),
        ),
    ]

    for name, build in selectors:
        try:
            loc = build(page)
            count = loc.count()
            if count <= 0:
                log(f"[dry] {name}: no input")
                continue
            loc.first.click(timeout=2000)
            loc.first.fill(code, timeout=4000)
            log(f"[dry] filled code via {name}")
            return True, name
        except Exception as exc:
            log(f"[dry] {name}: fail {exc}")

    # split cells fallback
    try:
        cells = page.locator("input[maxlength='1']")
        if cells.count() >= len(code):
            for i, ch in enumerate(code):
                cells.nth(i).fill(ch)
            log("[dry] filled code via split-cells")
            return True, "split-cells"
    except Exception as exc:
        log(f"[dry] split-cells fail {exc}")

    return False, None


def main():
    result = {
        "timestamp": datetime.now().isoformat(),
        "target_url": TARGET_URL,
        "proxy_server": PROXY_SERVER,
        "dry_code": DRY_CODE,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=WINDOWS_CHROME,
            headless=False,
            proxy={"server": PROXY_SERVER, "username": PROXY_USER, "password": PROXY_PASS},
            args=["--disable-blink-features=AutomationControlled"],
            slow_mo=80,
        )
        ctx = browser.new_context(viewport={"width": 1400, "height": 900}, locale="en-US")
        page = ctx.new_page()

        page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(2500)
        shot(page, "01_open.png")

        ok, via = try_fill_code(page, DRY_CODE)
        page.wait_for_timeout(700)
        shot(page, "02_after_dry_fill.png")

        next_enabled = False
        try:
            btn = page.get_by_role("button", name=re.compile(r"next|continue", re.I)).first
            next_enabled = btn.is_enabled(timeout=1200)
        except Exception:
            next_enabled = False

        result.update(
            {
                "fill_ok": ok,
                "fill_selector": via,
                "next_enabled_after_fill": next_enabled,
                "final_url": page.url,
                "title": page.title(),
            }
        )
        save("99_result.json", result)
        log(f"[done] {os.path.join(out_dir, '99_result.json')}")

        page.wait_for_timeout(1500)
        ctx.close()
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
            save("99_error.json", err)
        except Exception:
            pass
        sys.exit(1)
