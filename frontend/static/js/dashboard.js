/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - DASHBOARD SCRIPT
   ========================================================================== */

window.DashboardApp = (() => {
    let streakVal, hoursVal, notesCount, interviewsCount, weakCount, activityList;

    async function loadStats() {
        // 1. Fetch study statistics from localStorage
        let streak = 0;
        let hours = 0.0;
        let weakCountNum = 0;
        
        try {
            // Read quiz history count to determine study progress
            const history = JSON.parse(localStorage.getItem('quiz_history') || '[]');
            if (history.length > 0) {
                // Streak can be proxied by length of quiz attempts (up to 3 for demo)
                streak = Math.min(history.length, 5);
                hours += history.length * 0.5; // Assume 30 mins per quiz
            }
            
            // Read planner goals to estimate hours studied
            const plannerTasks = document.querySelectorAll('.planner-task-checkbox');
            let completedPlannerTasks = 0;
            // Let's check completed checklist items in localStorage if stored
            const taskProgress = JSON.parse(localStorage.getItem('planner_checked_tasks') || '[]');
            completedPlannerTasks = taskProgress.length;
            hours += completedPlannerTasks * 1.5; // Assume 1.5 hours per study task

            // Weak subjects count can be estimated from the planner inputs
            const weakTopicsStr = localStorage.getItem('study_planner_weak_topics') || '';
            if (weakTopicsStr.trim()) {
                weakCountNum = weakTopicsStr.split(',').length;
            }
        } catch (e) {
            console.error("Error reading stats from localStorage:", e);
        }

        streakVal.textContent = `${streak} Days`;
        hoursVal.textContent = `${hours.toFixed(1)} Hrs`;
        weakCount.textContent = `${weakCountNum}`;

        // 2. Fetch database document statistics
        try {
            // Notes collection
            const notesResp = await fetch('/api/indexed-files?module=notes');
            if (notesResp.ok) {
                const data = await notesResp.respJson || await notesResp.json();
                notesCount.textContent = `${data.files.length} Files`;
            }
            
            // Interview experiences collection
            const interviewResp = await fetch('/api/indexed-files?module=interview');
            if (interviewResp.ok) {
                const data = await interviewResp.respJson || await interviewResp.json();
                interviewsCount.textContent = `${data.files.length} Logs`;
            }
        } catch (e) {
            console.error("Error fetching collection stats:", e);
        }

        // 3. Load Recent Activity Logs
        loadActivities();
    }

    function loadActivities() {
        activityList.innerHTML = "";
        let activities = [];

        try {
            const quizes = JSON.parse(localStorage.getItem('quiz_history') || '[]');
            quizes.forEach(q => {
                activities.push({
                    text: `Completed ${q.subject} Quiz (${q.difficulty.toUpperCase()}) — Score: ${q.score}`,
                    date: q.date,
                    icon: `<i data-lucide="clipboard-check" style="width: 14px; height: 14px; color: var(--accent-blue);"></i>`
                });
            });

            const starredCards = localStorage.getItem('starred_flashcards_count') || "0";
            if (parseInt(starredCards) > 0) {
                activities.push({
                    text: `Reviewed flashcard deck and starred ${starredCards} concepts.`,
                    date: new Date().toLocaleDateString(),
                    icon: `<i data-lucide="brain" style="width: 14px; height: 14px; color: var(--accent-cyan);"></i>`
                });
            }
        } catch (e) {
            console.error(e);
        }

        // Add some default activities if empty
        if (activities.length === 0) {
            activities.push({
                text: "Started your Placement Preparation journey! Click modules on the left to begin.",
                date: new Date().toLocaleDateString(),
                icon: `<i data-lucide="rocket" style="width: 14px; height: 14px; color: var(--accent-purple);"></i>`
            });
        }

        activities.forEach(act => {
            const li = document.createElement('li');
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.gap = "8px";
            li.innerHTML = `
                <span style="display: inline-flex; align-items: center;">${act.icon}</span>
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <span style="color:var(--text-primary); font-size:13px;">${act.text}</span>
                </div>
                <span style="color:var(--text-muted); font-size:11px; margin-left: auto;">${act.date}</span>
            `;
            activityList.appendChild(li);
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function init() {
        streakVal = document.getElementById('dash-streak-val');
        hoursVal = document.getElementById('dash-hours-val');
        notesCount = document.getElementById('dash-notes-count');
        interviewsCount = document.getElementById('dash-interviews-count');
        weakCount = document.getElementById('dash-weak-count');
        activityList = document.getElementById('dash-activity-list');

        loadStats();
    }

    return { init };
})();
