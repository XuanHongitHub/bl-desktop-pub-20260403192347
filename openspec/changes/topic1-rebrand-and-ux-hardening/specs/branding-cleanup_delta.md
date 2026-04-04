# Delta: Branding Cleanup

**Change ID:** `topic1-rebrand-and-ux-hardening`
**Affects:** naming, assets, scripts, docs, package references

---

## ADDED

### Requirement: Legacy Brand Inventory
A complete inventory of old brand residues MUST be generated before rename execution.

#### Scenario: Pre-rename audit
- GIVEN a mixed codebase with old and current branding
- WHEN planning rename
- THEN all runtime paths, package names, docs, scripts, and assets are cataloged

### Requirement: Deterministic Rename Map
The project MUST use an explicit rename map from legacy naming to BugLogin naming.

#### Scenario: Rename execution
- GIVEN a verified inventory
- WHEN applying renames
- THEN each rename follows a pre-approved mapping with compatibility notes

## MODIFIED

### Requirement: Sync Naming Consistency
Sync service naming should converge to BugLogin brand naming and avoid old labels in user-facing and dev-facing surfaces.

#### Scenario: User reads docs or scripts
- GIVEN sync instructions and script commands
- WHEN searching by product name
- THEN naming is consistent with BugLogin branding
  AND canonical naming uses `buglogin-sync`

## REMOVED

- Implicit acceptance of legacy brand strings in active workflows
