# Upstream Intake Log: BugLoginBrowser

Track all reviewed upstream commits and decisions here.

## Last Reviewed Pointer

- Upstream branch: `main`
- Last reviewed upstream SHA: `8936816613da0b005cade929ff900648319ca4ee`
- Last reviewed date: `2026-03-19`

## Entries

| Date | Upstream SHA | Summary | Area | Risk | Decision | Follow-up |
|------|--------------|---------|------|------|----------|-----------|
| 2026-03-19 | 8936816613da0b005cade929ff900648319ca4ee | Initialize canonical intake workflow and baseline pointer | workflow | low | adopt | Use this template for future upstream reviews |
| 2026-03-19 | 76dd0d84e808 | check proxy validity via buglogin-proxy | proxy runtime | medium | adapt | Applied: `check_proxy_validity` now validates through temporary local BugLogin proxy worker |
| 2026-03-19 | 8511535d69ba | socks5 chaining | proxy runtime | high | adapt | Applied core server accept-loop adaptation: readable-wait before first read to reduce CONNECT race |
| 2026-03-19 | cf1e49c76173 | more robust output parsing | proxy parsing | medium | adapt | Pending: BugLogin lacks equivalent dynamic-proxy parser entrypoint; will map to current parser path before port |
| 2026-03-19 | 2cf9013d28cc | handle download interruptions | downloader | medium | adopt | Applied: HEAD-size reuse + buffered writes for browser download, atomic temp-file swap for GeoIP DB |
| 2026-03-19 | 96614a3f3347 | better tombstone handling | sync/profile | medium | defer | Evaluate in separate sync-focused change; scope broad and touches many modules |
| 2026-03-19 | c4aee3a00b66 | encrypt manifest for encrypted profiles | sync security | medium | defer | Bring when encrypted profile sync rollout is prioritized |

## Decision Legend

- `adopt`: direct or near-direct intake is safe
- `adapt`: re-implement intent for BugLogin architecture
- `defer`: useful but postpone
- `skip`: intentionally not taken
