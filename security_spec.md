# Security Specification for Firestore Database

This document details the security specifications, data invariants, and access control validation rules for the `backups` collection in the Wingo AI Studio application.

## 1. Core Data Invariants

1. **Identity Isolation**: A user CANNOT access, read, or write to any backup that does not belong to their specific authenticated `uid`.
2. **Type and Magnitude Constraints**: All backup fields correspond to specific types (indices, lists, maps, primitives) and have strict size boundaries to prevent recursive "Denial of Wallet" resource consumption attempts.
3. **Temporal Integrity**: The `updatedAt` field must align exactly with the server's authoritative clock time (`request.time`) during document creations and updates.
4. **Email Security verification**: Verified email accounts (`email_verified == true`) are strictly mandated for document creation and updates.

---

## 2. The "Dirty Dozen" Exploit Payloads

Here are the 12 specific payloads evaluated against our protection system to prevent identity, integrity, and state compromise.

| Exploit Payload Name | Attack Vector Description | Prevention Mechanism |
| :--- | :--- | :--- |
| **1. Shadow Upgrade** | Attempting to write an undocumented property (e.g. `isAdmin: true` or `role: "admin"`) to inject shadow fields. | Static strict key presence/magnitude check in `isValidBackup()`. |
| **2. Identity Theft** | User `A` trying to read owner `B`'s files directly (`/backups/user_B_id`). | `userId == request.auth.uid` validation inside the `allow get` match block. |
| **3. Identity Spoofing** | User `A` creates a backup document at `/backups/user_A_id` but assigns the file's inner `userId` to `user_B_id`. | `incoming().userId == request.auth.uid` checked during schema validation. |
| **4. Magnitude Exhaustion** | Inundating the `historyLogs` array field with 5,000 logs to bloat memory. | Strict list size check in rules: `data.historyLogs.size() <= 1000`. |
| **5. Path Poisoning** | Forging the `userId` document ID containing special regex characters or massive sizes. | `isValidId(userId)` validation on document ID path variables. |
| **6. Verification Bypass** | User attempts write without registering or verifying their email address (`email_verified: false`). | `isEmailVerified()` requires `request.auth.token.email_verified == true`. |
| **7. Spoof Timestamp** | Forcing client-generated future timestamps on `updatedAt` to forge state sequences. | `incoming().updatedAt == request.time` prevents client-side forging. |
| **8. Field Substitution** | Modifying `userId` field value in an existing schema document during an edit/update action. | `incoming().userId == existing().userId` enforces immutability of the owner UID. |
| **9. Blank Queries** | Performing unrestricted list queries to dump entire backup collection data. | Catch-all `allow list: if false;` prevents bulk scanning queries altogether. |
| **10. Value Poisoning (String)** | Inserting a massive (10MB) string inside string variables like `wingoMode`. | Size bound validation `data.wingoMode.size() <= 20` inside rules. |
| **11. Value Poisoning (Negative)** | Passing a negative integer value (`-100`) as a metric like `winCount`. | `data.winCount >= 0` check in `isValidBackup()`. |
| **12. Sibling Mutating** | Attempting to update a document in a path outside the `/backups/` scope using wildcard path traversal. | Global fallback namespace safety catch `match /{document=**} { allow read, write: if false; }`. |
