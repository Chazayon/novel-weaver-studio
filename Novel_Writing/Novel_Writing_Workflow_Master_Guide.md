# Novel Writing Workflow - Master Guide

## Overview

The novel writing process is divided into **7 separate workflows** to avoid rate limits and give better control over each phase. Each workflow must be completed before moving to the next.

---

## Workflow Structure

### **Phase 1: Initial Setup & Research**
- **File**: `phase1_initial_setup.yaml`
- **Duration**: ~5-10 minutes
- **Runs parallel**: Genre research + Style sheet creation
- **Outputs**: 
  - `genre_tropes.md`
  - `style_sheet.md`

### **Phase 2: Brainstorming & Series Outline**
- **File**: `phase2_brainstorming.yaml`
- **Duration**: ~15-30 minutes (interactive)
- **Interactive**: Yes (conversation-based brainstorming)
- **Outputs**: 
  - `series_outline.md`

### **Phase 3: Call Sheet Generation**
- **File**: `phase3_callsheet.yaml`
- **Duration**: ~5-10 minutes
- **Outputs**: 
  - `call_sheet.md`

### **Phase 4: Characters & Worldbuilding**
- **File**: `phase4_characters_worldbuilding.yaml`
- **Duration**: ~10-20 minutes
- **Runs parallel**: Character development + Worldbuilding
- **Outputs**: 
  - `characters.md`
  - `worldbuilding.md`

### **Phase 5: Chapter Outline Creation**
- **File**: `phase5_outline.yaml`
- **Duration**: ~10-15 minutes
- **Outputs**: 
  - `outline.md`

### **Phase 6: Chapter Writing (REPEATABLE)**
- **File**: `phase6_chapter_writing.yaml`
- **Duration**: ~15-25 minutes per chapter
- **Run once for EACH chapter**: If you have 20 chapters, run this 20 times
- **Outputs per run**: 
  - `chapter_X_final.md`

### **Phase 7: Final Manuscript Compilation**
- **File**: `phase7_final_compilation.yaml`
- **Duration**: ~5 minutes
- **Outputs**: 
  - `[BOOK_TITLE]_FINAL_MANUSCRIPT.md`

---

## Installation & Setup

### 1. Create Workflow Directory
```bash
cd /path/to/ChatDev
mkdir -p workflows
```

### 2. Save All Workflow Files
Save each of the 7 YAML files to the `workflows/` directory:
- `workflows/phase1_initial_setup.yaml`
- `workflows/phase2_brainstorming.yaml`
- `workflows/phase3_callsheet.yaml`
- `workflows/phase4_characters_worldbuilding.yaml`
- `workflows/phase5_outline.yaml`
- `workflows/phase6_chapter_writing.yaml`
- `workflows/phase7_final_compilation.yaml`

### 3. Set Up Environment Variables
Create a `.env` file or export these variables:
```bash
export BASE_URL="https://api.openai.com/v1"
export API_KEY="your-api-key-here"
```

For multiple API providers, you may want to set different keys:
```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

---

## Complete Workflow Execution Guide

### **Step-by-Step Process**

#### **PHASE 1: Initial Setup**
```bash
python chatdev.py --workflow workflows/phase1_initial_setup.yaml
```
**Input Required:**
- Genre
- Book title
- Initial ideas
- Writing samples (6000 words) or SKIP
- Outline template or SKIP
- Prohibited words or SKIP

**Save outputs to files:**
- `genre_tropes.md`
- `style_sheet.md`

---

#### **PHASE 2: Brainstorming**
```bash
python chatdev.py --workflow workflows/phase2_brainstorming.yaml
```
**Input Required:**
- Genre
- Book title
- Initial ideas
- Content from `genre_tropes.md`

**Interactive conversation** - Answer questions and ask for ideas

**Save output to file:**
- `series_outline.md`

---

#### **PHASE 3: Call Sheet**
```bash
python chatdev.py --workflow workflows/phase3_callsheet.yaml
```
**Input Required:**
- Book title
- Genre
- Content from `series_outline.md`
- Content from `genre_tropes.md`

**Save output to file:**
- `call_sheet.md`

---

#### **PHASE 4: Characters & Worldbuilding**
```bash
python chatdev.py --workflow workflows/phase4_characters_worldbuilding.yaml
```
**Input Required:**
- Book title
- Genre
- Content from `series_outline.md`
- Content from `genre_tropes.md`
- Content from `call_sheet.md`

**Save outputs to files:**
- `characters.md`
- `worldbuilding.md`

---

#### **PHASE 5: Chapter Outline**
```bash
python chatdev.py --workflow workflows/phase5_outline.yaml
```
**Input Required:**
- Book title
- Genre
- Content from `series_outline.md`
- Content from `genre_tropes.md`
- Content from `characters.md`
- Content from `worldbuilding.md`
- Outline template or SKIP

**Save output to file:**
- `outline.md`

**IMPORTANT:** Count your total chapters!

---

#### **PHASE 6: Chapter Writing (Repeat for each chapter)**
```bash
# For Chapter 1
python chatdev.py --workflow workflows/phase6_chapter_writing.yaml

# For Chapter 2
python chatdev.py --workflow workflows/phase6_chapter_writing.yaml

# ... repeat for all chapters
```

**Input Required (for EACH chapter):**
- Book title
- Genre
- Current chapter number (1, 2, 3...)
- Current chapter name (from outline)
- Content from `outline.md`
- Content from `characters.md`
- Content from `worldbuilding.md`
- Content from `style_sheet.md`
- Writing samples or SKIP
- Prohibited words or SKIP
- Previous chapter text (or NONE for Chapter 1)

**Save output to file (for each chapter):**
- `chapter_1_final.md`
- `chapter_2_final.md`
- `chapter_3_final.md`
- etc.

**TIP:** For the "previous chapter text" input:
- Chapter 1: Type "NONE"
- Chapter 2: Paste the final text from `chapter_1_final.md`
- Chapter 3: Paste the final text from `chapter_2_final.md`
- And so on...

---

#### **PHASE 7: Final Compilation**
```bash
python chatdev.py --workflow workflows/phase7_final_compilation.yaml
```
**Input Required:**
- Book title
- Author name
- Genre
- Total chapters
- All chapters (paste all chapter_X_final.md contents in order)

**Save output to file:**
- `[YOUR_BOOK_TITLE]_FINAL_MANUSCRIPT.md`

---

## File Organization

Recommended directory structure:
```
your_novel_project/
├── phase1_outputs/
│   ├── genre_tropes.md
│   └── style_sheet.md
├── phase2_outputs/
│   └── series_outline.md
├── phase3_outputs/
│   └── call_sheet.md
├── phase4_outputs/
│   ├── characters.md
│   └── worldbuilding.md
├── phase5_outputs/
│   └── outline.md
├── phase6_outputs/
│   ├── chapter_1_final.md
│   ├── chapter_2_final.md
│   ├── chapter_3_final.md
│   └── ... (all chapters)
└── final_manuscript/
    └── [BOOK_TITLE]_FINAL_MANUSCRIPT.md
```

---

## Rate Limit Management

### **Why Split into Phases?**
1. **Avoids API rate limits**: Each phase is a separate run
2. **Better error recovery**: If something fails, you don't lose all progress
3. **Flexibility**: You can pause between phases
4. **Cost control**: You can review outputs before proceeding

### **Time Estimates (for a 20-chapter novel)**
- Phase 1: 10 minutes
- Phase 2: 30 minutes
- Phase 3: 10 minutes
- Phase 4: 20 minutes
- Phase 5: 15 minutes
- Phase 6: 20 min × 20 chapters = **6-7 hours** (can spread over days)
- Phase 7: 5 minutes

**Total: ~8-9 hours** (mostly Phase 6)

### **Recommended Schedule**
- **Day 1**: Phases 1-5 (complete all pre-writing)
- **Days 2-10**: Phase 6 (write 2-3 chapters per day)
- **Day 11**: Phase 7 (compile and celebrate!)

---

## Troubleshooting

### **Problem: Rate limit errors during a phase**
**Solution**: Wait 60 seconds and re-run the same workflow. Most data is preserved.

### **Problem: Lost output from a phase**
**Solution**: ChatDev should save outputs. Check the console/terminal output and copy the text manually if needed.

### **Problem: Variable substitution not working**
**Solution**: Check if ChatDev uses different syntax. Try `{{variable}}` or `{variable}` instead of `${variable}`.

### **Problem: Parallel execution not working in Phase 4**
**Solution**: If ChatDev doesn't support parallel nodes, they'll run sequentially. No issue, just takes longer.

### **Problem: Conditional edges not supported**
**Solution**: Remove conditions from edges and use human nodes to manually route between workflows.

---

## Model Recommendations

### **Best Models by Phase**
- **Phase 1**: GPT-4o or Claude Sonnet (genre research), Claude Opus (style sheet)
- **Phase 2**: Claude Sonnet (best for creative brainstorming)
- **Phase 3**: GPT-4o (structured output)
- **Phase 4**: Claude Sonnet (character depth and worldbuilding)
- **Phase 5**: Claude Sonnet (plotting)
- **Phase 6**: 
  - Scene Brief: Claude Sonnet
  - First Draft: **Claude Opus** (best creative writer)
  - Analysis: Gemini 2.0 Flash Thinking (reasoning)
  - Editing: Gemini 2.0 Flash Thinking (precise edits)
- **Phase 7**: GPT-4o (compilation)

### **Budget Options**
If you have API cost concerns:
- Use GPT-4o-mini for Phases 1, 3, 7
- Use Claude Sonnet for Phases 2, 4, 5
- Use Claude Opus ONLY for Phase 6 first drafts
- Use Gemini Flash for Phase 6 editing

---

## Tips for Success

### **Phase 2 (Brainstorming)**
- Take your time! This is the foundation
- Ask for 5-10 options when uncertain
- Don't settle - iterate until it feels right

### **Phase 6 (Chapter Writing)**
- **Write in batches**: Do 3-5 chapters in one session
- **Keep previous chapter handy**: You'll need it for continuity
- **Review each chapter**: Don't just accept the first draft
- **Save immediately**: Don't lose your work!

### **Between Phases**
- **Review all outputs** before moving to next phase
- **Edit if needed**: You can manually edit .md files
- **Back up your work**: Copy files to cloud storage

---

## Success Checklist

- [ ] Phase 1 complete - genre_tropes.md and style_sheet.md saved
- [ ] Phase 2 complete - series_outline.md saved
- [ ] Phase 3 complete - call_sheet.md saved
- [ ] Phase 4 complete - characters.md and worldbuilding.md saved
- [ ] Phase 5 complete - outline.md saved (chapters counted)
- [ ] Phase 6 complete - all chapter_X_final.md files saved
- [ ] Phase 7 complete - final manuscript saved
- [ ] **BONUS**: Backed up all files to cloud storage
- [ ] **CELEBRATION**: You finished your novel! 🎉

---

## Next Steps After Completion

1. ✅ Human revision pass
2. ✅ Beta readers
3. ✅ Professional editing
4. ✅ Cover design
5. ✅ Publishing!

**You've got this!**