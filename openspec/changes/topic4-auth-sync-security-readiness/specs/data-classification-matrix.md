# Data Classification Matrix

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 1.1 (P0)

## Classes

| Class | Description | Examples | Local Storage | Cloud Sync | Encryption at Rest | Logging Rule |
|---|---|---|---|---|---|---|
| Runtime | Ephemeral execution state, valid only while process is active | browser process id, in-memory lock heartbeat, pending sync queue item | Memory first, minimal disk checkpoint if needed | No direct sync | N/A in memory; encrypted if checkpointed | Never log raw runtime payload if it can contain sensitive values |
| Public Config | Non-sensitive app behavior | theme, layout prefs, UI table sort | settings file | Optional | Not required (integrity required) | Allowed, avoid excessive verbosity |
| Sensitive Config | Data not credential-grade but privacy-relevant | profile metadata, group assignment, extension assignment, sync mode, last sync time | profile metadata files | Yes, selective | Recommended | Redact identifying fields when possible |
| Secret | Credentials, tokens, private keys, password-derived material | KMedia tokens, sync token, refresh token, API token, key-encryption keys | encrypted secret store files | Never sync in plaintext; sync only if envelope-encrypted and policy-approved | Mandatory (Argon2 + AES-GCM or OS keychain wrapped) | Never log secrets, never expose in frontend events |
| User Session Data | Browser continuity state | cookies/session artifacts, selected local storage/indexedDB containers, tabs/session restore | profile data directory | Selective (policy-controlled) | Yes when encrypted sync enabled | Never log raw content; only aggregate metrics |
| Volatile Artifact | High-churn/non-essential operational files | cache, code cache, lock files, temporary logs, crash dumps | local cache dirs | Never | Optional locally | Do not include in telemetry payload |

## Baseline Policy
- Local-first remains canonical for active execution.
- Cloud stores only policy-allowed synchronized artifacts.
- Secret class is always encrypted locally and never emitted to logs.
- Volatile artifacts are excluded from sync to reduce cost and conflict risk.

## Control Mapping (Must-Have)
- C1: Every persisted field maps to exactly one class.
- C2: Secret class must define key source, rotation, and recovery path.
- C3: Sync policy must explicitly declare default include/exclude containers.
- C4: Telemetry/audit pipeline must redact secret and raw session payloads.
