# Delta: Smart Quick Add Proxy

**Change ID:** `topic1-rebrand-and-ux-hardening`
**Affects:** proxy parsing, benchmark, protocol selection, profile creation flow

---

## ADDED

### Requirement: Unified Quick Add Experience
Quick-add proxy behavior MUST be consistent across Proxy Management and New Profile flows.

#### Scenario: User quick-adds in either entry point
- GIVEN quick add UI in two locations
- WHEN user submits proxy string(s)
- THEN parsing and selection behavior are equivalent

### Requirement: Multi-Protocol Benchmark
System MUST support benchmark attempts across HTTP/HTTPS/SOCKS4/SOCKS5 where technically valid.

#### Scenario: Protocol not explicit or ambiguous
- GIVEN a proxy host/port with uncertain protocol
- WHEN quick add runs benchmark
- THEN protocol checks run with bounded timeout and produce ranked results
  AND the benchmark remains responsive for UI usage

### Requirement: Auto Best Protocol Selection
System MUST auto-select the best protocol using benchmark outcome and practical tie-breakers.

#### Scenario: Multiple protocols succeed
- GIVEN at least two successful protocol checks
- WHEN selecting final protocol
- THEN lowest-latency successful protocol is selected with deterministic tie-break policy

## MODIFIED

### Requirement: Parse Robustness
Proxy parsing should accept common compact formats and batch input while reporting ambiguous/invalid lines clearly.

#### Scenario: User pastes mixed list
- GIVEN mixed valid, ambiguous, and invalid lines
- WHEN parsing completes
- THEN valid lines import, ambiguous lines are reported, invalid lines are reported without crashing flow

## REMOVED

(None)
