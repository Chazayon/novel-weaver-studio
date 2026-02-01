## Enhancements by writing stage (wizards + tooling)

### 1) Brainstorming / Series Outline (Phase 2)

Add a **Brainstorm Wizard** that collects structured “seed constraints” before you run the LLM:

- **Series type**: standalone / trilogy / long series
    
- **POV plan**: single POV / rotating / etc.
    
- **Hard constraints**: “must include”, “must avoid”, “rating/heat level”, “themes”
    
- **Genre trope toggles**: pick from the trope doc (checkbox UI in FE, but backend should store these in a structured artifact)
    

Backend artifact additions:

- `phase2_outputs/series_constraints.json`
    
- `phase2_outputs/series_outline.md`
    
- Update bundle includes `SERIES_CONSTRAINTS` section too (not just the outline)
    

Tooling:

- **Outline “risk audit” activity**: after series outline, run a short LLM pass that flags:
    
    - genre expectation mismatches
        
    - missing stakes
        
    - unclear antagonist pressure
        
    - “where is the hook?”
        

This becomes `phase2_outputs/series_outline_audit.md`.

---

### 2) Call Sheet (Phase 3)

Your process relies heavily on Call Sheet; it’s the “requirements document” for Phase 4/5.

Add:

- **Human review loop like Phase 2/5** (APPROVE/REVISE).
    
- Optional “lock items” mechanic: user can “lock” certain characters/locations so regen won’t overwrite them.
    

Backend artifact additions:

- `phase3_outputs/call_sheet.md`
    
- `phase3_outputs/call_sheet.json` (structured list of characters/world elements/questions)
    

Tooling:

- **Call Sheet completeness validator**:
    
    - Ensures every major plot thread in series outline has required supporting items (at least 1 antagonist force, stakes, core setting, etc.)
        
    - Ensures “groups” have 3–5 named minor characters (your rule)
        

---

### 3) Characters + Worldbuilding (Phase 4)

Right now Phase 4 is two one-shot generations. Your process is iterative. Make Phase 4 a **two-lane workflow with review gates**:

Proposed Phase 4 structure:

- **4A Characters**: generate -> review -> revise loop -> save locked
    
- **4B Worldbuilding**: generate -> review -> revise loop -> save locked
    
- Then update bundle.
    

Tooling:

- **Character Consistency Linter**
    
    - Extract a “character sheet index” (names, roles, voice traits, motivations)
        
    - Flags duplicates, name collisions, role confusion
        
- **Worldbuilding Category Normalizer**
    
    - Ensures categories are stable across revisions (prevents “category drift”)
        

Artifacts:

- `phase4_outputs/characters.md`
    
- `phase4_outputs/characters.index.json`
    
- `phase4_outputs/worldbuilding.md`
    
- `phase4_outputs/worldbuilding.index.json`
    

---

### 4) Outline (Phase 5)

Phase 5 is already solid. Two key optimizations:

- **Outline Template Wizard**
    
    - Instead of passing `outline_template` as raw text, store templates as named presets:
        
        - `templates/outline/romance_v1.md`
            
        - `templates/outline/thriller_v1.md`
            
    - Wizard chooses template + optional overrides.
        
- **Outline Parser + “Chapter Cards”**
    
    - You already parse outline into manifest chapters.
        
    - Enhance parser to also capture:
        
        - POV character (if present)
            
        - location (if present)
            
        - conflict tag(s) This powers better Phase 6 prompts and continuity checks.
            

---

### 5) Scene Brief (Phase 6 step)

Your process is much richer than the current scene brief prompt. Upgrade the scene brief generation to match your doc:

Add these required sections:

- POV + justification
    
- “Plot (Verbatim + Beats)” (pull chapter summary verbatim from outline)
    
- Scene function
    
- Characters per-scene details (clothes/mood/goals/behavior notes)
    
- Setting sensory details
    
- Main conflict
    
- Tone/style notes (clear window prose etc.)
    
- Symbolism/theme layer
    
- Continuity considerations (explicit checklist)
    

Tooling:

- **Scene Brief Validator**
    
    - Confirms required headings exist
        
    - Confirms beats count is 20–25
        
    - Confirms it included verbatim outline excerpt
        

Artifacts:

- `phase6_outputs/chapter_N/scene_brief.md`
    
- `phase6_outputs/chapter_N/scene_brief.check.json` (validator output)
    

---

### 6) First Draft + Prohibited Words + “Stop exactly” rules

Right now Phase 6 first draft uses bundle + scene brief, but your process also uses:

- prose style examples
    
- prohibited words doc
    
- strict “no foreshadowing, stop early, ~3000 words”
    

Backend improvements:

- Store `prose_style_examples.md` as an artifact in Phase 1 (or project-level settings)
    
- Store `prohibited_words.md` as a canonical artifact and also parse it into a list for automated checks
    

Tooling (big win):

- **Prohibited Words Scanner** (non-LLM)
    
    - Run after first draft and after final
        
    - Outputs:
        
        - occurrences with line snippets
            
        - count per word
            
- **Length + Structure checker**
    
    - word count
        
    - checks chapter header format
        

Artifacts:

- `phase6_outputs/chapter_N/draft_lint.json`
    

---

### 7) Light Line Editing (your 2-step edit)

You already do “improvement plan” then “apply plan/custom/skip”. Two upgrades:

- **Model routing**
    
    - improvement plan should use a “thinking” model (your note)
        
    - implementation can use a cheaper model
        
    - expose this as per-step config in backend
        
- **Diff-based apply**
    
    - Instead of “rewrite full chapter”, ask LLM to output a list of patches (or “before/after snippets”)
        
    - Then apply patches deterministically, so changes stay _minimal_
        
    - This reduces the risk you described (“editing passes can make it worse”).
        

---

## Backend/workflow optimizations (concrete, implementable)

### A) Step-level configuration (models/temps/tokens)

Add a project-level config artifact, e.g.:

- `project_settings/generation_profiles.json`
    

Per step:

- provider/model
    
- temperature
    
- max_tokens
    
- “thinking required” boolean (routes to a designated model)
    

This lets you match your process recommendations without hardcoding.

---

### B) Structured artifacts + indices (enables real “tools”)

Right now most outputs are Markdown-only. Add parallel structured files:

- `.json` indexes for characters/worldbuilding/outline chapters
    
- validators read the JSON and produce actionable warnings
    

This unlocks:

- “regenerate only X” (only the broken character entry)
    
- continuity checks
    
- UI wizards that can populate from real data
    

---

### C) Validation as first-class activities

Add lightweight activities (some LLM, some pure-python) that run after key steps:

- `validate_call_sheet_activity`
    
- `validate_scene_brief_activity`
    
- `scan_prohibited_words_activity`
    
- `continuity_check_activity` (outline vs chapter text)
    
- `chapter_starts_with_previous_context_activity` (checks the “previous chapter text” handoff)
    

Expose results in:

- new endpoint or existing “pending inputs” as “warnings to review”.
    

---

### D) Better “human input” support (wizard-style forms)

You already have a generic 

human_input_activity + `/workflows/{workflow_id}/respond`.

Enhancement:

- include a **schema** in the pending input payload:
    
    - field types (string, textarea, select, checklist)
        
    - validation rules
        
    - defaults
        

Then the frontend can render real wizards, not just a text prompt.

---

### E) Caching and reuse

Some steps are expensive and stable:

- genre tropes research
    
- style sheet creation
    
- worldbuilding categories
    

Add a simple cache layer keyed by `(project_id, step_name, inputs_hash)`:

- if inputs unchanged, reuse previous artifact
    
- if only minor change, do “revise” instead of regenerate