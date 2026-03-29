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

_arg_parser = argparse.ArgumentParser(add_help=False)
_arg_parser.add_argument("--proxy-host", dest="proxy_host")
_arg_parser.add_argument("--proxy-port", dest="proxy_port")
_arg_parser.add_argument("--proxy-user", dest="proxy_user")
_arg_parser.add_argument("--proxy-pass", dest="proxy_pass")
_arg_parser.add_argument("--proxy-rotate-url", dest="proxy_rotate_url")
_args, _unknown = _arg_parser.parse_known_args()

PROXY_HOST = _args.proxy_host or os.getenv("PROXY_HOST", "51.79.191.62")
PROXY_PORT = int(_args.proxy_port or os.getenv("PROXY_PORT", "8589"))
PROXY_USER = _args.proxy_user or os.getenv("PROXY_USER", "clipvNh7Jv")
PROXY_PASS = _args.proxy_pass or os.getenv("PROXY_PASS", "d2ey4Sjm")
PROXY_ROTATE_URL = (
    _args.proxy_rotate_url
    if _args.proxy_rotate_url is not None
    else os.getenv(
        "PROXY_ROTATE_URL",
        "https://api.zingproxy.com/open/get-proxy/s6n912b5zpv709330d25a089e9a7c8d3ee0b9b934754549e31c76e2",
    )
)

WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
out_dir = rf"E:\\bug-login\\tmp\\tiktok-probe-{stamp}"
os.makedirs(out_dir, exist_ok=True)


def log(msg: str) -> None:
    print(msg, flush=True)


def save_json(name: str, data) -> None:
    path = os.path.join(out_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def screenshot(page, name: str) -> None:
    path = os.path.join(out_dir, name)
    page.screenshot(path=path, full_page=True)
    log(f"[shot] {path}")


def click_first(page, description: str, locator_builders):
    for locator_name, builder in locator_builders:
        try:
            locator = builder(page)
            count = locator.count()
            if count <= 0:
                continue
            locator.first.click(timeout=5000)
            log(f"[click] {description} via {locator_name}")
            return True, locator_name
        except Exception as exc:
            log(f"[miss] {description} via {locator_name}: {exc}")
    return False, None


def dump_candidate_controls(page, name: str):
    data = page.evaluate(
        """
        () => {
          const nodes = Array.from(document.querySelectorAll('input,select,button,a,[role="button"],[role="combobox"]'));
          return nodes.slice(0, 400).map((el) => ({
            tag: el.tagName.toLowerCase(),
            type: (el.getAttribute('type') || '').toLowerCase(),
            role: (el.getAttribute('role') || '').toLowerCase(),
            name: el.getAttribute('name') || '',
            id: el.getAttribute('id') || '',
            placeholder: el.getAttribute('placeholder') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            text: (el.innerText || '').trim().slice(0, 120)
          }));
        }
        """
    )
    save_json(name, data)


def try_set_dob(page):
    # Strategy 1: native select fields
    month_select = page.locator(
        "select[name*='month' i], select[id*='month' i], select[aria-label*='month' i], select[name*='thang' i], select[id*='thang' i], select[aria-label*='thang' i]"
    )
    day_select = page.locator(
        "select[name*='day' i], select[id*='day' i], select[aria-label*='day' i], select[name*='ngay' i], select[id*='ngay' i], select[aria-label*='ngay' i]"
    )
    year_select = page.locator(
        "select[name*='year' i], select[id*='year' i], select[aria-label*='year' i], select[name*='nam' i], select[id*='nam' i], select[aria-label*='nam' i]"
    )

    if month_select.count() and day_select.count() and year_select.count():
        try:
            month_select.first.select_option(label=re.compile(r"jan|tháng 1|thang 1", re.I))
        except Exception:
            month_select.first.select_option(value="1")
        try:
            day_select.first.select_option(value="1")
        except Exception:
            day_select.first.select_option(label=re.compile(r"^1$"))
        try:
            year_select.first.select_option(value="2001")
        except Exception:
            year_select.first.select_option(label=re.compile(r"2001"))
        log("[dob] set via native select")
        return True

    # Strategy 2: input placeholders
    filled = 0
    for pattern, value in [
        (re.compile(r"month|tháng", re.I), "Jan"),
        (re.compile(r"day|ngày", re.I), "01"),
        (re.compile(r"year|năm", re.I), "2001"),
    ]:
        try:
            p = page.get_by_placeholder(pattern)
            if p.count() > 0:
                p.first.fill(value)
                filled += 1
        except Exception:
            pass

    if filled >= 2:
        log("[dob] set via placeholders")
        return True

    # Strategy 3: combobox by role+label text
    try:
        m = page.get_by_role("combobox", name=re.compile(r"month|tháng", re.I))
        d = page.get_by_role("combobox", name=re.compile(r"day|ngày", re.I))
        y = page.get_by_role("combobox", name=re.compile(r"year|năm", re.I))
        if m.count() and d.count() and y.count():
            m.first.click(timeout=3000)
            page.get_by_text(re.compile(r"^jan$|tháng 1|thang 1", re.I)).first.click(timeout=3000)
            d.first.click(timeout=3000)
            page.get_by_text(re.compile(r"^1$|^01$")).first.click(timeout=3000)
            y.first.click(timeout=3000)
            page.get_by_text(re.compile(r"2001")).first.click(timeout=3000)
            log("[dob] set via combobox")
            return True
    except Exception as exc:
        log(f"[dob] combobox strategy failed: {exc}")

    return False


def main():
    log(f"[info] output dir: {out_dir}")

    # Ask proxy provider to rotate once before running (optional)
    if PROXY_ROTATE_URL.strip():
        try:
            with urllib.request.urlopen(PROXY_ROTATE_URL, timeout=20) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
            save_json("00_rotate_response.json", {"response": body[:2000]})
            log("[proxy] rotate endpoint called")
        except Exception as exc:
            save_json("00_rotate_response.json", {"error": str(exc)})
            log(f"[proxy] rotate endpoint failed: {exc}")
    else:
        save_json("00_rotate_response.json", {"skipped": True})
        log("[proxy] rotate endpoint skipped")

    if not os.path.exists(WINDOWS_CHROME):
        raise RuntimeError(f"Chrome not found at {WINDOWS_CHROME}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=WINDOWS_CHROME,
            headless=True,
            proxy={
                "server": f"http://{PROXY_HOST}:{PROXY_PORT}",
                "username": PROXY_USER,
                "password": PROXY_PASS,
            },
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="America/New_York",
        )
        page = context.new_page()

        try:
            page.goto("https://shop.tiktok.com", wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(4000)
            log(f"[nav] url={page.url}")
            log(f"[nav] title={page.title()}")
            screenshot(page, "01_shop_home.png")
            dump_candidate_controls(page, "01_controls_home.json")

            signup_locators = [
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
            login_locators = [
                (
                    "button-login",
                    lambda pg: pg.get_by_role(
                        "button",
                        name=re.compile(r"log in|login|sign in|đăng nhập", re.I),
                    ),
                ),
                (
                    "link-login",
                    lambda pg: pg.get_by_role(
                        "link",
                        name=re.compile(r"log in|login|sign in|đăng nhập", re.I),
                    ),
                ),
                (
                    "text-login",
                    lambda pg: pg.get_by_text(
                        re.compile(r"log in|login|sign in|đăng nhập", re.I),
                    ),
                ),
            ]

            clicked_signup, _ = click_first(page, "signup", signup_locators)
            if not clicked_signup:
                clicked_login, _ = click_first(page, "login", login_locators)
                if clicked_login:
                    page.wait_for_timeout(2000)
                    screenshot(page, "02_after_login_click.png")
                    dump_candidate_controls(page, "02_controls_after_login.json")
                    clicked_signup, _ = click_first(page, "signup-after-login", signup_locators)

            page.wait_for_timeout(3000)
            screenshot(page, "03_after_signup_attempt.png")
            dump_candidate_controls(page, "03_controls_after_signup_attempt.json")

            phone_locators = [
                (
                    "button-use-phone",
                    lambda pg: pg.get_by_role(
                        "button",
                        name=re.compile(r"use phone|phone number|phone|số điện thoại|điện thoại", re.I),
                    ),
                ),
                (
                    "text-use-phone",
                    lambda pg: pg.get_by_text(
                        re.compile(r"use phone|phone number|phone|số điện thoại|điện thoại", re.I),
                    ),
                ),
            ]
            click_first(page, "use-phone", phone_locators)

            page.wait_for_timeout(3000)
            screenshot(page, "04_after_use_phone_attempt.png")
            dump_candidate_controls(page, "04_controls_after_use_phone.json")

            dob_set = False
            try:
                dob_set = try_set_dob(page)
            except Exception as exc:
                log(f"[dob] set failed with exception: {exc}")

            page.wait_for_timeout(1000)
            screenshot(page, "05_after_dob_attempt.png")
            dump_candidate_controls(page, "05_controls_after_dob.json")

            result = {
                "final_url": page.url,
                "title": page.title(),
                "dob_set": dob_set,
                "timestamp": datetime.now().isoformat(),
            }
            save_json("99_result.json", result)
            log(f"[done] {json.dumps(result, ensure_ascii=False)}")
        finally:
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
        }
        print(json.dumps(err, ensure_ascii=False), flush=True)
        try:
            os.makedirs(out_dir, exist_ok=True)
            save_json("99_error.json", err)
        except Exception:
            pass
        sys.exit(1)
