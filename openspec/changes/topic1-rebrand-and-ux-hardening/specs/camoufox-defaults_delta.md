# Delta: Camoufox Defaults Hardening

**Change ID:** `topic1-rebrand-and-ux-hardening`
**Affects:** profile defaults, resolution behavior, search behavior

---

## ADDED

### Requirement: Sane Display Defaults
New Camoufox profiles MUST initialize with display defaults aligned to host display constraints.

#### Scenario: Create profile on current machine
- GIVEN host display information is available
- WHEN creating Camoufox profile
- THEN default display settings are auto-populated to a sane value

### Requirement: Cross-Machine Stability
Profile defaults MUST remain launch-safe when moved to another machine.

#### Scenario: Profile opened on different machine
- GIVEN profile default display values from another host
- WHEN launching on a new host
- THEN runtime fallback avoids invalid display configuration and remains usable
  AND implementation follows profile-based defaults with host-aware fallback (Option B)

### Requirement: Search Engine Query Routing
Plain query input MUST route to default search engine (Google), not malformed URL navigation.

#### Scenario: User types `tiktok` and presses Enter
- GIVEN non-URL plain keyword input
- WHEN navigation occurs
- THEN browser uses Google search URL instead of `http://tiktok`

## MODIFIED

### Requirement: Camoufox Default Profile Experience
Default profile creation should minimize required manual anti-detect adjustments.

#### Scenario: First-time profile creation
- GIVEN no advanced user edits
- WHEN profile is created
- THEN profile remains usable with sensible defaults

## REMOVED

(None)
