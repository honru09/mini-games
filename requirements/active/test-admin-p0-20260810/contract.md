# Test Admin P0 Contract

## 1. Environment and bootstrap

| Variable | Requirement |
|---|---|
| `TEST_ADMIN_ENABLED` | Only exact `1` enables the feature. Missing or other values disable it. |
| `TEST_ADMIN_UID` | Non-empty server UID matching the established account UID grammar. |
| `TEST_ADMIN_USERNAME` | Existing username/password policy: 4–20 ASCII letters/digits with at least one of each. |
| `TEST_ADMIN_PASSWORD` | Existing password policy: 8–64 printable ASCII characters. Never log, persist raw, emit, or include an operator password in QA fixtures. |

- If enablement is requested but any value is missing, invalid, or conflicts with a different UID/username, startup fails before listening.
- Bootstrap creates only the normal credential profile required for authentication, with the normal scrypt hash. It never stores a plaintext password.
- On later starts, the configured account is matched by both UID and normalized username. A password change is applied only to that exact configured identity.
- Disabled mode exports no special identity or capability.

## 2. Fixed capability set

The module owns the only allowlist. There is no `*`, `all`, role string, client-supplied capability, or inferred admin state.

| Capability | Meaning |
|---|---|
| `test_admin_profile` | Receive private virtual test profile projection. |
| `test_admin_unlimited_currency` | Virtual G Coins only; no ledger mutation. |
| `test_admin_all_catalog_items` | Virtual ownership of every server-priced current catalog item. |
| `test_admin_sandbox_match` | Enter isolated test room and AI solo sandbox. |
| `tournament_recover` | Existing server-only explicit-target tournament recovery. |
| `tournament_create` | Create a normal-player tournament only as a non-playing control-plane owner after the separate guard integration. |

## 3. Virtual profile and catalog

- Owner-only projection returns `coins = Number.MAX_SAFE_INTEGER`, `level = 9999`, matching calculated XP, and an explicit `testAdmin` descriptor.
- `allOwnedFromCatalog()` dynamically includes every numeric ID from `SHOP_PRICES` plus normal free/base IDs. Current game cosmetics are therefore included without duplicating prices.
- The stored profile remains a minimal credential/settings record. Virtual balance/owned fields never become the persisted authority.
- A future persistent asset category must be added to the normalizer and passed through this module’s catalog seam; no unknown category is automatically trusted.

## 4. Isolation matrix

| Surface | Required result |
|---|---|
| Leaderboard / public profile / Presence / public lobby | Omit test admin and its rooms; direct public lookup is null. |
| Friend / Block / Report / Direct Chat | New and legacy edges are rejected or hidden; no message/history/read operation is available. |
| Rooms / invite / spectator / quick join | Test account rooms are private test sandboxes. Normal and test identities cannot share a player or spectator room. |
| Online match / Solo match | No formal reward, win, daily task, economy ledger, replay, AI learning, Analytics, outbox, playmate, achievement or persistent gameplay state. |
| Shop | Valid server catalog item returns a no-cost virtual success; invalid IDs still reject. No price, owned, ledger, RPC or outbox mutation. |
| Tournament | Test admin may control explicitly permitted recovery without becoming a participant. Its normal-player tournament creation path must use external-owner mode and never allocate it a player seat. |

## 5. Stable reasons and failure behavior

- Bootstrap failure: internal `test_admin_config_invalid` only; no sensitive values in output.
- Cross-domain isolation rejection: stable `test_admin_isolated` (or caller-specific equivalent) and no partial mutation.
- Test sandbox settlement: `test_admin_sandbox` is a non-eligible, zero-persistence result; it is not a normal reward block for ordinary users.
- Unknown/invalid shop item stays `product_not_found`; test identity cannot mint future arbitrary IDs.

## 6. Rollback

- Set `TEST_ADMIN_ENABLED=0` or remove it, then restart. The stored normal credential record remains but loses all special behavior.
- No formal ledger, reward, Replay, AI, Analytics, social or outbox data needs cleanup because the module forbids producing it.
