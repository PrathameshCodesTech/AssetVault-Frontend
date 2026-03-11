

# Asset Digitalization & Reconciliation System — Implementation Plan

## 1. Foundation & Theme
- Banking-grade design system: white background, subtle blue (#1e3a5f) primary, high-contrast typography
- Configure PWA: manifest, service worker, offline fallback, install prompt, camera permissions
- Environment-based API URL config (`/api/*` placeholder endpoints)
- Mock data layer with realistic sample data (250+ assets, multiple locations, employees)

## 2. Authentication (OTP Flow)
- **Email entry screen** — clean, centered, bank-branded
- **OTP verification screen** — 6-digit input with countdown timer, resend button, error/loading states
- Token stored in memory (JWT-ready), session timeout handling
- Role detection after login → routes to appropriate dashboard
- Unauthorized access redirect to login

## 3. Responsive Navigation
- **Mobile**: Bottom tab bar — Dashboard | Scan | My Assets | Profile
- **Desktop**: Left sidebar with collapsible groups + top header (profile, logout, notifications)
- Role-based menu items (Super Admin sees everything, Employee sees limited options)

## 4. Role-Based Dashboards

### Employee Dashboard (Mobile-first)
- Cards: Total Assigned, Pending Reconciliation, Verified count
- Large "Quick Scan" button
- Recent activity list

### Location Admin Dashboard
- Branch asset overview, reconciliation progress bar
- Pending approvals list, movement tracker

### Super Admin Dashboard (Desktop-optimized)
- Analytics widgets: asset distribution by location (charts), reconciliation %, recent activity
- Movement logs table, system health indicators

## 5. Asset Management Module
- **Asset list** — paginated table (desktop) / card list (mobile) with search, filters, sorting
- **Asset detail page** — registration info, image, QR code, status badge
- **Asset registration form** — manual entry with validation
- **Bulk upload** — CSV/Excel file upload with preview, validation errors, progress bar
- Lazy loading, debounced search, skeleton loading states

## 6. Barcode & QR Module
- **Camera scanner** — using `html5-qrcode` library for real barcode/QR scanning
- **Manual entry fallback** — text input for barcode number
- **QR generation** — instant QR preview modal with print button
- Large scan button UI, camera permission handling

## 7. Asset Tracking & History
- **Mobile**: Timeline-style movement/reassignment history
- **Desktop**: Table with expandable history drawer
- Shows: registration details, movement history, reconciliation status, image records

## 8. Reconciliation Workflow (Employee, Mobile-first)
Step-by-step guided flow:
1. Scan asset (camera or manual)
2. System fetches & displays asset details
3. Confirm current location
4. Upload photo of asset
5. Submit confirmation
- Success animation, error states, retry option

## 9. Admin & Reporting
- Reconciliation report with CSV export
- Filters: location, date range, employee
- Asset discrepancy report
- Movement audit log table

## 10. UX for Non-Technical Users
- Tooltips and help icons throughout
- Visual examples ("Where to find serial number" with illustration placeholders)
- Micro-instructions on forms
- Confirmation dialogs before submissions
- Step indicators on multi-step flows
- Minimal technical language

## 11. Performance & Security
- Pagination on all large lists
- Skeleton loading states on every data fetch
- API timeout handling with retry
- Role-based route guards
- Session timeout UI (auto-logout warning)

## Pages to Build
- `/login` — Email + OTP screens
- `/` — Role-based dashboard
- `/assets` — Asset list with filters
- `/assets/:id` — Asset detail + history
- `/assets/register` — New asset form
- `/assets/upload` — Bulk CSV upload
- `/scan` — Camera scanner + QR generation
- `/reconciliation` — Step-by-step flow
- `/reports` — Admin reporting
- `/profile` — User profile & settings
- `/install` — PWA install prompt page

