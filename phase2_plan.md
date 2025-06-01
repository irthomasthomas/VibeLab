# VibeLab Phase 2 Refactoring Plan

## Current Status: Phase 1 Complete ✓

**Phase 1 Achievements:**
- ✅ Fixed critical bugs (Add Custom Technique, Clear Queue buttons)
- ✅ Migrated template storage from JSON to SQLite database
- ✅ Refactored PromptManager to use DatabaseManager
- ✅ Updated FastAPI endpoints for database integration
- ✅ Maintained full backward compatibility

---

## Phase 2: Frontend Modularization & State Management

### **Priority 1: Fix SVG Drag-and-Drop Bug**
**Issue:** SVG images change appearance/color during drag-and-drop reordering in the Evaluation tab.

**Root Cause:** Likely due to DOM manipulation causing SVG re-parsing or style conflicts during reordering.

**Solution Approach:**
1. **Immediate Fix:** Ensure `reorderItems()` and `updateRankingsFromDOM()` only modify order/rank attributes, not SVG content
2. **Long-term Fix:** Implement proper state management to avoid unnecessary DOM re-renders

**Files to Modify:**
- `app.js` (around lines where drag-and-drop is handled)
- Investigate SVG container styling in `style.css`

### **Priority 2: Begin App.js Modularization**
**Current Problem:** 1800+ line monolithic `VibeLab` class handling everything.

**Strategy:** Create focused controller modules while maintaining current functionality.

**Modules to Extract:**
1. **`ExperimentSetupController.js`**
   - Handles "Experiment Setup" tab
   - Methods: `addPromptInput()`, `addCustomModel()`, `createExperiment()`
   - State: prompt inputs, model selection, technique configuration

2. **`GenerationQueueController.js`**
   - Manages "Generation Queue" tab and SVG generation
   - Methods: `startGeneration()`, `pauseGeneration()`, `clearQueue()`, `updateQueueDisplay()`
   - State: `generationQueue`, `isGenerating`

3. **`EvaluationController.js`**
   - Handles "Evaluation" tab and ranking
   - Methods: `updateEvaluationView()`, `resetRankings()`, drag-and-drop handlers
   - State: `rankings`, evaluation filters

4. **`ResultsController.js`**
   - Manages "Results" tab and analysis
   - Methods: `exportResults()`, `generateAnalysis()`
   - State: analysis results, export options

5. **`TemplateController.js`**
   - Handles template modal and operations
   - Methods: template CRUD operations, modal management
   - State: template list, modal state

**Implementation Strategy:**
- Create modules as ES6 classes
- Use simple event bus or shared state object for communication
- Migrate one controller at a time
- Maintain existing public API during transition

### **Priority 3: Dynamic Model Selection**
**Current Issue:** Model selection uses hardcoded dropdown.

**Solution:**
1. **Backend Endpoint:** Create `/api/models/available` that lists models from `ollama list` or equivalent
2. **Frontend Component:** Replace static dropdown with searchable/filterable model selector
3. **Auto-refresh:** Periodically update available models list

**Files to Create/Modify:**
- `fastapi_backend_llm_api.py` (new endpoint)
- `app.js` or `ExperimentSetupController.js` (model selection UI)
- `ApiService.js` (add model listing method)

### **Priority 4: Migrate Experiments from localStorage**
**Current Issue:** Experiments saved to browser localStorage, not backend database.

**Migration Plan:**
1. **Database Operations:** Ensure `DatabaseManager` experiment methods work correctly
2. **Frontend Changes:** Replace `saveExperiment()`/`loadExperiment()` localStorage calls with API calls
3. **Migration Tool:** Create utility to import existing localStorage experiments to database
4. **Fallback Strategy:** Keep localStorage as draft/temporary storage only

---

## Phase 2 Implementation Order

### Week 1: Stability & Core Bugs
1. **Day 1-2:** Fix SVG drag-and-drop visual bug
2. **Day 3-4:** Create first controller module (`GenerationQueueController.js`)
3. **Day 5:** Test and refine module communication patterns

### Week 2: Modularization
1. **Day 1-2:** Extract `ExperimentSetupController.js`
2. **Day 3-4:** Extract `EvaluationController.js`
3. **Day 5:** Extract `ResultsController.js` and `TemplateController.js`

### Week 3: Backend Integration
1. **Day 1-2:** Implement dynamic model selection
2. **Day 3-4:** Migrate experiment storage to database
3. **Day 5:** Testing and bug fixes

---

## Technical Debt to Address

### **Code Organization:**
- **CSS Modularization:** Consider organizing `style.css` with BEM methodology or CSS modules
- **API Consistency:** Ensure all backend calls go through `ApiService.js`
- **Error Handling:** Implement consistent error boundaries and user feedback

### **Performance Optimizations:**
- **SVG Rendering:** Consider virtual scrolling for large experiment results
- **Memory Management:** Prevent memory leaks from event listeners during module transitions
- **Caching:** Cache model lists and experiment metadata

### **Developer Experience:**
- **Documentation:** Add JSDoc comments to new modules
- **Testing Setup:** Consider adding unit tests for new modules
- **Build Process:** Evaluate need for bundler (webpack/vite) as modules increase

---

## Success Metrics for Phase 2

### **Functionality:**
- ✅ SVG drag-and-drop works without visual artifacts
- ✅ All existing features work after modularization
- ✅ Dynamic model selection loads available models
- ✅ Experiments save/load from database instead of localStorage

### **Code Quality:**
- ✅ Individual JavaScript files under 500 lines
- ✅ Clear separation of concerns between modules
- ✅ Consistent error handling patterns
- ✅ No regression in existing functionality

### **User Experience:**
- ✅ No noticeable performance degradation
- ✅ Improved responsiveness from better state management
- ✅ Better error messages and user feedback
- ✅ Smooth transitions between tabs

---

## Phase 3 Preview: Advanced Features

**After Phase 2 completion:**
- Advanced statistical analysis integration
- Multi-user support and authentication
- Real-time collaboration features
- Advanced prompt engineering techniques library
- Public-facing UI polish and responsive design
- Tutorial system and onboarding flow

---

## Files to Monitor During Phase 2

**Critical Files:**
- `app.js` (being broken down)
- `style.css` (may need modularization)
- `ApiService.js` (expanding)
- `fastapi_backend_llm_api.py` (new endpoints)
- `database_manager.py` (experiment operations)

**New Files to Create:**
- `ExperimentSetupController.js`
- `GenerationQueueController.js` 
- `EvaluationController.js`
- `ResultsController.js`
- `TemplateController.js`
- `StateManager.js` (for module communication)

**Testing Strategy:**
- Test each module in isolation before integration
- Maintain backward compatibility during transition
- Use browser dev tools to monitor for memory leaks
- Verify all user workflows after each major change

Remember: **Stability first, then features.** Each change should be tested thoroughly before moving to the next module.
EOF

echo "New refactoring plan created: refactoring_plan.md"