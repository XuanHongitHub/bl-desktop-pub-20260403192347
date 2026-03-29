import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime

from playwright.sync_api import sync_playwright

WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Manual-assisted TikTok cookie collector (Windows Chrome). "
            "This script does not automate signup/OTP/captcha bypass."
        )
    )
    parser.add_argument("--target", default="https://shop.tiktok.com/us")
    parser.add_argument("--manual-wait-seconds", type=int, default=240)
    parser.add_argument("--done-flag-path", default="")
    parser.add_argument("--auto-signup-dob", action="store_true")
    parser.add_argument("--dob-month", default="Jan")
    parser.add_argument("--dob-day", default="1")
    parser.add_argument("--dob-year", default="2001")

    parser.add_argument("--proxy-host", default="")
    parser.add_argument("--proxy-port", type=int, default=0)
    parser.add_argument("--proxy-user", default="")
    parser.add_argument("--proxy-pass", default="")

    parser.add_argument("--bugidea-base-url", default="")
    parser.add_argument("--bugidea-token", default="")
    parser.add_argument("--label", default="")
    parser.add_argument("--notes", default="")
    return parser.parse_args()


def log(message: str) -> None:
    print(message, flush=True)


def ensure_output_dir() -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_dir = rf"E:\\bug-login\\tmp\\tiktok-cookie-push-{stamp}"
    os.makedirs(output_dir, exist_ok=True)
    return output_dir


def save_json(output_dir: str, name: str, data) -> None:
    with open(os.path.join(output_dir, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def screenshot(page, output_dir: str, name: str) -> None:
    path = os.path.join(output_dir, name)
    page.screenshot(path=path, full_page=True)
    log(f"[shot] {path}")


def build_cookie_header(cookies: list[dict]) -> str:
    filtered = []
    for cookie in cookies:
        domain = (cookie.get("domain") or "").lower()
        if "tiktok.com" in domain or "tiktokw.us" in domain:
            filtered.append(cookie)

    # Prefer shop cookies first, then generic tiktok domains.
    filtered.sort(
        key=lambda cookie: (
            0 if "shop.tiktok.com" in (cookie.get("domain") or "").lower() else 1,
            cookie.get("name", ""),
        )
    )

    seen_names = set()
    parts = []
    for cookie in filtered:
        name = (cookie.get("name") or "").strip()
        value = (cookie.get("value") or "").strip()
        if not name or not value:
            continue
        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)
        parts.append(f"{name}={value}")
    return "; ".join(parts)


def maybe_post_cookie(
    base_url: str,
    token: str,
    label: str,
    cookie_header: str,
    notes: str,
) -> dict:
    endpoint = base_url.rstrip("/") + "/api/tiktok-cookies"
    payload = {
        "label": label,
        "cookie": cookie_header,
        "notes": notes,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        return {
            "status": resp.status,
            "body_preview": body[:2000],
            "endpoint": endpoint,
        }


def wait_manual(window_seconds: int, done_flag_path: str) -> dict:
    start = time.time()
    last_log_mark = -1
    finished_by_flag = False

    while True:
        elapsed = int(time.time() - start)
        if elapsed >= window_seconds:
            break

        if done_flag_path and os.path.exists(done_flag_path):
            finished_by_flag = True
            break

        mark = elapsed // 15
        if mark != last_log_mark:
            remaining = max(0, window_seconds - elapsed)
            log(f"[manual] waiting... {remaining}s remaining")
            last_log_mark = mark

        time.sleep(1)

    return {
        "waited_seconds": int(time.time() - start),
        "finished_by_flag": finished_by_flag,
    }


def click_first(page, description: str, locator_builders) -> bool:
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


def wait_url_contains(page, keywords: list[str], timeout_ms: int = 12000) -> bool:
    deadline = time.time() + (timeout_ms / 1000.0)
    lowered = [x.lower() for x in keywords]
    while time.time() < deadline:
        current = (page.url or "").lower()
        if any(key in current for key in lowered):
            return True
        page.wait_for_timeout(300)
    return False


def try_set_dob(page, month_value: str, day_value: str, year_value: str) -> bool:
    try:
        month = page.get_by_role("combobox", name=re.compile(r"month|tháng", re.I))
        day = page.get_by_role("combobox", name=re.compile(r"day|ngày", re.I))
        year = page.get_by_role("combobox", name=re.compile(r"year|năm", re.I))
        if month.count() and day.count() and year.count():
            month.first.click(timeout=5000)
            page.get_by_text(re.compile(rf"^{re.escape(month_value)}$|january|jan", re.I)).first.click(
                timeout=5000
            )
            day.first.click(timeout=5000)
            page.get_by_text(re.compile(rf"^{re.escape(day_value)}$|^0?{re.escape(day_value)}$", re.I)).first.click(
                timeout=5000
            )
            year.first.click(timeout=5000)
            page.get_by_text(re.compile(rf"{re.escape(year_value)}", re.I)).first.click(timeout=5000)
            log("[dob] set via combobox")
            return True
    except Exception as exc:
        log(f"[dob] set failed: {exc}")
    return False


def run_semi_auto_signup_dob(page, output_dir: str, month_value: str, day_value: str, year_value: str) -> dict:
    result = {
        "attempted": True,
        "signup_opened": False,
        "phone_form_opened": False,
        "dob_set": False,
        "final_url": "",
    }

    signup_locators = [
        (
            "button-create-account",
            lambda pg: pg.get_by_role(
                "button",
                name=re.compile(r"create account|sign up|signup|register|đăng ký", re.I),
            ),
        ),
        (
            "link-signup",
            lambda pg: pg.get_by_role(
                "link",
                name=re.compile(r"create account|sign up|signup|register|đăng ký", re.I),
            ),
        ),
        (
            "text-signup",
            lambda pg: pg.get_by_text(re.compile(r"create account|sign up|signup|register|đăng ký", re.I)),
        ),
    ]
    phone_locators = [
        (
            "button-use-phone",
            lambda pg: pg.get_by_role(
                "button",
                name=re.compile(r"use phone or email|use phone|phone", re.I),
            ),
        ),
        (
            "text-use-phone",
            lambda pg: pg.get_by_text(re.compile(r"use phone or email|use phone|phone", re.I)),
        ),
    ]

    if "tiktok.com/signup" not in page.url.lower():
        click_first(page, "signup", signup_locators)
        if not wait_url_contains(page, ["tiktok.com/signup"], timeout_ms=9000):
            log("[nav] fallback goto signup page")
            page.goto(
                "https://www.tiktok.com/signup/?enter_from=ecommerce_mall&redirect_url=https%3A%2F%2Fshop.tiktok.com%2Fus%3Fenter_from%3Decommerce_mall%26enter_method%3DUserPortal%26lang%3Den-US&enter_method=UserPortal&lang=en-US",
                wait_until="domcontentloaded",
                timeout=90000,
            )
            page.wait_for_timeout(1200)
    result["signup_opened"] = "tiktok.com/signup" in page.url.lower()
    screenshot(page, output_dir, "03_after_auto_signup.png")

    if "signup/phone-or-email/phone" not in page.url.lower():
        click_first(page, "use-phone", phone_locators)
        if not wait_url_contains(page, ["signup/phone-or-email/phone"], timeout_ms=7000):
            log("[nav] fallback goto phone signup page")
            page.goto(
                "https://www.tiktok.com/signup/phone-or-email/phone",
                wait_until="domcontentloaded",
                timeout=90000,
            )
            page.wait_for_timeout(1200)
    result["phone_form_opened"] = "signup/phone-or-email/phone" in page.url.lower()
    screenshot(page, output_dir, "04_after_auto_use_phone.png")

    result["dob_set"] = try_set_dob(page, month_value, day_value, year_value)
    screenshot(page, output_dir, "05_after_auto_dob.png")
    result["final_url"] = page.url
    return result


def main() -> int:
    args = parse_args()
    output_dir = ensure_output_dir()
    log(f"[info] output dir: {output_dir}")

    if not os.path.exists(WINDOWS_CHROME):
        raise RuntimeError(f"Chrome not found at {WINDOWS_CHROME}")

    proxy = None
    if args.proxy_host and args.proxy_port > 0:
        proxy = {
            "server": f"http://{args.proxy_host}:{args.proxy_port}",
            "username": args.proxy_user,
            "password": args.proxy_pass,
        }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=WINDOWS_CHROME,
            headless=False,
            proxy=proxy,
            args=["--disable-blink-features=AutomationControlled"],
            slow_mo=120,
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
        page.wait_for_timeout(2000)
        screenshot(page, output_dir, "01_initial.png")
        log(f"[nav] url={page.url}")
        log(f"[nav] title={page.title()}")

        log(
            "[manual] Do manual steps in the opened browser window "
            "(captcha/login/signup/OTP by yourself)."
        )
        if args.done_flag_path:
            log(f"[manual] Create file to finish early: {args.done_flag_path}")
        wait_result = wait_manual(args.manual_wait_seconds, args.done_flag_path)
        screenshot(page, output_dir, "02_after_manual.png")

        auto_flow = {"attempted": False}
        if args.auto_signup_dob:
            log("[auto] running semi-auto signup flow until DOB step")
            auto_flow = run_semi_auto_signup_dob(
                page=page,
                output_dir=output_dir,
                month_value=args.dob_month,
                day_value=args.dob_day,
                year_value=args.dob_year,
            )

        cookies = context.cookies()
        cookie_header = build_cookie_header(cookies)
        save_json(output_dir, "06_cookies_raw.json", cookies)

        push_result = {"skipped": True}
        if args.bugidea_base_url and args.bugidea_token and cookie_header:
            label = args.label.strip() or f"manual-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            notes = args.notes.strip() or "Collected by manual-assisted script."
            try:
                push_result = maybe_post_cookie(
                    base_url=args.bugidea_base_url,
                    token=args.bugidea_token,
                    label=label,
                    cookie_header=cookie_header,
                    notes=notes,
                )
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="ignore")
                push_result = {
                    "error": f"HTTP {exc.code}",
                    "body_preview": body[:2000],
                }
            except Exception as exc:
                push_result = {"error": str(exc)}
        elif args.bugidea_base_url and args.bugidea_token and not cookie_header:
            push_result = {"skipped": True, "reason": "empty_cookie_header"}

        result = {
            "timestamp": datetime.now().isoformat(),
            "target": args.target,
            "final_url": page.url,
            "title": page.title(),
            "manual_wait": wait_result,
            "auto_signup_dob": auto_flow,
            "cookie_header_length": len(cookie_header),
            "cookie_header_preview": cookie_header[:300],
            "tiktok_cookie_count": len(
                [
                    c
                    for c in cookies
                    if "tiktok.com" in (c.get("domain") or "").lower()
                    or "tiktokw.us" in (c.get("domain") or "").lower()
                ]
            ),
            "pushed": push_result,
        }
        save_json(output_dir, "99_result.json", result)
        log(f"[done] result file: {os.path.join(output_dir, '99_result.json')}")

        page.wait_for_timeout(2000)
        context.close()
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
