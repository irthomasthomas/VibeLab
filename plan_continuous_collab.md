continuous, collaborative evaluation model.

**Action Plan:**
1.  **Scoring System:**
    *   **Task:** Design/Implement a global ELO-like rating system (e.g., ELO, Glicko-2, TrueSkill) for models/generations.
    *   **Consideration:** How to initialize scores, handle new model entries.
2.  **Data Aggregation:**
    *   **Task:** Define a mechanism for user comparisons (pairwise choices) to feed into this global scoring system.
    *   **Data Model:** Store individual comparison outcomes (e.g., `model_A_id`, `model_B_id`, `winner_id`, `user_id`, `timestamp`).
3.  **Experiment Integration (Optional, as per your suggestion):**
    *   **Task:** If retaining 'experiments', outline how their pairwise comparison results contribute to the global scores. They essentially become tagged subsets of the global comparison data.
4.  **Visualization:**
    *   **Task:** Design UI for presenting global leaderboards.
    *   **Task:** Design UI for pairwise comparison input.

**Key Components Impacted:**
*   **Baseline Models:** Naming/versioning becomes critical for global tracking.
*   **Evaluation Metrics:** Primary metric becomes the global rank/score, supplemented by individual experiment analyses if retained.
*   **Data Ingestion:** Needs to handle a continuous stream of pairwise comparison results.

**Next Step Suggestion:**
*   Prioritize selection and basic implementation of the chosen rating algorithm (e.g., ELO) and the data model for storing pairwise outcomes. This forms the core of the "arena" functionality.