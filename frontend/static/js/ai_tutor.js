/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - AI TUTOR SCRIPT
   ========================================================================== */

window.TutorApp = (() => {
    let topicInput, diffChips, explainBtn, sourcesList, contentArea, loader, chatInput, sendBtn;
    let currentTopic = "";
    let activeDifficulty = "Intermediate";

    function selectDifficulty(chip) {
        diffChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeDifficulty = chip.getAttribute('data-difficulty');
    }

    // Robust markdown-to-HTML renderer
    function formatMarkdown(text) {
        if (!text) return "";

        const lines = text.split('\n');
        let html = '';
        let inUl = false;
        let inOl = false;
        let inCode = false;
        let codeLang = '';
        let codeContent = '';

        function closeList() {
            if (inUl) { html += '</ul>'; inUl = false; }
            if (inOl) { html += '</ol>'; inOl = false; }
        }

        function inlineFormat(line) {
            return line
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        }

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.trim();

            // Fenced code blocks
            if (trimmed.startsWith('```')) {
                if (!inCode) {
                    closeList();
                    inCode = true;
                    codeLang = trimmed.slice(3).trim();
                    codeContent = '';
                } else {
                    html += `<pre class="code-block"><code>${codeContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`;
                    inCode = false;
                }
                continue;
            }
            if (inCode) {
                codeContent += (codeContent ? '\n' : '') + raw;
                continue;
            }

            // Empty line
            if (trimmed === '') {
                closeList();
                continue;
            }

            // Headers
            const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (headerMatch) {
                closeList();
                const level = headerMatch[1].length;
                const tag = `h${Math.min(level + 1, 6)}`; // shift down one level for in-bubble sizing
                html += `<${tag} class="md-heading md-h${level}">${inlineFormat(headerMatch[2])}</${tag}>`;
                continue;
            }

            // Unordered list items: - or * or •
            const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
            if (ulMatch) {
                if (inOl) { html += '</ol>'; inOl = false; }
                if (!inUl) { html += '<ul class="md-list">'; inUl = true; }
                html += `<li>${inlineFormat(ulMatch[1])}</li>`;
                continue;
            }

            // Ordered list items: 1. 2. etc.
            const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
            if (olMatch) {
                if (inUl) { html += '</ul>'; inUl = false; }
                if (!inOl) { html += '<ol class="md-list">'; inOl = true; }
                html += `<li>${inlineFormat(olMatch[1])}</li>`;
                continue;
            }

            // Normal paragraph line
            closeList();
            html += `<p class="md-para">${inlineFormat(trimmed)}</p>`;
        }

        // Close any remaining open tags
        closeList();
        if (inCode && codeContent) {
            html += `<pre class="code-block"><code>${codeContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`;
        }

        return html;
    }

    async function generateExplanation() {
        const topic = topicInput.value.trim();
        if (!topic) {
            alert("Please enter a topic to explain.");
            return;
        }

        currentTopic = topic;
        explainBtn.disabled = true;
        loader.classList.remove('hidden');
        contentArea.innerHTML = "";
        sourcesList.innerHTML = '<li class="empty-list-msg">Loading citations...</li>';
        chatInput.disabled = true;
        sendBtn.disabled = true;

        try {
            const response = await fetch('/tutor/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, difficulty: activeDifficulty })
            });
            if (!response.ok) {
                let errText = "Failed to explain topic.";
                try {
                    const errData = await response.json();
                    errText = errData.detail || errText;
                } catch (e) {}
                throw new Error(errText);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let sources = [];

            // Render initial AI message container
            contentArea.innerHTML = `
                <div class="ai-message message-container">
                    <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="bot" style="width: 20px; height: 20px;"></i></div>
                    <div class="message-bubble-wrapper">
                        <div class="message-bubble">
                            <h4 style="margin-bottom: 8px; color: var(--accent-cyan);">Concept Guide: ${topic} (${activeDifficulty})</h4>
                            <div id="tutor-streaming-content"></div>
                        </div>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
            const streamingContent = document.getElementById('tutor-streaming-content');

            // Read the stream chunk by chunk
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                
                // Check for [SOURCES] token at the end
                const sourceMatch = fullText.split('\n[SOURCES]:');
                let displayText = fullText;
                
                if (sourceMatch.length > 1) {
                    displayText = sourceMatch[0];
                    try {
                        sources = JSON.parse(sourceMatch[1]);
                    } catch(e) {}
                }
                
                streamingContent.innerHTML = formatMarkdown(displayText);
                // Auto-scroll to bottom as text arrives
                contentArea.scrollTop = contentArea.scrollHeight;
            }

            // Update stats
            const conceptsEl = document.getElementById('tutor-stat-concepts');
            if (conceptsEl) conceptsEl.textContent = parseInt(conceptsEl.textContent || '0') + 1;

            // Render citations
            if (sources && sources.length > 0) {
                sourcesList.innerHTML = '';
                sources.forEach(src => {
                    const li = document.createElement('li');
                    
                    const match = src.match(/(.+?),\s*p\.(\d+)/i);
                    if (match) {
                        const filename = match[1].trim();
                        const page = match[2];
                        li.innerHTML = `<i data-lucide="file-text" style="width: 14px; height: 14px; vertical-align: text-bottom; margin-right: 6px;"></i> ${src}`;
                        li.style.cursor = 'pointer';
                        li.addEventListener('click', () => {
                            window.open(`/pdf/${encodeURIComponent(filename)}#page=${page}`, '_blank');
                        });
                    } else {
                        li.innerHTML = `<i data-lucide="file-text" style="width: 14px; height: 14px; vertical-align: text-bottom; margin-right: 6px;"></i> ${src}`;
                    }
                    sourcesList.appendChild(li);
                });
            } else {
                sourcesList.innerHTML = '<li class="empty-list-msg">No citations referenced.</li>';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();

            // Enable doubts chat
            chatInput.disabled = false;
            chatInput.placeholder = "Ask a doubt about this explanation...";

        } catch (error) {
            console.error(error);
            contentArea.innerHTML = `
                <div class="ai-message message-container">
                    <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="alert-triangle" style="width: 20px; height: 20px; color: var(--danger-rose);"></i></div>
                    <div class="message-bubble-wrapper">
                        <div class="message-bubble" style="color: #f87171;">
                            ${error.message}
                        </div>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            sourcesList.innerHTML = '<li class="empty-list-msg" style="color: #f87171;">Failed to load references.</li>';
        } finally {
            explainBtn.disabled = false;
            loader.classList.add('hidden');
            contentArea.scrollTop = contentArea.scrollHeight;
        }
    }

    async function sendDoubt() {
        const doubtText = chatInput.value.trim();
        if (!doubtText) return;

        // Append User bubble
        contentArea.innerHTML += `
            <div class="user-message message-container">
                <div class="message-bubble-wrapper">
                    <div class="message-bubble">${formatMarkdown(doubtText)}</div>
                </div>
                <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="user" style="width: 20px; height: 20px;"></i></div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        contentArea.scrollTop = contentArea.scrollHeight;

        chatInput.value = "";
        chatInput.disabled = true;
        sendBtn.disabled = true;

        // Show a brief loader bubble
        const loadingId = "doubt-loading-bubble";
        contentArea.innerHTML += `
            <div class="ai-message message-container" id="${loadingId}">
                <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="bot" style="width: 20px; height: 20px;"></i></div>
                <div class="message-bubble-wrapper">
                    <div class="message-bubble">
                        <div class="mini-loader" style="margin: 0;"></div>
                    </div>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        contentArea.scrollTop = contentArea.scrollHeight;

        try {
            // Ground doubts in Notes Q&A endpoint
            const response = await fetch('/subject-qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: `Regarding "${currentTopic}": ${doubtText}` })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";

            const loaderBubble = document.getElementById(loadingId);
            if (loaderBubble) loaderBubble.remove();

            if (!response.ok) {
                throw new Error("Unable to answer doubt.");
            }

            // Append AI Answer empty container
            contentArea.innerHTML += `
                <div class="ai-message message-container">
                    <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="bot" style="width: 20px; height: 20px;"></i></div>
                    <div class="message-bubble-wrapper">
                        <div class="message-bubble doubt-streaming-content"></div>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
            const doubtBubbles = contentArea.querySelectorAll('.doubt-streaming-content');
            const currentDoubtBubble = doubtBubbles[doubtBubbles.length - 1];

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;

                const sourceMatch = fullText.split('\n[SOURCES]:');
                let displayText = fullText;
                if (sourceMatch.length > 1) {
                    displayText = sourceMatch[0];
                }

                currentDoubtBubble.innerHTML = formatMarkdown(displayText);
                contentArea.scrollTop = contentArea.scrollHeight;
            }

        } catch (error) {
            const loaderBubble = document.getElementById(loadingId);
            if (loaderBubble) loaderBubble.remove();

            contentArea.innerHTML += `
                <div class="ai-message message-container">
                    <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="alert-triangle" style="width: 20px; height: 20px; color: var(--danger-rose);"></i></div>
                    <div class="message-bubble-wrapper">
                        <div class="message-bubble" style="color: #f87171;">
                            ${error.message}
                        </div>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
            contentArea.scrollTop = contentArea.scrollHeight;
        }
    }

    function init() {
        topicInput = document.getElementById('tutor-topic-input');
        diffChips = document.querySelectorAll('#tutor-difficulty-chips .mode-chip');
        explainBtn = document.getElementById('tutor-explain-btn');
        sourcesList = document.getElementById('tutor-sources-list');
        contentArea = document.getElementById('tutor-content-area');
        loader = document.getElementById('tutor-loader');
        chatInput = document.getElementById('tutor-chat-input');
        sendBtn = document.getElementById('tutor-send-btn');

        if (diffChips) {
            diffChips.forEach(chip => {
                chip.addEventListener('click', () => selectDifficulty(chip));
            });
        }

        if (explainBtn) {
            explainBtn.addEventListener('click', generateExplanation);
        }

        if (chatInput) {
            chatInput.addEventListener('input', () => {
                sendBtn.disabled = chatInput.value.trim() === "";
            });
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey && !chatInput.disabled && chatInput.value.trim()) {
                    e.preventDefault();
                    sendDoubt();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', sendDoubt);
        }
    }

    return { init };
})();
