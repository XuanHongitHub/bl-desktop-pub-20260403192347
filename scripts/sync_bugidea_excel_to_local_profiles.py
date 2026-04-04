#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import uuid
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile


DEFAULT_BUGIDEA_URL = "https://bugidea.com/api/tiktok-cookies"
DEFAULT_XLSX = r"D:\Download\Tiktok Account REG_ALL.xlsx"
DEFAULT_DATA_DIR = Path(r"C:\Users\Acer\AppData\Local\BugLoginDev")
DEFAULT_TEMPLATE_PROFILE_ID = "9204c98e-1275-4800-8cc2-3ccd961e1f17"
PROFILE_NAME_PREFIX = "BugIdeaSync"
PROFILE_TAGS = ["bugidea-automation", "bugidea-sync"]
LOG_DIR_NAME = "automation-workspaces"
TEMPLATE_PROFILE_IDS_FOR_SCHEMA = [
    "9204c98e-1275-4800-8cc2-3ccd961e1f17",
    "588ffa0c-4c77-4ae3-ba45-28e1afbca0ac",
    "3baf0d7b-116d-4e17-ac77-57685f031227",
]
PROFILE_DIR_IGNORE_NAMES = {
    "bookmarkbackups",
    "cache2",
    "datareporting",
    "extension-store",
    "extension-store-menus",
    "jumpListCache",
    "safebrowsing",
    "security_state",
    "sessionstore-backups",
    "startupCache",
    "storage",
    "thumbnails",
}
PROFILE_FILE_SKIP = {
    "cookies.sqlite-shm",
    "cookies.sqlite-wal",
    "parent.lock",
}
PROFILE_FILE_PREFIX_SKIP = (
    "favicons.sqlite",
    "places.sqlite",
    "webappsstore.sqlite",
    "domain_to_categories.sqlite",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bearer", required=True)
    parser.add_argument("--bugidea-url", default=DEFAULT_BUGIDEA_URL)
    parser.add_argument("--xlsx", default=DEFAULT_XLSX)
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument("--template-profile-id", default=DEFAULT_TEMPLATE_PROFILE_ID)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep-existing-generated", action="store_true")
    return parser.parse_args()


def wsl_to_windows_path(path: Path) -> str:
    path_str = str(path)
    if path_str.startswith("/mnt/") and len(path_str) > 6:
        drive = path_str[5].upper()
        rest = path_str[6:].replace("/", "\\")
        return f"{drive}:{rest}"
    return path_str


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def preview_key(value: str) -> str:
    return normalize_spaces(value.replace("...", ""))


def parse_cookie_header(raw_cookie: str) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for part in raw_cookie.split(";"):
        item = part.strip()
        if not item or "=" not in item:
            continue
        name, value = item.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            continue
        cookies[name] = value
    return cookies


def load_xlsx_rows(xlsx_path: Path) -> list[dict[str, str]]:
    ns = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "p": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    rows: list[dict[str, str]] = []
    with ZipFile(xlsx_path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for si in root.findall("a:si", ns):
                shared_strings.append(
                    "".join(t.text or "" for t in si.iterfind(".//a:t", ns))
                )

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("p:Relationship", ns)
        }

        def cell_value(cell: ET.Element) -> str:
            cell_type = cell.attrib.get("t")
            value_node = cell.find("a:v", ns)
            if value_node is None:
                inline = cell.find("a:is", ns)
                if inline is None:
                    return ""
                return "".join(t.text or "" for t in inline.iterfind(".//a:t", ns))
            raw = value_node.text or ""
            if cell_type == "s":
                return shared_strings[int(raw)]
            return raw

        for sheet in workbook.find("a:sheets", ns):
            target = rel_map[
                sheet.attrib[
                    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                ]
            ]
            sheet_xml = ET.fromstring(archive.read(f"xl/{target}"))
            sheet_data = sheet_xml.find("a:sheetData", ns)
            headers: list[str] = []
            for row_index, row in enumerate(sheet_data.findall("a:row", ns), start=1):
                values = [cell_value(cell) for cell in row.findall("a:c", ns)]
                if row_index == 1:
                    headers = values
                    continue
                if not any(values):
                    continue
                record = dict(zip(headers, values))
                cookie = (record.get("Cookie") or "").strip()
                if not cookie:
                    continue
                rows.append(
                    {
                        "phone": (record.get("Phone") or "").strip(),
                        "api_phone": (record.get("API_Phone") or "").strip(),
                        "cookie": cookie,
                    }
                )
    return rows


def fetch_bugidea_rows(token: str, url: str) -> list[dict[str, Any]]:
    command = (
        f'$headers=@{{ Authorization = "Bearer {token}"; Accept = "application/json" }}; '
        f'$r=Invoke-WebRequest -Uri "{url}" -Headers $headers -UseBasicParsing; '
        "$r.Content"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", command],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    cookies = payload.get("cookies")
    if not isinstance(cookies, list):
        raise RuntimeError("BugIdea response does not contain a cookies array")
    return cookies


def collect_schema(profile_ids: list[str], profiles_dir: Path) -> dict[str, list[tuple[str, str, int, int, int]]]:
    schema: dict[str, set[tuple[str, str, int, int, int]]] = defaultdict(set)
    for profile_id in profile_ids:
        db_path = profiles_dir / profile_id / "profile" / "cookies.sqlite"
        if not db_path.exists():
            continue
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT host, path, name, isSecure, isHttpOnly, sameSite
            FROM moz_cookies
            WHERE host LIKE '%tiktok%'
            """
        )
        for host, path, name, is_secure, is_http_only, same_site in cur.fetchall():
            schema[name].add((host, path, int(is_secure), int(is_http_only), int(same_site)))
        conn.close()
    return {name: sorted(values) for name, values in schema.items()}


def default_cookie_defs(name: str) -> list[tuple[str, str, int, int, int]]:
    secure = 1
    http_only = 0
    same_site = 1
    if name in {
        "cmpl_token",
        "multi_sids",
        "passport_auth_status",
        "passport_auth_status_ss",
        "sessionid",
        "sessionid_ss",
        "sid_guard",
        "sid_tt",
        "sid_ucp_v1",
        "ssid_ucp_v1",
        "store-country-code",
        "store-country-code-src",
        "store-country-sign",
        "store-idc",
        "tt-target-idc",
        "tt-target-idc-sign",
        "tt_session_tlb_tag",
        "ttwid",
        "uid_tt",
        "uid_tt_ss",
        "d_ticket",
        "dkms-token",
    }:
        http_only = 1
    if name == "dkms-type":
        secure = 0
        http_only = 0
    if name == "tt_csrf_token":
        return [(".tiktok.com", "/", 1, 0, 0)]
    return [(".tiktok.com", "/", secure, http_only, same_site)]


def build_cookie_records(
    cookie_map: dict[str, str],
    schema: dict[str, list[tuple[str, str, int, int, int]]],
) -> list[tuple[str, str, str, int, int, int]]:
    records: list[tuple[str, str, str, int, int, int]] = []
    seen: set[tuple[str, str, str]] = set()
    for name, value in cookie_map.items():
        defs = schema.get(name) or default_cookie_defs(name)
        for host, path, is_secure, is_http_only, same_site in defs:
            key = (host, path, name)
            if key in seen:
                continue
            seen.add(key)
            records.append((host, path, name, value, is_secure, is_http_only, same_site))
    return records


def copy_profile_template(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        if item.name in PROFILE_DIR_IGNORE_NAMES:
            continue
        if item.name in PROFILE_FILE_SKIP:
            continue
        if item.name.startswith(PROFILE_FILE_PREFIX_SKIP):
            continue
        target = dest / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)


def update_cookie_db(
    db_path: Path,
    cookie_records: list[tuple[str, str, str, str, int, int, int]],
) -> None:
    now = int(time.time())
    expires = now + 180 * 24 * 60 * 60
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM moz_cookies WHERE host LIKE '%tiktok%'")
    for host, path, name, value, is_secure, is_http_only, same_site in cookie_records:
        cur.execute(
            """
            INSERT INTO moz_cookies
            (originAttributes, name, value, host, path, expiry, lastAccessed,
             creationTime, isSecure, isHttpOnly, sameSite, rawSameSite, schemeMap)
            VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)
            """,
            (
                name,
                value,
                host,
                path,
                expires,
                now * 1_000_000,
                now * 1_000_000,
                is_secure,
                is_http_only,
                same_site,
                same_site,
            ),
        )
    conn.commit()
    conn.close()


def collect_proxy_ids(proxies_dir: Path) -> list[str]:
    proxies: list[tuple[str, str]] = []
    for file in sorted(proxies_dir.glob("*.json")):
        data = json.loads(file.read_text(encoding="utf-8"))
        proxy_settings = data.get("proxy_settings") or {}
        host = (proxy_settings.get("host") or "").lower()
        name = (data.get("name") or "").lower()
        if "usa" in host or "us" in host or "usa" in name or "us" in name:
            proxies.append((data["id"], data.get("name") or data["id"]))
    return [proxy_id for proxy_id, _ in proxies]


def remove_existing_generated_profiles(profiles_dir: Path) -> list[str]:
    removed: list[str] = []
    for metadata_file in profiles_dir.glob("*/metadata.json"):
        try:
            metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        tags = metadata.get("tags") or []
        name = metadata.get("name") or ""
        if "bugidea-sync" not in tags and not str(name).startswith(PROFILE_NAME_PREFIX):
            continue
        shutil.rmtree(metadata_file.parent, ignore_errors=True)
        removed.append(metadata_file.parent.name)
    return removed


def build_metadata(
    template_metadata: dict[str, Any],
    profile_id: str,
    name: str,
    proxy_id: str,
    label: str,
    phone: str,
    api_phone: str,
) -> dict[str, Any]:
    metadata = deepcopy(template_metadata)
    metadata["id"] = profile_id
    metadata["name"] = name
    metadata["proxy_id"] = proxy_id
    metadata["vpn_id"] = None
    metadata["process_id"] = None
    metadata["last_launch"] = None
    metadata["tags"] = sorted(set((metadata.get("tags") or []) + PROFILE_TAGS))
    metadata["note"] = (
        f"source=bugidea+excel\n"
        f"bugidea_label={label}\n"
        f"phone={phone}\n"
        f"api_phone={api_phone}"
    )
    metadata["created_by_id"] = metadata.get("created_by_id")
    metadata["created_by_email"] = metadata.get("created_by_email")
    return metadata


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    profiles_dir = data_dir / "profiles"
    proxies_dir = data_dir / "proxies"
    template_dir = profiles_dir / args.template_profile_id / "profile"
    template_metadata_path = profiles_dir / args.template_profile_id / "metadata.json"
    if not template_dir.exists() or not template_metadata_path.exists():
        raise RuntimeError("Template profile was not found")

    workbook_path = Path(args.xlsx)
    if not workbook_path.exists():
        raise RuntimeError(f"Workbook not found: {workbook_path}")

    workbook_rows = load_xlsx_rows(workbook_path)
    bugidea_rows = fetch_bugidea_rows(args.bearer, args.bugidea_url)
    schema = collect_schema(TEMPLATE_PROFILE_IDS_FOR_SCHEMA, profiles_dir)
    proxy_ids = collect_proxy_ids(proxies_dir)
    if not proxy_ids:
        raise RuntimeError("No US proxy IDs found in local BugLogin data")

    workbook_matches: dict[str, dict[str, str]] = {}
    for row in workbook_rows:
        workbook_matches[preview_key(row["cookie"][:180])] = row

    matched: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []
    for row in bugidea_rows:
        preview = preview_key((row.get("cookie_preview") or ""))
        found = None
        for workbook_row in workbook_rows:
            if normalize_spaces(workbook_row["cookie"]).startswith(preview):
                found = workbook_row
                break
        if found:
            matched.append({"bugidea": row, "excel": found})
        else:
            unmatched.append(row)

    template_metadata = json.loads(template_metadata_path.read_text(encoding="utf-8"))
    removed: list[str] = []
    if not args.keep_existing_generated and not args.dry_run:
        removed = remove_existing_generated_profiles(profiles_dir)

    summary: dict[str, Any] = {
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "bugidea_total": len(bugidea_rows),
        "excel_total": len(workbook_rows),
        "matched_total": len(matched),
        "unmatched_total": len(unmatched),
        "removed_profiles": removed,
        "created_profiles": [],
        "unmatched_labels": [
            {"label": row.get("label"), "preview": row.get("cookie_preview")}
            for row in unmatched
        ],
    }

    if args.dry_run:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    for index, item in enumerate(sorted(matched, key=lambda value: str(value["bugidea"].get("label") or ""))):
        bugidea = item["bugidea"]
        excel = item["excel"]
        label = str(bugidea.get("label") or f"cookie-{bugidea.get('id')}")
        profile_name = f"{PROFILE_NAME_PREFIX} {label}"
        profile_id = str(uuid.uuid4())
        proxy_id = proxy_ids[index % len(proxy_ids)]
        profile_root = profiles_dir / profile_id
        profile_data_dir = profile_root / "profile"
        profile_root.mkdir(parents=True, exist_ok=True)
        copy_profile_template(template_dir, profile_data_dir)

        metadata = build_metadata(
            template_metadata=template_metadata,
            profile_id=profile_id,
            name=profile_name,
            proxy_id=proxy_id,
            label=label,
            phone=excel["phone"],
            api_phone=excel["api_phone"],
        )
        (profile_root / "metadata.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        cookie_map = parse_cookie_header(excel["cookie"])
        cookie_records = build_cookie_records(cookie_map, schema)
        update_cookie_db(profile_data_dir / "cookies.sqlite", cookie_records)

        summary["created_profiles"].append(
            {
                "profile_id": profile_id,
                "profile_name": profile_name,
                "bugidea_id": bugidea.get("id"),
                "bugidea_label": label,
                "proxy_id": proxy_id,
                "phone": excel["phone"],
                "api_phone": excel["api_phone"],
                "cookie_names": sorted(cookie_map.keys()),
                "cookie_record_count": len(cookie_records),
            }
        )

    log_dir = data_dir / LOG_DIR_NAME
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"bugidea-sync-{time.strftime('%Y%m%d-%H%M%S')}.json"
    log_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"log_path": str(log_path), **summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(exc.stderr or exc.stdout or str(exc), file=sys.stderr)
        raise
