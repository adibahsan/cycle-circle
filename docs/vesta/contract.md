# Software Development Agreement

**Project:** Vesta v1 — Bilingual Reproductive Health & Cycle Intelligence Platform
**Agreement Date:** ________________
**Agreement ID:** SDA-VESTA-001

---

## 1. Parties

| Role | Name | Contact |
|---|---|---|
| **Developer** | Adib Ahsan Chowdhury | ________________ |
| **Client** | Arika / Fakhrul (hereinafter "Client") | ________________ |

Both parties are referred to individually as a "Party" and collectively as the "Parties."

---

## 2. Background & Purpose

The Client wishes to engage the Developer to build **Vesta v1**, a bilingual reproductive-health and cycle-intelligence web application targeting Bangladesh, as described in the Software Requirements Specification document **SRS-VESTA-001 v1.1** dated 3 May 2026 (hereinafter the "SRS"), which is attached to and forms part of this Agreement.

This Agreement covers **software development only**. Deployment to production infrastructure, ongoing server hosting, maintenance, post-launch support, and any future enhancements (v2 or beyond) are **not included** and shall be governed by separate agreements negotiated in good faith.

---

## 3. Scope of Work

### 3.1 Inclusions

The Developer shall deliver the software described in the SRS (SRS-VESTA-001 v1.1), specifically:

- All functional requirements marked **P0 (Must Have)** and **P1 (Should Have)** in the SRS.
- All functional requirements marked **P2 (Could Have)** on a best-effort basis within the agreed timeline.
- The source code in a state that passes all **Definition of Done (DoD)** gates listed in SRS Section 4, excluding any items explicitly marked **(deferred -- v2)**.
- A private Git repository containing the complete, buildable source code.

### 3.2 Exclusions

The following are **explicitly outside** the scope of this Agreement:

- Production deployment, server provisioning, domain setup, DNS configuration, and SSL certificates.
- Third-party service account creation, billing, and ongoing subscription costs (Vercel, Supabase, Upstash, Resend, BDApps developer portal).
- Post-launch bug fixes, maintenance, monitoring, and technical support.
- Content creation (health articles, SMS content, translations) — only the CMS/platform to manage content is included.
- Features marked **(deferred -- v2)** in the SRS, including but not limited to: Pro auto-disable/grace period, feature-gating middleware enforcement, LSTM Tier 3 prediction, partner sharing, pregnancy mode, SMS notifications (personal), native mobile apps, AI chatbot, doctor consultations, and community forum.
- Any regulatory compliance filings, legal review of privacy policies, or GDPR/data-protection certifications.
- User acceptance testing by end users — the Developer shall demonstrate that DoD gates pass; final user-facing UAT is the Client's responsibility.
- Training of Client staff on the admin panel or CMS.

### 3.3 P2 (Could Have) Best-Effort Clause

Requirements prioritised as **P2 (Could Have)** in the SRS (FR-ADMIN, FR-CMS, FR-ANALYTICS, FR-EXPORT) shall be developed on a best-effort basis. If the Developer, exercising reasonable professional judgement, determines that completing all P2 items within the agreed timeline would compromise the quality or stability of P0/P1 deliverables, the Developer shall notify the Client in writing before the Week 4 milestone and the Parties shall agree which P2 items to defer. Deferral of P2 items shall not constitute a breach of this Agreement and shall not affect the final milestone payment, provided all P0 and P1 requirements have been delivered and accepted.

---

## 4. Timeline

The project shall be completed within **four (4) calendar weeks** (or a mutually agreed timeframe) from the Effective Start Date (defined in Section 5.1). The internal weekly breakdown follows the MoSCoW release plan in SRS Section 2.6:

| Week | Focus | Key Deliverables |
|---|---|---|
| 1--2 | P0 (Must Have) | Auth, profiles, tracking, dashboard, calendar, symptoms, predictions, onboarding, billing, encryption, sessions, webhooks, i18n |
| 3 | P1 (Should Have) | Email notifications, content platform, SMS content circulation |
| 4 | P2 (Could Have) | Admin panel, CMS, analytics, data export |

### 4.1 Completion Date

The Developer shall deliver the final source code and demonstrate DoD gate compliance no later than **twenty-eight (28) calendar days** (or a mutually agreed timeframe) after the Effective Start Date, unless extended by mutual written agreement.

### 4.2 Delays

If the Developer anticipates a delay, the Developer shall notify the Client in writing at least **five (5) business days** (or a mutually agreed timeframe) before the affected milestone. If the delay is caused by:

- **Developer's fault** (underestimation, technical issues within Developer's control): The Developer shall continue work at no additional cost until completion, up to a maximum extension of **seven (7) calendar days** (or a mutually agreed timeframe). Beyond that, either Party may terminate under Section 8.
- **Client's fault** (delayed feedback, unavailable BDApps credentials, changed requirements): The timeline shall be extended day-for-day for each day of Client-caused delay, and no penalty shall apply to the Developer.
- **Third-party fault** (BDApps API outage, Supabase downtime, force majeure): The timeline shall be extended by the duration of the external blockage, and neither Party shall be liable.

---

## 5. Payment

### 5.1 Total Fee

The total development fee is **65,000 BDT** (sixty-five thousand Bangladeshi Taka), payable in three milestones:

| # | Milestone | Amount (BDT) | Trigger |
|---|---|---|---|
| M1 | Upfront | 20,000 | Upon signing this Agreement. Receipt of M1 defines the **Effective Start Date**. Development shall not begin until M1 is received. |
| M2 | Mid-project | 20,000 | Upon completion of Week 2 deliverables (all P0 items demonstrated to Client in a working preview). Due within **three (3) business days** (or a mutually agreed timeframe) of the Developer's written notification that M2 is ready for review. |
| M3 | Final | 25,000 | Upon completion of the project (all P0 + P1 items delivered, DoD gates demonstrated, source code handed over). Due within **five (5) business days** (or a mutually agreed timeframe) of Client acceptance or deemed acceptance (see Section 5.3). |

### 5.2 Payment Method

Payments shall be made via ________________ (bank transfer / bKash / Nagad / other — specify at signing). The Developer shall provide a receipt or written acknowledgement for each payment received.

### 5.3 Acceptance & Deemed Acceptance

Upon the Developer's written notification that a milestone is ready for review, the Client shall have **five (5) business days** (or a mutually agreed timeframe) to:

1. **Accept** the milestone in writing, or
2. **Reject** the milestone with a written list of specific, objectively verifiable defects referencing SRS requirement IDs (e.g. "FR-AUTH acceptance criterion #3 fails because...").

If the Client does not respond within the above review period, the milestone shall be **deemed accepted** and the corresponding payment shall become immediately due. The Client may not withhold payment based on subjective preferences, feature requests not in the SRS, or items marked as excluded in Section 3.2.

### 5.4 Late Payment

If any milestone payment is overdue by more than **seven (7) calendar days** (or a mutually agreed timeframe), the Developer may:

- Suspend all work until payment is received, without extending the project timeline on the Developer's side.
- After **fourteen (14) calendar days** (or a mutually agreed timeframe) of non-payment, terminate this Agreement under Section 8.2 and retain all payments received to date.

### 5.5 Rejected Milestone — Cure Period

If the Client validly rejects a milestone with specific, SRS-referenced defects, the Developer shall have **five (5) business days** (or a mutually agreed timeframe) to cure (fix) the identified defects and re-submit. The Client shall then have **three (3) business days** (or a mutually agreed timeframe) to re-review. If defects persist after two cure cycles, either Party may escalate under Section 9 (Dispute Resolution).

---

## 6. Intellectual Property & Source Code

### 6.1 Development-Only Scope

This Agreement covers development costs only. Ownership, licensing, and usage rights for the Vesta v1 source code, design assets, and any derivative works are **not determined by this Agreement** and shall be governed by a separate Intellectual Property agreement to be negotiated between the Parties.

### 6.2 Interim Provisions (Until IP Agreement Is Signed)

Until a separate IP agreement is executed:

- The Developer shall not sell, sublicense, open-source, or distribute the Vesta v1 source code to any third party.
- The Client shall not engage another developer to modify, fork, or redistribute the source code without the Developer's written consent.
- Both Parties acknowledge that neither Party has exclusive ownership until the IP agreement is signed.
- The Developer shall maintain at least one backup of the source code repository at all times.

### 6.3 Third-Party & Open-Source Components

The deliverable shall use open-source libraries (React, Next.js, Prisma, etc.) under their respective licences. The Developer shall not introduce any open-source component whose licence would prevent commercial use of the resulting application. A list of key dependencies and their licences is available in the project's `package.json` and lockfile.

---

## 7. Confidentiality

### 7.1 Confidential Information

Each Party may receive confidential information from the other, including but not limited to: BDApps API credentials, business plans, user data schemas, pricing strategies, and technical architecture. Both Parties shall:

- Not disclose confidential information to any third party without prior written consent.
- Use confidential information only for the purposes of this Agreement.
- Take reasonable measures to protect confidential information (at minimum, the same care they apply to their own confidential information).

### 7.2 Exceptions

Information is not confidential if it: (a) is or becomes publicly available through no fault of the receiving Party; (b) was already known to the receiving Party before disclosure; (c) is independently developed without reference to the disclosing Party's information; or (d) is required to be disclosed by law or court order, provided the receiving Party gives prompt notice.

### 7.3 Health Data

The Vesta application handles reproductive health data. During development, the Developer may encounter test data or schema designs involving sensitive health information. The Developer shall not retain, export, or use any real user health data beyond what is strictly necessary for development and testing. All test data used during development shall be synthetic.

### 7.4 Survival

Confidentiality obligations shall survive termination of this Agreement for a period of **two (2) years** (or a mutually agreed timeframe).

---

## 8. Termination

### 8.1 Termination by Mutual Agreement

Either Party may terminate this Agreement at any time by mutual written agreement. The Parties shall negotiate in good faith regarding payment for work completed to date.

### 8.2 Termination for Cause — by Developer

The Developer may terminate this Agreement if:

- The Client fails to pay any milestone within **fourteen (14) calendar days** (or a mutually agreed timeframe) of it becoming due (per Section 5.4).
- The Client materially breaches this Agreement and fails to cure within **seven (7) days** (or a mutually agreed timeframe) of written notice.

Upon termination by the Developer for cause, the Developer shall retain all payments received and shall have no obligation to deliver further work. The Developer shall provide the Client with the source code in its then-current state.

### 8.3 Termination for Cause — by Client

The Client may terminate this Agreement if:

- The Developer abandons the project (no communication and no commits for **fourteen (14) consecutive calendar days** (or a mutually agreed timeframe) without prior notice).
- The Developer materially breaches this Agreement and fails to cure within **seven (7) days** (or a mutually agreed timeframe) of written notice.

Upon termination by the Client for cause, the Developer shall refund the pro-rata unused portion of the most recent milestone payment (calculated based on the percentage of that milestone's deliverables completed). Prior milestone payments for accepted work are non-refundable.

### 8.4 Termination for Convenience — by Client

The Client may terminate this Agreement at any time for convenience (no fault) by giving **seven (7) days** (or a mutually agreed timeframe) written notice. In this case:

- The Developer shall be paid for all work completed up to the termination date, including the current milestone payment if more than 50% of that milestone's deliverables are complete.
- The Developer shall hand over the source code in its then-current state.

### 8.5 Effect of Termination

Upon termination for any reason: (a) all accrued payment obligations survive; (b) confidentiality obligations survive per Section 7.4; (c) the interim IP provisions in Section 6.2 remain in effect until superseded by a separate IP agreement.

---

## 9. Dispute Resolution

### 9.1 Good-Faith Negotiation

The Parties shall first attempt to resolve any dispute arising from this Agreement through good-faith negotiation between the principals (Adib and Arika/Fakhrul) for a period of **fourteen (14) calendar days** (or a mutually agreed timeframe).

### 9.2 Mediation

If negotiation fails, the Parties shall submit the dispute to mediation by a mutually agreed mediator. Mediation costs shall be shared equally. Mediation shall be conducted in Dhaka, Bangladesh.

### 9.3 Jurisdiction

If mediation fails, either Party may pursue legal remedies. This Agreement shall be governed by the laws of **Bangladesh**. The courts of Dhaka shall have exclusive jurisdiction.

---

## 10. Warranties & Limitations

### 10.1 Developer Warranties

The Developer warrants that:

- The software shall materially conform to the SRS requirements not marked as deferred.
- The source code shall be original work by the Developer, except for open-source components used under their respective licences.
- The Developer shall not knowingly introduce malware, backdoors, or intentional vulnerabilities into the source code.
- The Developer has the legal capacity to enter into this Agreement.

### 10.2 Disclaimer

THE SOFTWARE IS PROVIDED FOR DEVELOPMENT PURPOSES UNDER THIS AGREEMENT. THE DEVELOPER DOES NOT WARRANT THAT THE SOFTWARE WILL BE ERROR-FREE, UNINTERRUPTED, OR SUITABLE FOR ANY PARTICULAR PURPOSE BEYOND THE REQUIREMENTS IN THE SRS. EXCEPT AS EXPRESSLY STATED IN SECTION 10.1, ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, ARE DISCLAIMED TO THE MAXIMUM EXTENT PERMITTED BY LAW.

### 10.3 Limitation of Liability

The Developer's total aggregate liability under this Agreement shall not exceed the **total fees actually paid** by the Client (65,000 BDT). Neither Party shall be liable for indirect, incidental, consequential, or punitive damages, including lost profits, lost data, or business interruption, even if advised of the possibility of such damages.

### 10.4 Client Responsibilities

The Client shall:

- Provide BDApps developer portal credentials and any required API keys within **three (3) business days** (or a mutually agreed timeframe) of the Effective Start Date.
- Respond to milestone review notifications within the timeframes specified in Section 5.3.
- Not alter the SRS scope unilaterally after signing; any scope changes shall follow the Change Request process in Section 11.
- Be solely responsible for the accuracy and legality of health content published through the CMS.

---

## 11. Change Requests

### 11.1 Process

If either Party wishes to change the project scope after signing:

1. The requesting Party shall submit a **written Change Request** describing the desired change and its rationale.
2. The Developer shall respond within **three (3) business days** (or a mutually agreed timeframe) with an impact assessment: effect on timeline, effort, and cost.
3. Both Parties must agree to the change in writing before work begins. No verbal agreements shall be binding.

### 11.2 Cost & Timeline Impact

Changes that increase scope shall be billed at an agreed rate or as a lump-sum amendment. Changes that reduce scope may reduce the final milestone payment proportionally if agreed in writing before the affected milestone.

### 11.3 SRS as Baseline

The SRS (SRS-VESTA-001 v1.1) as of the Agreement Date is the **baseline scope**. Any feature or requirement not in the SRS is out of scope unless added via a signed Change Request. Verbal discussions, emails, or chat messages do not constitute scope changes unless formalised through this process.

---

## 12. General Provisions

### 12.1 Entire Agreement

This Agreement, together with the SRS (SRS-VESTA-001 v1.1), constitutes the entire understanding between the Parties and supersedes all prior negotiations, representations, or agreements, whether written or oral, relating to the subject matter.

### 12.2 Amendments

No modification of this Agreement shall be valid unless in writing and signed by both Parties.

### 12.3 Severability

If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

### 12.4 Notices

All notices under this Agreement shall be in writing and delivered via email to the addresses specified below (or updated addresses provided in writing). A notice is deemed delivered when sent, provided the sender does not receive a bounce-back or delivery failure notification.

### 12.5 No Employment Relationship

The Developer is an independent contractor. Nothing in this Agreement creates an employer-employee, partnership, or joint-venture relationship. The Developer is responsible for their own taxes and statutory obligations.

### 12.6 Force Majeure

Neither Party shall be liable for delays caused by events beyond their reasonable control, including natural disasters, war, government actions, epidemics, internet outages, or prolonged third-party service failures (e.g. BDApps platform downtime exceeding 72 hours).

### 12.7 Assignment

Neither Party may assign this Agreement without the other Party's written consent, except that either Party may assign to a successor in the event of a merger, acquisition, or sale of substantially all assets.

---

## 13. Signatures

By signing below, both Parties acknowledge that they have read, understood, and agree to the terms of this Agreement.

**Developer:**

| | |
|---|---|
| Name | Adib Ahsan Chowdhury |
| Signature | ________________________________ |
| Date | ________________________________ |

**Client:**

| | |
|---|---|
| Name | ________________________________ |
| Signature | ________________________________ |
| Date | ________________________________ |

---

## Attachment A — Referenced Documents

| Document | ID | Version |
|---|---|---|
| Software Requirements Specification | SRS-VESTA-001 | v1.1 (3 May 2026) |

---

*End of Agreement.*
