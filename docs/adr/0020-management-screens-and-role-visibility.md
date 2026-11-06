# ADR 0020: Management Screens Architecture, Role Visibility, and Preset-Driven Navigation

- **Status**: Accepted
- **Date**: 2026-11-06
- **Context**: Prompt 3C requires all remaining sidebar navigation items backed by database models to transition from placeholders into fully operational, production-ready management screens: Branches (`/branches`), Areas & Sections (`/venue/areas`), Dining Tables (`/venue/tables`), Counters & Tokens (`/venue/counters`), Floor Plan (`/venue/floor`), Staff Management (`/staff`), and Venue Settings (`/settings/venue`).
- **Decisions**:
  1. **Strict Role-Based Field and Action Visibility**:
     - `OWNER`: Full administrative privileges across all branches, tenant capabilities, staff invitations, and plan tier configurations.
     - `BRANCH_MANAGER`: Scoped strictly to viewing/editing their assigned branch. Cannot see or trigger "Add Branch", cannot edit billing plan presets, cannot modify owner-level venue switches.
     - `WAITER` & `CASHIER`: Limited to viewing table layouts, status transitions (`table.status_update`), and service queues. "Add Table", "Bulk Create", "Delete Area", and "Manage Staff" controls are hidden from DOM and unauthorized at API endpoints.
  2. **Temporary Password Security Invariant**:
     - Temporary credentials generated upon staff creation or password reset are displayed exactly ONCE in a dedicated modal dialog with a one-click copy button and a prominent security notice: *"They must change it at first sign-in"*.
     - Dismissing or reloading clears the credential from browser memory; it is never stored in persistent local state or retrievable again.
  3. **Zero-Table Invariant for Counter Service / Tea Shop**:
     - When `uses_tables = false` (e.g., Tea Shop preset or Quick Service), the UI replaces "Tables" and "Floor Plan" with "Counters & Tokens" (`/venue/counters`).
     - Strict verification ensures zero occurrences of the word `"table"` or Tamil `"மேஜை"` in screen text, headers, breadcrumbs, and active navigation.
  4. **Natural Sorting of Table Identifiers**:
     - Dining tables must order naturally (`T1`, `T2`, `T10`, not alphabetical `T1`, `T10`, `T2`). Backend ordering is performed on `(label_prefix, label_number, label)` and matched client-side.
  5. **Floor Plan Phased Delivery**:
     - Drag-and-drop interactive floor map manipulation is explicitly deferred to future releases (tracked in `docs/product/backlog.md`).
     - Screen B5 renders a clean, read-only grid layout displaying active table cards with status-coded borders, table capacity, and a clear user notice: *"Drag-and-drop floor plan editing will be available in a future update."* Clicking a table opens an accessible side sheet allowing authorized staff to update table status.
  6. **API Gap Documentation Over Invention**:
     - Missing schema fields on existing models (such as `Section.is_active` or `Section.section_type`) are documented as known API gaps rather than inventing ad-hoc database migrations out of scope.
- **Consequences**:
  - Eliminates all placeholder screens for Pilot 1 operational baseline.
  - Guarantees role separation and tenant isolation across all management interfaces.
  - Establishes a complete regression test suite covering all 9 operational management flows across desktop and mobile viewports.

