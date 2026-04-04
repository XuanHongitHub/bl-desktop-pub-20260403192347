# Runtime Parity and Exception Matrix (Run/Stop)

**Change ID:** `topic3-profile-park-and-terminate`  
**Purpose:** define expected behavior and acceptance cases for runtime continuity (`Run/Stop`, session/tab persistence, back/forward integrity).

---

## Case Levels

| Level | Category | Scenario | Expected Result |
|---|---|---|---|
| Same-level (parity) | Stop/resume continuity | `Run -> Stop -> Run` with active tabs/session | Resumes existing process/session; no forced relaunch |
| Same-level (parity) | Runtime state visibility | Stop on running profile | Profile transitions to `Parked` (or explicit fallback) and UI state is deterministic |
| Same-level (parity) | In-tab navigation | Resume tab with prior navigation chain | Back/forward remains usable and history chain is intact |
| Higher-level | Restart continuity | Full browser close then `Run` on persistent profile | Last-session restore policy applies consistently per browser adapter |
| Higher-level | Process reuse safety | Matching live process already exists | Reuse existing process, do not kill/relaunch if no explicit open-url request |
| Lower-level fallback | Unsupported park | Browser/profile cannot park safely | Stop degrades to terminate with explicit reason surfaced to UI |
| Lower-level fallback | Ephemeral profile stop | Stop requested for ephemeral profile | Convert/reject park and enforce terminate-only lifecycle |
| Exception | Stale parked PID | Metadata says `Parked` but process dead | Reconcile to `Crashed`/`Stopped`; never remain stale `Parked` |
| Exception | Status probe miss | Health probe transiently fails while process still live | Stop path uses safe optimistic handling; avoid false "cannot stop" dead-end |
| Exception | Proxy/VPN mutation while parked | Network config changes during parked state | Runtime state remains consistent and no proxy/VPN orphan leak |
| Exception | App/browser update while parked | Update occurs with parked runtime | Transition is explicit; no silent session corruption |

---

## Non-Negotiable Runtime Invariants (P0)

1. `Stop` in primary UX MUST not silently drop runtime continuity in supported persistent flows.
2. `Run` after `Parked` MUST prefer process/session reuse over relaunch.
3. Any park degradation to terminate MUST be explicit and user-visible.
4. Back/forward behavior after resume/reopen MUST remain browser-consistent and non-broken.
5. No stale `Parked` state after reconciliation when process is gone.

---

## Validation Notes

- Validation must cover Camoufox and Wayfern adapters separately.
- Ephemeral profiles are explicitly excluded from continuity guarantees beyond active runtime.
- Cross-platform smoke (Windows/macOS/Linux) is required before archive/signoff.
