/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - AI ANALYTICS DASHBOARD SCRIPT
   ========================================================================== */

window.AnalyticsApp = (() => {
    let loader, emptyState, activeScreen, demoDataBtn;
    let cardDocs, cardNotes, cardQuestions, cardQuizAcc, cardResumeSkills, cardStreak, cardHours, cardReadiness;
    let insightsList, subjectTbody, exportCsvBtn, exportPdfBtn;

    let ringChart = null;
    let activityChart = null;
    let subjectChart = null;
    let uploadChart = null;

    let cachedData = null;

    async function loadDashboardData() {
        loader.classList.remove('hidden');
        emptyState.classList.add('hidden');
        activeScreen.classList.add('hidden');

        try {
            const response = await fetch('/api/analytics');
            if (!response.ok) throw new Error("Failed to load analytics data.");

            const data = await response.json();
            cachedData = data;

            if (!data.has_data) {
                emptyState.classList.remove('hidden');
                loader.classList.add('hidden');
                return;
            }

            renderDashboard(data);

        } catch (error) {
            console.error(error);
            emptyState.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    }

    function renderDashboard(data) {
        emptyState.classList.add('hidden');
        activeScreen.classList.remove('hidden');

        // Enable exports
        exportCsvBtn.disabled = false;
        exportPdfBtn.disabled = false;

        // 1. Set Stat Cards
        cardDocs.textContent = `${data.uploads.total_study_materials} Files`;
        cardNotes.textContent = `${data.notes_index.total_chunks} Chunks`;
        cardQuestions.textContent = `${data.ai_usage.questions_asked} Ask`;
        cardQuizAcc.textContent = `${data.quiz_analytics.accuracy_percent}%`;
        cardResumeSkills.textContent = `${data.resume_analytics.skills_detected.length} Skills`;
        cardStreak.textContent = `${data.streaks.current_streak} Days`;
        
        const totalHrs = (data.study_time.weekly_minutes / 60.0);
        cardHours.textContent = `${totalHrs.toFixed(1)} Hrs`;
        
        const rScore = data.placement_readiness.score;
        cardReadiness.textContent = `${rScore}%`;

        // 2. Set AI Insights
        insightsList.innerHTML = "";
        data.ai_insights.forEach(insight => {
            const li = document.createElement('li');
            li.textContent = insight;
            insightsList.appendChild(li);
        });

        // 3. Set Subject Mastery Table
        subjectTbody.innerHTML = "";
        Object.keys(data.subject_performance).forEach(sub => {
            const perf = data.subject_performance[sub];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${sub}</strong></td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>${perf.progress}%</span>
                        <div class="progress-bar-wrapper" style="width:60px; height:4px; margin-bottom:0;">
                            <div class="progress-bar" style="width: ${perf.progress}%; background:var(--accent-purple);"></div>
                        </div>
                    </div>
                </td>
                <td style="color:#4ade80; font-weight:600;">${perf.accuracy}%</td>
                <td>${perf.time_spent} hrs</td>
                <td>
                    <span class="difficulty-badge" style="background:${perf.mastery_level === 'Expert' ? 'rgba(34,197,94,0.15)' : 'rgba(168,85,247,0.15)'}; color:${perf.mastery_level === 'Expert' ? '#4ade80' : 'var(--accent-purple)'}; border:none;">
                        ${perf.mastery_level}
                    </span>
                </td>
            `;
            subjectTbody.appendChild(tr);
        });

        // 4. Render Charts
        renderCharts(data);
    }

    function renderCharts(data) {
        // Destroy existing instances if they exist
        if (ringChart) ringChart.destroy();
        if (activityChart) activityChart.destroy();
        if (subjectChart) subjectChart.destroy();
        if (uploadChart) uploadChart.destroy();

        const pScore = data.placement_readiness.score;
        const pLevel = data.placement_readiness.level;

        document.getElementById('ring-score-txt').textContent = `${pScore}%`;
        document.getElementById('ring-level-txt').textContent = pLevel;
        document.getElementById('ring-level-txt').style.color = pLevel === 'Excellent' ? '#4ade80' : 'var(--accent-purple)';

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)';
        const tickColor = isDark ? '#A1A1AA' : '#64748B';
        const textRingBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)';

        // Ring Chart (Doughnut)
        const ctxRing = document.getElementById('chart-readiness-ring').getContext('2d');
        ringChart = new Chart(ctxRing, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [pScore, 100 - pScore],
                    backgroundColor: [
                        '#2563eb', // Accent primary blue
                        textRingBg
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '80%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });

        // Activity Line Chart (Weekly Activity)
        const ctxActivity = document.getElementById('chart-activity-logs').getContext('2d');
        const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        activityChart = new Chart(ctxActivity, {
            type: 'line',
            data: {
                labels: weekdays,
                datasets: [{
                    label: 'Study Hours',
                    data: data.streaks.weekly_activity,
                    borderColor: '#3b82f6', // Blue
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.12)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: tickColor } },
                    y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true }
                }
            }
        });

        // Subject Bar Chart
        const ctxSubject = document.getElementById('chart-subject-comparison').getContext('2d');
        const subjects = Object.keys(data.subject_performance);
        const accuracyData = subjects.map(s => data.subject_performance[s].accuracy);
        
        subjectChart = new Chart(ctxSubject, {
            type: 'bar',
            data: {
                labels: subjects,
                datasets: [{
                    data: accuracyData,
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(37, 99, 235, 0.65)',
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: tickColor } },
                    y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true, max: 100 }
                }
            }
        });

        // Uploads breakdown Pie/Doughnut
        const ctxUploads = document.getElementById('chart-upload-breakdown').getContext('2d');
        const up = data.uploads;
        uploadChart = new Chart(ctxUploads, {
            type: 'doughnut',
            data: {
                labels: ['PDFs', 'TXTs', 'DOCXs'],
                datasets: [{
                    data: [up.pdfs, up.txts, up.docxs],
                    backgroundColor: ['#8b5cf6', '#3b82f6', '#06b6d4'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: tickColor, font: { size: 11 } }
                    }
                }
            }
        });

        // Listen for window theme changes to dynamically redraw charts
        window.removeEventListener('themeChanged', handleThemeChange);
        window.addEventListener('themeChanged', handleThemeChange);
        
        function handleThemeChange(e) {
            const nextTheme = e.detail.theme;
            const dark = nextTheme === 'dark';
            const grid = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)';
            const tick = dark ? '#A1A1AA' : '#64748B';
            const ringBg = dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)';
            
            if (ringChart) {
                ringChart.data.datasets[0].backgroundColor[1] = ringBg;
                ringChart.update();
            }
            if (activityChart) {
                activityChart.options.scales.x.grid.color = grid;
                activityChart.options.scales.x.ticks.color = tick;
                activityChart.options.scales.y.grid.color = grid;
                activityChart.options.scales.y.ticks.color = tick;
                activityChart.update();
            }
            if (subjectChart) {
                subjectChart.options.scales.y.grid.color = grid;
                subjectChart.options.scales.x.ticks.color = tick;
                subjectChart.options.scales.y.ticks.color = tick;
                subjectChart.update();
            }
            if (uploadChart) {
                uploadChart.options.plugins.legend.labels.color = tick;
                uploadChart.update();
            }
        }
    }

    function loadDemoData() {
        const demoData = {
            has_data: true,
            uploads: { pdfs: 4, txts: 2, docxs: 1, total_study_materials: 7 },
            notes_index: { total_notes: 5, total_chunks: 142, avg_chunks_per_file: 28.4 },
            ai_usage: { questions_asked: 36, tutor_sessions: 12, notes_qa_sessions: 14, interview_questions: 6, assignment_requests: 4 },
            quiz_analytics: { attempted: 6, average_score: 4.2, accuracy_percent: 84.0, correct_answers: 25, wrong_answers: 5, best_subject: "DSA", weak_subject: "OS" },
            resume_analytics: {
                skills_detected: ["Python", "SQL", "React", "NodeJS", "Machine Learning"],
                projects_detected: ["Portfolio Web App", "AI Chat Bot Portfolio"],
                technologies_detected: ["Python", "SQL", "React", "NodeJS"],
                strength_score: 75,
                missing_skills: ["docker", "git"],
                recommended_skills: ["Docker", "Git"]
            },
            streaks: {
                current_streak: 4,
                longest_streak: 7,
                days_active: 8,
                weekly_activity: [1.2, 2.5, 0.0, 1.8, 2.0, 0.5, 1.0],
                monthly_activity: Array.from({length: 30}, () => +(Math.random() * 3).toFixed(1))
            },
            learning: {
                topics_studied: 5,
                topics_mastered: 3,
                topics_remaining: 4,
                most_asked_topic: "DBMS Joins",
                least_studied_topic: "Networking Layers",
                weak_topics: ["Operating Systems"],
                strong_topics: ["DSA", "DBMS"]
            },
            subject_performance: {
                "OS": { progress: 65, accuracy: 58, time_spent: 2.5, mastery_level: "Beginner" },
                "DBMS": { progress: 85, accuracy: 82, time_spent: 4.0, mastery_level: "Intermediate" },
                "CN": { progress: 50, accuracy: 70, time_spent: 1.5, mastery_level: "Intermediate" },
                "OOP": { progress: 90, accuracy: 88, time_spent: 3.5, mastery_level: "Expert" },
                "DSA": { progress: 95, accuracy: 92, time_spent: 6.0, mastery_level: "Expert" }
            },
            study_time: { today_minutes: 60, weekly_minutes: 540, monthly_minutes: 1800, avg_daily_minutes: 67.5 },
            placement_readiness: { score: 82, level: "Excellent" },
            ai_insights: [
                "Your Quiz accuracy in Operating Systems is currently below 60%. Study notes files before re-quizzing.",
                "Your resume profile lacks Docker. Focus on dockerizing projects to boost strength.",
                "Active Study streak has reached 4 days. Keep consistency high to retain system design keys.",
                "OOP Concepts preparation level is Expert (88%). Maintain revision milestones in planning dashboard."
            ]
        };

        cachedData = demoData;
        renderDashboard(demoData);
    }

    function exportCSV() {
        if (!cachedData) return;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Subject,Readiness %,Quiz Accuracy %,Time Spent (hrs),Mastery Level\r\n";

        Object.keys(cachedData.subject_performance).forEach(sub => {
            const perf = cachedData.subject_performance[sub];
            csvContent += `${sub},${perf.progress},${perf.accuracy},${perf.time_spent},${perf.mastery_level}\r\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "placement_prep_analytics.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportPDF() {
        // Native clean print report formatting
        window.print();
    }

    function init() {
        loader = document.getElementById('analytics-loader');
        emptyState = document.getElementById('analytics-empty-state');
        activeScreen = document.getElementById('analytics-active-screen');
        demoDataBtn = document.getElementById('analytics-demo-data-btn');

        cardDocs = document.getElementById('card-docs-uploaded');
        cardNotes = document.getElementById('card-notes-indexed');
        cardQuestions = document.getElementById('card-questions-asked');
        cardQuizAcc = document.getElementById('card-quiz-accuracy');
        cardResumeSkills = document.getElementById('card-resume-skills');
        cardStreak = document.getElementById('card-study-streak');
        cardHours = document.getElementById('card-study-hours');
        cardReadiness = document.getElementById('card-readiness-score');

        insightsList = document.getElementById('analytics-ai-insights-list');
        subjectTbody = document.getElementById('analytics-subject-tbody');
        exportCsvBtn = document.getElementById('analytics-export-csv');
        exportPdfBtn = document.getElementById('analytics-export-pdf');

        if (demoDataBtn) {
            demoDataBtn.addEventListener('click', loadDemoData);
        }

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', exportCSV);
        }

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', exportPDF);
        }

        loadDashboardData();
    }

    return { init };
})();
