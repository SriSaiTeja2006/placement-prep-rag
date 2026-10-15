/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - PROGRESS DASHBOARD SCRIPT
   ========================================================================== */

window.ProgressDashboardApp = (() => {
    let topicsVal, quizzesVal, cardsVal, streakVal;
    let subjectList, strongList, weakList;

    async function loadProgress() {
        let quizCount = 0;
        let cardCount = 0;
        let streak = 0;
        
        let subjectScores = {}; // topic -> list of percentages

        // 1. Read localStorage metrics
        try {
            const quizHistory = JSON.parse(localStorage.getItem('quiz_history') || '[]');
            quizCount = quizHistory.length;
            
            quizHistory.forEach(q => {
                // Parse score e.g., "4 / 5"
                const parts = q.score.split('/');
                if (parts.length === 2) {
                    const got = parseFloat(parts[0]);
                    const total = parseFloat(parts[1]);
                    if (total > 0) {
                        const pct = (got / total) * 100;
                        if (!subjectScores[q.subject]) {
                            subjectScores[q.subject] = [];
                        }
                        subjectScores[q.subject].push(pct);
                    }
                }
            });

            // Read starred flashcards count
            const starredCount = parseInt(localStorage.getItem('starred_flashcards_count') || '0');
            cardCount = starredCount;

            streak = Math.min(quizHistory.length, 5);

        } catch (e) {
            console.error("Error reading progress metrics:", e);
        }

        // Set widgets
        quizzesVal.textContent = `${quizCount} Played`;
        cardsVal.textContent = `${cardCount} Starred`;
        streakVal.textContent = `${streak} Days`;

        // 2. Fetch Topics count
        try {
            const response = await fetch('/api/indexed-files?module=notes');
            if (response.ok) {
                const data = await response.json();
                topicsVal.textContent = `${data.files.length} Files`;
            }
        } catch (e) {
            console.error(e);
        }

        // 3. Render Subject Progress Bars & Lists
        renderSubjectAnalytics(subjectScores);
    }

    function renderSubjectAnalytics(subjectScores) {
        subjectList.innerHTML = "";
        strongList.innerHTML = "";
        weakList.innerHTML = "";

        const defaultSubjects = ["Operating Systems", "DBMS", "Computer Networks", "OOP Concepts"];
        let finalSubjects = {};

        // Merge default and user quiz subjects
        defaultSubjects.forEach(s => {
            finalSubjects[s] = 70.0; // Default baseline prep level
        });

        Object.keys(subjectScores).forEach(sub => {
            const list = subjectScores[sub];
            const avg = list.reduce((a, b) => a + b, 0) / list.length;
            finalSubjects[sub] = avg;
        });

        // Render progress bars
        Object.keys(finalSubjects).forEach(sub => {
            const score = finalSubjects[sub];
            const div = document.createElement('div');
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                    <span style="font-weight: 500;">${sub}</span>
                    <span style="font-weight: 600; color: var(--accent-purple);">${Math.round(score)}%</span>
                </div>
                <div class="progress-bar-wrapper" style="height: 6px;">
                    <div class="progress-bar" style="width: ${score}%; background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));"></div>
                </div>
            `;
            subjectList.appendChild(div);

            // Classify into strong or weak lists
            const li = document.createElement('li');
            li.textContent = sub;
            if (score >= 80) {
                strongList.appendChild(li);
            } else if (score < 60) {
                weakList.appendChild(li);
            }
        });

        // Empty fallbacks
        if (strongList.innerHTML === "") {
            strongList.innerHTML = '<li class="empty-list-msg">Complete quizzes with >80% score to list strong areas.</li>';
        }
        if (weakList.innerHTML === "") {
            weakList.innerHTML = '<li class="empty-list-msg">All topics meet average readiness levels.</li>';
        }
    }

    function init() {
        topicsVal = document.getElementById('prog-topics-val');
        quizzesVal = document.getElementById('prog-quizzes-val');
        cardsVal = document.getElementById('prog-cards-val');
        streakVal = document.getElementById('prog-streak-val');
        
        subjectList = document.getElementById('prog-subject-list');
        strongList = document.getElementById('prog-strong-list');
        weakList = document.getElementById('prog-weak-list');

        loadProgress();
    }

    return { init };
})();
