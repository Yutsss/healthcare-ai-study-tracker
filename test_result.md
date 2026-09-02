#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Yuta's Lab — private, owner-only Healthcare-AI learning tracker (14 phases / 58 courses / 265 modules) on Next.js App Router + Supabase (Auth + Postgres with strict RLS). Phase 1-2: foundation (env, schema+RLS SQL, Supabase Auth, protected shell), idempotent seed import, Roadmap view with module status transitions (not_started/learning/exercise/done), XP/level/streak basics, lite dashboard, settings/owner tools."

backend:
  - task: "Supabase clients (browser/server/admin) + middleware session refresh & route protection"
    implemented: true
    working: "NA"
    file: "lib/supabase/*.ts, middleware.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implemented per VERIFIED Supabase playbook. BLOCKED for live testing: NEXT_PUBLIC_SUPABASE_URL not yet provided by user (keys present). App renders SetupRequired screen until then."
  - task: "SQL schema + RLS + gamification triggers (supabase/migrations/001_init.sql)"
    implemented: true
    working: "NA"
    file: "supabase/migrations/001_init.sql, 000_bootstrap_exec_sql.sql, scripts/apply-migrations.mjs"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "16 tables, owner_id RLS on all, triggers: new user->owner_settings, module_progress->activity+XP (module 20xp/unit 50/phase 200 bonuses), study_log->XP, exercise_report->XP. Must be applied by user in Supabase SQL Editor (API keys cannot run DDL)."
  - task: "API routes: /api/health, /api/auth/owner-exists, POST /api/auth/register-owner (first user only), GET /api/seed/preview (dry-run), POST /api/seed/import (idempotent), GET /api/seed/status"
    implemented: true
    working: "NA"
    file: "app/api/[[...path]]/route.ts, lib/seed/importSeed.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Auth via session cookies OR Authorization: Bearer <supabase access_token>. Seed bundled from data/yutas-lab-course-seed.json. /api/health verified locally (returns supabaseConfigured:false until URL set)."

frontend:
  - task: "Login page (sign in / first-run create owner), SetupRequired screen"
    implemented: true
    working: "NA"
    file: "app/login/page.tsx, components/setup-required.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "SetupRequired screenshot verified. Login flow untested until Supabase URL is provided."
  - task: "App shell + Dashboard (lite) + Roadmap (expand/collapse, filters, search, status control) + Settings (seed preview/import, db counts, sign out)"
    implemented: true
    working: "NA"
    file: "app/(app)/*, components/app-shell/app-shell.tsx, components/roadmap/*.tsx, lib/hooks/*.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "All routes compile (200). tsc --noEmit clean. Data-testids added throughout."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Supabase clients (browser/server/admin) + middleware session refresh & route protection"
    - "API routes: /api/health, /api/auth/owner-exists, POST /api/auth/register-owner (first user only), GET /api/seed/preview (dry-run), POST /api/seed/import (idempotent), GET /api/seed/status"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Phase 1-2 code complete but live testing blocked: waiting for user's NEXT_PUBLIC_SUPABASE_URL and for 001_init.sql to be run in the Supabase SQL Editor. Once set + server restarted: create owner via login page (or POST /api/auth/register-owner), import seed in Settings, verify roadmap status changes award XP."
