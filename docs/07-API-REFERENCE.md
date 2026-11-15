# 07 — API Reference

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: Backend Engineers, Frontend Developers, QA, API Consumers

---

## 1. Global API Standards

### Base URL
All API routes are prefixed under `/api` (e.g. `https://your-domain.edu/api`).

### Ingress Headers & CSRF Protection
For all mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`):
- **CSRF Token**: Must include `x-csrf-token: <token>` header matching the `XSRF-TOKEN` cookie (obtainable via `GET /api/csrf-token`).
- **Idempotency**: High-value ticket submissions accept an optional `x-idempotency-key: <uuid>` header to protect against double-submission.

### Authentication Headers & Cookies
- **Primary**: Automatically handled via secure `HttpOnly` cookie (`Cookie: token=<jwt>`).
- **Secondary (Bearer)**: Accepts `Authorization: Bearer <jwt>`.

---

## 2. API Endpoint Matrix (59 Endpoints)

---

### Module 1: System Health & Diagnostics (4 Endpoints)

#### 1. `GET /api/health/liveness`
- **Purpose**: Liveness probe verifying Node.js event loop health.
- **Auth**: None (Public).
- **Middleware**: None.
- **Response `200 OK`**:
  ```json
  { "status": "alive", "timestamp": "2026-11-11T12:00:00.000Z", "uptimeSeconds": 1420, "pid": 101 }
  ```

#### 2. `GET /api/health/readiness`
- **Purpose**: Readiness probe checking MongoDB connection state and graceful shutdown lifecycle.
- **Auth**: None (Public).
- **Response `200 OK`**:
  ```json
  { "status": "ready", "ready": true, "database": "connected", "mongoReadyState": 1 }
  ```
- **Response `503 Service Unavailable`**: Returned if shutting down or disconnected in production.

#### 3. `GET /api/system/database-status`
- **Purpose**: Public status check indicating active storage mode (`atlas` or `local`).
- **Auth**: None.
- **Response `200 OK`**:
  ```json
  { "isMongoConnected": true, "storageMode": "atlas", "readyState": 1 }
  ```

#### 4. `GET /api/database-status`
- **Purpose**: Detailed diagnostic report for superadmins.
- **Auth**: Required (`role: superadmin`).
- **Response `200 OK`**: Includes collection counts, ping latency, and database names.

---

### Module 2: Authentication & Credentials (9 Endpoints)

#### 5. `GET /api/csrf-token`
- **Purpose**: Issues a cryptographically random 64-character hexadecimal double-submit CSRF token.
- **Auth**: None.
- **Response `200 OK`**: Sets cookie `XSRF-TOKEN` and returns `{ "csrfToken": "..." }`.

#### 6. `POST /api/auth/register`
- **Purpose**: Register a new student account.
- **Auth**: None (`authLimiter` applied).
- **Body**:
  ```json
  {
    "name": "Alex Rivera",
    "enrollmentNumber": "STU1001",
    "email": "alex@campus.edu",
    "contactNumber": "9876543210",
    "password": "Password123!",
    "institutionId": "inst-1792319961187"
  }
  ```
- **Validation**: Enforces institution existence; rejects duplicate enrollment or email.
- **Response `201 Created`**: Returns user profile and sets auth token cookie.

#### 7. `POST /api/auth/login`
- **Purpose**: Authenticate student, staff, or superadmin.
- **Auth**: None (`authLimiter`: 10 attempts/15m in prod; 200 in dev).
- **Body**:
  ```json
  { "identifier": "alex@campus.edu", "password": "Password123!", "institutionId": "inst-1792319961187" }
  ```
- **Response `200 OK`**: Sets `token` cookie and returns user session profile.
- **Errors**: `401 Unauthorized` (Invalid credentials), `403 Forbidden` (Disabled/Locked account).

#### 8. `POST /api/auth/logout`
- **Purpose**: Invalidate client session.
- **Auth**: None.
- **Response `200 OK`**: Clears `token` cookie (`maxAge: 0`).

#### 9. `POST /api/auth/forgot-password`
- **Purpose**: Initiate account password recovery and dispatch 6-digit OTP.
- **Auth**: None (`forgotPasswordLimiter`: 3 attempts/15m in prod).
- **Body**: `{ "email": "user@campus.edu" }`.
- **Response `200 OK`**: `{ "message": "OTP sent successfully" }`.

#### 10. `POST /api/auth/verify-otp`
- **Purpose**: Verify 6-digit OTP code against active challenge record.
- **Auth**: None (`otpLimiter`: 5 attempts/15m in prod).
- **Body**: `{ "email": "user@campus.edu", "otp": "123456" }`.
- **Response `200 OK`**: Returns single-use `resetToken`.

#### 11. `POST /api/auth/validate-reset-token`
- **Purpose**: Check if a reset token is still unexpired.
- **Body**: `{ "token": "..." }`.
- **Response `200 OK`**: `{ "valid": true }`.

#### 12. `POST /api/auth/reset-password`
- **Purpose**: Complete password reset using verified `resetToken`.
- **Body**: `{ "token": "...", "newPassword": "NewSecurePassword123!" }`.
- **Response `200 OK`**: `{ "message": "Password reset successful" }`.

#### 13. `POST /api/auth/change-password`
- **Purpose**: Authenticated password change.
- **Auth**: Required (`student`, `staff`, `superadmin`).
- **Body**: `{ "currentPassword": "...", "newPassword": "..." }`.
- **Validation**: Rejects identical new password or invalid current password.

---

### Module 3: Institutions Management (5 Endpoints)

#### 14. `GET /api/institutions`
- **Purpose**: Lists registered institutions. By default, hides entries flagged with `isTest: true`.
- **Query Params**: `?includeTest=true` (Optional: includes test institutions).
- **Response `200 OK`**: Array of `Institution` objects.

#### 15. `GET /api/institutions/:id`
- **Purpose**: Retrieve profile for a single institution.
- **Auth**: Authenticated user.

#### 16. `POST /api/institutions/register`
- **Purpose**: Register a new college institution along with its initial Super Admin account.
- **Auth**: None (`authLimiter` applied).
- **Body**: Institutional details (`name`, `type`, `website`, `logo`, `adminEmail`, `adminPassword`, `adminName`).

#### 17. `PUT /api/institutions/:id`
- **Purpose**: Update institution profile details.
- **Auth**: `role: superadmin` (Restricted to own `institutionId`).

#### 18. `DELETE /api/institutions/:id`
- **Purpose**: Delete institution profile.
- **Auth**: `role: superadmin`.

---

### Module 4: Student Profile (2 Endpoints)

#### 19. `GET /api/students/me`
- **Purpose**: Returns authenticated student's profile information.
- **Auth**: Required (`role: student`).
- **Response `200 OK`**:
  ```json
  { "id": "student-...", "name": "Alex Rivera", "enrollmentNumber": "STU1001", "email": "alex@campus.edu", "contactNumber": "9876543210", "institutionId": "inst-..." }
  ```

#### 20. `PATCH /api/students/me`
- **Purpose**: Update mutable personal contact details.
- **Auth**: Required (`role: student`).
- **Body**: `{ "name": "Alex Updated", "contactNumber": "9876543211" }`.
- **Security Invariant**: Strictly rejects mutation of `role`, `institutionId`, `enrollmentNumber`, or `email` (`400 Bad Request`).

---

### Module 5: Complaints & Help Requests (10 Endpoints)

#### 21. `POST /api/requests`
- **Purpose**: Create a new complaint or help request.
- **Auth**: Required (`role: student`).
- **Headers**: Supports `x-idempotency-key`.
- **Body**:
  ```json
  {
    "requestType": "complaint",
    "departmentKey": "hostel",
    "subject": "Room Water Leakage",
    "description": "Pipe leaking in Room 302 bathroom.",
    "attachments": ["data:image/png;base64,..."]
  }
  ```
- **Response `201 Created`**: Returns created `HelpComplaintRequest` with timeline.

#### 22. `GET /api/requests`
- **Purpose**: List complaints.
  - Students receive only their own tickets.
  - Staff receive tickets routed to their assigned `departmentKey`.
  - Superadmins receive all tickets within their institution.
- **Query Params**: `status`, `departmentKey`, `search`.

#### 23. `GET /api/requests/:id`
- **Purpose**: Retrieve full ticket details including attachments and timeline.
- **Auth**: Authenticated ticket owner, assigned staff, or superadmin.

#### 24. `PATCH /api/requests/:id/status`
- **Purpose**: Update resolution status and append official remarks.
- **Auth**: `role: staff` or `superadmin`.
- **Body**: `{ "status": "in_progress", "remarks": "Technician dispatched to inspect room." }`.

#### 25. `PATCH /api/requests/:id/assign-officer`
- **Purpose**: Assign a designated officer to a ticket.
- **Auth**: `role: staff` or `superadmin`.
- **Body**: `{ "officerId": "staff-...", "officerName": "Officer John" }`.

#### 26. `PATCH /api/requests/:id/priority`
- **Purpose**: Adjust ticket severity priority (`low`, `medium`, `high`, `urgent`).
- **Auth**: `role: staff` or `superadmin`.

#### 27. `PATCH /api/requests/:id/internal-notes`
- **Purpose**: Add confidential staff notes (hidden from student view).
- **Auth**: `role: staff` or `superadmin`.

#### 28. `POST /api/requests/:id/feedback`
- **Purpose**: Submit satisfaction rating on a `resolved` ticket.
- **Auth**: Required (`role: student` and ticket owner).
- **Body**: `{ "rating": 5, "remarks": "Resolved within two hours!" }`.

#### 29. `PATCH /api/requests/:id/reopen`
- **Purpose**: Reopen an unsatisfactorily resolved ticket.
- **Auth**: Required (`role: student` and ticket owner).
- **Body**: `{ "reason": "Water is still leaking after technician visit." }`.
- **Validation**: Requires `reason` of at least 5 characters.

#### 30. `PATCH /api/requests/:id/reassign`
- **Purpose**: Reassign ticket to a different department.
- **Auth**: Required (`role: superadmin`).
- **Body**: `{ "targetDepartmentKey": "maintenance", "reason": "Structural plumbing issue" }`.

---

### Module 6: Departments & Subdepartments (8 Endpoints)

#### 31. `GET /api/departments`
- **Purpose**: Retrieve active departments for student ticket selection.
- **Auth**: None (Filtered by student session institution if authenticated).

#### 32. `POST /api/admin/departments`
- **Purpose**: Create a new department.
- **Auth**: `role: superadmin`.

#### 33. `PATCH /api/admin/departments/:key`
- **Purpose**: Update department title, phone, email, or status.
- **Auth**: `role: superadmin`.

#### 34. `DELETE /api/admin/departments/:id`
- **Purpose**: Remove department.
- **Auth**: `role: superadmin`.

#### 35. `GET /api/subdepartments`
- **Purpose**: List subdepartments under an institution.
- **Auth**: Authenticated.

#### 36. `POST /api/admin/subdepartments`
- **Purpose**: Create a subdepartment.
- **Auth**: `role: superadmin`.

#### 37. `PATCH /api/admin/subdepartments/:id`
- **Purpose**: Update subdepartment metadata.
- **Auth**: `role: superadmin`.

#### 38. `DELETE /api/admin/subdepartments/:id`
- **Purpose**: Remove subdepartment.
- **Auth**: `role: superadmin`.

---

### Module 7: Administrative Oversight & Staff Management (11 Endpoints)

#### 39. `GET /api/admin/students`
- **Purpose**: List enrolled students with search and server-side pagination.
- **Auth**: `role: superadmin`.
- **Headers**: Returns `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`.
- **Query Params**: `page=1`, `limit=20`, `search=alex`.

#### 40. `DELETE /api/admin/students/:id`
- **Purpose**: Delete student account.
- **Auth**: `role: superadmin`.
- **Security**: Hard-scoped to `{ id, institutionId }`. Cross-tenant attempts return `404 Not Found`.

#### 41. `GET /api/admin/staff`
- **Purpose**: List staff accounts under the institution.
- **Auth**: `role: superadmin`.

#### 42. `POST /api/admin/staff`
- **Purpose**: Provision a new department staff member.
- **Auth**: `role: superadmin`.

#### 43. `PATCH /api/admin/staff/:id`
- **Purpose**: Edit staff profile or department assignment.
- **Auth**: `role: superadmin`.

#### 44. `DELETE /api/admin/staff/:id`
- **Purpose**: Remove staff account.
- **Auth**: `role: superadmin`.

#### 45. `POST /api/admin/staff/:id/reset-password`
- **Purpose**: Administratively issue a temporary password for staff.
- **Auth**: `role: superadmin`.

#### 46. `POST /api/admin/staff/:id/toggle-disable`
- **Purpose**: Freeze or reactivate staff login access.
- **Auth**: `role: superadmin`.

#### 47. `POST /api/admin/staff/:id/unlock`
- **Purpose**: Unlock an account locked due to excessive failed attempts.
- **Auth**: `role: superadmin`.

#### 48. `GET /api/admin/audit-logs`
- **Purpose**: Retrieve institutional security audit logs.
- **Auth**: `role: superadmin`.
- **Headers**: Supports pagination (`page`, `limit`).

#### 49. `GET /api/admin/analytics`
- **Purpose**: Compute high-level dashboard metrics (counts, resolution rates, average turnarounds).
- **Auth**: `role: superadmin`.

---

### Module 8: Notifications (2 Endpoints)

#### 50. `GET /api/notifications`
- **Purpose**: Stream notifications addressed to the current authenticated user.
- **Auth**: Authenticated user.

#### 51. `POST /api/notifications/read`
- **Purpose**: Mark one or all notifications as read.
- **Auth**: Authenticated user.
- **Body**: `{ "notificationId": "..." }` or `{ "all": true }`.

---

### Module 9: Announcements (7 Endpoints)

#### 52. `POST /api/announcements`
- **Purpose**: Create a campus-wide or department-targeted notice.
- **Auth**: `role: superadmin` or `staff`.

#### 53. `GET /api/announcements`
- **Purpose**: Retrieve visible notices for the current institution.
- **Auth**: Authenticated user.

#### 54. `PUT /api/announcements/:id`
- **Purpose**: Edit existing announcement.
- **Auth**: `role: superadmin` or `staff`.

#### 55. `DELETE /api/announcements/:id`
- **Purpose**: Soft-delete announcement.
- **Auth**: `role: superadmin` or `staff`.

#### 56. `POST /api/announcements/:id/restore`
- **Purpose**: Restore soft-deleted notice.
- **Auth**: `role: superadmin`.

#### 57. `DELETE /api/announcements/:id/permanent`
- **Purpose**: Permanently purge announcement.
- **Auth**: `role: superadmin`.

#### 58. `PATCH /api/announcements/:id/toggle`
- **Purpose**: Activate/deactivate notice visibility.
- **Auth**: `role: superadmin` or `staff`.

---

### Module 10: Temporary Password Handling (1 Endpoint)

#### 59. `POST /api/auth/change-temporary-password`
- **Purpose**: Force newly provisioned staff members to set a permanent password upon first login.
- **Auth**: None (Validates temporary credentials in payload).
- **Body**: `{ "email": "...", "tempPassword": "...", "newPassword": "..." }`.
