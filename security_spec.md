# Security Specification - Atallm Academy

## 1. Data Invariants
- **Write Restriction**: Only the account `ahmedgamalahmed159@gmail.com` with a verified email can create, update, or delete content.
- **Reference Integrity**: Any item referencing a `subjectId` must point to an existing document in the `subjects` collection.
- **Strict Schema**: All documents must adhere to specific type and size constraints to prevent resource abuse.
- **Immutability**: `createdAt` timestamps cannot be modified after creation.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

| ID | Collection | Action | Payload Description | Expected Result |
|----|------------|--------|---------------------|-----------------|
| 1  | subjects   | create | Non-admin user attempts to create a subject. | **PERMISSION_DENIED** |
| 2  | lectures   | create | Admin attempts to create lecture with 2MB description string. | **PERMISSION_DENIED** |
| 3  | files      | create | Admin attempts to create file without a `subjectId`. | **PERMISSION_DENIED** |
| 4  | lectures   | update | Admin attempts to change the `createdAt` timestamp. | **PERMISSION_DENIED** |
| 5  | subjects   | create | Admin tries to use a non-string for 'color'. | **PERMISSION_DENIED** |
| 6  | lectures   | create | User with same email but `email_verified: false`. | **PERMISSION_DENIED** |
| 7  | terms      | delete | Student (authenticated via Google) attempts to delete. | **PERMISSION_DENIED** |
| 8  | lectures   | create | Admin attempts to create lecture with invalid document ID (symbols). | **PERMISSION_DENIED** |
| 9  | files      | create | Admin attempts to inject "isAdmin: true" into a file document. | **PERMISSION_DENIED** |
| 10 | subjects   | update | Admin attempts to update fields not in the allowlist. | **PERMISSION_DENIED** |
| 11 | lectures   | create | Admin attempts to create lecture referencing non-existent subject. | **PERMISSION_DENIED** |
| 12 | *          | list   | Unauthenticated user attempts to list collections. | **PERMISSION_DENIED** |

## 3. Test Runner Checklist
- [ ] Verify `isAdmin()` checks `email_verified`.
- [ ] Verify `isValidId()` regex constraints.
- [ ] Verify `affectedKeys().hasOnly()` on updates.
- [ ] Verify `exists()` checks for relational integrity.
