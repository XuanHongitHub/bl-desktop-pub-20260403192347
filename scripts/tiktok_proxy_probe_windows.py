import json
import os
from playwright.sync_api import sync_playwright

HOST = "51.79.191.62"
PORT = 8589
USER = "clipvNh7Jv"
PWD = "d2ey4Sjm"

CHROME = r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
TARGET = "https://api.ipify.org/?format=json"

servers = [
    f"http://{HOST}:{PORT}",
    f"https://{HOST}:{PORT}",
    f"socks5://{HOST}:{PORT}",
    f"socks4://{HOST}:{PORT}",
]

results = []

with sync_playwright() as p:
    for server in servers:
        for with_auth in [True, False]:
            label = f"{server} auth={with_auth}"
            print(f"[test] {label}", flush=True)
            browser = None
            context = None
            try:
                proxy = {"server": server}
                if with_auth:
                    proxy["username"] = USER
                    proxy["password"] = PWD
                browser = p.chromium.launch(
                    executable_path=CHROME,
                    headless=True,
                    proxy=proxy,
                )
                context = browser.new_context()
                page = context.new_page()
                page.goto(TARGET, wait_until="domcontentloaded", timeout=30000)
                body = page.text_content("body")
                print(f"[ok] {label} => {body}", flush=True)
                results.append({"server": server, "with_auth": with_auth, "ok": True, "body": body})
            except Exception as exc:
                print(f"[err] {label} => {exc}", flush=True)
                results.append({"server": server, "with_auth": with_auth, "ok": False, "error": str(exc)})
            finally:
                if context is not None:
                    try:
                        context.close()
                    except Exception:
                        pass
                if browser is not None:
                    try:
                        browser.close()
                    except Exception:
                        pass

print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)
