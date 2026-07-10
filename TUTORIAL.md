# Workspace Hub - Complete Tutorial Guide

## Table of Contents
1. [Overview](#overview)
2. [Dashboard](#dashboard)
3. [Schedule](#schedule)
4. [Focus Timer](#focus-timer)
5. [Weather](#weather)
6. [To-Do](#to-do)
7. [Analytics](#analytics)
8. [Lessons](#lessons)
9. [Library](#library)
10. [Knowledge Graph](#knowledge-graph)
11. [Habits](#habits)

---

## Overview

**Workspace Hub** is your all-in-one productivity center. It combines multiple tools into a single, cohesive interface with a beautiful cyberpunk-themed design.

### Main Components:
- **Sidebar** - Navigation menu with all available tools
- **Header** - Quick stats and focus mode toggle
- **Main Content Area** - Where each tool's interface loads
- **Floating Action Button** - Quick add tasks anywhere

---

## Dashboard

**Location:** Main view (default landing page)
**Purpose:** Your command center for productivity metrics

### Features:

#### 1. **Banner Card**
- **Daily Completion Progress** - Shows how much of your daily tasks you've completed
- **Streak Display** - Shows your current productivity streak
- **Greeting** - Personalized message with current date

#### 2. **Active Session Card**
- **Current Session** - Displays what you're currently working on
- **Up Next** - Shows your next scheduled task
- **Lesson Link** - Quick access to linked lesson pages

#### 3. **Master To-Do Card**
- Displays your task list directly on the dashboard
- Checkboxes to mark tasks complete
- Syncs with the dedicated To-Do view

#### 4. **Custom Widgets**
- Add your own widgets for quick information
- Weather widget integration
- Fully customizable

#### 5. **Stats Cards** (4 cards)
- **Tasks Done** - X/Y tasks completed today
- **Today's Tasks** - Number of tasks scheduled for today
- **Lesson Folders** - Count of your lesson folders
- **Day Streak** - Consecutive days of productivity

### How It Works:
The dashboard automatically pulls data from all other modules (schedule, tasks, lessons) and displays key metrics. It updates in real-time as you complete tasks or add new ones.

---

## Schedule

**Location:** Schedule view (sidebar navigation)
**Purpose:** Manage your weekly schedule and tasks

### Features:

#### 1. **Week View (Graph View)**
- **7 Day Cards** - One for each day of the week
- **Task Count** - Number of tasks per day
- **Mini Preview** - Shows first 3 tasks of each day
- **Progress Bar** - Completion percentage for each day
- **Today Highlight** - Current day is highlighted with a star ⭐
- **Time Conflict Warning** - ⚠️ badge appears if tasks overlap

**How to Use:**
- Click any day card to open the detailed day diagram
- Right-click for context menu options
- Hover to see task preview

#### 2. **Day Diagram Modal** (opens when clicking a day)

**Left Side - Task Creation Form:**
- **Task Title** - Name your task
- **Category** - Choose type: Study, Work, Personal, Fitness, Social, Other
- **Link to Lesson** - Connect task to a lesson page
- **Repeat Options** - Set recurrence: None, Daily, Weekly, Monthly
- **Day Selection** - Choose which days to add the task to
- **Time Pickers** - iOS-style wheel pickers for start/end times
- **Preset Buttons** - Quick add "Study" or "Break" tasks

**Right Side - Timeline:**
- **Task List** - All tasks for the selected day
- **Time Display** - Start and end times for each task
- **Category Badges** - Color-coded by type
- **Action Buttons:**
  - ⏱ Start Focus Timer - Launches timer for this task
  - ✓ Complete - Mark task as done
  - 📄 Open Lesson - Opens linked lesson page
  - Remove - Delete the task

**Day Navigation:**
- **Arrow Buttons** - Navigate to previous/next day
- **Today Button** - Jump back to today
- **Day Pills** - Quick switch between days (shows task count)

**How It Works:**
1. Click a day to open the modal
2. Fill in the task details on the left
3. Click "Add Task" to save
4. See your task appear in the timeline on the right
5. Click any timeline task to edit it (form populates with task data)
6. Use action buttons to manage tasks

#### 3. **Month View**
- Calendar grid showing the current month
- Dots indicate days with tasks
- Color-coded by category
- Click a day to see its events

#### 4. **List View**
- Text-based list of all tasks
- Simpler alternative to graph view

#### 5. **Countdown View**
- Shows time until next task
- Useful for time management

---

## Focus Timer

**Location:** Focus Timer view (sidebar navigation)
**Purpose:** Pomodoro-style countdown timer with session tracking

### Features:

#### 1. **Session Tracker** (Top Section)
- **Task Selector** - Dropdown to link timer to a scheduled task
- **Auto-Link Badge** - Shows when connected to schedule
- **Scheduled Time** - Set your target focus duration
- **Focus Time Display** - Large green timer showing accumulated focus time
- **Break Time Display** - Orange timer showing break time
- **Progress Bar** - Visual progress toward your goal
- **Progress Percentage** - X% of scheduled time complete

**Buttons:**
- **Reset Log** - Clears today's accumulated times
- **End Session & Log** - Saves session to history

**How It Works:**
- Automatically links to today's scheduled tasks
- Tracks focus and break time separately
- Accumulates time across multiple sessions
- Auto-resets at midnight
- Saves history to localStorage

#### 2. **Simple Countdown Timer** (Bottom Section)
- **Large Display** - Shows remaining time in MM:SS format
- **Control Buttons:**
  - Start - Begin countdown
  - Pause - Stop timer (resume later)
  - Reset - Return to initial time

#### 3. **Preset Timers**
- **5 min** - Quick break timer
- **25 min** - Standard Pomodoro session
- **50 min** - Extended focus session

#### 4. **Custom Timers**
- **Input Field** - Enter any duration (1-999 minutes)
- **Add Timer Button** - Creates a new custom timer
- **Custom Timer Buttons** - Your saved timers appear here
- **Delete Button** - Hover over custom timer to reveal ✕ button

**How It Works:**
1. Select a preset or create a custom timer
2. Click Start to begin countdown
3. Timer alerts when complete
4. Session tracker automatically logs your time
5. Custom timers are saved to localStorage

---

## Weather

**Location:** Weather view (sidebar navigation)
**Purpose:** Display current weather and forecast

### Features:
- **Current Conditions** - Temperature, humidity, wind
- **Forecast** - Extended weather predictions
- **Visual Display** - Icons and graphics for weather conditions

**How It Works:**
- Fetches data from weather API
- Updates automatically
- Displays in easy-to-read format

---

## To-Do

**Location:** To-Do view (sidebar navigation)
**Purpose:** Master task management system

### Features:

#### 1. **Task List**
- **Add Tasks** - Click "+ Add task" button
- **Checkboxes** - Mark tasks complete
- **Strikethrough** - Completed tasks show with line through
- **Delete** - Remove tasks when done

#### 2. **Momentum Card** (Right side)
- **Total Tasks** - Count of all tasks
- **Done** - Number completed
- **Complete %** - Completion percentage

**How It Works:**
- Tasks sync with dashboard
- Persist in localStorage
- Can be reordered by dragging
- Filter by status (all/active/completed)

---

## Analytics

**Location:** Analytics view (sidebar navigation)
**Purpose:** Insights and reports on your productivity

### Features:

#### 1. **Focus Session History**
- Timeline of all focus sessions
- Duration and date of each session
- Tasks associated with sessions

#### 2. **Stats Grid**
- Various productivity metrics
- Visual charts and graphs
- Time period filters

#### 3. **Category Breakdown**
- Pie chart showing time spent by category
- Study, Work, Personal, etc.

#### 4. **Peak Performance Hours**
- Shows when you're most productive
- Based on focus session data

#### 5. **Scheduling Conflicts**
- Detects overlapping tasks
- Warns about time conflicts

**How It Works:**
- Aggregates data from all modules
- Calculates statistics and trends
- Visualizes data with charts
- Updates in real-time

---

## Lessons

**Location:** Lessons view (sidebar navigation)
**Purpose:** Create, organize, and edit lesson content

### Features:

#### 1. **Explorer Panel** (Left Sidebar)
- **Folder Tree** - Hierarchical organization
- **Search** - Find lessons quickly
- **Context Menu** - Right-click for options:
  - Create new folder
  - Create new page
  - Rename
  - Delete

#### 2. **Main Editor** (Right Panel)
- **Rich Text Editing** - Notion-style block editor
- **Block Types:**
  - Headings (H1, H2, H3)
  - Bullet lists
  - Quotes
  - Code blocks (with syntax highlighting)
  - Callouts
  - Toggle blocks
  - Dividers

#### 3. **Toolbar**
- **Find** - Search within page
- **Hide Menu** - Toggle sidebar visibility
- **Save Indicator** - Shows "Saved" when changes are saved

#### 4. **Slash Commands**
- Type `/` to open command menu
- Quick insert blocks
- Keyboard shortcuts

#### 5. **Export Options**
- Export as Markdown
- Export as HTML
- Print to PDF
- Backup/Restore

**How It Works:**
1. Create folders to organize content
2. Add pages within folders
3. Click page to open in editor
4. Type content using blocks
5. Use slash commands for quick formatting
6. Auto-saves to localStorage

---

## Library

**Location:** Library view (sidebar navigation)
**Purpose:** Store and organize learning resources

### Features:

#### 1. **Search & Filter**
- **Search Bar** - Find resources by title
- **Category Filter** - Filter by type:
  - Links
  - Videos
  - Documents
  - Code snippets

#### 2. **Add Resources**
- **Title** - Name of the resource
- **URL** - Link to the resource
- **Category** - Type of resource
- **Tags** - Comma-separated keywords

#### 3. **Resource Grid**
- Cards display each resource
- Click to open
- Visual indicators for category

**How It Works:**
- Save links to important resources
- Tag for easy organization
- Search and filter to find quickly
- Persists in localStorage

---

## Knowledge Graph

**Location:** Knowledge Graph view (sidebar navigation)
**Purpose:** Visualize connections between lessons and concepts

### Features:

#### 1. **Interactive Graph**
- **Nodes** - Represent lessons/pages
- **Edges** - Show connections between nodes
- **Force-Directed Layout** - Auto-arranges nodes
- **Zoom & Pan** - Navigate large graphs

#### 2. **Visual Indicators**
- **Node Size** - Based on connections
- **Color Coding** - By category or status
- **Hover Info** - Shows node details

**How It Works:**
- Analyzes lesson content and links
- Builds graph of connections
- Renders using Cytoscape.js
- Interactive exploration

---

## Habits

**Location:** Habits view (sidebar navigation)
**Purpose:** Track daily habits and build streaks

### Features:

#### 1. **Habit List**
- **Add Habits** - Create new habits to track
- **Daily Checkboxes** - Mark complete each day
- **Streak Counter** - Consecutive days completed
- **Visual Progress** - Calendar view

#### 2. **Habit Cards**
- **Name** - Habit title
- **Icon** - Visual identifier
- **Streak** - Current streak count
- **Completion Rate** - Percentage

**How It Works:**
1. Add habits you want to build
2. Check them off daily
3. Build streaks for consistency
4. View progress over time
5. Data persists in localStorage

---

## Common Features

### Theme Selector (Sidebar)
- **Cyberpunk** (default) - Purple/blue neon theme
- **Minimal** - Clean, light theme
- **Ocean** - Blue water theme
- **Sunset** - Warm orange/pink theme
- **Forest** - Green nature theme
- **Midnight** - Dark blue theme
- **Auto** - Follows system preference

### Progress Ring (Sidebar)
- Shows daily completion percentage
- Updates as you complete tasks
- Visual indicator of daily progress

### Quick Add Button (Floating +)
- Appears on most views
- Click to quickly add a task for today
- Saves time navigating to To-Do view

### Global Search (Top Bar)
- Search across lessons, tasks, and library
- Real-time results
- Quick navigation

### Focus Mode
- Toggle with "Focus" button in header
- Minimizes distractions
- Optimizes interface for productivity

---

## Data Persistence

All your data is saved automatically to your browser's localStorage:
- Tasks and to-dos
- Schedule events
- Custom timers
- Lesson content
- Library resources
- Habit tracking
- Analytics history

**Note:** Data is stored locally in your browser. Clearing browser data will erase everything. Use the "Export Backup" feature in Lessons to save your data.

---

## Keyboard Shortcuts

- **Escape** - Close modals
- **Arrow Keys** - Navigate between days in schedule
- **Enter** - Submit forms
- **/** - Open slash commands (in lesson editor)
- **Ctrl+F** - Find in page (lessons)

---

## Tips & Best Practices

1. **Start with Dashboard** - Check your daily overview each morning
2. **Plan Your Day** - Use Schedule to time-block tasks
3. **Use Focus Timer** - Work in 25-minute Pomodoro sessions
4. **Link Lessons** - Connect tasks to lesson pages for context
5. **Track Habits** - Build consistency with daily habit tracking
6. **Review Analytics** - Check weekly to optimize productivity
7. **Export Backups** - Regularly backup your data

---

## Troubleshooting

**Data not saving?**
- Check if localStorage is enabled in your browser
- Ensure you're not in incognito/private mode

**Timer not working?**
- Refresh the page
- Check browser console for errors

**Schedule conflicts?**
- The system automatically detects overlaps
- Yellow warning badge appears on conflicting tasks

**Lessons not loading?**
- Check file structure in WorkspaceJS folder
- Ensure all JavaScript files are loaded

---

## Technical Architecture

### File Structure:
```
Workspace/
├── Workspace.html (main interface)
├── WorkspaceCSS/
│   ├── core/
│   │   ├── reset.css
│   │   ├── variables.css
│   │   └── layout.css
│   └── features/
│       ├── dashboard.css
│       ├── schedule.css
│       ├── schedule-modal.css
│       ├── modals.css
│       └── [other feature styles]
└── WorkspaceJS/
    ├── core/
    │   ├── init-globals.js
    │   ├── config.js
    │   └── helpers.js
    ├── engines/
    │   ├── simple-timer.js
    │   ├── session-tracker.js
    │   ├── schedule-planner.js
    │   └── [other engines]
    └── ui/
        ├── dashboard.js
        ├── app.js
        └── [other UI modules]
```

### Data Flow:
1. **User Action** → Event Listener
2. **Event Handler** → Business Logic
3. **Data Update** → State Management
4. **localStorage** → Persistence
5. **UI Update** → Re-render

---

## Getting Help

- Check browser console for errors (F12)
- Review this tutorial for feature explanations
- Use the Tour button in sidebar for guided walkthrough
- Press Shortcuts button to see keyboard shortcuts

---

**Version:** 2.1.0
**Last Updated:** 2026
**Author:** Workspace Hub Team

Happy Productivity! 🚀
