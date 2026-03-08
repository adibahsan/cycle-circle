# Flo Health — User Journey Flow Diagrams

All major feature flows mapped from the comprehensive product research. Each diagram represents the end-to-end user journey for a distinct product area.

---

## 1. Onboarding Flow

The ~70-screen onboarding arc, following a deliberate psychological sequence: trust → goal → data → signup → paywall.

```mermaid
flowchart TD
    A([App Launch]) --> B[Trust Screens\n'Your data is protected'\n'100+ medical experts']
    B --> C[Goal Selection]

    C --> D[Track my Period]
    C --> E[Try to Conceive]
    C --> F[Track Pregnancy]
    C --> G[Perimenopause]

    D & E & F & G --> H[Personal Data Collection\nDate of birth · Last period date\nCycle length · Period length\nHeight & weight]

    H --> I[Lifestyle & Health Questions\nDiet · Exercise · Sleep\nPrior pregnancies · Contraception\nHealth concerns · Content interests]

    I --> J[Social Proof Interspersed\n'90% say Flo predicts accurately'\n'3.5M+ 5-star ratings']

    J --> K[Account Sign-up\nEmail · Apple · Google\nPositioned after value shown]

    K --> L{Premium Paywall\n14-day free trial}

    L -->|Accept trial| M([Dashboard — Premium User])

    L -->|Decline| N[Gift Box Offer\n77% off Annual Plan]
    N -->|Accept| O([Dashboard — Premium via Discount])
    N -->|Decline| P[Second Offer\n7-day Trial · Reduced Price]
    P -->|Accept| Q([Dashboard — Premium via Trial])
    P -->|Decline| R([Dashboard — Free Tier User])
```

---

## 2. Period Tracking & Cycle Dashboard

The core daily habit loop — logging periods and viewing cycle status.

```mermaid
flowchart TD
    A([Open App]) --> B[Home Dashboard]

    B --> C[Circular Hero Element\nCycle Day Counter\nCurrent Phase Label]
    B --> D[7-Day Calendar Strip\nColor-coded markers]

    D --> D1[🔴 Red/Pink — Period days]
    D --> D2[🩵 Teal — Fertile window]
    D --> D3[🔵 Teal-dot — Ovulation day]
    D --> D4[⚫ Dark — Low fertility]

    C --> E{Today's status}

    E -->|Period expected / active| F[Tap 'Log Period']
    F --> G[Select: Start Period]
    G --> H[Choose Flow Intensity\nLight · Medium · Heavy]
    H --> I[Confirm & Save]
    I --> J[Prediction Engine Recalculates\nNeural network updates forecast]

    E -->|Period ended| K[Tap 'Log Period End']
    K --> L[Mark End Date\nEditable retroactively]
    L --> J

    J --> M[Updated Predictions Shown\nNext period date\nFertile window\nOvulation day]

    M --> N{Need to correct past data?}
    N -->|Yes| O[Open Full Calendar View\nTap any past day\nEdit period markers]
    O --> J
    N -->|No| P([Done — Data feeds\nML model + content personalization])
```

---

## 3. Symptom Logging Flow

80+ symptoms across 16 categories, logged via floating "+" in ≤3 taps.

```mermaid
flowchart TD
    A([Any Screen]) --> B[Tap Floating '+' Button]

    B --> C[Symptom Logging Sheet Opens]
    C --> D[Select Category Tab]

    D --> E[🩺 Physical\nCramps · Headache · Bloating\nFatigue · Nausea · Acne]
    D --> F[😌 Mood & Emotional\nCalm · Sad · Happy\nAnxious · Irritable · Depressed]
    D --> G[💧 Vaginal Discharge\nSticky · Creamy · Watery\nEgg white · Spotting · Atypical]
    D --> H[🏃 Lifestyle\nSleep · Water · Exercise\nWeight · Stress · Travel]
    D --> I[💊 Medical\nContraception · BBT · OPK\nPregnancy test results]
    D --> J[❤️ Sex & Libido\nSex drive · Protected/unprotected\nOrgasm · Masturbation]

    E & F & G & H & I & J --> K[Tap Icon to Select Symptom\nIcon-based — not text-heavy]

    K --> L{Select multiple?}
    L -->|Yes| D
    L -->|No| M[Save Day's Log]

    M --> N[Data Stored\nFeeds prediction engine\nFeeds content personalization]

    N --> O{Symptom logged before today?}
    O -->|Yes| P[Edit option available\nOne log per symptom per day]
    O -->|No| Q([Log Complete])

    P --> Q
```

---

## 4. Ovulation & Fertility Tracking (TTC Mode)

Journey for users trying to conceive — BBT, OPK, and fertile window tools.

```mermaid
flowchart TD
    A([Goal: Try to Conceive]) --> B[TTC Dashboard\nFertile window highlighted\nOvulation day marked]

    B --> C[Fertile Window View\nTeal calendar strip\nConception tips from experts]

    B --> D[Log BBT Reading]
    D --> E[Manual Entry — Temperature]
    E --> F[BBT feeds into\nPrediction Algorithm\nShifts ovulation estimate]

    B --> G[Log OPK Result\nOvulation Predictor Kit]
    G --> H{Result?}
    H -->|Positive| I[Ovulation Predicted for Next Day\nAlgorithm shifts forward 1 day]
    H -->|Negative| J[No Change — Continue Testing]

    I & J --> K[Updated Fertile Window\nShown on Calendar]

    K --> L[Daily Conception Tips\nMedical expert content\nBy cycle phase]

    B --> M[Log Unprotected Sex\nSex & Libido category]
    M --> N[Conception Timing Tracked]

    N --> O{Period late?}
    O -->|Yes| P[Log Pregnancy Test Result]
    P --> Q{Result?}
    Q -->|Positive| R([Switch to Pregnancy Mode])
    Q -->|Negative| S[Cycle Continues\nPredictions adjust]
    O -->|No| T([Continue TTC Cycle])
```

---

## 5. Pregnancy Mode Flow

Full lifecycle from mode switch through postpartum.

```mermaid
flowchart TD
    A([Positive Pregnancy Test\nor Manual Mode Switch]) --> B[Enter Due Date\nor Last Period Date]

    B --> C[Pregnancy Mode Activated\nUI shifts to yellow/warm palette\nHero: Gestational Week Counter]

    C --> D[Week-by-Week Dashboard]

    D --> E[3D Fetus Visualization\nSize comparison · Milestones]
    D --> F[Body Change Tracker\nSymptom logging: Nausea\nLochia · Pregnancy symptoms]
    D --> G[Weekly Checklist\nPrenatal appointments\nChildbirth classes · Tasks]
    D --> H[Educational Content\nSafe foods · Exercise\nSleep positions · Birth prep]

    D --> I[Calculators]
    I --> I1[Due Date Calculator]
    I --> I2[hCG Calculator]
    I --> I3[IVF/FET Due Date]
    I --> I4[Ultrasound Dating]

    D --> J{Week milestone reached?}
    J -->|Yes| K[Milestone Notification\nBaby development update\nChecklist items unlocked]
    J -->|No| L[Continue Tracking]

    D --> M{Complication to log?}
    M -->|Miscarriage / Abortion\nDay 29+ only| N[Log Event\nSensitive flow with support content]
    N --> O([Return to Period Tracking Mode\nor Seek Support Content])

    D --> P[Partner receives\nWeekly baby updates\nvia Partner Mode]

    D --> Q([Postpartum — Mode Ends\nReturn to Cycle Tracking\nor Perimenopause Mode])
```

---

## 6. AI Health Assistant — Ask Flo

Conversational health queries triggered by cycle events or user-initiated.

```mermaid
flowchart TD
    A([Trigger]) --> B{How was it triggered?}

    B -->|Cycle phase change| C[Auto-push notification\nor in-app banner]
    B -->|Symptom logged| D[Contextual prompt appears\n'Want to know more about\nyour cramps?']
    B -->|User taps Ask Flo| E[User-initiated chat]
    B -->|Cycle start event| F[New cycle insight card]

    C & D & E & F --> G[Chat Interface Opens\nConversational UI]

    G --> H{User tier?}
    H -->|Free| I[Limited interactions\nHit limit → Paywall prompt]
    H -->|Premium| J[Unlimited interactions]

    I & J --> K[User sends message\nor selects suggested topic]

    K --> L{AI Engine}
    L -->|Pre-2025 rule-based| M[Scripted conversation trees\nBranching logic\nMedical/legal reviewed]
    L -->|2025+ GenAI| N[Fine-tuned LLM\nDatabricks Mosaic AI\nContext-aware personalized]

    M & N --> O[Response generated\nWith citations to Flo articles\nor expert content]

    O --> P{Topic area?}
    P --> P1[Late period explanation]
    P --> P2[PMS / PMDD guidance]
    P --> P3[Discharge interpretation]
    P --> P4[Fertility guidance]
    P --> P5[Disorder signs — PCOS etc]
    P --> P6[General reproductive health Q&A]

    P1 & P2 & P3 & P4 & P5 & P6 --> Q[User reads response]

    Q --> R{Continue?}
    R -->|Follow-up question| K
    R -->|Done| S([Exit chat\nConversation history saved])
```

---

## 7. Community — Secret Chats

Anonymous forum with 7M monthly users and full pre-moderation.

```mermaid
flowchart TD
    A([Tap Secret Chats Tab]) --> B{First time?}

    B -->|Yes| C[Random Avatar Assigned\nNo photo required\nFull anonymity]
    B -->|No| D[Feed Opens]

    C --> D

    D --> E[Personalized Feed\nBased on engagement patterns]

    E --> F{User age}
    F -->|Under 18| G[Under-18 Content Only\nNo cross-interaction with adults]
    F -->|18+| H[Adult Content Feed\nNo cross-interaction with minors]

    G & H --> I[Browse Categories]
    I --> I1[PCOS]
    I --> I2[Pregnancy symptoms]
    I --> I3[Sex & relationships]
    I --> I4[Perimenopause]
    I --> I5[Parenting]
    I --> I6[General health]

    I1 & I2 & I3 & I4 & I5 & I6 --> J[Open Thread]

    J --> K{Action?}
    K -->|Read replies| L[View thread]
    K -->|Write post| M[Draft Post]
    K -->|Ask Expert| N[Access Expert Archive\nDoctor-verified Q&A]

    M --> O[Submit for Moderation\nHuman review team]
    O --> P{Approved?}
    P -->|Yes| Q[Post appears in feed]
    P -->|No| R[Post removed\nUser notified]

    Q --> S[Reply notifications sent\nto thread participants]

    S --> T([Ongoing community engagement])
```

---

## 8. Partner Mode (Flo for Partners)

Sharing flow between primary user and partner — read-only, privacy-first.

```mermaid
flowchart TD
    A([Primary User — Settings]) --> B[Navigate to Partner Sharing]
    B --> C[Generate Sharing Code]
    C --> D[Share Code with Partner\nvia any messaging app]

    D --> E([Partner — Downloads Flo App])
    E --> F[Enter Sharing Code]
    F --> G[Partner Account Created\nLinked to primary user]

    G --> H[Partner Dashboard — Read Only]

    H --> I[Cycle Calendar View\nCurrent data only\nNot historical]
    H --> J[Daily Insights\nHow partner might be feeling\nby cycle phase]
    H --> K[Symptom Explanations\nIn accessible language\nNo raw symptom data visible]
    H --> L[Educational Content\nCouples quizzes]

    I & J & K & L --> M{Mode of primary user?}
    M -->|Period tracking| N[Cycle phase insights\nFertility window info]
    M -->|Pregnancy| O[Weekly baby development updates\nPregnancy milestone content]

    M --> P{Primary user revokes access?}
    P -->|Yes| Q[Partner access instantly removed\nPartner app shows disconnected]
    P -->|No| R([Ongoing partner access])

    H --> S[What Partner CANNOT See]
    S --> S1[❌ Raw logged symptoms]
    S --> S2[❌ Historical cycle data]
    S --> S3[❌ Edit any data]
    S --> S4[❌ Personal notes]
```

---

## 9. Anonymous Mode Setup

Privacy-first flow decoupling health data from all personal identifiers.

```mermaid
flowchart TD
    A([User — Privacy Settings]) --> B[Discover Anonymous Mode]
    B --> C[Explanation Screen\n'Your data decoupled from identity'\nOHTTP · Post-quantum crypto]

    C --> D{Currently signed in with\npersonal account?}

    D -->|Yes| E[Warning: Switching will\ndisconnect personal identifiers\nName · Email · Apple/Google ID\nPayment info · IP · Device Ad ID]

    E --> F{User confirms?}
    F -->|No| G([Stay on Personal Account])
    F -->|Yes| H[Anonymous Account Created]

    D -->|New user — starting fresh| H

    H --> I[Cloudflare OHTTP Relay\nNo single party has\nboth identity + health data]

    I --> J[Anonymous Tracking Begins\nAll features available\nNo personal data linkage]

    J --> K{Payment for Premium?}
    K -->|Yes| L[Payment processed\nDecoupled from health activity\nISO 27001 + ISO 27701 certified]
    K -->|No| M[Free tier with full anonymity]

    L & M --> N([Anonymous Mode Active\nData protected by OHTTP\n+ post-quantum cryptography])

    N --> O{User wants to exit anonymous mode?}
    O -->|Yes| P[Re-link personal identifiers\nManual re-authentication]
    O -->|No| N
```

---

## 10. Health Reports & Symptom Checker

Premium-only features for clinical-grade health summaries and self-assessment.

```mermaid
flowchart TD
    A([User — Insights / Profile]) --> B[Navigate to Health Reports]

    B --> C{Premium subscriber?}
    C -->|No| D[Paywall Prompt\nUpgrade to Premium]
    D --> E([Upgrade Flow])
    C -->|Yes| F[Report Options]

    F --> G[Doctor's Report]
    G --> H[6-Month Data Summary\nCycle lengths · Symptom frequency\nPattern charts]
    H --> I[Preview Report]
    I --> J[Export as PDF]
    J --> K([Share with physician])

    F --> L[Symptom Checker\nNot available in UK/EU]
    L --> M[Select Condition to Screen]

    M --> M1[PCOS Checker]
    M --> M2[Endometriosis Checker]
    M --> M3[Uterine Fibroids Checker]
    M --> M4[Perimenopause Checker]

    M1 & M2 & M3 & M4 --> N[Chatbot-style Self-Assessment\nClinical guidelines: Monash · ESHRE · AAFP]

    N --> O[Answer symptom questions]
    O --> P{More questions?}
    P -->|Yes| O
    P -->|No| Q[Results Generated\nMatch percentage report]

    Q --> R[Disclaimer: Designed for\nphysician follow-up only]
    R --> S([Save or share result\nwith healthcare provider])
```

---

## 11. Premium Upgrade Flow (In-App Conversion)

Multiple in-app touchpoints that funnel free users to Premium.

```mermaid
flowchart TD
    A([Free Tier User]) --> B{Touchpoint encountered}

    B -->|Taps locked insight| C[Soft Paywall\nPreview of insight\n'Unlock with Premium']
    B -->|Opens Ask Flo at limit| D[Usage Limit Paywall\n'You've used your free chats']
    B -->|Tries to generate report| E[Feature Paywall\n'Doctor's Report is Premium']
    B -->|Symptom Checker| F[Feature Paywall\nWith condition-specific pitch]
    B -->|Detailed cycle analysis| G[Insight Paywall\nWith sample of locked data]

    C & D & E & F & G --> H[Premium Offer Screen]

    H --> I[Pricing Display\nAnnual: $4.17/mo — 'Best Deal'\n3-Month · Monthly options\nHigh monthly anchors annual value]

    I --> J[Social Proof\n'6.6M members already Premium'\nTestimonials]

    J --> K{14-day Free Trial}
    K -->|Start Trial| L([Premium Activated\nAll features unlocked])

    K -->|Decline| M[Gift Box Offer\n77% off Annual Plan]
    M -->|Accept| N([Premium Activated — Discounted])
    M -->|Decline| O[7-day Trial · Reduced Price]
    O -->|Accept| P([Premium Activated — Trial])
    O -->|Decline| Q[Return to Free Tier\nPaywall touchpoints remain active]

    Q --> B

    L & N & P --> R[Confirmation Screen\nFSA/HSA payment accepted\nin US — receipts available]
```

---

## 12. Mode-Switching Flow

How users transition between the app's four lifecycle modes over time.

```mermaid
flowchart TD
    A([User Profile / Settings]) --> B[Goal / Mode Settings]

    B --> C{Current Mode}

    C -->|Period Tracking| D[Switch to TTC Mode\nWhen ready to conceive]
    C -->|TTC Mode| E{Pregnancy test positive?}
    E -->|Yes| F[Auto-prompt: Switch to Pregnancy]
    E -->|No| G[Continue TTC Tracking]
    C -->|Pregnancy| H[Postpartum — Mode ends\naround 40-week mark]
    C -->|Any| I[Switch to Perimenopause\nWhen cycle becomes irregular]

    D --> J[TTC Dashboard\nBBT · OPK · Fertile window]
    F --> K[Pregnancy Mode\nYellow UI · Fetal development]

    H --> L{Post-birth goal?}
    L -->|Resume cycle tracking| M[Period Tracking Mode\nFertility returns monitoring]
    L -->|Another pregnancy| J
    L -->|No more tracking| N([Reduced engagement mode])

    I --> O[Perimenopause Mode\nIrregular cycle tools\nPerimenopause Score\nSymptomatic support]

    O --> P[Symptom Checker:\nPerimenopause assessment]

    K --> Q[Partner notified of\nmode switch automatically]
    J --> Q

    M & O --> R([Ongoing Lifecycle Tracking])
```

---

## Feature Map Summary

```mermaid
mindmap
  root((Flo Health))
    Onboarding
      Goal selection fork
      70-screen personalization
      Post-data signup
      Trial cascade paywall
    Period Tracking
      Cycle dashboard
      Flow intensity logging
      Neural net predictions
      Retroactive editing
    Symptom Logging
      80+ symptoms
      16 categories
      Icon-tap UX
      Feeds ML model
    Fertility & TTC
      Fertile window
      BBT logging
      OPK tracking
      Conception tips
    Pregnancy Mode
      Week counter
      3D fetal viz
      Checklists
      Calculators
    Ask Flo AI
      Rule-based trees
      GenAI LLM 2025
      Phase-triggered
      Free vs Premium
    Secret Chats
      7M MAU
      Anonymous avatars
      Pre-moderation
      Age-separated feeds
    Partner Mode
      Sharing code
      Read-only access
      Daily insights
      Pregnancy updates
    Anonymous Mode
      OHTTP relay
      No PII linkage
      Post-quantum crypto
      ISO dual certified
    Health Reports
      Doctor PDF export
      Symptom checker
      PCOS · Endo screens
      6-month history
    Premium Conversion
      Multiple touchpoints
      Trial cascade
      FSA/HSA eligible
      Pricing anchoring
```
