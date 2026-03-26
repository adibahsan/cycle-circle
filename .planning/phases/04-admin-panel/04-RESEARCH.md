# Phase 4: Admin Panel - Research

**Researched:** 2026-03-26
**Domain:** Admin dashboard, user management, analytics, content CMS, RBAC, data export
**Confidence:** HIGH

## Summary

Phase 4 builds the operational admin panel for Vesta. The admin panel lives inside the same React SPA, lazy-loaded behind role-based route guards (Pattern 5 from ARCHITECTURE.md). It encompasses 14 requirements (ADMN-01 through ADMN-14) covering: an analytics dashboard with visual charts, user management CRUD with suspension/reactivation, population-level health analytics (privacy-protected aggregates), prediction accuracy reporting, a content management system for bilingual articles, notification management with broadcast capability, role-based access control (Super Admin vs Content Admin), and data export to CSV/Excel.

The admin panel is primarily a **read-heavy, display-heavy** feature surface. Most backend data already exists from Phases 1-3 (users, profiles, cycles, predictions, content, notifications). Phase 4's backend work is mostly writing aggregation queries and admin-specific endpoints, not new data models. The frontend work is heavier: data tables, charts, forms for content editing, and role-gated routing.

**Primary recommendation:** Use shadcn/ui's Data Table pattern (wrapping TanStack Table v8) for all tabular data. Use Recharts 3.x for all analytics charts. Use Tiptap 3.x with shadcn integration for the content editor. Use ExcelJS for data export (SheetJS on npm is abandoned). Keep RBAC simple: JWT role claim + Express middleware + React route guard wrapper. All analytics queries must return only aggregated data -- never expose individual user/profile records through analytics endpoints.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMN-01 | Admin dashboard showing total/active users, profiles created, tracking activity metrics | Prisma aggregate/groupBy for metrics; Recharts 3.x for KPI cards and sparklines; TanStack Query for data fetching |
| ADMN-02 | Visual charts: daily new users, monthly active users, profile creation trends | Recharts AreaChart, BarChart, LineChart components; date-fns for date bucketing; Prisma groupBy with date truncation |
| ADMN-03 | User management: list, view details, suspend, reactivate, delete, reset password | shadcn Data Table with TanStack Table v8 for user list; server-side pagination; admin API endpoints with requireRole middleware |
| ADMN-04 | Profile monitoring: aggregated cycle insights (privacy-protected) | Prisma aggregate queries with minimum population threshold (n>=10); never expose individual profile data |
| ADMN-05 | Health data analytics: aggregated population-level insights | Prisma groupBy + _count + _avg for cycle length, symptom frequency; privacy guards on all aggregate endpoints |
| ADMN-06 | Prediction accuracy reports: predicted vs actual dates, accuracy percentages | Compare Prediction.nextPeriod vs CycleLog.startDate; group by tier for accuracy breakdown; Recharts for visualization |
| ADMN-07 | Content management system: create/edit/delete articles, manage categories and languages | Tiptap 3.x rich text editor for article body; shadcn forms for metadata; bilingual content with language toggle |
| ADMN-08 | Notification management: control reminder types, broadcast notifications | Admin API for notification config; BullMQ broadcast job for mass notifications; delivery log table |
| ADMN-09 | Security & access control: Super Admin, Content Admin roles | Role enum in User model; requireRole('superAdmin', 'contentAdmin') middleware; RequireRole React wrapper |
| ADMN-10 | Data export: analytics/research data as CSV or Excel | ExcelJS 4.4 for XLSX generation; browser-side download via Blob + URL.createObjectURL; CSV as fallback |
| ADMN-11 | Feature usage report: usage percentages per feature area | Count queries per feature table (CycleLog, SymptomLog, Prediction, etc.); percentage = active / total profiles |
| ADMN-12 | Alert engagement report: reminders delivered, opened, action taken | NotificationLog table aggregation; delivery/open/action funnel; Recharts funnel or bar chart |
| ADMN-13 | Multi-profile usage analytics: accounts, profiles per account, relation type breakdown | Prisma groupBy on Profile.relationType with _count; User._count.profiles for distribution |
| ADMN-14 | Data completeness report: complete vs partial vs inactive profiles | Classify profiles by data completeness score (has cycles + symptoms + predictions = complete); Prisma conditional counts |
</phase_requirements>

## Standard Stack

### Core (Admin-Specific Additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.21.3 | Headless data table logic | De facto standard for React data tables. Sorting, filtering, pagination, row selection. Used by shadcn/ui Data Table component. 2400+ npm dependents. |
| Recharts | ^3.8.1 | Analytics charts | React-first SVG charts. v3 released mid-2025, rewrote state management, 3500+ unit tests. AreaChart, BarChart, LineChart, PieChart for admin dashboards. Already in project stack. |
| Tiptap | ^3.20.5 | Rich text editor for CMS | ProseMirror-based. Strong ecosystem for content editing (images, links, headings, lists). shadcn integration available. Active maintenance (published days ago). |
| ExcelJS | ^4.4.0 | Excel/CSV export | Generates XLSX files in browser. SheetJS npm package (0.18.5) is abandoned on npm since 2022 -- ExcelJS is the maintained alternative. MIT license. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tiptap/starter-kit | ^3.20.5 | Tiptap base extensions | Install alongside @tiptap/react for default editor features (bold, italic, headings, lists, code blocks) |
| @tiptap/extension-image | ^3.20.5 | Image support in CMS | Content articles need embedded images |
| @tiptap/extension-link | ^3.20.5 | Link support in CMS | Content articles need hyperlinks |
| file-saver | ^2.0.5 | Browser file download | Pair with ExcelJS for triggering XLSX download. Alternative: native Blob + URL.createObjectURL (no dependency needed). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | AG Grid | AG Grid is feature-rich but 200KB+ and has a commercial license for advanced features. Overkill for admin tables with <10K rows. |
| Tiptap | Lexical (Meta) | Lexical is faster and lighter but has a steeper learning curve and weaker ecosystem for content CMS features. Tiptap has better out-of-box content editing UX. |
| ExcelJS | SheetJS (xlsx) | SheetJS npm package (0.18.5) is abandoned/unmaintained since 2022. Newer versions only available via their CDN, not npm. ExcelJS is the safe choice. |
| ExcelJS | CSV-only (no library) | CSV export needs no library (just string concat). But ADMN-10 explicitly requires "CSV or Excel" -- ExcelJS covers both. |
| Recharts | Tremor | Tremor is a copy-paste Tailwind charting library. Nice DX but smaller community and fewer chart types than Recharts. Recharts already in the stack. |

**Installation (admin-specific additions to `packages/web`):**

```bash
# Data tables
pnpm add @tanstack/react-table

# Rich text editor for CMS
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link

# Excel export (browser-side)
pnpm add exceljs

# Recharts already in stack from Phase 2 analytics
# shadcn/ui table component (copy-paste, not a dependency):
pnpm dlx shadcn@latest add table badge tabs dialog alert-dialog select textarea
```

**No new backend dependencies needed.** All admin API endpoints use existing Prisma, Express, and auth infrastructure from Phases 1-3.

## Architecture Patterns

### Recommended Admin Structure

```
packages/web/src/
  pages/admin/                    # Route-level pages (lazy-loaded)
    AdminLayout.tsx               # Admin shell with sidebar navigation
    DashboardPage.tsx             # ADMN-01, ADMN-02: KPI cards + charts
    users/
      UserListPage.tsx            # ADMN-03: User management table
      UserDetailPage.tsx          # ADMN-03: Single user view/actions
    analytics/
      HealthAnalyticsPage.tsx     # ADMN-04, ADMN-05: Population-level insights
      PredictionReportsPage.tsx   # ADMN-06: Prediction accuracy
      UsageReportsPage.tsx        # ADMN-11, ADMN-12, ADMN-13, ADMN-14: Feature/alert/profile reports
    content/
      ContentListPage.tsx         # ADMN-07: Article list + management
      ContentEditorPage.tsx       # ADMN-07: Create/edit article with Tiptap
    notifications/
      NotificationMgmtPage.tsx    # ADMN-08: Reminder config + broadcast
    settings/
      RolesPage.tsx               # ADMN-09: Role management
    export/
      DataExportPage.tsx          # ADMN-10: Export wizard

  components/features/admin/      # Reusable admin components
    KpiCard.tsx                   # Metric card with sparkline
    AdminDataTable.tsx            # Wrapper around shadcn DataTable + TanStack Table
    ChartCard.tsx                 # Recharts chart in a Card wrapper
    ContentEditor.tsx             # Tiptap editor component
    RoleGuard.tsx                 # RequireRole wrapper component
    ExportButton.tsx              # CSV/Excel download trigger

  api/admin.ts                    # TanStack Query hooks for admin endpoints

packages/api/src/
  routes/admin/
    dashboard.routes.ts           # GET /admin/dashboard (overview metrics)
    users.routes.ts               # GET/PATCH/DELETE /admin/users
    analytics.routes.ts           # GET /admin/analytics/* (aggregated data)
    content.routes.ts             # CRUD /admin/content/articles
    notifications.routes.ts       # GET/POST /admin/notifications
    export.routes.ts              # GET /admin/export/* (CSV/XLSX)
  services/admin.service.ts       # Business logic for admin operations
  middleware/auth.ts              # requireRole('superAdmin', 'contentAdmin')
```

### Pattern 1: Role-Based Route Guarding (Frontend + Backend)

**What:** Two-layer RBAC. Frontend guards routes for UX (hide admin pages from non-admins). Backend enforces for security (reject unauthorized API calls).

**When to use:** Every admin route and endpoint.

**Frontend guard:**

```typescript
// components/features/admin/RoleGuard.tsx
interface RequireRoleProps {
  roles: ('superAdmin' | 'contentAdmin')[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function RequireRole({ roles, children, fallback }: RequireRoleProps) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return fallback ?? <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// router.tsx - lazy-loaded admin routes
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));

<Route path="/admin" element={
  <RequireRole roles={['superAdmin', 'contentAdmin']}>
    <Suspense fallback={<AdminSkeleton />}>
      <AdminLayout />
    </Suspense>
  </RequireRole>
}>
  {/* Content Admin can access content routes */}
  <Route path="content/*" element={<ContentListPage />} />

  {/* Only Super Admin can access user management and settings */}
  <Route path="users/*" element={
    <RequireRole roles={['superAdmin']}>
      <UserListPage />
    </RequireRole>
  } />
</Route>
```

**Backend guard:**

```typescript
// middleware/auth.ts
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // set by verifyJWT middleware
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// routes/admin/users.routes.ts
router.get('/admin/users',
  verifyJWT,
  requireRole('superAdmin'),
  validateQuery(userListQuerySchema),
  adminController.listUsers
);

// Content Admin can manage articles but not users
router.post('/admin/content/articles',
  verifyJWT,
  requireRole('superAdmin', 'contentAdmin'),
  validateBody(createArticleSchema),
  adminController.createArticle
);
```

### Pattern 2: Aggregated Analytics Queries (Privacy-Protected)

**What:** All admin analytics endpoints return only aggregated data. Never expose individual user or profile records through analytics. Apply minimum population thresholds.

**When to use:** ADMN-04, ADMN-05, ADMN-06, ADMN-11-14.

```typescript
// services/admin.service.ts
async function getHealthAnalytics() {
  const [avgCycleLength, irregularPct, topSymptoms] = await Promise.all([
    // Average cycle length across all profiles (aggregate)
    prisma.cycleLog.aggregate({
      _avg: { cycleLength: true },
      _count: { id: true },
    }),

    // Irregular cycle percentage (cycle length < 21 or > 35 days)
    prisma.$queryRaw`
      SELECT
        COUNT(CASE WHEN cycle_length < 21 OR cycle_length > 35 THEN 1 END)::float
        / NULLIF(COUNT(*), 0) * 100 AS irregular_pct
      FROM "CycleLog"
      WHERE cycle_length IS NOT NULL
    `,

    // Most common symptoms (grouped, never individual)
    prisma.symptomLog.groupBy({
      by: ['symptomId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ]);

  return { avgCycleLength, irregularPct, topSymptoms };
}

// CRITICAL: Minimum population threshold
// Never return aggregated data for groups smaller than 10
function applyPrivacyThreshold<T extends { _count: { id: number } }>(
  groups: T[],
  minCount: number = 10
): T[] {
  return groups.filter(g => g._count.id >= minCount);
}
```

### Pattern 3: Admin Data Table with Server-Side Pagination

**What:** User management tables use server-side pagination, sorting, and filtering. The client sends page/limit/sort/filter params; the server returns a paginated result with total count.

**When to use:** ADMN-03 (user list), ADMN-07 (article list), notification logs.

```typescript
// API endpoint
// GET /admin/users?page=1&limit=20&sort=createdAt&order=desc&search=email
router.get('/admin/users',
  verifyJWT,
  requireRole('superAdmin'),
  validateQuery(z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.enum(['email', 'createdAt', 'role']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(),
  })),
  async (req, res) => {
    const { page, limit, sort, order, search } = req.query;
    const skip = (page - 1) * limit;

    const where = search ? {
      email: { contains: search, mode: 'insensitive' }
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        select: {
          id: true, email: true, role: true, createdAt: true,
          isActive: true,
          _count: { select: { profiles: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }
);

// Frontend TanStack Query hook
function useAdminUsers(params: UserListParams) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminApi.getUsers(params),
  });
}
```

### Pattern 4: Content CMS with Bilingual Support

**What:** Articles are stored with separate content fields per language. The admin editor has a language toggle to edit English and Bengali versions independently.

**When to use:** ADMN-07 (content management).

```typescript
// Database model (Prisma schema)
// model Article {
//   id          String   @id @default(uuid())
//   slug        String   @unique
//   titleEn     String
//   titleBn     String
//   bodyEn      String   @db.Text  // Tiptap JSON or HTML
//   bodyBn      String   @db.Text
//   categoryId  String
//   tags        String[]
//   cyclePhases String[] // which cycle phases this is relevant to
//   status      ArticleStatus @default(DRAFT)
//   authorId    String
//   publishedAt DateTime?
//   createdAt   DateTime @default(now())
//   updatedAt   DateTime @updatedAt
// }
//
// enum ArticleStatus { DRAFT, PUBLISHED, ARCHIVED }

// Content editor page has a language toggle
// Each language tab contains a Tiptap editor instance
// Save sends both language versions in one request
```

### Anti-Patterns to Avoid

- **Exposing individual user data in analytics:** Admin analytics must NEVER return identifiable profile data. All health metrics are aggregated. Apply minimum group size thresholds (n >= 10).
- **Client-side-only role checking:** Frontend role guards are UX convenience only. The backend must enforce roles on every admin endpoint. A user editing localStorage/JWT should not gain admin access.
- **Building a separate admin SPA:** Doubles deployment, auth, and maintenance complexity. Use lazy-loaded routes within the same SPA (see ARCHITECTURE.md Anti-Pattern 3).
- **Using raw SQL for all analytics:** Prisma's `aggregate()`, `groupBy()`, and `_count` handle 90% of admin queries. Use `$queryRaw` only for complex date bucketing or cross-table aggregations that Prisma cannot express.
- **Storing Tiptap content as raw HTML:** Store as Tiptap JSON for portability and re-rendering. Generate HTML on read for the public-facing content pages. JSON is easier to migrate and sanitize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data tables with sorting/filtering/pagination | Custom table component with manual sort/filter state | shadcn Data Table + TanStack Table v8 | Keyboard navigation, accessibility, column resizing, row selection -- hundreds of edge cases in table UX |
| Charts and data visualization | SVG charts from scratch or D3 directly | Recharts 3.x | Responsive, animated, React-native API. D3 integration is already handled internally. |
| Rich text editor | Custom contentEditable implementation | Tiptap 3.x (@tiptap/react + starter-kit) | Content editing has thousands of edge cases (cursor management, nested lists, paste handling, undo/redo). |
| Excel file generation | Manual XLSX binary format construction | ExcelJS 4.4 | XLSX is a complex zip-based XML format. ExcelJS handles worksheets, styling, formulas. |
| Role-based route guarding | Per-page role checks scattered in components | Centralized RequireRole wrapper + Express requireRole middleware | Consistent enforcement. One place to audit. |
| Date range aggregation | Custom date bucketing logic | Prisma `$queryRaw` with PostgreSQL `date_trunc()` | PostgreSQL's `date_trunc('day', created_at)` handles timezone-aware bucketing correctly. |

**Key insight:** The admin panel is architecturally simple (CRUD + aggregation + charts) but has enormous surface area (14 requirements, many sub-features). The danger is not complexity but scope creep. Use established libraries for every sub-problem to keep implementation tight.

## Common Pitfalls

### Pitfall 1: Analytics Queries Blocking the Main Database
**What goes wrong:** Admin analytics queries (full-table scans, groupBy across millions of rows) compete with user-facing read/write queries, causing slowdowns for regular users.
**Why it happens:** Admin and user traffic share the same database connection pool.
**How to avoid:** At launch scale (< 1K users), this is a non-issue. Add read replica when scale grows. For now, add appropriate indexes: `(createdAt)` on User, `(profileId, startDate)` on CycleLog, `(profileId, date)` on SymptomLog. Cache expensive aggregate results in Redis with 5-minute TTL.
**Warning signs:** User-facing API latency increases when admin views analytics pages.

### Pitfall 2: Content Admin Escalating to Super Admin Capabilities
**What goes wrong:** Content Admin role gains access to user management, data export, or notification broadcast because role checks are inconsistent.
**Why it happens:** Using a single `requireRole('admin')` check everywhere instead of differentiating between role levels.
**How to avoid:** Define a clear permission matrix. Content Admin can ONLY: manage articles, manage content categories. Super Admin can: everything. Enforce this in backend middleware, not just frontend routing. Use specific role arrays: `requireRole('superAdmin')` for user management, `requireRole('superAdmin', 'contentAdmin')` for content.
**Warning signs:** Content Admin can see user management pages or trigger data exports.

### Pitfall 3: Exposing Individual Health Data Through Admin Queries
**What goes wrong:** Admin endpoint returns per-profile cycle data instead of population aggregates. An admin (or compromised admin account) can identify individual users' reproductive health patterns.
**Why it happens:** Developer writes `prisma.cycleLog.findMany()` instead of `prisma.cycleLog.aggregate()` in admin analytics.
**How to avoid:** Admin analytics service NEVER calls `findMany()` on health data tables. Only `aggregate()`, `groupBy()`, and `count()`. Code review rule: no `findMany` or `findFirst` on CycleLog/SymptomLog/Prediction in admin service except for data export (which requires Super Admin + explicit user consent framework).
**Warning signs:** Admin API response contains `profileId`, individual dates, or arrays of individual records in analytics endpoints.

### Pitfall 4: Tiptap Content XSS in Public-Facing Pages
**What goes wrong:** Admin creates article content with malicious HTML/scripts. When rendered on the public content page, XSS executes.
**Why it happens:** Storing Tiptap output as raw HTML and rendering with `dangerouslySetInnerHTML` without sanitization.
**How to avoid:** Store content as Tiptap JSON (not HTML). Render using Tiptap's `generateHTML()` which produces safe HTML from known node types. If you must render HTML, sanitize with DOMPurify before rendering. Never use `dangerouslySetInnerHTML` with unsanitized admin-authored content.
**Warning signs:** Article body contains `<script>` tags, `onclick` attributes, or `javascript:` URLs in the rendered output.

### Pitfall 5: Data Export Producing Enormous Files
**What goes wrong:** Admin triggers CSV export of all user analytics. The server loads millions of rows into memory, runs out of RAM, and crashes.
**Why it happens:** Using `findMany()` without pagination for export, loading entire result set into memory before writing to file.
**How to avoid:** Use streaming: Prisma cursor-based pagination with Node.js writable streams. Write CSV/XLSX rows incrementally. Set a maximum export size limit (e.g., 100K rows). For larger exports, queue as a background job and email the admin a download link when complete.
**Warning signs:** Export endpoint times out or backend process memory spikes during export.

### Pitfall 6: Notification Broadcast Without Rate Limiting
**What goes wrong:** Admin accidentally sends a broadcast notification to all users multiple times, overwhelming the SMS/email providers and burning through SMS credits.
**Why it happens:** No confirmation step, no deduplication, no cooldown period on broadcast.
**How to avoid:** Require confirmation dialog ("Send to X users?"). Add a cooldown period (no broadcast within 1 hour of the last one). Log all broadcasts with timestamp, sender, and recipient count. Use BullMQ's unique job ID to prevent duplicate sends.
**Warning signs:** Multiple identical broadcast jobs in the BullMQ queue.

## Code Examples

### KPI Card with Sparkline (Recharts)

```typescript
// components/features/admin/KpiCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string; // e.g., "+12% from last month"
  trend?: { date: string; value: number }[];
}

function KpiCard({ title, value, change, trend }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className="text-xs text-muted-foreground">{change}</p>
        )}
        {trend && (
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={trend}>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

### Admin Data Table Setup (shadcn + TanStack Table)

```typescript
// pages/admin/users/columns.tsx
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type AdminUser = {
  id: string;
  email: string;
  role: 'user' | 'contentAdmin' | 'superAdmin';
  isActive: boolean;
  createdAt: string;
  _count: { profiles: number };
};

export const userColumns: ColumnDef<AdminUser>[] = [
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>
        Email
      </Button>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
      <Badge variant={row.original.role === 'superAdmin' ? 'destructive' : 'default'}>
        {row.original.role}
      </Badge>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
        {row.original.isActive ? 'Active' : 'Suspended'}
      </Badge>
    ),
  },
  {
    accessorKey: '_count.profiles',
    header: 'Profiles',
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ row }) => format(new Date(row.original.createdAt), 'PP'),
  },
];
```

### Excel Export with ExcelJS (Browser-Side)

```typescript
// lib/export.ts
import ExcelJS from 'exceljs';

interface ExportOptions {
  filename: string;
  sheetName: string;
  columns: { header: string; key: string; width?: number }[];
  data: Record<string, unknown>[];
}

async function exportToExcel({ filename, sheetName, columns, data }: ExportOptions) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns;

  // Header styling
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  data.forEach(row => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// CSV export (no library needed)
function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Tiptap Content Editor (CMS)

```typescript
// components/features/admin/ContentEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

interface ContentEditorProps {
  content: string; // Tiptap JSON string
  onChange: (json: string) => void;
}

function ContentEditor({ content, onChange }: ContentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
    ],
    content: content ? JSON.parse(content) : '',
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  return (
    <div className="border rounded-md">
      {/* Toolbar */}
      <div className="flex gap-1 p-2 border-b">
        <Button size="sm" variant="ghost"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          data-active={editor?.isActive('bold')}>
          Bold
        </Button>
        <Button size="sm" variant="ghost"
          onClick={() => editor?.chain().focus().toggleItalic().run()}>
          Italic
        </Button>
        {/* ... more toolbar buttons */}
      </div>
      <EditorContent editor={editor} className="prose p-4 min-h-[300px]" />
    </div>
  );
}
```

### Prediction Accuracy Report Query

```typescript
// services/admin.service.ts
async function getPredictionAccuracyReport() {
  // Compare predicted period start vs actual period start
  // Only for cycles where we have both a prediction AND an actual logged period
  const results = await prisma.$queryRaw<PredictionAccuracy[]>`
    SELECT
      p.tier,
      COUNT(*)::int AS total_predictions,
      AVG(ABS(p.next_period::date - c.start_date::date))::float AS avg_days_off,
      (COUNT(CASE WHEN ABS(p.next_period::date - c.start_date::date) <= 1 THEN 1 END)::float
       / NULLIF(COUNT(*), 0) * 100)::float AS within_1_day_pct,
      (COUNT(CASE WHEN ABS(p.next_period::date - c.start_date::date) <= 3 THEN 1 END)::float
       / NULLIF(COUNT(*), 0) * 100)::float AS within_3_days_pct
    FROM "Prediction" p
    INNER JOIN "CycleLog" c ON c.profile_id = p.profile_id
      AND c.start_date >= p.next_period - INTERVAL '7 days'
      AND c.start_date <= p.next_period + INTERVAL '7 days'
    GROUP BY p.tier
    ORDER BY p.tier
  `;

  return results;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x (external deps: recharts-scale, react-smooth) | Recharts 3.x (internalized all deps, rewritten state mgmt) | June 2025 | Better performance, smaller bundle, better TS support. Use ^3.8.1. |
| SheetJS on npm (xlsx@0.18.5) | SheetJS moved off npm; ExcelJS as alternative | 2022 (SheetJS stopped npm publishing) | Must use ExcelJS for npm-based Excel export. SheetJS requires CDN install which is non-standard. |
| Tiptap 2.x | Tiptap 3.x (new React integration, declarative API) | 2025 | Declarative `<Tiptap />` component. Better React 19 compatibility. |
| TanStack Table v7 (react-table) | TanStack Table v8 (framework-agnostic, headless) | 2022 (stable since) | Current: 8.21.3. Headless, TypeScript-first, ~15KB. No v9 yet. |

**Deprecated/outdated:**
- `xlsx` npm package: Abandoned on npm since 2022. Do NOT `npm install xlsx`. Use ExcelJS instead.
- Recharts 2.x: Still works but v3 has significant improvements. Upgrade path is straightforward (see migration guide).
- react-table (v7): Replaced by @tanstack/react-table v8. Do not use the old package name.

## Open Questions

1. **Tiptap content storage format**
   - What we know: Tiptap can output JSON or HTML. JSON is recommended for storage, HTML for rendering.
   - What's unclear: Whether to store both JSON + rendered HTML (denormalized for read performance) or just JSON (render on read).
   - Recommendation: Store JSON only. Generate HTML at read time using `generateHTML()`. The content volume is low enough that render-on-read is fine. Denormalize only if content read latency becomes an issue.

2. **Data export size limits**
   - What we know: ExcelJS can handle large files but loading all data into memory is dangerous.
   - What's unclear: Maximum expected export size at launch. Are we exporting raw health data or only aggregated analytics?
   - Recommendation: ADMN-10 says "analytics/research data" -- this implies aggregated data, not raw logs. Set a 50K row limit. For larger research datasets, queue as background job.

3. **Admin user seeding**
   - What we know: First admin account needs to exist before the admin panel is usable.
   - What's unclear: Whether to create admin via seed script, CLI command, or special registration endpoint.
   - Recommendation: Prisma seed script creates the initial Super Admin account. Additional admins are created by existing Super Admins through the admin panel. Never expose a public admin registration endpoint.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.x (not yet installed) |
| Config file | none -- see Wave 0 |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMN-01 | Dashboard returns correct aggregate metrics | unit | `pnpm vitest run tests/admin/dashboard.test.ts -t "dashboard metrics"` | No -- Wave 0 |
| ADMN-02 | Charts render with correct data shape | unit | `pnpm vitest run tests/admin/charts.test.ts` | No -- Wave 0 |
| ADMN-03 | User management CRUD operations | integration | `pnpm vitest run tests/admin/users.test.ts` | No -- Wave 0 |
| ADMN-04 | Profile monitoring returns only aggregated data | unit | `pnpm vitest run tests/admin/analytics.test.ts -t "aggregated"` | No -- Wave 0 |
| ADMN-05 | Health analytics respects privacy threshold | unit | `pnpm vitest run tests/admin/analytics.test.ts -t "privacy"` | No -- Wave 0 |
| ADMN-06 | Prediction accuracy calculation correct | unit | `pnpm vitest run tests/admin/predictions.test.ts` | No -- Wave 0 |
| ADMN-07 | Content CRUD with bilingual support | integration | `pnpm vitest run tests/admin/content.test.ts` | No -- Wave 0 |
| ADMN-08 | Notification broadcast sends to correct channels | integration | `pnpm vitest run tests/admin/notifications.test.ts` | No -- Wave 0 |
| ADMN-09 | Role-based access enforced on all admin endpoints | unit | `pnpm vitest run tests/admin/rbac.test.ts` | No -- Wave 0 |
| ADMN-10 | Data export generates valid CSV/XLSX | unit | `pnpm vitest run tests/admin/export.test.ts` | No -- Wave 0 |
| ADMN-11 | Feature usage report counts correct | unit | `pnpm vitest run tests/admin/reports.test.ts -t "feature usage"` | No -- Wave 0 |
| ADMN-12 | Alert engagement funnel metrics correct | unit | `pnpm vitest run tests/admin/reports.test.ts -t "engagement"` | No -- Wave 0 |
| ADMN-13 | Multi-profile analytics correct | unit | `pnpm vitest run tests/admin/reports.test.ts -t "multi-profile"` | No -- Wave 0 |
| ADMN-14 | Data completeness scoring correct | unit | `pnpm vitest run tests/admin/reports.test.ts -t "completeness"` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm vitest run tests/admin/ --reporter=verbose`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` -- Framework config (not yet in project)
- [ ] `tests/admin/rbac.test.ts` -- RBAC enforcement tests (highest priority)
- [ ] `tests/admin/analytics.test.ts` -- Privacy threshold + aggregation correctness
- [ ] `tests/admin/dashboard.test.ts` -- Metric calculation tests
- [ ] `tests/admin/users.test.ts` -- User management CRUD integration tests
- [ ] `tests/admin/content.test.ts` -- Content CMS CRUD tests
- [ ] `tests/admin/export.test.ts` -- Export file generation tests
- [ ] `tests/admin/reports.test.ts` -- All reporting requirement tests
- [ ] `tests/admin/predictions.test.ts` -- Prediction accuracy calc tests
- [ ] `tests/admin/notifications.test.ts` -- Broadcast + notification management tests
- [ ] Vitest installation: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom`

## Sources

### Primary (HIGH confidence)
- [npm @tanstack/react-table](https://www.npmjs.com/package/@tanstack/react-table) -- v8.21.3 verified via `npm view`
- [npm recharts](https://www.npmjs.com/package/recharts) -- v3.8.1 verified via `npm view`
- [npm @tiptap/react](https://www.npmjs.com/package/@tiptap/react) -- v3.20.5 verified via `npm view`
- [npm exceljs](https://www.npmjs.com/package/exceljs) -- v4.4.0 verified via `npm view`
- [npm xlsx](https://www.npmjs.com/package/xlsx) -- v0.18.5, abandoned on npm since 2022
- [shadcn/ui Data Table docs](https://ui.shadcn.com/docs/components/radix/data-table) -- Official integration pattern with TanStack Table
- [Prisma Aggregation docs](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing) -- groupBy, aggregate, _count patterns
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- v3 changelog and breaking changes
- [Recharts releases](https://github.com/recharts/recharts/releases) -- v3.0.0 released June 2025, v3.8.1 current

### Secondary (MEDIUM confidence)
- [RBAC in Node.js and React (Medium)](https://medium.com/@ignatovich.dm/implementing-role-based-access-control-rbac-in-node-js-and-react-c3d89af6f945) -- Frontend + backend RBAC pattern
- [shadcn Admin template](https://www.shadcn.io/template/satnaing-shadcn-admin) -- Reference for admin dashboard layout patterns
- [Tiptap + shadcn integration](https://github.com/hunghg255/reactjs-tiptap-editor) -- Community integration pattern
- [SheetJS npm migration notice](https://cdn.sheetjs.com/xlsx/) -- Confirms SheetJS moved off npm

### Tertiary (LOW confidence)
- [HIPAA data aggregation guidance](https://www.brickergraydon.com/insights/resources/key/hipaa-privacy-regulations-definitions-data-aggregation-164-501) -- While Vesta may not be HIPAA-bound, the k-anonymity principle (minimum population threshold for aggregated health data) is a best practice worth following
- [Recharts 3.0 mid-2025 update claims](https://embeddable.com/blog/what-is-recharts) -- Accessibility and animation improvements mentioned but not verified against changelog

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All packages verified via npm registry. Versions confirmed. shadcn/ui Data Table + TanStack Table is the industry standard pattern.
- Architecture: HIGH -- Admin panel architecture follows Pattern 5 from ARCHITECTURE.md (same SPA, lazy-loaded, role-gated). Backend follows established routes/services/middleware pattern.
- Pitfalls: HIGH -- Privacy-protected analytics, RBAC enforcement, and content XSS are well-documented concerns in health app admin panels. Prevention strategies are straightforward.
- CMS (Tiptap): MEDIUM -- Tiptap 3.x is actively maintained and well-documented, but the bilingual dual-editor pattern is a custom design without established precedent. May need iteration.
- Data export: MEDIUM -- ExcelJS is reliable but SheetJS situation (abandoned npm) is unusual and may confuse developers familiar with the old approach.

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (30 days -- admin tooling is stable, unlikely to shift)
