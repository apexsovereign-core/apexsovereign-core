# Tier-3 Data Center Cold Outreach Email Sequence

**Status:** Ready for dispatch (draft — review before sending)
**Target:** Regional Tier-2/Tier-3 independent data centers, private cloud hosters, crypto-mining facilities pivoting to AI compute
**Stakeholders:** CTO, Head of Infrastructure, VP of Business Development

---

## Email 1 — Initial Outreach

**Subject:** Monetizing idle H100 / B200 rack capacity (Zero integration cost)

[Executive Name],

Most regional data centers are losing 25% to 40% of potential yield on idle GPU clusters during off-peak hours while competing against AWS/GCP floor rates.

ApexSovereign.ai operates a high-frequency spot-rate arbitrage layer that routes automated inference workloads directly to unutilized node capacity.

We are currently onboarding select Tier-3 data center partners under a non-binding, non-exclusive revenue-share agreement:

1. Zero Upfront Engineering: We wrap your existing API/SSH access points into our edge routing mesh.
2. Guaranteed Floor Rate: You set your minimum acceptable yield per GPU-hour.
3. Automated Settlement: Pre-funded customer Compute Units (CU) clear programmatically upon job completion.

We have staged our initial partner LOI framework here: docs/outreach/01_Data_Center_LOI.md

Are you open to a brief 10-minute briefing this week to review capacity listing parameters for your H100/B200 clusters?

Anton John Gajutos Intes
Founder & Chief Architect | ApexSovereign.ai
contact@apexsovereign.ai

---

## Follow-Up (Day 5)

**Subject:** Re: Monetizing idle H100 / B200 rack capacity

[Executive Name],

Following up on my note below. Even a single idle H100 represents recoverable revenue under our non-exclusive, zero-upfront model.

Happy to share our reference-rate catalog and the LOI framework at your convenience. No commitment required to review.

Best,
Anton John Gajutos Intes
ApexSovereign.ai

---

## Notes
- Non-exclusive: never agree to exclusivity clauses with any single supplier.
- All signed LOIs received at partners@apexsovereign.ai are auto-ingested by the inbound agent (feat/inbound-agent) into the supplier_pipeline Supabase table.
- Keep all supplier interactions bound to the non-binding terms in 01_Data_Center_LOI.md.