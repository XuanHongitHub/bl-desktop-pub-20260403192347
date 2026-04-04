import json
import os
import re
import sys
import traceback
from datetime import datetime

from playwright.sync_api import sync_playwright

WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
out_dir = rf"E:\\bug-login\\tmp\\tiktok-probe-noproxy-{stamp}"
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
            if locator.count() <= 0:
                continue
            locator.first.click(timeout=5000)
            log(f"[click] {description} via {locator_name}")
            return True
        except Exception as exc:
            log(f"[miss] {description} via {locator_name}: {exc}")
    return False


def dump_candidate_controls(page, name: str):
    data = page.evaluate(
        """
        () => {
          const nodes = Array.from(document.querySelectorAll('input,select,button,a,[role="button"],[role="combobox"]'));
          return nodes.slice(0, 500).map((el) => ({
            tag: el.tagName.toLowerCase(),
            type: (el.getAttribute('type') || '').toLowerCase(),
            role: (el.getAttribute('role') || '').toLowerCase(),
            name: el.getAttribute('name') || '',
            id: el.getAttribute('id') || '',
            placeholder: el.getAttribute('placeholder') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            text: (el.innerText || '').trim().slice(0, 160)
          }));
        }
        """
    )
    save_json(name, data)


with sync_playwright() as p:
    try:
        browser = p.chromium.launch(
            executable_path=WINDOWS_CHROME,
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            timezone_id="America/New_York",
        )
        page = context.new_page()

        page.goto("https://shop.tiktok.com", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(3000)
        log(f"[nav] {page.url}")
        screenshot(page, "01_home.png")
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

        if not click_first(page, "signup", signup_locators):
            if click_first(page, "login", login_locators):
                page.wait_for_timeout(2000)
                click_first(page, "signup-after-login", signup_locators)

        page.wait_for_timeout(3000)
        screenshot(page, "02_after_signup.png")
        dump_candidate_controls(page, "02_controls_after_signup.json")

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
        screenshot(page, "03_after_use_phone.png")
        dump_candidate_controls(page, "03_controls_after_use_phone.json")

        result = {
            "final_url": page.url,
            "title": page.title(),
            "timestamp": datetime.now().isoformat(),
        }
        save_json("99_result.json", result)
        log(json.dumps(result, ensure_ascii=False))

        context.close()
        browser.close()
    except Exception as exc:
        err = {
            "error": str(exc),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.now().isoformat(),
        }
        save_json("99_error.json", err)
        print(json.dumps(err, ensure_ascii=False), flush=True)
        sys.exit(1)
