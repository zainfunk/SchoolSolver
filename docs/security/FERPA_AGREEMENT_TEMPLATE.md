# FERPA "School Official" Agreement — Template

This is a template agreement between an educational institution
("Institution") and ClubIt ("Vendor") under the school-official
exception to FERPA (34 CFR § 99.31(a)(1)(i)(B)). It is a starting
point for legal review. Every blank or italicized clause marked
`<!-- TODO(legal) -->` must be reviewed by qualified counsel and the
Institution's privacy officer before execution.

This template is **not legal advice** and is not a contract until
both parties sign. Counsel for the Institution is the controlling
authority on whether each clause meets that Institution's
obligations.

---

## 1. Parties

This agreement ("Agreement") is between:

- **Institution:** <!-- TODO(legal): institution full legal name --> ("Institution"), and
- **Vendor:** ClubIt, <!-- TODO(legal): legal entity (LLC / Inc.) and address -->.

Effective date: <!-- TODO(legal) -->. Term: <!-- TODO(legal): typically 1 year, auto-renew with notice; align with subscription. -->.

## 2. Designation as School Official

Pursuant to 34 CFR § 99.31(a)(1)(i)(B), the Institution designates
the Vendor as a "school official" with a "legitimate educational
interest" in the education records the Vendor processes on behalf of
the Institution, **solely** for the purpose of operating the ClubIt
service for the Institution's students, staff, and clubs.

This designation requires the Institution to retain "direct control"
over the Vendor's use and maintenance of the records. Sections 3–11
implement that control in operational terms.

## 3. Permitted Use

The Vendor may access and process education records only:

(a) to provide the contracted ClubIt service to the Institution;
(b) to maintain platform security, integrity, and availability;
(c) to comply with law (response to a valid subpoena or court
    order, with notice to the Institution where lawful).

The Vendor shall **not**:

(d) use education records for advertising, profiling, or
    cross-context behavioral marketing of any kind;
(e) sell, rent, or trade education records;
(f) train any machine-learning model or large language model on
    education records, whether the Vendor's own model or a third
    party's; <!-- TODO(legal): some districts allow narrowly-scoped, contracted training with de-identified data — finalize position. -->
(g) use education records for product analytics or improvement
    that depends on identifiable student data. De-identified,
    aggregated platform metrics (e.g., "X clubs created across the
    Institution") may be used for capacity planning. <!-- TODO(legal): confirm de-identification standard (NIST 800-188 or equivalent) and whether even aggregated metrics require disclosure. -->

## 4. No Redisclosure

The Vendor shall not disclose any education record to any third
party except:

(a) to the Institution;
(b) to a subprocessor listed in Schedule A (`docs/security/SUBPROCESSORS.md`)
    bound by a written agreement with terms at least as protective
    as this Agreement;
(c) as required by law, with prior notice to the Institution where
    lawful;
(d) with the prior written consent of the Institution.

The Vendor's subprocessors as of the effective date are listed in
`SUBPROCESSORS.md`. Material changes will be notified per § 11.

## 5. Data Categories and Minimization

The Vendor processes the following categories of education records
on behalf of the Institution: club rosters, club chat messages,
attendance records, event participation, polls and election votes,
hours-tracking records, badges/achievements, leadership history,
student profile information (name, email, optional bio, optional
social links), and audit metadata.

The Vendor does **not** process: grades, transcripts, IEPs,
disciplinary records, health records, immigration status, free /
reduced-lunch status, or social-security numbers.

The Vendor will not request or accept additional categories without
a written amendment to this Agreement.

## 6. Security Controls

The Vendor will maintain the security controls described in the
attached **Security Practices** schedule, which incorporates by
reference: `THREAT_MODEL.md`, `INCIDENT_RESPONSE.md`,
`SECRETS_POLICY.md`, `SUBPROCESSORS.md`, and `HECVAT_LITE_RESPONSES.md`.
Material weakening of any control requires 30 days' written notice
to the Institution. <!-- TODO(legal): align notice window with Institution's vendor-management policy. -->

## 7. Audit Rights

The Institution may, no more frequently than once per year and on
30 days' notice, request:

(a) a copy of the Vendor's most recent third-party penetration
    test executive summary;
(b) the Vendor's then-current HECVAT response;
(c) a sample of audit-log entries for administrative actions taken
    on the Institution's tenant during a specified window;
(d) confirmation of subprocessor list as of the request date.

The Institution may, at its expense, conduct or commission an
independent security assessment of the Vendor's environment as it
pertains to the Institution's data, on 60 days' notice and subject
to a customary scope-of-work and confidentiality terms.

## 8. Breach Notification

In the event of a confirmed unauthorized access to, acquisition of,
or disclosure of the Institution's education records, the Vendor
will:

(a) notify the Institution's designated FERPA contact within
    **24 hours** of confirmation of the incident;
(b) provide a written incident report within **72 hours** including
    the scope of records affected, the individuals affected if
    known, the technical root cause, the immediate mitigation, and
    the planned corrective actions;
(c) cooperate with the Institution in any subsequent investigation
    or required notice to students, parents, regulators, or law
    enforcement.

These timelines align with `INCIDENT_RESPONSE.md` and are intended
to meet or exceed the Institution's own breach-notification
requirements.

## 9. Data Subject Requests

When the Vendor receives a request directly from a student, parent,
or eligible student to inspect, amend, or delete records, the
Vendor will forward the request to the Institution within 5 business
days and act only on the Institution's written instruction.
<!-- TODO(legal): some state laws (e.g., NY Ed Law 2-d) impose direct obligations on the vendor — confirm and adjust. -->

## 10. Return / Destroy on Termination

Upon termination of this Agreement for any reason, the Vendor will,
at the Institution's election:

(a) export the Institution's education records in a structured,
    machine-readable format and provide them to the Institution
    within 30 days; and/or
(b) delete all live copies within 30 days and confirm in writing.

Backups containing the Institution's records will expire from the
Vendor's storage on the schedule documented in `DATA_DELETION.md`
(currently within 90 days of live deletion). Retained logs and
financial records subject to legal retention obligations are
exempt and listed in `DATA_DELETION.md`.

## 11. Subprocessor Changes

The Vendor will give the Institution at least **30 days'** written
notice before adding a new subprocessor that processes education
records. The Institution may object on reasonable grounds; the
Vendor will work with the Institution in good faith to resolve, and
if no resolution is reached, the Institution may terminate without
penalty.

## 12. Audit Log Access

The Vendor will provide the Institution, on request, an export of
the audit log for the Institution's tenant covering: admin role
changes, invite-code rotations, school suspensions, deletions,
profile-override changes, election creation, vote-cast counts (not
voter identities), and webhook processing.

<!-- TODO(security): audit logging is on the W3 backlog. This clause is aspirational until shipped. Disclose to the Institution at signing time that the audit-log feature is in development with an expected ship date. -->

## 13. Insurance

The Vendor will maintain cyber-liability insurance in an amount of
not less than <!-- TODO(business): coverage amount; typical district floor is $1M–$5M --> with the Institution named as a certificate holder.

## 14. Indemnification

<!-- TODO(legal): indemnification scope — typically capped at fees paid in the prior 12 months, with carve-outs for breach, IP infringement, and willful misconduct. -->

## 15. Governing Law

<!-- TODO(legal): typically the Institution's state. -->

## 16. Signatures

```
For the Institution:                For the Vendor:

________________________________    ________________________________
Name (print)                        Name (print)

________________________________    ________________________________
Title                               Title

________________________________    ________________________________
Date                                Date
```

---

## Schedule A — Subprocessors

See `docs/security/SUBPROCESSORS.md` (incorporated by reference).

## Schedule B — Security Practices

See `docs/security/THREAT_MODEL.md`,
`docs/security/INCIDENT_RESPONSE.md`,
`docs/security/SECRETS_POLICY.md`, and
`docs/security/HECVAT_LITE_RESPONSES.md` (all incorporated by
reference).
