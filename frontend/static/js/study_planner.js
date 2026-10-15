/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - STUDY PLANNER SCRIPT
   ========================================================================== */

window.PlannerApp = (() => {
    let dateInput, subjectsInput, hoursInput, companyInput, weakInput, generateBtn;
    let loader, introScreen, activeScreen;
    let dashTitle, dashMeta, progressBar, progressTxt;
    let dailyTasks, weeklyGoals, weeklyGoalsPanel;
    let tipsList, motivationQuote, insightsPanel;
    let countdownVal, countdownTxt;
    let timelineFill;
    let statHours, statGoals, statStreak, statProgress;
    let weakAreasList;
    let themeToggle;

    let activeDayIndex = 0;
    let currentPlan = null;
    let checkedTasks = []; // Array of string ids: "task-dayIdx-taskIdx"

    function getTaskTag(taskText, weakAreasStr, companyStr) {
        const textLower = taskText.toLowerCase();
        
        // Check target company
        if (companyStr && companyStr.trim() !== '') {
            const comp = companyStr.trim().toLowerCase();
            if (textLower.includes(comp)) {
                return { label: companyStr.trim(), class: "sp-tag-company" };
            }
        }
        
        // Check weak areas
        if (weakAreasStr && weakAreasStr.trim() !== '') {
            const weakList = weakAreasStr.split(',').map(s => s.trim().toLowerCase());
            for (const weak of weakList) {
                if (weak && textLower.includes(weak)) {
                    return { label: "Weak area", class: "sp-tag-weak" };
                }
            }
        }
        
        // Default to Core
        return { label: "Core", class: "sp-tag-core" };
    }

    function calculateCountdown(examDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const examDate = new Date(examDateStr);
        examDate.setHours(0, 0, 0, 0);

        const diffTime = examDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? diffDays : 0;
    }

    function updateProgress() {
        if (!currentPlan || !currentPlan.daily_plan) return;

        // Calculate progress for active day
        const activeDay = currentPlan.daily_plan[activeDayIndex];
        let activeDayTotal = 0;
        let activeDayDone = 0;

        if (activeDay && activeDay.tasks) {
            activeDayTotal = activeDay.tasks.length;
            activeDay.tasks.forEach((_, tIdx) => {
                const taskId = `task-${activeDayIndex}-${tIdx}`;
                if (checkedTasks.includes(taskId)) {
                    activeDayDone++;
                }
            });
        }

        // Active day checklist UI update
        const activeDayPercent = activeDayTotal > 0 ? Math.round((activeDayDone / activeDayTotal) * 100) : 0;
        progressBar.style.width = `${activeDayPercent}%`;
        progressTxt.textContent = `${activeDayDone} of ${activeDayTotal} done`;

        // Update stats row for active day checklist
        statProgress.textContent = `${activeDayPercent}%`;
        const activeTasks = activeDayTotal - activeDayDone;
        statGoals.textContent = `${activeTasks} Active`;

        // Calculate overall plan progress
        let overallTotal = 0;
        let overallDone = 0;

        currentPlan.daily_plan.forEach((day, dIdx) => {
            if (day.tasks) {
                day.tasks.forEach((_, tIdx) => {
                    overallTotal++;
                    const taskId = `task-${dIdx}-${tIdx}`;
                    if (checkedTasks.includes(taskId)) {
                        overallDone++;
                    }
                });
            }
        });

        const overallPercent = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;
        
        // Update Milestone Timeline
        timelineFill.style.width = `${overallPercent}%`;

        const milestones = [
            { id: "ms-1", thresh: 25, label: "1" },
            { id: "ms-2", thresh: 50, label: "2" },
            { id: "ms-3", thresh: 75, label: "3" },
            { id: "ms-4", thresh: 100, label: "4" }
        ];

        milestones.forEach(ms => {
            const el = document.getElementById(ms.id);
            if (el) {
                if (overallPercent >= ms.thresh) {
                    el.classList.add("done");
                    el.textContent = "✓";
                } else {
                    el.classList.remove("done");
                    el.textContent = ms.label;
                }
            }
        });
    }

    function renderWeakAreas(weakStr) {
        weakAreasList.innerHTML = "";
        if (!weakStr || !weakStr.trim()) {
            weakAreasList.innerHTML = '<span class="sp-weak-pill" style="font-style: italic; color: var(--muted); font-size: 11px;">No weak areas added yet.</span>';
            return;
        }

        const list = weakStr.split(',').map(s => s.trim()).filter(Boolean);
        const dots = ["sp-dot-high", "sp-dot-med", "sp-dot-low"];

        list.forEach((area, index) => {
            const pill = document.createElement("span");
            pill.className = "sp-weak-pill";
            const dotClass = dots[index % dots.length];
            pill.innerHTML = `<span class="sp-weak-dot ${dotClass}"></span>${area}`;
            weakAreasList.appendChild(pill);
        });
    }

    function renderChecklist() {
        dailyTasks.innerHTML = "";
        if (!currentPlan || !currentPlan.daily_plan) return;

        const dayData = currentPlan.daily_plan[activeDayIndex];
        if (!dayData || !dayData.tasks || dayData.tasks.length === 0) {
            dailyTasks.innerHTML = '<p class="sp-empty-desc">No tasks scheduled for this day.</p>';
            return;
        }

        const weakStr = weakInput.value;
        const companyStr = companyInput.value;

        dayData.tasks.forEach((task, tIdx) => {
            const taskId = `task-${activeDayIndex}-${tIdx}`;
            const tag = getTaskTag(task, weakStr, companyStr);
            const isChecked = checkedTasks.includes(taskId);

            const div = document.createElement("div");
            div.className = `sp-checklist-item ${isChecked ? 'done' : ''}`;
            div.innerHTML = `
                <input type="checkbox" id="${taskId}" ${isChecked ? 'checked' : ''}>
                <span class="t">${task}</span>
                <span class="tag ${tag.class}">${tag.label}</span>
            `;

            const cb = div.querySelector("input");
            cb.addEventListener("change", () => {
                if (cb.checked) {
                    if (!checkedTasks.includes(taskId)) {
                        checkedTasks.push(taskId);
                    }
                    div.classList.add("done");
                } else {
                    checkedTasks = checkedTasks.filter(id => id !== taskId);
                    div.classList.remove("done");
                }
                localStorage.setItem("study_planner_checked_tasks", JSON.stringify(checkedTasks));
                updateProgress();
            });

            dailyTasks.appendChild(div);
        });
    }

    function renderPlan() {
        if (!currentPlan) return;

        const examDate = dateInput.value;
        const subjects = subjectsInput.value.trim();
        const dailyHours = hoursInput.value;
        const company = companyInput.value.trim();

        // Stats updates — show actual plan hours for the active day
        const activeDay = currentPlan.daily_plan[activeDayIndex];
        const dayHours = activeDay && activeDay.hours ? parseFloat(activeDay.hours) : parseFloat(dailyHours);
        statHours.textContent = `${dayHours} Hrs`;

        // Countdown text
        const daysLeft = calculateCountdown(examDate);
        countdownVal.textContent = daysLeft;
        
        let totalPlanHours = 0;
        if (currentPlan.daily_plan) {
            currentPlan.daily_plan.forEach(day => {
                totalPlanHours += parseFloat(day.hours || 0);
            });
        }
        countdownTxt.textContent = `days until exam — plan covers ${totalPlanHours.toFixed(1)} study hours across ${currentPlan.daily_plan ? currentPlan.daily_plan.length : 0} days`;

        // Milestone 3 company prep label
        const ms3Label = document.getElementById("ms-3-label");
        if (ms3Label) {
            ms3Label.textContent = company ? `${company} Prep` : "Company Prep";
        }

        // Render weak areas pills
        renderWeakAreas(weakInput.value);

        // Render Day Tabs
        const dayTabs = document.getElementById("plan-day-tabs");
        dayTabs.innerHTML = "";

        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const startDate = new Date(); // Start tab dates from today

        if (currentPlan.daily_plan) {
            currentPlan.daily_plan.forEach((day, index) => {
                const dateForDay = new Date(startDate);
                dateForDay.setDate(startDate.getDate() + index);
                const dayName = daysOfWeek[dateForDay.getDay()];
                const dayNum = dateForDay.getDate();

                const tab = document.createElement("div");
                tab.className = `sp-day-tab ${index === activeDayIndex ? 'active' : ''}`;
                tab.dataset.day = index;
                tab.innerHTML = `${dayName}<br><span class="d">${dayNum}</span>`;

                tab.addEventListener("click", () => {
                    document.querySelectorAll("#plan-day-tabs .sp-day-tab").forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    activeDayIndex = parseInt(tab.dataset.day);
                    renderChecklist();
                    updateProgress();
                });

                dayTabs.appendChild(tab);
            });
        }

        // Render Weekly Goals
        weeklyGoals.innerHTML = "";
        if (currentPlan.weekly_goals && currentPlan.weekly_goals.length > 0) {
            currentPlan.weekly_goals.forEach(goal => {
                const li = document.createElement("li");
                li.textContent = goal;
                weeklyGoals.appendChild(li);
            });
            weeklyGoalsPanel.classList.remove("sp-hidden");
        } else {
            weeklyGoalsPanel.classList.add("sp-hidden");
        }

        // Render Insights & Motivation
        tipsList.innerHTML = "";
        if (currentPlan.study_tips && currentPlan.study_tips.length > 0) {
            currentPlan.study_tips.forEach(tip => {
                const li = document.createElement("li");
                li.textContent = tip;
                tipsList.appendChild(li);
            });
            insightsPanel.classList.remove("sp-hidden");
        } else {
            insightsPanel.classList.add("sp-hidden");
        }

        if (currentPlan.motivational_message) {
            motivationQuote.textContent = `"${currentPlan.motivational_message}"`;
            motivationQuote.style.display = "block";
        } else {
            motivationQuote.style.display = "none";
        }

        // Render initial checklist and progress
        renderChecklist();
        updateProgress();

        introScreen.classList.add("sp-hidden");
        activeScreen.classList.remove("sp-hidden");
    }

    async function loadStudyPlan() {
        const examDate = dateInput.value;
        const subjects = subjectsInput.value.trim();
        const dailyHours = parseFloat(hoursInput.value);
        const weakSubjects = weakInput.value.trim();
        const company = companyInput.value.trim();

        if (!examDate || !subjects || isNaN(dailyHours) || !weakSubjects) {
            alert("Please fill in all required planner parameters.");
            return;
        }

        generateBtn.disabled = true;
        loader.classList.remove("sp-hidden");
        introScreen.classList.add("sp-hidden");
        activeScreen.classList.add("sp-hidden");

        try {
            const response = await fetch('/study-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_date: examDate,
                    subjects,
                    daily_hours: dailyHours,
                    weak_subjects: weakSubjects,
                    target_company: company || null
                })
            });

            if (!response.ok) {
                let errText = "Study plan could not be created.";
                try {
                    const errData = await response.json();
                    errText = errData.detail || errText;
                } catch (e) {}
                throw new Error(errText);
            }

            const data = await response.json();
            
            // Save to state and storage
            currentPlan = data;
            checkedTasks = [];
            activeDayIndex = 0;
            
            localStorage.setItem("study_planner_plan", JSON.stringify(currentPlan));
            localStorage.setItem("study_planner_checked_tasks", JSON.stringify(checkedTasks));
            
            // Save inputs as well
            localStorage.setItem("study_planner_date", examDate);
            localStorage.setItem("study_planner_subjects", subjects);
            localStorage.setItem("study_planner_hours", dailyHours);
            localStorage.setItem("study_planner_company", company);
            localStorage.setItem("study_planner_weak", weakSubjects);

            renderPlan();

        } catch (error) {
            console.error(error);
            alert(error.message);
            introScreen.classList.remove("sp-hidden");
        } finally {
            generateBtn.disabled = false;
            loader.classList.add("sp-hidden");
        }
    }

    function syncThemeToggle() {
        if (!themeToggle) return;
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        themeToggle.querySelectorAll('button').forEach(btn => {
            if (btn.dataset.mode === currentTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function init() {
        dateInput = document.getElementById('plan-date-input');
        subjectsInput = document.getElementById('plan-subjects-input');
        hoursInput = document.getElementById('plan-hours-input');
        companyInput = document.getElementById('plan-company-input');
        weakInput = document.getElementById('plan-weak-input');
        generateBtn = document.getElementById('plan-generate-btn');

        loader = document.getElementById('plan-loader');
        introScreen = document.getElementById('plan-intro-screen');
        activeScreen = document.getElementById('plan-active-screen');

        dashTitle = document.getElementById('plan-dash-title');
        dashMeta = document.getElementById('plan-dash-meta');
        
        progressBar = document.getElementById('plan-progress-fill');
        progressTxt = document.getElementById('plan-progress-txt');

        dailyTasks = document.getElementById('plan-daily-tasks');
        weeklyGoals = document.getElementById('plan-weekly-goals');
        weeklyGoalsPanel = document.getElementById('plan-weekly-goals-panel');
        
        tipsList = document.getElementById('plan-tips-list');
        motivationQuote = document.getElementById('plan-motivation-quote');
        insightsPanel = document.getElementById('plan-insights-panel');

        countdownVal = document.getElementById('plan-countdown-val');
        countdownTxt = document.getElementById('plan-countdown-txt');
        timelineFill = document.getElementById('plan-timeline-fill');

        statHours = document.getElementById('plan-stat-hours');
        statGoals = document.getElementById('plan-stat-goals');
        statStreak = document.getElementById('plan-stat-streak');
        statProgress = document.getElementById('plan-stat-progress');

        weakAreasList = document.getElementById('plan-weak-areas-list');
        themeToggle = document.getElementById('themeToggle');

        if (generateBtn) {
            generateBtn.addEventListener('click', loadStudyPlan);
        }

        // Set default minimum date to today
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
        }

        // Theme Toggle events mapping to global theme toggle
        if (themeToggle) {
            themeToggle.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    themeToggle.querySelectorAll('button').forEach(x => x.classList.remove('active'));
                    btn.classList.add('active');
                    if (typeof setTheme === 'function') {
                        setTheme(btn.dataset.mode);
                    } else {
                        document.documentElement.setAttribute('data-theme', btn.dataset.mode);
                        localStorage.setItem('placement-prep-theme', btn.dataset.mode);
                    }
                });
            });
            syncThemeToggle();
            window.addEventListener('themeChanged', syncThemeToggle);
        }

        // Listen for user changes in the weak areas input to preview pills immediately
        if (weakInput) {
            weakInput.addEventListener('input', () => {
                renderWeakAreas(weakInput.value);
            });
        }

        // Load values from LocalStorage if they exist
        const savedDate = localStorage.getItem("study_planner_date");
        const savedSubjects = localStorage.getItem("study_planner_subjects");
        const savedHours = localStorage.getItem("study_planner_hours");
        const savedCompany = localStorage.getItem("study_planner_company");
        const savedWeak = localStorage.getItem("study_planner_weak");

        if (savedDate) dateInput.value = savedDate;
        if (savedSubjects) subjectsInput.value = savedSubjects;
        if (savedHours) hoursInput.value = savedHours;
        if (savedCompany) companyInput.value = savedCompany;
        if (savedWeak) {
            weakInput.value = savedWeak;
            renderWeakAreas(savedWeak);
        }

        // Compute real study streak from activity log
        computeAndDisplayStreak();

        // Restore Plan state
        const savedPlan = localStorage.getItem("study_planner_plan");
        const savedChecked = localStorage.getItem("study_planner_checked_tasks");

        if (savedPlan) {
            try {
                currentPlan = JSON.parse(savedPlan);
                if (savedChecked) {
                    checkedTasks = JSON.parse(savedChecked);
                }
                renderPlan();
            } catch(e) {
                console.error("Error restoring study plan", e);
            }
        }
    }

    return { init };
})();
