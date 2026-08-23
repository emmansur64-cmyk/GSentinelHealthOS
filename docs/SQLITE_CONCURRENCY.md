# SQLite concurrency guarantee

`SQLiteClinicalStateStore.commit()` opens a dedicated connection, enables WAL,
sets a 30-second busy timeout, and starts `BEGIN IMMEDIATE` before reading the
latest case revision. SQLite therefore acquires the reserved writer lock before
the read-check-write sequence. Competing writers may read concurrently before
the transaction, but only one commit transaction performs the authoritative
latest-revision check at a time.

Within that transaction the store checks:

- global `request_id` idempotency consistency;
- latest revision for the complete tenant/clinician/conversation/case scope;
- exact sequential advance or exact replay;
- immutability of facts, knowledge release, and terminology release;
- atomic insertion of case revision and idempotency receipt.

WAL does not provide distributed consensus, serializable reads across arbitrary
application operations, protection against direct database writers, or network
filesystem safety. The guarantee is limited to cooperating processes using this
store against one local SQLite database. A production multi-host deployment
requires a transactional server database and the same invariants enforced by
constraints or stored transaction logic.
