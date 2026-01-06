# Intake Process Notes - Shane & Stephanie Bakery Project

**Session Date:** 2026-01-03
**Purpose:** Track learnings for refining the intake questionnaire and process

---

## Questionnaire Observations

### What Worked Well
- Color-coded depth levels helped skip irrelevant questions
- Question 2.3 (Success Definition) generated rich, detailed response
- Client answered honestly when unsure ("I don't know")

### Areas to Improve
- **4.1 (Must-Have Features)** - Client said "I feel like I answered this in 2.3" → consider combining or rephrasing
- **Blank answers on:** 4.3 (MVP), 4.5 (Failure Definition), 7.1/7.2 (Risks) → add examples to prompt better responses
- **Security/Compliance section** confused them → add simple explanations of what each means

### Questions to Add/Revise
- [ ] Add payment processor question explicitly
- [ ] Clarify "spreadsheet" - literal Google Sheets or database with spreadsheet UI?
- [ ] Add example for flavor caps: "e.g., only 6 cinnamon raisin per Saturday"

---

## Live Session Notes

**Key clarifications from Shane:**
- Bake days are Date + Location combos ("bake slots"), not just dates
- Customer first picks date/location, then sees available flavors
- Credits: Our fault = credit + possible bonus; Their no-show = forfeit; Case-by-case override
- Recipes exist in docx files, want ability to add new ones
- Need broadcast messaging to customer database
- Need sales stats by flavor and financial tracking with payment methods

**ChatGPT cross-examination feedback (incorporated):**
- Added explicit order lifecycle states
- Added credits/adjustments system
- Clarified location model (slots, not global bake days)
- Added compliance basics (SMS opt-in, CSV export, data retention)
- Noted architecture supports future prepay



---

## Follow-up Items

- [ ] Review and revise questionnaire based on observations
- [ ] Update /new-project skill if process changes

---

## Session Outcome

**Scope approved: 2026-01-03**

Key process learnings:
- ChatGPT cross-examination caught important gaps (order lifecycle, credits, location model)
- Live Q&A with client was more efficient than questionnaire alone
- Technical constraints (flash drive delivery, non-tech user) emerged late - consider adding to questionnaire
- "Bake slot" concept (date + location) was key architectural insight from conversation

---

*This document is for Sam's internal review*
