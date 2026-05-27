# Vesta — Google Stitch UI Generation Guide

> Submit each screen prompt individually to Google Stitch. Each prompt is self-contained with design direction, layout specification, and component details. Generate screens in the order listed — later screens reference patterns established by earlier ones.

---

## Global Design System

**Apply these rules to EVERY screen generated:**

- **Color palette:** Primary pink `#FF5A7D`, secondary deep purple `#7C3AED`, background white `#FFFFFF`, surface cards `#F9FAFB`, text dark `#1A1A2E`, text secondary `#6B7280`
- **Accent colors:** Period days = pink `#FF5A7D`, fertile window = teal `#14B8A6`, ovulation = purple `#7C3AED`, low-fertility = muted gray `#D1D5DB`
- **Style:** Soft gradients, rounded corners (12px cards, 8px buttons), glassmorphism frosted-glass effect on cards, subtle shadows. Calming, warm, empowering — not clinical
- **Typography:** Clean sans-serif (Inter or system font), aggressive hierarchy — primary numbers are oversized and bold, labels are small uppercase
- **Layout:** Mobile-first responsive (375px base), bottom tab navigation, floating action button for quick logging
- **Icons:** Rounded, illustrative style (not abstract), pastel icon backgrounds
- **Tone:** Friendly, warm, reassuring. Bengali text is 20-40% longer than English — all layouts must accommodate both languages
- **Pro badges:** Features gated behind Pro show a small purple "PRO" pill badge. Free users see an upgrade prompt overlay when tapping

---

## Screen 1: Welcome / Splash

**Stitch Prompt:**

```
Design a mobile welcome screen for "Vesta" — a reproductive health tracking app.
Centered Vesta logo (abstract flower/circle in pink-to-purple gradient).
Tagline below: "Your cycle, your family's health — in your hands" in dark text.
Subtitle: "Track periods, predict cycles, and care for your family" in gray.
Two buttons stacked vertically:
  - "Get Started" — large, rounded, pink-to-purple gradient fill, white text
  - "I already have an account" — text-only button in gray
Bottom: "English | বাংলা" language toggle as small text link.
Background: soft radial gradient from white center to very light pink edges.
Clean, minimal, no clutter. Mobile viewport 375px.
```

---

## Screen 2: Onboarding — Trust & Privacy

**Stitch Prompt:**

```
Design a mobile onboarding trust screen for a health app. Pink and purple theme.
Top: Step indicator showing "1 of 5" with a thin progress bar (20% filled, pink gradient).
Center illustration: A shield icon with a heart inside, soft pink-purple gradient,
hand-drawn illustrative style, not flat/corporate.
Headline: "Your health data is private & secure" — bold, dark, 20px.
Three trust bullet points with small icons:
  - Lock icon: "End-to-end encrypted health data"
  - Eye-off icon: "Your data is never sold or shared"
  - Users icon: "Reviewed by medical experts"
Social proof stat: "Trusted by thousands of women across Bangladesh" in small purple text.
Bottom: "Continue" button — full-width, rounded, pink-to-purple gradient.
White background with very subtle pink radial glow behind the illustration.
```

---

## Screen 3: Onboarding — Goal Selection

**Stitch Prompt:**

```
Design a mobile goal selection screen for a period tracking app. Pink and purple theme.
Top: Step indicator "2 of 5" with progress bar (40% filled).
Question: "What's your primary goal?" — bold, dark, centered.
Subtitle: "This helps us personalize your experience" — gray, small.
Two large selection cards stacked vertically, rounded corners,
white background with pink/purple left border accent:
  - Card 1: Calendar icon in pink circle + "Track my period" title +
    "Understand your cycle and predict your next period" description
  - Card 2: Heart icon in purple circle + "Try to conceive" title +
    "Track fertile window and optimize your chances" description
Each card has a radio-style selection indicator on the right.
Selected card has a subtle pink background tint and pink border.
Bottom: "Continue" button — full-width, rounded, pink gradient.
Disabled (gray) until a card is selected.
```

---

## Screen 4: Onboarding — Cycle History

**Stitch Prompt:**

```
Design a mobile form screen for entering cycle history. Pink and purple theme.
Top: Step indicator "3 of 5" with progress bar (60% filled).
Headline: "Tell us about your cycle" — bold, dark.
Reassurance text: "Don't worry if you're not sure — estimates work great" — small, pink.
Three input fields with labels, each in a white card with rounded corners:
  - "When did your last period start?" — Date picker field showing "Tap to select date"
  - "How long is your typical cycle?" — Stepper control showing "28 days" with minus/plus buttons
  - "How many days does your period usually last?" — Stepper showing "5 days" with minus/plus
Each field has a small help icon (?) that could show an explanation.
Bottom: "Continue" button — full-width, pink gradient.
White background. Clean spacing between fields.
```

---

## Screen 5: Onboarding — Personal Data

**Stitch Prompt:**

```
Design a mobile form screen for personal health data entry. Pink and purple theme.
Top: Step indicator "4 of 5" with progress bar (80% filled).
Headline: "A bit about you" — bold, dark.
Subtitle: "This helps improve prediction accuracy" — small, gray.
Four input fields in white rounded cards:
  - "Date of birth" — Date picker showing placeholder "DD/MM/YYYY"
  - "Height" — Number input with cm/ft toggle switch
  - "Weight" — Number input with kg/lb toggle switch
  - "Relation" — Dropdown/selector showing options:
    "Tracking for myself", "For my wife", "For my sister", "For my mother", "For my daughter"
The relation field has a small info icon: "One account can manage multiple family profiles"
Bottom: "Create my profile" button — full-width, pink-to-purple gradient, slightly larger than previous continues.
```

---

## Screen 6: Onboarding — First Prediction

**Stitch Prompt:**

```
Design a mobile celebration/result screen after onboarding completes. Pink and purple theme.
Center: A large circular element with gradient ring (pink to purple), showing:
  - Large number "14" (cycle day) in bold dark text, 48px
  - Below it: "Follicular Phase" in pink
  - Below that: "Your next period in ~14 days" in gray
Above the circle: Confetti/sparkle illustration, subtle, celebratory feel.
Below the circle: "Your first prediction is ready!" — bold, 16px, dark.
Subtitle: "Accuracy improves as you log more data" — small gray text with
a small bar chart icon showing 70% → 87% improvement visual.
A "Pro" pill badge next to "Advanced AI Predictions" text — hinting at the tier system.
Bottom: "Go to Dashboard" button — full-width, pink gradient.
Background: White with subtle pink/purple radial glow behind the circle.
```

---

## Screen 7: Main Dashboard (Home)

**Stitch Prompt:**

```
Design the main dashboard for a period tracking app. Pink and purple theme. Mobile 375px.

Top bar: Left — profile avatar circle (small, with dropdown arrow for profile switcher).
Center — "Vesta" logo text. Right — notification bell icon with a red dot badge.

Below top bar: Horizontal 7-day calendar strip showing Mon-Sun.
Current day highlighted with pink filled circle.
Future period days have pink dots below them.
Fertile days have teal dots. Today has a bold ring.

Hero section (center of screen): Large circular progress ring (pink-to-purple gradient stroke).
Inside the ring:
  - Very large "Day 14" text (the number is 48px+, the word "Day" is small above it)
  - "Follicular Phase" label in pink below
  - "Next period in 14 days" in small gray text below that

Below the hero: Two side-by-side info cards in white with rounded corners and subtle shadow:
  - Left card: Teal accent dot + "Fertile Window" + "Starts in 3 days"
  - Right card: Purple accent dot + "Prediction Confidence" + "75%" with a small bar

Below cards: "Today's Insight" card — wider card with article thumbnail,
title "Understanding your follicular phase", category pill "Cycle Health",
and a "Read" link in pink. Subtle "Based on your current phase" label.

Floating action button: Pink circle with white "+" icon, bottom-right,
for quick symptom logging.

Bottom navigation: 4 tabs with icons + labels:
  - Home (filled/active, pink)
  - Calendar (outline)
  - Content (outline, book icon)
  - Settings (outline, gear icon)

One tab item "Content" has a tiny purple "PRO" badge on the icon —
indicating this section has pro-gated articles.
```

---

## Screen 8: Profile Switcher

**Stitch Prompt:**

```
Design a profile switcher dropdown/bottom sheet for a multi-profile health app.
Pink and purple theme.

Triggered by tapping the avatar on the dashboard.
A bottom sheet slides up with rounded top corners and a drag handle.

Header: "Switch Profile" — bold, dark. Small "Manage" link in pink on the right.

Profile list (vertical cards):
  - Active profile: "Fatima (Self)" — pink left border, pink background tint,
    checkmark icon, avatar circle with initials "F"
  - "Rahima (Wife)" — white card, avatar "R", last activity "Updated 2 days ago"
  - "Amina (Mother)" — white card, avatar "A", last activity "Updated 1 week ago"

Each card shows: Avatar circle, name, relation type badge (small gray pill),
last period prediction snippet.

Below the list: "+ Add New Profile" button — outlined with dashed border,
pink text, plus icon.

Bottom: "Close" text link in gray.
Background behind sheet is dimmed overlay.
```

---

## Screen 9: Period Logging Modal

**Stitch Prompt:**

```
Design a period logging bottom sheet modal for a cycle tracking app. Pink and purple theme.

Bottom sheet with rounded top corners and drag handle.
Header: "Log Period" — bold, dark. X close button on the right.

Toggle at top: Two segment buttons — "Period Started" (active, pink fill) | "Period Ended" (inactive, gray outline).

Date selector: Shows today's date in a tappable field "March 27, 2026" with a calendar icon.
Label above: "Date" — small, gray.

Flow intensity section (only visible when "Period Started" selected):
Label: "Flow Intensity" — small, gray.
Three large icon cards in a horizontal row:
  - Droplet (small) + "Light" — selectable
  - Droplet (medium, filled) + "Medium" — selected state with pink background
  - Droplet (large, filled) + "Heavy" — selectable
Each is a rounded card with the icon centered above the label.

Bottom: "Save" button — full-width, pink gradient, rounded.
Below save: "Your predictions will update automatically" — tiny gray text with sparkle icon.
```

---

## Screen 10: Symptom Logger

**Stitch Prompt:**

```
Design a symptom logging screen for a health tracking app. Pink and purple theme. Mobile 375px.

Top bar: Back arrow + "Log Symptoms" title + "Done" text button in pink.
Date shown below: "Today, March 27" in gray.

Tab bar with 4 category pills (horizontally scrollable):
  - "Physical" (active — pink fill, white text)
  - "Mood" (inactive — gray outline)
  - "Discharge" (inactive — gray outline)
  - "Lifestyle" (inactive — gray outline)

Grid of symptom icons (3 columns, scrollable):
Each symptom is a square card (rounded corners) with:
  - Circular pastel-colored icon illustration on top
  - Symptom name below in small text

Physical tab shows: Cramps, Headache, Breast Pain, Bloating, Back Pain, Fatigue, Nausea, Acne.
Selected symptoms have a pink border and pink check badge in the corner.
Unselected are white/light gray.

Bottom: Small "Customize categories" link in gray.
Fixed bottom: "Save X symptoms" button — pink gradient, shows count of selected.
```

---

## Screen 11: Monthly Calendar

**Stitch Prompt:**

```
Design a full monthly calendar view for a period tracking app. Pink and purple theme.

Top bar: Back arrow + "Calendar" title + today's month/year "March 2026".
Left/right arrows for month navigation.

Calendar grid: Standard 7-column layout (Sun-Sat headers in small gray text).
Day cells show the date number with colored indicators:
  - Period days (e.g., days 1-5): Pink filled circle behind the number
  - Predicted period days (future): Pink dashed circle (lighter, not solid)
  - Fertile window days: Teal filled dot below the number
  - Ovulation day: Purple filled circle with a small star/diamond icon
  - Today: Bold number with a dark ring outline
  - Other days: Plain gray numbers
  - Days with logged symptoms: Small dot below the number (in addition to other markers)

Below the calendar grid: A "selected day" detail card.
Shows: "March 15 — Day 15, Luteal Phase"
With logged data: "Cramps, Fatigue, Medium flow" as small pills/tags.
"Edit" link in pink. If no data: "Nothing logged — tap + to add" in gray.

Legend bar at bottom of calendar:
Small colored circles with labels: Period (pink), Fertile (teal), Ovulation (purple), Predicted (dashed pink).
```

---

## Screen 12: Content / Articles Browse

**Stitch Prompt:**

```
Design a content browsing screen for health articles in a pink/purple themed app. Mobile 375px.

Top bar: "Health Insights" title, language toggle "EN | বাং" on the right.

Featured card at top: Large image card with gradient overlay (pink-to-transparent from bottom).
Article title overlaid: "Understanding Your Cycle Phases" — white, bold.
Category pill: "Cycle Health" in small pink badge. "5 min read" in white.

Below: Horizontal scrollable category pills:
"All", "Menstrual Health", "Fertility", "Wellness", "Myths & Facts"
Active category has pink fill. Others are gray outline.

Article list (vertical cards, 2 per row in a grid):
Each card has:
  - Thumbnail image (top, rounded top corners)
  - Title (bold, 2 lines max, dark)
  - Category pill + read time
  - Small "PRO" purple badge on cards that are premium-gated

One card shows a lock overlay icon for free users —
with text "Upgrade to Pro" at the bottom of the card.

Bottom: Standard 4-tab navigation (Content tab active/pink).
```

---

## Screen 13: Partner Sharing

**Stitch Prompt:**

```
Design a partner sharing settings screen. Pink and purple theme. Mobile.

Top bar: Back arrow + "Partner Sharing" title.

Section 1 — Current Partner (if connected):
White card with:
  - Avatar circle "R" + "Rahim" name + "Connected since March 20" gray text
  - Green dot indicating active
  - Permissions summary: "Can see: Calendar, Phase info, Fertile window"
  - "Cannot see: Symptoms, Personal logs"
  - Red text link at bottom: "Revoke Access"

Section 2 — Share Code:
White card with:
  - "Your share code" label in gray
  - Large code display: "VE7X-K2M9" in bold monospace, centered
  - "Copy" button (outline) and "Share via SMS" button (pink fill) side by side
  - "Code expires in 24 hours" in tiny gray text
  - "Generate New Code" link in pink below

Section 3 — What Partners Can See:
Checklist in a white card:
  - Check: "Cycle calendar & predictions"
  - Check: "Current phase & daily tips"
  - Check: "Fertile window (TTC mode only)"
  - Cross: "Logged symptoms"
  - Cross: "Personal health data"

All items non-editable — this is informational only.
```

---

## Screen 14: Notification Preferences

**Stitch Prompt:**

```
Design a notification preferences screen. Pink and purple theme. Mobile.

Top bar: Back arrow + "Notifications" title.

Profile selector at top: Small pill showing "Notifications for: Fatima (Self)" with dropdown arrow.
(Multi-profile: each profile has independent notification settings)

Section: "Alerts" — gray section header.
Toggle rows in white cards:
  - "Period predictions" — toggle ON (pink), subtitle "Get notified before your period starts"
  - "Fertile window" — toggle ON, subtitle "Know when your fertile window begins"
  - "Logging reminders" — toggle OFF (gray), subtitle "Daily reminder to log symptoms"

Section: "Channels" — gray section header.
Toggle rows:
  - "Email" — toggle ON, subtitle showing "fatima@email.com"
  - "SMS" — toggle ON, subtitle showing "+880 1XXXXXXXXX" with small "Bengali" language badge

Section: "Quiet Hours" — gray section header.
Time range selector: "10:00 PM — 7:00 AM" with edit pencil icon.
Subtitle: "No notifications during quiet hours"

Note at bottom: "SMS notifications are sent in Bengali per Bangladesh regulations" —
small gray italic text with info icon.
```

---

## Screen 15: Subscription / Pro Upgrade

**Stitch Prompt:**

```
Design a Pro subscription upgrade screen. Pink and purple gradient theme. Mobile.

Top: Close (X) button. Background: Deep purple-to-pink gradient.

Hero: "Vesta Pro" in large white bold text with a sparkle/crown icon.
Subtitle: "Unlock the full power of your health data" — white, smaller.

Feature list on purple-tinted glass cards (glassmorphism, frosted):
  - "Advanced AI Predictions" — brain icon, "Tier 2 & 3 prediction engines"
  - "Detailed Health Insights" — chart icon, "Deep cycle analytics & trends"
  - "Priority Notifications" — bell icon, "SMS + Email alerts for all events"
  - "Content Library" — book icon, "Full access to expert health articles"
  - "Partner Sharing" — users icon, "Share cycle info with your partner"

Pricing card at bottom (white card on the gradient):
  - "Charged to your mobile bill via BDApps"
  - Price: "৳XX/month" in bold (Bangladeshi Taka symbol)
  - "Cancel anytime from your BDApps account"

CTA button: "Subscribe with BDApps" — large white button with purple text, rounded.
Below: "Restore subscription" link in light purple.
Small print: "Charges appear on your mobile phone bill" — white, tiny.
```

---

## Screen 16: Grace Period Warning Banner

**Stitch Prompt:**

```
Design a dashboard variant showing a subscription grace period warning.
Same layout as the main dashboard (Screen 7) but with an added warning banner.

At the top of the screen (below the top bar, above the calendar strip):
An amber/yellow warning banner with rounded corners:
  - Warning triangle icon on the left
  - Text: "Your Pro subscription expires in 2 days" — bold, dark amber
  - Subtitle: "Resolve your billing to keep Pro features" — smaller, amber
  - "Fix Billing" button on the right — small, amber fill, white text
  - X dismiss button on far right

The rest of the dashboard is identical but any "PRO" features show a
subtle amber tint instead of purple — indicating they're about to be locked.

When Pro expires fully, those features show a lock icon overlay
with "Upgrade to Pro" text (similar to content cards in Screen 12).
```

---

## Screen 17: Settings & Account

**Stitch Prompt:**

```
Design a settings/account screen for a multi-profile health app. Pink and purple theme.

Top bar: "Settings" title.

Section: "Account" — gray section header.
Rows in white card:
  - Profile photo circle + "Adib Ahsan" name + "adib@email.com" subtitle
  - "Manage Profiles" — right arrow, shows "3 profiles" badge
  - "Subscription" — right arrow, shows "Pro" purple badge OR "Free" gray badge
  - "Language" — right arrow, shows "English" current selection

Section: "Preferences" — gray section header.
  - "Notifications" — right arrow
  - "Partner Sharing" — right arrow, shows "1 partner connected" or "Not set up"
  - "Data & Privacy" — right arrow

Section: "Support" — gray section header.
  - "Help Center" — right arrow
  - "Privacy Policy" — right arrow
  - "Terms of Service" — right arrow

Section: "Danger Zone" — red section header.
  - "Delete Account" — red text, with warning subtitle
    "This permanently removes your account and all profile data"

Bottom: "Sign Out" button — outlined, gray, centered.
App version: "Vesta v1.0" in tiny gray text at very bottom.
```

---

## Screen 18: Admin — Dashboard

**Stitch Prompt:**

```
Design an admin dashboard for a health platform. Clean, professional,
light theme with purple accent (not pink — admin uses purple as primary).
Desktop layout (1280px).

Left sidebar (dark purple, #2E1065):
  - Vesta Admin logo at top (white)
  - Nav items with icons: Dashboard (active/white), Users, Profiles,
    Analytics, Content, Notifications, Subscriptions, Feature Gates,
    Sessions, Reports, Settings
  - Active item has white background pill with purple text
  - Bottom: Admin avatar + "Super Admin" role badge

Main content area (white/gray background):
Top row — 4 KPI cards side by side:
  - "Total Users" — large number "12,453" with green up arrow "+8% this week"
  - "Active Profiles" — "18,291" with "+12%"
  - "Pro Subscribers" — "3,812" with purple accent
  - "Predictions Today" — "8,445"

Below: Two charts side by side:
  - Left: Line chart "New Users (30 days)" with purple line on white
  - Right: Bar chart "Feature Usage" showing bars for Period Tracking,
    Symptoms, Calendar, Content, Partner Sharing

Below charts: "Recent Activity" table with columns:
User, Action, Profile, Time — showing last 10 activities.
```

---

## Screen 19: Admin — Feature Gating

**Stitch Prompt:**

```
Design an admin feature gating management screen. Purple admin theme. Desktop 1280px.

Left sidebar same as admin dashboard.

Main content:
Header: "Feature Gates" title + "Changes take effect immediately" subtitle in gray.

Table with columns: Feature Name, Category, Access Level, Status, Actions.
Rows:
  - "Period Tracking" | Core | Free (green badge) | Active | Toggle switch
  - "Symptom Logging" | Core | Free | Active | Toggle
  - "Calendar View" | Core | Free | Active | Toggle
  - "Advanced Predictions (Tier 2+)" | AI | Pro (purple badge) | Active | Toggle
  - "Content Library (Full)" | Content | Pro | Active | Toggle
  - "Partner Sharing" | Social | Pro | Active | Toggle
  - "Health Reports Export" | Analytics | Pro | Active | Toggle
  - "Notification SMS" | Notifications | Free | Active | Toggle

Each row's Access Level has a dropdown: Free / Pro.
Toggle switches are purple when on.

Top right: "Bulk Actions" dropdown + "Export Config" button (outline).

Alert banner at top: "3 features changed in last 24 hours" — info blue banner.
```

---

## Screen 20: Admin — Session Management

**Stitch Prompt:**

```
Design an admin session management screen. Purple admin theme. Desktop 1280px.

Left sidebar same as admin dashboard.

Main content:
Header: "Active Sessions" title + total count "1,245 active sessions" in gray.

Search bar at top: "Search by user email or name..."

Table with columns: User, Device, IP Address, Login Time, Last Activity, Actions.
Rows showing active sessions:
  - "fatima@email.com" | Chrome / Android | 103.x.x.x | "2h ago" | "5 min ago" | [Terminate] button
  - "rahim@email.com" | Safari / iOS | 114.x.x.x | "1 day ago" | "3h ago" | [Terminate] button
  - (more rows)

The [Terminate] button is red/outlined.

Clicking a user row expands to show ALL their sessions with a
"Terminate All Sessions" red button.

Filters row above table:
"All Sessions" | "Active (last 24h)" | "Idle (>24h)" — as tab pills.

Stats bar at top:
"Active now: 834" | "Idle: 411" | "Avg session: 12 min" — in small stat pills.
```

---

## Screen 21: Admin — Subscription Management

**Stitch Prompt:**

```
Design an admin subscription management screen. Purple admin theme. Desktop 1280px.

Left sidebar same as admin dashboard.

Main content:
Header: "Subscriptions (BDApps)" title.

Top row — 4 stat cards:
  - "Active" — "3,812" green accent
  - "Grace Period" — "145" amber accent
  - "Expired" — "892" red accent
  - "Never Subscribed" — "7,604" gray accent

Config card (outlined, aside):
  - "Grace Period Setting" — number input showing "3" days, with Save button
  - "When BDApps charging fails for this many days, Pro access is revoked"

Main table with columns: User, Status, Last Charge, Days Since, Tier, Actions.
Rows:
  - "fatima@email.com" | Active (green pill) | "Mar 26" | "1 day" | Pro | [View History]
  - "karim@email.com" | Grace Period (amber pill) | "Mar 23" | "4 days" | Pro (expiring) | [View History] [Revoke]
  - "salma@email.com" | Expired (red pill) | "Mar 15" | "12 days" | Free | [View History] [Grant Pro]

[Grant Pro] and [Revoke] buttons open a modal asking for a reason text field.

"View History" expands to show: Date, Amount (BDT), Status (Success/Failed),
Tier Change — in a sub-table.

Top right: "Export Subscription Report" button (outline, purple).
```

---

## Notes for Stitch Usage

1. **Generate one screen at a time.** Copy-paste the prompt inside the ``` blocks.
2. **After generating, use Stitch's "Redesign Agent"** to refine details.
3. **Link screens into a prototype flow** in this order:
   - Welcome → Onboarding (5 screens) → Dashboard → (branch to Calendar, Symptoms, Content, Settings)
   - Settings → Partner Sharing, Notifications, Subscription
   - Admin screens are a separate flow
4. **For Bengali versions:** After generating English screens, ask Stitch to "Regenerate this screen with all text in Bengali (বাংলা). Keep the exact same layout and styling. Bengali text is longer so allow text to wrap."
5. **Export to AI Studio** for React + Tailwind code generation after prototype is complete.
