import argparse
import json
import os
import re
import sys
import time
import traceback
import urllib.request
from datetime import datetime

from playwright.sync_api import sync_playwright

WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--proxy-host", required=True)
    parser.add_argument("--proxy-port", type=int, required=True)
    parser.add_argument("--proxy-user", required=True)
    parser.add_argument("--proxy-pass", required=True)
    parser.add_argument("--proxy-rotate-url", default="")
    parser.add_argument("--wait-seconds", type=int, default=300)
    parser.add_argument("--target", default="https://shop.tiktok.com/us")
    return parser.parse_args()


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_out_dir() -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = rf"E:\\bug-login\\tmp\\tiktok-manual-solve-{stamp}"
    os.makedirs(out_dir, exist_ok=True)
    return out_dir


def save_json(out_dir: str, name: str, data) -> None:
    with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def screenshot(page, out_dir: str, name: str) -> None:
    path = os.path.join(out_dir, name)
    page.screenshot(path=path, full_page=True)
    log(f"[shot] {path}")


def click_first(page, description: str, locator_builders):
    for locator_name, builder in locator_builders:
        try:
            locator = builder(page)
            if locator.count() <= 0:
                continue
            locator.first.click(timeout=5000)
            log(f"[click] {description} via {locator_name}")
            return True
        except Exception as exc:
            log(f"[miss] {description} via {locator_name}: {exc}")
    return False


def wait_url_contains(page, keywords: list[str], timeout_ms: int = 15000) -> bool:
    deadline = time.time() + (timeout_ms / 1000.0)
    lowered = [k.lower() for k in keywords]
    while time.time() < deadline:
        current = (page.url or "").lower()
        if any(k in current for k in lowered):
            return True
        page.wait_for_timeout(400)
    return False


def set_dob(page) -> bool:
    try:
        month = page.get_by_role("combobox", name=re.compile(r"month|tháng", re.I))
        day = page.get_by_role("combobox", name=re.compile(r"day|ngày", re.I))
        year = page.get_by_role("combobox", name=re.compile(r"year|năm", re.I))

        if month.count() and day.count() and year.count():
            month.first.click(timeout=5000)
            page.get_by_text(re.compile(r"^jan$|january|tháng 1|thang 1", re.I)).first.click(timeout=5000)

            day.first.click(timeout=5000)
            page.get_by_text(re.compile(r"^1$|^01$", re.I)).first.click(timeout=5000)

            year.first.click(timeout=5000)
            page.get_by_text(re.compile(r"2001", re.I)).first.click(timeout=5000)

            log("[dob] set via combobox")
            return True
    except Exception as exc:
        log(f"[dob] combobox strategy failed: {exc}")

    return False


def build_cookie_header(cookies: list[dict]) -> str:
    filtered = [
        c for c in cookies if "domain" in c and c["domain"] and "tiktok.com" in c["domain"].lower()
    ]
    filtered.sort(key=lambda c: (0 if "shop.tiktok.com" in c.get("domain", "") else 1, c.get("name", "")))

    seen = set()
    parts = []
    for c in filtered:
        name = (c.get("name") or "").strip()
        value = (c.get("value") or "").strip()
        if not name or not value:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        parts.append(f"{name}={value}")
    return "; ".join(parts)


def main() -> int:
    args = parse_args()
    out_dir = ensure_out_dir()
    log(f"[info] output dir: {out_dir}")

    if args.proxy_rotate_url.strip():
        try:
            with urllib.request.urlopen(args.proxy_rotate_url, timeout=20) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
            save_json(out_dir, "00_rotate_response.json", {"response": body[:2000]})
            log("[proxy] rotate endpoint called")
        except Exception as exc:
            save_json(out_dir, "00_rotate_response.json", {"error": str(exc)})
            log(f"[proxy] rotate endpoint failed: {exc}")
    else:
        save_json(out_dir, "00_rotate_response.json", {"skipped": True})

    if not os.path.exists(WINDOWS_CHROME):
        raise RuntimeError(f"Chrome not found at {WINDOWS_CHROME}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=WINDOWS_CHROME,
            headless=False,
            proxy={
                "server": f"http://{args.proxy_host}:{args.proxy_port}",
                "username": args.proxy_user,
                "password": args.proxy_pass,
            },
            args=["--disable-blink-features=AutomationControlled"],
            slow_mo=150,
        )

        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            timezone_id="America/New_York",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        page.goto(args.target, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(2500)
        log(f"[nav] {page.url} | title={page.title()}")
        screenshot(page, out_dir, "01_initial.png")

        # Wait for user to solve Security Check manually.
        log(
            f"[manual] Please solve Security Check/CAPTCHA in opened Chrome window. Waiting up to {args.wait_seconds}s..."
        )
        deadline = time.time() + args.wait_seconds
        solved = False
        while time.time() < deadline:
            try:
                title = (page.title() or "").strip().lower()
                body_text = page.locator("body").inner_text(timeout=2000).lower()
                looks_blocked = (
                    "security check" in title
                    or "verify to continue" in body_text
                    or "drag the puzzle piece" in body_text
                )
                if not looks_blocked:
                    solved = True
                    break
            except Exception:
                pass
            page.wait_for_timeout(1500)

        screenshot(page, out_dir, "02_after_manual_wait.png")
        log(f"[manual] solved={solved} current_url={page.url} title={page.title()}")

        signup_locators = [
            (
                "button-create-account",
                lambda pg: pg.get_by_role(
                    "button",
                    name=re.compile(r"create account|sign up|signup|register|đăng ký", re.I),
                ),
            ),
            (
                "button-signup",
                lambda pg: pg.get_by_role(
                    "button",
                    name=re.compile(r"sign up|signup|register|create account|đăng ký", re.I),
                ),
            ),
            (
                "link-signup",
                lambda pg: pg.get_by_role(
                    "link",
                    name=re.compile(r"sign up|signup|register|create account|đăng ký", re.I),
                ),
            ),
            (
                "text-signup",
                lambda pg: pg.get_by_text(
                    re.compile(r"sign up|signup|register|create account|đăng ký", re.I),
                ),
            ),
        ]

        if "tiktok.com/signup" not in page.url.lower():
            click_first(page, "signup", signup_locators)
            if not wait_url_contains(page, ["tiktok.com/signup"], timeout_ms=10000):
                log("[nav] fallback goto signup page")
                page.goto(
                    "https://www.tiktok.com/signup/?enter_from=ecommerce_mall&redirect_url=https%3A%2F%2Fshop.tiktok.com%2Fus%3Fenter_from%3Decommerce_mall%26enter_method%3DUserPortal%26lang%3Den-US&enter_method=UserPortal&lang=en-US",
                    wait_until="domcontentloaded",
                    timeout=90000,
                )
                page.wait_for_timeout(1500)
        screenshot(page, out_dir, "03_after_signup_phone.png")

        phone_locators = [
            (
                "button-use-phone",
                lambda pg: pg.get_by_role(
                    "button", name=re.compile(r"use phone or email|use phone|phone", re.I)
                ),
            ),
            (
                "button-use-phone-div",
                lambda pg: pg.locator("button:has-text('Use phone or email')"),
            ),
            (
                "text-use-phone",
                lambda pg: pg.get_by_text(
                    re.compile(r"use phone|phone number|phone|số điện thoại|điện thoại", re.I),
                ),
            ),
        ]
        if "signup/phone-or-email/phone" not in page.url.lower():
            clicked_phone = click_first(page, "use-phone", phone_locators)
            if clicked_phone:
                wait_url_contains(page, ["signup/phone-or-email/phone"], timeout_ms=8000)
            if "signup/phone-or-email/phone" not in page.url.lower():
                log("[nav] fallback goto signup/phone-or-email/phone")
                page.goto(
                    "https://www.tiktok.com/signup/phone-or-email/phone",
                    wait_until="domcontentloaded",
                    timeout=90000,
                )
                page.wait_for_timeout(1500)

        screenshot(page, out_dir, "04_signup_phone_form.png")

        dob_set = set_dob(page)
        page.wait_for_timeout(1000)
        screenshot(page, out_dir, "05_after_set_dob.png")

        cookies = context.cookies()
        cookie_header = build_cookie_header(cookies)
        save_json(out_dir, "05_cookies_tiktok.json", cookies)
        save_json(
            out_dir,
            "99_result.json",
            {
                "final_url": page.url,
                "title": page.title(),
                "dob_set": dob_set,
                "cookie_header_preview": cookie_header[:300],
                "cookie_header_length": len(cookie_header),
                "timestamp": datetime.now().isoformat(),
            },
        )

        log("[done] Flow finished. You can close Chrome window now.")
        log(f"[done] result file: {os.path.join(out_dir, '99_result.json')}")

        # Keep browser for a short time so user can visually verify.
        page.wait_for_timeout(5000)
        context.close()
        browser.close()

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        err_dir = ensure_out_dir()
        err = {
            "error": str(exc),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat(),
        }
        save_json(err_dir, "99_error.json", err)
        print(json.dumps(err, ensure_ascii=False), flush=True)
        sys.exit(1)
