# Ed25519 key management

## Private key

The private signing key must be generated and retained in a managed KMS or HSM
that supports Ed25519. If the selected cloud KMS does not support Ed25519, use a
managed HSM or a vault transit-signing service backed by an HSM. The Kernel
runtime never receives or stores private-key material.

The clinical-knowledge release service requests a signature after governance
approval. Its workload identity receives only the sign permission for the
active key version. Security Operations owns key creation and rotation;
Clinical Governance approves which release hash may be submitted for signing.
Neither role can perform both actions alone.

## Public key lifecycle

1. Security Operations exports the public PEM from the managed key version.
2. A change-control record binds key ID, provider, creation time, public PEM
   SHA-256, activation time, and owner approval.
3. Deployment places the PEM in a read-only secret/configuration mount outside
   the application repository and database.
4. The expected PEM SHA-256 is supplied through signed deployment metadata.
5. `Ed25519KnowledgeVerifier` reads the PEM at startup, verifies its SHA-256,
   verifies that it is Ed25519, and refuses startup on mismatch.
6. The verifier uses the loaded key until process restart. Rotation therefore
   requires a controlled deployment restart.

## Rotation and revocation

Rotation creates a new managed key version, distributes its public PEM and
fingerprint, deploys readers, and only then permits new signatures. Releases
signed by the prior key remain usable only during a documented overlap window.
Supporting simultaneous keys requires an explicit key-ID-bearing signature
contract and is not implemented in the current single-key verifier.

On suspected compromise, Security Operations disables the signing key version,
revokes the release-service sign permission, and publishes a denylisted key ID
and affected release hashes. Operators deactivate affected releases and deploy
a replacement public key/fingerprint. Automated KMS revocation lookup and a
durable denylist are not implemented; production use remains blocked until
those controls exist and are tested.
