# Scope Creep Analysis

Features and capabilities present in codebase that are NOT documented or approved in `docs/product/` specifications.

## Identified Scope Creep Items

| Feature / Module | Location | Status in docs/product | Risk / Impact | Recommendation |
|---|---|---|---|---|
| **Fire Mains Flow** | `frontend/src/pages/orders/FloorPOSPage.tsx` | Not in PRD | Adds extra state complexity to order firing beyond KDS workflow | Quarantine or mark experimental |
| **Split Payment Module** | `frontend/src/pages/billing/BillingPage.tsx` | Mentioned as LATER/ADVICE | Premature implementation before legal/tax receipt split rules confirmed | Restrict to single settlement until tax rules finalized |
| **Customer Direct Ordering Wizard** | `frontend/src/pages/admin/NewCustomerWizardPage.tsx` vs `OnboardingWizardPage.tsx` | Redundant dual onboarding flows | Confuses tenant onboarding; duplicate wizard code paths exist | Consolidate onto canonical onboarding guide |
| **Room Service & Room Charges Stubs** | `frontend/src/pages/orders/RoomServicePage.tsx`, `frontend/src/pages/billing/RoomChargesPage.tsx` | Phase P2 | Implemented prematurely in navigation/routes before hotel PMS integration ready | Hide behind Hotel venue capability flag |
| **Support Ticket Desk & Broadcasts** | `backend/apps/tenants/models.py` (`SupportTicket`, `PlatformAnnouncement`) | Phase P2 | Platform admin ticketing infrastructure built ahead of pilot phase | Retain as admin-only internal tools |

## Summary
The codebase shows strong adherence to core restaurant operations, but has prematurely started several Phase 2 (P2) and ADVICE items without backend PMS/tax alignment.