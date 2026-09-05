# Yuta's Lab

### My learning journey from data science foundations to Healthcare AI

Hi, I'm Yuta. I am currently learning my way toward Healthcare AI, one course, module, practice session, and small project at a time.

Yuta's Lab is the personal workspace I built to make that journey easier to see. It helps me remember where I am, stay consistent, reflect on what I actually understand, and keep moving when the roadmap starts to feel a little overwhelming.

> [!NOTE]
> ### An honest build note
>
> This website was made through **full vibe coding with AI**. I started with the learning experience I wanted, described it through prompts, reviewed the results, tested the flows, and kept refining things as the project grew.
>
> I am not presenting this repository as something I coded line by line entirely on my own. The learning direction, curriculum choices, feature decisions, and the progress recorded here are mine; AI helped me turn those ideas into a working tool. I still have plenty to learn, both in Healthcare AI and in building software, and this project is part of that process.

## Why I built this

Learning Healthcare AI is not a straight line. It connects programming, mathematics, statistics, machine learning, healthcare knowledge, clinical data, responsible evaluation, and deployment. Keeping all of that in a regular checklist made it difficult for me to understand the bigger picture.

I wanted one place where I could:

- see how today's module connects to the long-term goal;
- focus without losing track of study time;
- record what I learned and where I struggled;
- turn completed lessons into practical project ideas;
- look back at real progress instead of relying on memory;
- make consistency feel a little more fun.

This repository is that place. It is less about building a perfect productivity app and more about giving my learning journey a home.

## The journey

The current curriculum contains **14 phases, 58 courses, and 265 modules**. It begins with general foundations and gradually moves closer to applied Healthcare AI.

| Stage | What I am learning |
| --- | --- |
| Data foundations | Python, SQL, data analysis, visualization, and the data science workflow |
| Mathematical foundations | Linear algebra, calculus, probability, and statistics for machine learning |
| Core AI | Classical machine learning, deep learning, validation, and error analysis |
| Healthcare foundations | Healthcare systems, medical terminology, epidemiology, and biostatistics |
| Clinical data | Clinical datasets, electronic health records, and healthcare-focused data science |
| Healthcare AI | Clinical usefulness, evaluation, safety, fairness, and medical AI applications |
| From model to practice | Advanced clinical AI, MLOps, and an independent end-to-end portfolio project |

The checked-in [curriculum seed](data/yutas-lab-course-seed.json) gives the roadmap a stable starting point. I can adjust the curriculum as I learn, while keeping existing progress attached to stable course and module identifiers.

## How I learn with it

```text
Plan → Focus → Practice → Reflect → Build → Review
```

1. **Plan** — choose a module from the roadmap and understand where it fits.
2. **Focus** — use the Pomodoro timer to work in deliberate intervals.
3. **Practice** — move a module through Learning, Exercise, and Done.
4. **Reflect** — record confidence, difficulty, lessons learned, and struggles.
5. **Build** — collect project ideas and move them from idea to completed work.
6. **Review** — use progress, streaks, milestones, and activity history to decide what comes next.

The goal is not to chase numbers for their own sake. The numbers are there to make effort visible and to help me notice patterns in how I learn.

## Inside Yuta's Lab

### Roadmap

The roadmap organizes the full curriculum into phases, courses, and modules. It supports search, progress states, course links, and exercise reflections without hiding the larger learning path.

### Focus Mode

A configurable Pomodoro timer records only active focus time. Completed sessions flow into the study log, weekly goal, streak, XP, and related quests.

### Study Log and reflections

The study log keeps a history of focused sessions. Exercise reports add the more useful human context: what felt difficult, what became clearer, and how confident I felt after practicing.

### Projects

The project board is where course knowledge can become something practical. Ideas can move through planning, active work, completion, or archiving, with space for skills and project links.

### Progress that feels encouraging

The progress area brings together XP, levels, activity history, confidence trends, skill growth, milestones, achievements, and rotating weekly quests. I wanted these elements to feel playful enough to encourage consistency without pretending that XP is the same thing as mastery.

## Follow or try the journey

The application has two ways for visitors to explore it without entering my private workspace:

- **Public showcase (`/showcase`)** — a read-only view of the progress and projects I deliberately choose to publish.
- **Guest demo (`/demo`)** — the same core learning experience with a fresh progress space stored only in the visitor's browser.

The demo includes Dashboard, Roadmap, Focus, Study Log, Projects, and Progress. Its activity is separate from mine, so visitors can freely try the workflow without changing my learning records.

## Under the hood

The website is built with:

- **Next.js 15**, **React**, and **TypeScript**;
- **Supabase Auth** and **PostgreSQL** for the private owner workspace;
- **TanStack Query** for server-state synchronization;
- **Tailwind CSS** and **Radix UI** for the interface;
- **Recharts** for learning and confidence visualizations;
- **Vitest** and **Testing Library** for automated checks.

The owner workspace, public showcase, and guest demo use separate data paths. The private workspace is authenticated, the showcase exposes only explicitly published information, and the demo keeps its progress in validated browser storage.

## Run it locally

### Prerequisites

- Node.js 20 or newer
- Yarn 1.22
- A Supabase project

### 1. Clone and install

```bash
git clone https://github.com/Yutsss/healthcare-ai-study-tracker.git
cd healthcare-ai-study-tracker
yarn install
```

### 2. Configure the environment

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

The secret key is used only by server-side setup and import utilities. Do not expose it through a `NEXT_PUBLIC_` variable or commit the `.env` file.

### 3. Apply the database migrations

First, run [`000_bootstrap_exec_sql.sql`](supabase/migrations/000_bootstrap_exec_sql.sql) once in the Supabase SQL Editor. It creates the restricted migration helper used by the repository.

Then apply the remaining migrations in order:

```bash
node scripts/apply-migrations.mjs
```

### 4. Start the app

```bash
yarn dev:no-reload
```

Open [http://localhost:3000](http://localhost:3000), create the first owner account, and import the bundled curriculum from Settings.

### Useful checks

```bash
yarn test
yarn tsc --noEmit
yarn build
```

---

This is a personal project built alongside the journey it tracks. I hope it becomes more useful and more thoughtful as I continue learning.
