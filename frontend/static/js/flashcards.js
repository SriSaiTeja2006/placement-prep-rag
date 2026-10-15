/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - FLASHCARDS SCRIPT
   ========================================================================== */

window.FlashcardsApp = (() => {
    let subjectInput, countSelect, generateBtn;
    let progressTxt, learnedCount, starredCount, shuffleBtn, reviewModeBtn;
    let loader, introScreen, activeScreen;
    let cardElement, frontText, backText, starBtn, checkBtn, prevBtn, nextBtn, cardIndicator;

    let originalDeck = [];
    let activeDeck = [];
    let currentIndex = 0;
    
    let starredCards = new Set();  // Set of card text or ids
    let learnedCards = new Set();  // Set of card text or ids
    let reviewMode = false;

    function renderCard() {
        if (activeDeck.length === 0) return;

        // Reset flip rotation
        cardElement.classList.remove('flipped');

        const card = activeDeck[currentIndex];
        frontText.textContent = card.front;
        backText.textContent = card.back;

        // Update progress bar
        const progressPercent = ((currentIndex + 1) / activeDeck.length) * 100;
        document.getElementById('fc-progress-bar').style.width = `${progressPercent}%`;

        // Update progress badges
        progressTxt.textContent = `${currentIndex + 1} / ${activeDeck.length}`;
        cardIndicator.textContent = `Card ${currentIndex + 1} of ${activeDeck.length}`;

        // Update star and check buttons
        const cardKey = card.front;
        if (starredCards.has(cardKey)) {
            starBtn.classList.add('starred');
        } else {
            starBtn.classList.remove('starred');
        }

        if (learnedCards.has(cardKey)) {
            checkBtn.classList.add('learned');
        } else {
            checkBtn.classList.remove('learned');
        }

        // Enable/disable navigation buttons
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === activeDeck.length - 1;
    }

    async function loadFlashcards() {
        const subject = subjectInput.value.trim();
        if (!subject) {
            alert("Please enter a subject or topic for the deck.");
            return;
        }

        generateBtn.disabled = true;
        loader.classList.remove('hidden');
        introScreen.classList.add('hidden');
        activeScreen.classList.add('hidden');
        reviewMode = false;
        reviewModeBtn.innerHTML = '<i data-lucide="star" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;"></i> Review Starred';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            const response = await fetch('/flashcards/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    num_cards: parseInt(countSelect.value)
                })
            });

            if (!response.ok) {
                let errText = "Flashcards unavailable.";
                try {
                    const errData = await response.json();
                    errText = errData.detail || errText;
                } catch (e) {}
                throw new Error(errText);
            }

            const data = await response.json();
            originalDeck = data.cards;
            activeDeck = [...originalDeck];

            if (activeDeck.length === 0) {
                throw new Error("No flashcards could be generated from your notes.");
            }

            currentIndex = 0;
            renderCard();

            // Enable control panel buttons
            shuffleBtn.disabled = false;
            reviewModeBtn.disabled = false;
            
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

    function toggleFlip() {
        cardElement.classList.toggle('flipped');
    }

    function toggleStar(e) {
        e.stopPropagation(); // Avoid flipping when clicking button
        if (activeDeck.length === 0) return;

        const card = activeDeck[currentIndex];
        const cardKey = card.front;

        if (starredCards.has(cardKey)) {
            starredCards.delete(cardKey);
            starBtn.classList.remove('starred');
        } else {
            starredCards.add(cardKey);
            starBtn.classList.add('starred');
        }

        starredCount.textContent = starredCards.size;
    }

    function toggleLearn(e) {
        e.stopPropagation(); // Avoid flipping when clicking button
        if (activeDeck.length === 0) return;

        const card = activeDeck[currentIndex];
        const cardKey = card.front;

        if (learnedCards.has(cardKey)) {
            learnedCards.delete(cardKey);
            checkBtn.classList.remove('learned');
        } else {
            learnedCards.add(cardKey);
            checkBtn.classList.add('learned');
        }

        learnedCount.textContent = learnedCards.size;
    }

    function shuffleDeck() {
        if (activeDeck.length <= 1) return;
        
        // Fisher-Yates Shuffle
        for (let i = activeDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [activeDeck[i], activeDeck[j]] = [activeDeck[j], activeDeck[i]];
        }
        
        currentIndex = 0;
        renderCard();
    }

    function toggleReviewMode() {
        if (reviewMode) {
            // Exit review mode
            activeDeck = [...originalDeck];
            reviewMode = false;
            reviewModeBtn.innerHTML = '<i data-lucide="star" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;"></i> Review Starred';
            reviewModeBtn.classList.remove('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            // Enter review mode: Filter only starred cards
            const starred = originalDeck.filter(card => starredCards.has(card.front));
            if (starred.length === 0) {
                alert("No starred cards to review! Star a card by clicking the ⭐ button first.");
                return;
            }
            activeDeck = starred;
            reviewMode = true;
            reviewModeBtn.innerHTML = '<i data-lucide="log-out" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;"></i> Exit Review';
            reviewModeBtn.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        currentIndex = 0;
        renderCard();
    }

    function init() {
        subjectInput = document.getElementById('fc-subject-input');
        countSelect = document.getElementById('fc-count');
        generateBtn = document.getElementById('fc-generate-btn');

        progressTxt = document.getElementById('fc-progress-txt');
        learnedCount = document.getElementById('fc-learned-count');
        starredCount = document.getElementById('fc-starred-count');
        shuffleBtn = document.getElementById('fc-shuffle-btn');
        reviewModeBtn = document.getElementById('fc-review-mode-btn');

        loader = document.getElementById('fc-loader');
        introScreen = document.getElementById('fc-intro-screen');
        activeScreen = document.getElementById('fc-active-screen');

        cardElement = document.getElementById('fc-card-element');
        frontText = document.getElementById('fc-front-text');
        backText = document.getElementById('fc-back-text');
        starBtn = document.getElementById('fc-star-btn');
        checkBtn = document.getElementById('fc-check-btn');
        prevBtn = document.getElementById('fc-prev-btn');
        nextBtn = document.getElementById('fc-next-btn');
        cardIndicator = document.getElementById('fc-card-indicator');

        // Event listeners
        if (generateBtn) {
            generateBtn.addEventListener('click', loadFlashcards);
        }

        if (cardElement) {
            cardElement.addEventListener('click', toggleFlip);
        }

        if (starBtn) {
            starBtn.addEventListener('click', toggleStar);
        }

        if (checkBtn) {
            checkBtn.addEventListener('click', toggleLearn);
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentIndex > 0) {
                    currentIndex--;
                    renderCard();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentIndex < activeDeck.length - 1) {
                    currentIndex++;
                    renderCard();
                }
            });
        }

        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', shuffleDeck);
        }

        if (reviewModeBtn) {
            reviewModeBtn.addEventListener('click', toggleReviewMode);
        }

        // Reset sidebar stats
        learnedCount.textContent = "0";
        starredCount.textContent = "0";
        starredCards.clear();
        learnedCards.clear();
    }

    return { init };
})();
