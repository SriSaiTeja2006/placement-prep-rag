/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - INTERVIEW PREP SCRIPT (v2)
   ========================================================================== */

window.InterviewApp = (() => {
    // --- DOM References ---
    let companyInput, roleInput, roundInput, companyFilter;
    let pasteTextarea, pasteSubmitBtn;
    let researchSubmitBtn, researchPreview, researchTextarea, researchSaveBtn;
    let uploadDropzone, fileInput, uploadBtn;
    let uploadProgress, progressBar, progressText, alertMessage;
    let chatHistory, chatInput, sendBtn, clearChatBtn, mockBtn;
    let expList, expSummary, filesLoader;
    let flashcardEl, flashPrev, flashNext, flashCount, flashTotal;

    // --- State ---
    let isMockMode = false;
    let flashcards = [];
    let flashIdx = 0;
    let flashFlipped = false;
    let experiences = []; // { company, role, round_type, source, filename }

    // ===== Tab Switching =====
    function initTabs() {
        const tabs = document.querySelectorAll('#ip-tabs .ip-tab');
        tabs.forEach(t => t.addEventListener('click', () => {
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.ip-tabpanel').forEach(p => p.classList.add('ip-hidden'));
            const panelId = 'ip-panel-' + t.dataset.tab;
            const panel = document.getElementById(panelId);
            if (panel) panel.classList.remove('ip-hidden');
        }));
    }

    // ===== Alert Helper =====
    function showAlert(msg, type = 'success') {
        if (!alertMessage) return;
        alertMessage.textContent = msg;
        alertMessage.className = 'ip-alert ' + type;
        alertMessage.classList.remove('ip-hidden');
        setTimeout(() => alertMessage.classList.add('ip-hidden'), 6000);
    }

    function validateCompany() {
        const company = companyInput.value.trim();
        if (!company) {
            showAlert('Please enter a company name first.', 'error');
            companyInput.focus();
            return null;
        }
        return company;
    }

    // ===== Paste Text Submit =====
    async function handlePasteSubmit() {
        const company = validateCompany();
        if (!company) return;

        const text = pasteTextarea.value.trim();
        if (!text) {
            showAlert('Please describe the interview experience.', 'error');
            return;
        }

        const role = roleInput.value.trim() || 'General';
        const roundType = roundInput.value.trim() || 'General';

        pasteSubmitBtn.disabled = true;
        pasteSubmitBtn.textContent = 'Logging...';

        try {
            const response = await fetch('/interview/paste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company, role, round_type: roundType, text })
            });

            if (!response.ok) {
                let errMsg = 'Failed to log experience.';
                try { const e = await response.json(); errMsg = e.detail || errMsg; } catch (_) {}
                throw new Error(errMsg);
            }

            const result = await response.json();
            showAlert(`Logged! Indexed ${result.chunks_indexed} chunks for ${company}.`, 'success');
            pasteTextarea.value = '';
            loadIndexedExperiences();
        } catch (err) {
            showAlert(err.message, 'error');
        } finally {
            pasteSubmitBtn.disabled = false;
            pasteSubmitBtn.textContent = 'Log This Experience';
        }
    }

    // ===== Auto-Research =====
    async function handleResearchSubmit() {
        const company = validateCompany();
        if (!company) return;

        const role = roleInput.value.trim() || 'General';
        const roundType = roundInput.value.trim() || 'General';

        researchSubmitBtn.disabled = true;
        researchSubmitBtn.innerHTML = '<i data-lucide="loader-2" style="width:14px;height:14px;vertical-align:middle;margin-right:6px;animation:spin 1s linear infinite;"></i> Researching...';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            const response = await fetch('/interview/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company, role, round_type: roundType })
            });

            if (!response.ok) {
                let errMsg = 'Research failed.';
                try { const e = await response.json(); errMsg = e.detail || errMsg; } catch (_) {}
                throw new Error(errMsg);
            }

            const result = await response.json();
            researchTextarea.value = result.research_text;
            researchPreview.classList.remove('ip-hidden');
            showAlert('Research complete — review and edit before saving.', 'success');
        } catch (err) {
            showAlert(err.message, 'error');
        } finally {
            researchSubmitBtn.disabled = false;
            researchSubmitBtn.innerHTML = '<i data-lucide="search" style="width:14px;height:14px;vertical-align:middle;margin-right:6px;"></i> Research & Auto-Fill';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    async function handleResearchSave() {
        const company = validateCompany();
        if (!company) return;

        const text = researchTextarea.value.trim();
        if (!text) {
            showAlert('Nothing to save — research text is empty.', 'error');
            return;
        }

        const role = roleInput.value.trim() || 'General';
        const roundType = roundInput.value.trim() || 'General';

        researchSaveBtn.disabled = true;
        researchSaveBtn.textContent = 'Saving...';

        try {
            const response = await fetch('/interview/paste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company, role, round_type: roundType, text, source: 'research' })
            });

            if (!response.ok) throw new Error('Failed to save research.');

            const result = await response.json();
            showAlert(`Saved! Indexed ${result.chunks_indexed} chunks for ${company}.`, 'success');
            researchPreview.classList.add('ip-hidden');
            researchTextarea.value = '';
            loadIndexedExperiences();
        } catch (err) {
            showAlert(err.message, 'error');
        } finally {
            researchSaveBtn.disabled = false;
            researchSaveBtn.textContent = 'Save This Research';
        }
    }

    // ===== File Upload =====
    async function uploadFiles(files) {
        if (files.length === 0) return;
        const company = validateCompany();
        if (!company) return;

        uploadProgress.classList.remove('ip-hidden');
        alertMessage.classList.add('ip-hidden');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            progressBar.style.width = '0%';
            progressText.textContent = `Indexing [${i + 1}/${files.length}]: ${file.name} (0%)...`;

            try {
                await new Promise((resolve, reject) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('company', company);

                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/interview/upload', true);

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const pct = Math.round((e.loaded / e.total) * 100);
                            progressBar.style.width = pct + '%';
                            progressText.textContent = `Indexing [${i + 1}/${files.length}]: ${file.name} (${pct}%)...`;
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                showAlert(`Success! Indexed ${result.chunks_indexed} chunks for ${company} (${result.filename}).`);
                                loadIndexedExperiences();
                                resolve();
                            } catch (e) {
                                reject(new Error('Uploaded but failed to parse response.'));
                            }
                        } else {
                            let errorMsg = 'Upload failed.';
                            try { const err = JSON.parse(xhr.responseText); errorMsg = err.detail || errorMsg; } catch (_) {}
                            reject(new Error(errorMsg));
                        }
                    };

                    xhr.onerror = () => reject(new Error('Network error during upload.'));
                    xhr.send(formData);
                });
            } catch (error) {
                showAlert(`Error: ${error.message}`, 'error');
                break;
            }
        }

        uploadProgress.classList.add('ip-hidden');
    }

    // ===== Indexed Experiences =====
    async function loadIndexedExperiences() {
        if (!expList) return;
        if (filesLoader) filesLoader.classList.remove('ip-hidden');

        try {
            const response = await fetch('/api/indexed-files?module=interview');
            const data = await response.json();

            expList.innerHTML = '';
            experiences = [];

            if (data.files && data.files.length > 0) {
                // Group by company
                const companyMap = {};
                data.files.forEach(f => {
                    const parsed = parseExperienceFilename(f);
                    experiences.push(parsed);
                    if (!companyMap[parsed.company]) {
                        companyMap[parsed.company] = { rounds: 0, source: parsed.source };
                    }
                    companyMap[parsed.company].rounds++;
                });

                // Update stats
                const companies = Object.keys(companyMap);
                updateStat('ip-stat-companies', companies.length);
                updateStat('ip-stat-reports', data.files.length);

                // Populate filter
                populateFilter(companies);

                // Render cards
                let ownDataCount = 0;
                companies.forEach(company => {
                    const info = companyMap[company];
                    const initials = company.substring(0, 2).toUpperCase();
                    const sourceTag = info.source === 'research' ? 'via research' : (info.source === 'paste' ? 'via paste' : 'via upload');
                    if (info.source !== 'research') ownDataCount++;

                    const card = document.createElement('div');
                    card.className = 'ip-expcard';
                    card.innerHTML = `
                        <div class="avatar">${initials}</div>
                        <div class="meta">
                            <div class="name">${company}</div>
                            <div class="sub">${info.rounds} round${info.rounds > 1 ? 's' : ''} logged · ${sourceTag}</div>
                        </div>`;
                    expList.appendChild(card);
                });

                // Summary
                if (expSummary) {
                    expSummary.textContent = `${ownDataCount} of ${companies.length} companies have your own data — the rest use community reports.`;
                }

                // Readiness
                if (companies.length > 0) {
                    const score = Math.min(25 + companies.length * 12, 95);
                    updateStat('ip-stat-readiness', score + '%');
                    const sub = document.getElementById('ip-stat-readiness-sub');
                    if (sub) sub.textContent = 'Based on logged experiences';
                }

            } else {
                expList.innerHTML = '<div class="ip-empty">No interview experiences indexed yet.</div>';
                if (expSummary) expSummary.textContent = '';
            }
        } catch (error) {
            console.error('Error fetching indexed experiences:', error);
            expList.innerHTML = '<div class="ip-empty" style="color:#D95C5C;">Failed to load experiences.</div>';
        } finally {
            if (filesLoader) filesLoader.classList.add('ip-hidden');
        }
    }

    function parseExperienceFilename(filename) {
        // Expected formats: paste_Company_RoundType.txt, research_Company_RoundType.txt, upload_Company_filename.ext
        let source = 'upload', company = 'Unknown', roundType = '';
        if (filename.startsWith('paste_')) {
            source = 'paste';
            const parts = filename.replace('paste_', '').replace(/\.[^.]+$/, '').split('_');
            company = parts[0] || 'Unknown';
            roundType = parts.slice(1).join(' ') || '';
        } else if (filename.startsWith('research_')) {
            source = 'research';
            const parts = filename.replace('research_', '').replace(/\.[^.]+$/, '').split('_');
            company = parts[0] || 'Unknown';
            roundType = parts.slice(1).join(' ') || '';
        } else {
            // Plain uploaded file — extract company from metadata if available
            const parts = filename.replace(/\.[^.]+$/, '').split('_');
            company = parts[0] || filename;
        }
        return { company, source, roundType, filename };
    }

    function populateFilter(companies) {
        if (!companyFilter) return;
        const currentVal = companyFilter.value;
        companyFilter.innerHTML = '<option value="">All Companies (No filter)</option>';
        companies.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            companyFilter.appendChild(opt);
        });
        companyFilter.value = currentVal;
    }

    function updateStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ===== Chat =====
    async function handleChatSubmit() {
        const question = chatInput.value.trim();
        if (!question) return;

        const filterVal = companyFilter ? companyFilter.value : '';

        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.disabled = true;

        appendMessage('user', question);
        scrollToBottom();

        const typingEl = appendTypingIndicator();
        scrollToBottom();

        try {
            const requestBody = { question };
            if (filterVal) requestBody.company = filterVal;

            const response = await fetch('/interview-qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            removeTypingIndicator(typingEl);

            if (!response.ok) {
                let errText = 'Failed to get response.';
                try { const e = await response.json(); errText = e.detail || errText; } catch (_) {}
                throw new Error(errText);
            }

            const data = await response.json();
            appendMessage('ai', data.answer, data.sources);
            saveChatHistory();
        } catch (error) {
            removeTypingIndicator(typingEl);
            appendMessage('ai', `Sorry, I encountered an error: ${error.message}`);
        } finally {
            sendBtn.disabled = false;
            scrollToBottom();
        }
    }

    function appendMessage(sender, text, sources = []) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ip-msg';

        const av = document.createElement('div');
        av.className = 'av';
        av.innerHTML = sender === 'user'
            ? '<i data-lucide="user" style="width:14px;height:14px;"></i>'
            : '<i data-lucide="bot" style="width:14px;height:14px;"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'ip-bubble' + (sender === 'user' ? ' user-bubble' : '');
        bubble.textContent = text;

        // Sources
        if (sources && sources.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'ip-sources';
            sources.forEach(src => {
                const pill = document.createElement('span');
                pill.className = 'ip-source-pill';
                pill.innerHTML = `<i data-lucide="file-text" style="width:12px;height:12px;"></i> ${src}`;
                sourcesDiv.appendChild(pill);
            });
            bubble.appendChild(sourcesDiv);
        }

        // Copy action
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'ip-bubble-actions';
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px;"></i> Copy';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;"></i> Copied!';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                setTimeout(() => {
                    copyBtn.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px;"></i> Copy';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }, 2000);
            });
        });
        actionsDiv.appendChild(copyBtn);
        bubble.appendChild(actionsDiv);

        msgDiv.appendChild(av);
        msgDiv.appendChild(bubble);
        chatHistory.appendChild(msgDiv);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function appendTypingIndicator() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ip-msg';
        msgDiv.id = 'ip-typing-' + Date.now();

        const av = document.createElement('div');
        av.className = 'av';
        av.innerHTML = '<i data-lucide="bot" style="width:14px;height:14px;"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'ip-bubble';

        const typing = document.createElement('div');
        typing.className = 'ip-typing';
        for (let i = 0; i < 3; i++) {
            typing.appendChild(document.createElement('span'));
        }

        bubble.appendChild(typing);
        msgDiv.appendChild(av);
        msgDiv.appendChild(bubble);
        chatHistory.appendChild(msgDiv);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return msgDiv.id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // ===== Chat Persistence =====
    function saveChatHistory() {
        const messages = [];
        chatHistory.querySelectorAll('.ip-msg').forEach(msg => {
            if (msg.id && msg.id.startsWith('ip-typing-')) return;
            const bubble = msg.querySelector('.ip-bubble');
            if (!bubble) return;

            const isUser = bubble.classList.contains('user-bubble');
            const sourcePills = bubble.querySelectorAll('.ip-source-pill');
            const sources = [];
            sourcePills.forEach(p => sources.push(p.textContent.trim()));

            // Get raw text (exclude sources and actions text)
            const clone = bubble.cloneNode(true);
            const srcEl = clone.querySelector('.ip-sources');
            const actEl = clone.querySelector('.ip-bubble-actions');
            if (srcEl) srcEl.remove();
            if (actEl) actEl.remove();

            messages.push({
                sender: isUser ? 'user' : 'ai',
                text: clone.textContent.trim(),
                sources
            });
        });
        localStorage.setItem('interview_chat_history_v2', JSON.stringify(messages));
    }

    function loadChatHistory() {
        const data = localStorage.getItem('interview_chat_history_v2');
        if (!data) return;

        try {
            const messages = JSON.parse(data);
            if (messages.length > 0) {
                chatHistory.innerHTML = '';
                messages.forEach(msg => appendMessage(msg.sender, msg.text, msg.sources));
                scrollToBottom();
            }
        } catch (e) {
            console.error('Error loading interview chat history:', e);
        }
    }

    // ===== Flashcard Deck =====
    const defaultCards = [
        { tag: 'Example · Technical', q: 'Explain the difference between abstraction and encapsulation in OOPS.', a: 'Abstraction hides implementation complexity behind a simple interface; encapsulation bundles data and methods together and restricts direct access to internal state.' },
        { tag: 'Example · Coding', q: 'Reverse a linked list in place.', a: 'Iterate with three pointers (prev, curr, next), reversing the "next" link at each step until curr is null, then return prev as the new head.' },
        { tag: 'Example · Aptitude', q: 'A train 150m long crosses a pole in 10s. Find its speed.', a: 'Speed = distance/time = 150/10 = 15 m/s = 54 km/h.' },
        { tag: 'Example · HR', q: 'Why do you want to join this company?', a: 'Focus on alignment between your skills/goals and the company\'s training programs, project variety, and growth path — keep it specific, not generic.' }
    ];

    function initFlashcards() {
        flashcards = defaultCards;
        flashIdx = 0;
        flashFlipped = false;
        renderFlashcard();
    }

    function renderFlashcard() {
        if (!flashcardEl) return;
        if (flashcards.length === 0) {
            flashcardEl.innerHTML = '<div class="tag">No cards yet</div><div class="q">Add interview experiences to generate review flashcards</div>';
            if (flashCount) flashCount.textContent = 'Card 0 of 0';
            if (flashTotal) flashTotal.textContent = '0 cards';
            return;
        }

        const c = flashcards[flashIdx];
        const displayText = flashFlipped ? c.a : c.q;
        const hint = flashFlipped ? '' : ' <span class="flip-hint">(tap to flip)</span>';
        flashcardEl.innerHTML = `<div class="tag">${c.tag}</div><div class="q">${displayText}${hint}</div>`;
        if (flashCount) flashCount.textContent = `Card ${flashIdx + 1} of ${flashcards.length}`;
        if (flashTotal) flashTotal.textContent = `${flashcards.length} cards`;
    }

    // ===== Quick Chips =====
    function initChips() {
        const chips = document.querySelectorAll('#ip-chips .ip-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                if (sendBtn && sendBtn.disabled) return;
                if (chatInput) {
                    chatInput.value = chip.textContent;
                    // Auto-resize the textarea
                    chatInput.style.height = 'auto';
                    chatInput.style.height = chatInput.scrollHeight + 'px';
                    // Enable send button and submit
                    sendBtn.disabled = false;
                    chatInput.focus();
                    handleChatSubmit();
                }
            });
        });
    }

    // ===== Initialize =====
    function init() {
        // Map elements
        companyInput = document.getElementById('ip-company-input');
        roleInput = document.getElementById('ip-role-input');
        roundInput = document.getElementById('ip-round-input');
        companyFilter = document.getElementById('ip-company-filter');

        pasteTextarea = document.getElementById('ip-paste-textarea');
        pasteSubmitBtn = document.getElementById('ip-paste-submit');

        researchSubmitBtn = document.getElementById('ip-research-submit');
        researchPreview = document.getElementById('ip-research-preview');
        researchTextarea = document.getElementById('ip-research-textarea');
        researchSaveBtn = document.getElementById('ip-research-save');

        uploadDropzone = document.getElementById('ip-upload-dropzone');
        fileInput = document.getElementById('ip-file-input');
        uploadBtn = document.getElementById('ip-upload-btn');

        uploadProgress = document.getElementById('ip-upload-progress');
        progressBar = document.getElementById('ip-progress-bar');
        progressText = document.getElementById('ip-progress-text');
        alertMessage = document.getElementById('ip-alert-message');

        chatHistory = document.getElementById('ip-chat-history');
        chatInput = document.getElementById('ip-chat-input');
        sendBtn = document.getElementById('ip-send-btn');
        clearChatBtn = document.getElementById('ip-clear-chat');
        mockBtn = document.getElementById('ip-mock-btn');

        expList = document.getElementById('ip-exp-list');
        expSummary = document.getElementById('ip-exp-summary');
        filesLoader = document.getElementById('ip-files-loader');

        flashcardEl = document.getElementById('ip-flashcard');
        flashPrev = document.getElementById('ip-flash-prev');
        flashNext = document.getElementById('ip-flash-next');
        flashCount = document.getElementById('ip-flash-count');
        flashTotal = document.getElementById('ip-flash-total');

        // Tabs
        initTabs();

        // Paste submit
        if (pasteSubmitBtn) pasteSubmitBtn.addEventListener('click', handlePasteSubmit);

        // Research submit & save
        if (researchSubmitBtn) researchSubmitBtn.addEventListener('click', handleResearchSubmit);
        if (researchSaveBtn) researchSaveBtn.addEventListener('click', handleResearchSave);

        // File upload dropzone
        if (uploadDropzone && fileInput) {
            uploadDropzone.addEventListener('click', (e) => {
                if (e.target === fileInput) return;
                const company = companyInput.value.trim();
                if (!company) {
                    showAlert('Please enter a company name first.', 'error');
                    return;
                }
                fileInput.click();
            });

            uploadDropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadDropzone.classList.add('dragover');
            });

            uploadDropzone.addEventListener('dragleave', () => {
                uploadDropzone.classList.remove('dragover');
            });

            uploadDropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadDropzone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) uploadFiles(fileInput.files);
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                const company = companyInput.value.trim();
                if (!company) {
                    showAlert('Please enter a company name first.', 'error');
                    return;
                }
                fileInput.click();
            });
        }

        // Chat
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                sendBtn.disabled = !chatInput.value.trim();
                chatInput.style.height = 'auto';
                chatInput.style.height = chatInput.scrollHeight + 'px';
            });

            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                }
            });
        }

        if (sendBtn) sendBtn.addEventListener('click', handleChatSubmit);

        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                chatHistory.innerHTML = `
                    <div class="ip-msg">
                        <div class="av"><i data-lucide="bot" style="width:14px;height:14px;"></i></div>
                        <div class="ip-bubble">Chat history cleared. Scope your chat filter and start fresh!</div>
                    </div>`;
                localStorage.removeItem('interview_chat_history_v2');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        }

        // Mock Interview Toggle
        if (mockBtn) {
            mockBtn.addEventListener('click', () => {
                isMockMode = !isMockMode;
                mockBtn.classList.toggle('on', isMockMode);
                if (isMockMode) {
                    appendMessage('ai', '🎯 Mock Interview Mode is ON. I\'ll ask you one question at a time and evaluate your response. Ready? Type "start" to begin!');
                    scrollToBottom();
                }
            });
        }

        // Flashcards
        if (flashcardEl) {
            flashcardEl.addEventListener('click', () => {
                flashFlipped = !flashFlipped;
                renderFlashcard();
            });
        }
        if (flashNext) {
            flashNext.addEventListener('click', () => {
                if (flashcards.length === 0) return;
                flashIdx = (flashIdx + 1) % flashcards.length;
                flashFlipped = false;
                renderFlashcard();
            });
        }
        if (flashPrev) {
            flashPrev.addEventListener('click', () => {
                if (flashcards.length === 0) return;
                flashIdx = (flashIdx - 1 + flashcards.length) % flashcards.length;
                flashFlipped = false;
                renderFlashcard();
            });
        }

        // Quick chips
        initChips();

        // Initial loads
        loadIndexedExperiences();
        loadChatHistory();
        initFlashcards();
    }

    return { init };
})();
