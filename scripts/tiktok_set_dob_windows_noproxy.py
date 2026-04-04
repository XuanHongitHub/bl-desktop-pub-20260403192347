import json
import os
import re
from datetime import datetime

from playwright.sync_api import sync_playwright

WINDOWS_CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
out_dir = rf"E:\\bug-login\\tmp\\tiktok-dob-noproxy-{stamp}"
os.makedirs(out_dir, exist_ok=True)


def shot(page, name):
    page.screenshot(path=os.path.join(out_dir, name), full_page=True)


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=WINDOWS_CHROME,
        headless=True,
        args=["--disable-blink-features=AutomationControlled"],
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    page.goto("https://www.tiktok.com/signup/phone-or-email/phone", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3000)
    shot(page, "01_signup_phone.png")

    month = page.get_by_role("combobox", name=re.compile(r"month", re.I))
    day = page.get_by_role("combobox", name=re.compile(r"day", re.I))
    year = page.get_by_role("combobox", name=re.compile(r"year", re.I))

    month.first.click(timeout=5000)
    page.get_by_text(re.compile(r"^jan$|january", re.I)).first.click(timeout=5000)

    day.first.click(timeout=5000)
    page.get_by_text(re.compile(r"^1$|^01$", re.I)).first.click(timeout=5000)

    year.first.click(timeout=5000)
    page.get_by_text(re.compile(r"2001", re.I)).first.click(timeout=5000)

    page.wait_for_timeout(1000)
    shot(page, "02_after_set_dob.png")

    result = {
        "url": page.url,
        "month_text": month.first.text_content(),
        "day_text": day.first.text_content(),
        "year_text": year.first.text_content(),
        "timestamp": datetime.now().isoformat(),
    }
    with open(os.path.join(out_dir, "99_result.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(json.dumps(result, ensure_ascii=False), flush=True)

    context.close()
    browser.close()
