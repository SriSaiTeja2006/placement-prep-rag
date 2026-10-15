/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - QUIZ GENERATOR SCRIPT
   ========================================================================== */

window.QuizApp = (() => {
    let subjectInput, difficultySelect, countSelect, typeSelect, fileSelect, generateBtn;
    let timerVal, scoreVal, loader;
    let introScreen, activeScreen, resultsScreen;
    let qNum, qDiff, questionText, optionsList, textAnswerContainer, textInput, textSubmitBtn, feedbackCard, nextBtn;
    let resScore, resFeedback, historyTbody;

    let quizQuestions = [];
    let currentQIndex = 0;
    let currentScore = 0;
    let timerInterval = null;
    let quizStartTime = null;

    function formatTime(ms) {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const secs = (totalSecs % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function startTimer() {
        quizStartTime = Date.now();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - quizStartTime;
            timerVal.textContent = formatTime(elapsed);
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    async function loadNotesDropdown() {
        if (!fileSelect) return;
        try {
            const response = await fetch('/api/indexed-files?module=notes');
            if (response.ok) {
                const data = await response.json();
                fileSelect.innerHTML = '<option value="">All Indexed Notes (Search term required)</option>';
                if (data.files && data.files.length > 0) {
                    data.files.forEach(file => {
                        const opt = document.createElement('option');
                        opt.value = file;
                        opt.textContent = file;
                        fileSelect.appendChild(opt);
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching files for quiz dropdown:', error);
        }
    }

    async function loadQuiz() {
        const subject = subjectInput.value.trim();
        const filename = fileSelect ? fileSelect.value : "";
        if (!subject && !filename) {
            alert("Please enter a subject topic OR select a notes file to generate the quiz.");
            return;
        }

        generateBtn.disabled = true;
        loader.classList.remove('hidden');
        introScreen.classList.add('hidden');
        activeScreen.classList.add('hidden');
        resultsScreen.classList.add('hidden');
        stopTimer();

        try {
            const response = await fetch('/quiz/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject || null,
                    difficulty: difficultySelect.value,
                    num_questions: parseInt(countSelect.value),
                    quiz_type: typeSelect.value,
                    filename: filename || null
                })
            });

            if (!response.ok) {
                let errText = "Quiz could not be generated.";
                try {
                    const errData = await response.json();
                    errText = errData.detail || errText;
                } catch (e) {}
                throw new Error(errText);
            }

            const data = await response.json();
            quizQuestions = data.questions;
            
            if (!quizQuestions || quizQuestions.length === 0) {
                throw new Error("No quiz questions were returned by the assistant.");
            }

            // Start quiz state
            currentQIndex = 0;
            currentScore = 0;
            scoreVal.textContent = `0 / ${quizQuestions.length}`;
            
            startTimer();
            renderQuestion();
            
            activeScreen.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            alert(error.message);
            introScreen.classList.remove('hidden');
        } finally {
            generateBtn.disabled = false;
            loader.classList.add('hidden');
        }
    }

    function renderQuestion() {
        const q = quizQuestions[currentQIndex];
        qNum.textContent = `Question ${currentQIndex + 1} of ${quizQuestions.length}`;
        qDiff.textContent = difficultySelect.value;
        questionText.textContent = q.question;

        // Reset feedback and next button
        feedbackCard.classList.add('hidden');
        nextBtn.classList.add('hidden');

        // Update progress bar
        const progressPercent = (currentQIndex / quizQuestions.length) * 100;
        document.getElementById('quiz-progress-bar').style.width = `${progressPercent}%`;

        // Check if question style has choices
        if (q.options && q.options.length > 0) {
            optionsList.classList.remove('hidden');
            textAnswerContainer.classList.add('hidden');
            optionsList.innerHTML = "";

            q.options.forEach((opt, idx) => {
                const optLetter = String.fromCharCode(65 + idx); // A, B, C, D
                const btn = document.createElement('button');
                btn.className = "quiz-option-btn";
                btn.innerHTML = `
                    <span class="option-letter-circle">${optLetter}</span>
                    <span>${opt}</span>
                `;
                btn.addEventListener('click', () => submitOptionAnswer(btn, opt));
                optionsList.appendChild(btn);
            });
        } else {
            // Text answer input for fill-blanks / short answer
            optionsList.classList.add('hidden');
            textAnswerContainer.classList.remove('hidden');
            textInput.value = "";
            textInput.disabled = false;
            textSubmitBtn.disabled = false;
        }
    }

    function submitOptionAnswer(selectedBtn, selectedText) {
        const q = quizQuestions[currentQIndex];
        const optionButtons = optionsList.querySelectorAll('.quiz-option-btn');
        
        // Disable all option buttons
        optionButtons.forEach(btn => btn.disabled = true);

        const isCorrect = selectedText.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
        
        if (isCorrect) {
            selectedBtn.classList.add('selected-correct');
            currentScore++;
            scoreVal.textContent = `${currentScore} / ${quizQuestions.length}`;
            showFeedback(true, q.explanation);
        } else {
            selectedBtn.classList.add('selected-incorrect');
            // Find and highlight correct answer
            optionButtons.forEach(btn => {
                const textSpan = btn.querySelector('span:last-child');
                if (textSpan && textSpan.textContent.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
                    btn.classList.add('correct-reveal');
                }
            });
            showFeedback(false, q.explanation, q.correct_answer);
        }
        
        nextBtn.classList.remove('hidden');
    }

    function submitTextAnswer() {
        const q = quizQuestions[currentQIndex];
        const ans = textInput.value.trim();
        if (!ans) return;

        textInput.disabled = true;
        textSubmitBtn.disabled = true;

        const isCorrect = ans.toLowerCase() === q.correct_answer.toLowerCase() || 
                          q.correct_answer.toLowerCase().includes(ans.toLowerCase()) && ans.length > 2;

        if (isCorrect) {
            currentScore++;
            scoreVal.textContent = `${currentScore} / ${quizQuestions.length}`;
            showFeedback(true, q.explanation);
        } else {
            showFeedback(false, q.explanation, q.correct_answer);
        }

        nextBtn.classList.remove('hidden');
    }

    function showFeedback(isCorrect, explanation, correctAnswer) {
        feedbackCard.className = `quiz-feedback-box ${isCorrect ? 'correct' : 'incorrect'}`;
        const titleEl = document.getElementById('quiz-feedback-title');
        titleEl.innerHTML = isCorrect ? 
            '<i data-lucide="check-circle" style="width: 18px; height: 18px; color: var(--success-green); vertical-align: middle; margin-right: 6px;"></i> Correct!' : 
            '<i data-lucide="x-circle" style="width: 18px; height: 18px; color: var(--danger-rose); vertical-align: middle; margin-right: 6px;"></i> Incorrect';
        
        let text = explanation;
        if (!isCorrect && correctAnswer) {
            text = `Correct Answer: <strong>${correctAnswer}</strong><br><br>${explanation}`;
        }
        document.getElementById('quiz-feedback-text').innerHTML = text;
        feedbackCard.classList.remove('hidden');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function showResults() {
        stopTimer();
        activeScreen.classList.add('hidden');
        resultsScreen.classList.remove('hidden');

        // Update progress bar to 100%
        document.getElementById('quiz-progress-bar').style.width = '100%';

        resScore.textContent = `Score: ${currentScore} / ${quizQuestions.length}`;
        
        const percent = (currentScore / quizQuestions.length) * 100;
        let iconName = "trophy";
        let feedback = "Incredible job! You have fully mastered this topic.";

        if (percent < 50) {
            iconName = "book-open";
            feedback = "Keep studying! Try reviewing the lecture notes and attempt again.";
        } else if (percent < 80) {
            iconName = "thumbs-up";
            feedback = "Good effort! A few concepts still need practice, but you are getting there.";
        }

        document.getElementById('quiz-res-icon').innerHTML = `<i data-lucide="${iconName}" style="width: 48px; height: 48px;"></i>`;
        resFeedback.textContent = feedback;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Log result to history
        const quizLog = {
            subject: subjectInput.value.trim(),
            difficulty: difficultySelect.value,
            score: `${currentScore} / ${quizQuestions.length}`,
            correct: currentScore,
            wrong: quizQuestions.length - currentScore
        };
        saveToHistory({
            subject: quizLog.subject,
            difficulty: quizLog.difficulty,
            score: quizLog.score,
            date: new Date().toLocaleDateString()
        });
        renderHistory();

        // Submit log to backend
        fetch('/api/analytics/log-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quizLog)
        }).catch(e => console.error("Error logging quiz to backend:", e));
    }

    function saveToHistory(entry) {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('quiz_history') || '[]');
        } catch (e) {}
        
        history.unshift(entry); // Add to front
        // Limit to top 10 items
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem('quiz_history', JSON.stringify(history));
    }

    function renderHistory() {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('quiz_history') || '[]');
        } catch (e) {}

        historyTbody.innerHTML = "";
        if (history.length === 0) {
            historyTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;" class="empty-list-msg">No previous quiz attempts found.</td></tr>';
            return;
        }

        history.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.subject}</strong></td>
                <td style="text-transform: uppercase;">${item.difficulty}</td>
                <td>${item.score}</td>
                <td>${item.date}</td>
            `;
            historyTbody.appendChild(tr);
        });
    }

    function init() {
        subjectInput = document.getElementById('quiz-subject-input');
        difficultySelect = document.getElementById('quiz-difficulty');
        countSelect = document.getElementById('quiz-count');
        typeSelect = document.getElementById('quiz-type');
        fileSelect = document.getElementById('quiz-file-select');
        generateBtn = document.getElementById('quiz-generate-btn');
        
        timerVal = document.getElementById('quiz-timer');
        scoreVal = document.getElementById('quiz-score-val');
        loader = document.getElementById('quiz-loader');

        introScreen = document.getElementById('quiz-intro-screen');
        activeScreen = document.getElementById('quiz-active-screen');
        resultsScreen = document.getElementById('quiz-results-screen');

        qNum = document.getElementById('quiz-q-num');
        qDiff = document.getElementById('quiz-q-diff');
        questionText = document.getElementById('quiz-question-text');
        optionsList = document.getElementById('quiz-options-list');
        textAnswerContainer = document.getElementById('quiz-text-answer-container');
        textInput = document.getElementById('quiz-text-input');
        textSubmitBtn = document.getElementById('quiz-text-submit-btn');
        feedbackCard = document.getElementById('quiz-feedback-card');
        nextBtn = document.getElementById('quiz-next-btn');

        resScore = document.getElementById('quiz-res-score');
        resFeedback = document.getElementById('quiz-res-feedback');
        historyTbody = document.getElementById('quiz-history-tbody');

        if (generateBtn) {
            generateBtn.addEventListener('click', loadQuiz);
        }

        if (textSubmitBtn) {
            textSubmitBtn.addEventListener('click', submitTextAnswer);
        }

        if (textInput) {
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !textInput.disabled && textInput.value.trim()) {
                    e.preventDefault();
                    submitTextAnswer();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentQIndex++;
                if (currentQIndex < quizQuestions.length) {
                    renderQuestion();
                } else {
                    showResults();
                }
            });
        }

        renderHistory();
        loadNotesDropdown();
    }

    return { init };
})();
