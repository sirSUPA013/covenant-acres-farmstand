# Upgrade Session Log: Owner Feedback - January 2026

**Project:** Covenant Acres Farmstand (ShaneStephanieBakery)
**Date Started:** 2026-01-09
**Trigger:** Owner feedback document "Ongoing C.A. bug fixes - Google Slides.pdf"
**Owner Present:** No (feedback provided via document)

---

## Source Materials

### Documents Provided
- `C:\Users\Sam\OneDrive\Desktop\Ongoing C.A. bug fixes - Google Slides.pdf` (6 pages)

### Document Analysis

#### Page 1: Payment Options Display Bug
**Issue:** Order form confirmation shows wrong payment info
- **Admin settings show:** @Shane-Yandow (Venmo), $syandow3 (CashApp), @syandow3 (PayPal), (770)6963492 (Zelle)
- **Customer sees:** @CovenantAcres, $CovenantAcres, pay@covenantacresin.com
- The order form is NOT pulling from the admin-configured payment settings

**Screenshot evidence:** Side-by-side comparison showing mismatch

---

#### Page 2: Ingredient Package Units Missing
**Issue:** When adding ingredients to library, package units (oz, ounces) not available in dropdown
- Current dropdown has baking units (g, cups, tsp) but not purchase units
- Example: Pumpkin Puree bought in 29oz cans, but can't enter "oz" as package unit

**Owner quote:** "the units available for measurement are good for what we are using to bake but the package in which the ingredients are bought are not listed"

---

#### Page 3: Ingredient Reordering Needed
**Issue:** Cannot reorder ingredients in recipe once added
- Ingredients are fixed in position
- To insert an ingredient in the middle, must delete all ingredients after that position

**Owner quote:** "if something were to be added and placed in a certain order i would have to delete all the ingredients up to the desired location"

**Solution needed:** Drag-and-drop reordering for recipe ingredients

---

#### Page 4: Production Tab Overhaul (MAJOR)
**Issues identified:**
1. "Bake Slot" terminology confusing - owner expects "Pick up"
2. "Production Day" should be "Bake Day"
3. "Standalone Date" option has no clear utility
4. Overall purpose/workflow of Production tab unclear

**Owner quote:** "The entire production tab needs to be revamped to make it function how we would need it to. Details to be determined"

**Note:** This is flagged as a MAJOR overhaul. Need to clarify exact workflow with owner.

---

#### Page 5: Order Form - Multiple Loaf Sizes
**Issue:** Order form only shows one size/price per flavor
- Each loaf has TWO sizes (small and large) with different prices
- Currently only small size price is shown
- Need customer to choose which size to order

**Additional requirement:** Admin should be able to restrict which sizes are offered per flavor
- Example: Only offer large for certain specialty loaves

**Owner quote:** "I want there to be a way to restrict only a certain size on the order configuration side if we only decide to offer a certain size of any particular loaf"

---

#### Page 6: Recipe Ingredient Unit Toggle
**Issue:** Cannot change units when adding ingredients to recipe
- Ingredient defaults to its library unit (e.g., grams)
- Owner needs to enter recipe in different units (cups, tsp, etc.)
- Cost calculations must still work correctly across unit conversions

**Owner quote:** "I need to be able to toggle between different units of measurement while maintaining the integrity of the cost calculations"

---

## Conversation Log

### 2026-01-09 - Initial Analysis

**User said:**
> Shared the PDF document. Previous planning sessions crashed and lost detailed plans. Owner was present during original planning providing context not in the document.

**Claude analysis:**
The document identifies 6 distinct issues:
1. Payment display bug (order form)
2. Missing package units (ingredient library)
3. No ingredient reordering (recipes)
4. Production tab overhaul (major - needs clarification)
5. Multiple loaf sizes (order form + admin config)
6. Unit toggle for recipe ingredients (with cost conversion)

Items 2, 3, and 6 are all related to the recipe/ingredient system.
Item 4 is flagged as major but "details TBD" - needs owner clarification.
Items 1 and 5 are order form issues.

---

## Emerging Plan

### Bug Fixes

| # | Issue | Location | Complexity | Status | Notes |
|---|-------|----------|------------|--------|-------|
| 1 | Payment options not displaying correctly | order-form + desktop-app | Medium | **FIXED** | Root cause: order form read from Vercel env vars, not synced settings. Fixed by syncing PublicSettings to Sheets. |

### Feature Changes

| # | Change | Location | Complexity | Status | Notes |
|---|--------|----------|------------|--------|-------|
| 2 | Add package units (oz, lb, etc.) to ingredient dropdown | desktop-app (ConfigPage) | Low | **DONE** | Added dropdown with oz, lb, can, jar, etc. Package types (can, jar) show additional contents fields |
| 3 | Drag-and-drop ingredient reordering | desktop-app (RecipesPage) | Medium | **DONE** | Used existing dnd-kit - ingredients now have drag handles |
| 6 | Unit toggle for recipe ingredients with cost conversion | desktop-app (RecipesPage) | High | **DONE** | Unit dropdown exists on each ingredient with automatic cost conversion via density data |

### New Features

| # | Feature | Location | Complexity | Status | Notes |
|---|---------|----------|------------|--------|-------|
| 5 | Multiple loaf sizes on order form | order-form + desktop-app | High | **DONE** | Sizes stored with is_active flag; order form filters inactive |
| 5b | Size restriction per flavor in admin | desktop-app (ConfigPage) | Medium | **DONE** | Checkbox toggle per size; inactive sizes shown in parentheses in table |

### Major Overhauls

| # | Area | Complexity | Notes |
|---|------|------------|-------|
| 4 | Production Tab | High | "Details TBD" - needs owner clarification on desired workflow |

---

---

### 2026-01-09 - During Debugging Session

**User said:**
> Customers tab works. Quick update - we should display a customer history when we click to view a customer. It should show when they first made an order, all previous orders, and credits given (with reasons attached). The reason field should be clearly labeled as a required field for issuing credits and a proper error message should appear if you try to save without it. This should be a proper and complete customer profile.

**New requirement added:**

| # | Feature | Location | Complexity | Status | Notes |
|---|---------|----------|------------|--------|-------|
| 7 | Customer profile with full history | desktop-app (CustomersPage) | Medium | **DONE** | Order history, credit history, required reason field |

**Details:**
- Show first order date
- List all previous orders
- Show credit history with reasons
- Reason field required for issuing credits (with error message)

---

## Questions Needing Owner Clarification

1. **Production Tab:** What is the desired workflow? What should it track?
   - Is it for logging what was actually baked vs. ordered?
   - Should it connect to prep sheets?
   - What's the relationship between "Bake Day" and "Pick Up Day"?

2. **Terminology:** Should "Bake Slot" be renamed throughout the app?
   - Current: "Bake Slot" = date + location combo
   - Owner mentions expecting "Pick up" - is this for the whole app or just certain screens?

3. **Prep Sheet page:** Any changes needed there? (Owner mentioned prep page → bake-day page in lost session)

---

## Session History

| Date | Duration | Key Outcomes |
|------|----------|--------------|
| 2026-01-09 | Ongoing | Initial document analysis, created upgrade log |

---

*Last updated: 2026-01-09*
