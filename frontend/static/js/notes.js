/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - NOTES Q&A SCRIPT
   ========================================================================== */

window.NotesApp = (() => {
    let dropzone, fileInput, uploadProgress, progressBar, progressText, uploadMessage;
    let chatHistory, chatInput, sendBtn, clearChatBtn, indexedFilesList, filesLoader;

    // Load and render currently indexed files
    async function loadIndexedFiles() {
        if (!indexedFilesList) return;
        filesLoader.classList.remove('hidden');
        try {
            const response = await fetch('/api/indexed-files?module=notes');
            const data = await response.json();
            
            indexedFilesList.innerHTML = '';
            
            if (data.files && data.files.length > 0) {
                data.files.forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file;
                    indexedFilesList.appendChild(li);
                });
            } else {
                indexedFilesList.innerHTML = '<li class="empty-list-msg">No files indexed yet. Upload notes to begin!</li>';
            }
        } catch (error) {
            console.error('Error fetching indexed files:', error);
            indexedFilesList.innerHTML = '<li class="empty-list-msg" style="color: #f87171;">Failed to load files list.</li>';
        } finally {
            filesLoader.classList.add('hidden');
        }
    }

    // Handles multiple file uploads sequentially
    async function uploadFiles(files) {
        if (files.length === 0) return;

        uploadProgress.classList.remove('hidden');
        uploadMessage.classList.add('hidden');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            progressBar.style.width = '0%';
            progressText.textContent = `Indexing [${i + 1}/${files.length}]: ${file.name} (0%)...`;

            try {
                await new Promise((resolve, reject) => {
                    const formData = new FormData();
                    formData.append('file', file);

                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/notes/upload', true);

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percentComplete = Math.round((e.loaded / e.total) * 100);
                            progressBar.style.width = percentComplete + '%';
                            progressText.textContent = `Indexing [${i + 1}/${files.length}]: ${file.name} (${percentComplete}%)...`;
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                uploadMessage.className = 'alert-message success';
                                uploadMessage.textContent = `Success! Indexed ${result.chunks_indexed} chunks from ${result.filename}.`;
                                uploadMessage.classList.remove('hidden');
                                loadIndexedFiles();
                                resolve();
                            } catch (e) {
                                reject(new Error('Uploaded successfully, but failed to parse response.'));
                            }
                        } else {
                            let errorMsg = 'Upload failed.';
                            try {
                                const err = JSON.parse(xhr.responseText);
                                errorMsg = err.detail || errorMsg;
                            } catch (e) {}
                            reject(new Error(errorMsg));
                        }
                    };

                    xhr.onerror = () => {
                        reject(new Error('Network error during upload.'));
                    };

                    xhr.send(formData);
                });
            } catch (error) {
                console.error(error);
                uploadMessage.className = 'alert-message error';
                uploadMessage.textContent = `Error indexing ${file.name}: ${error.message}`;
                uploadMessage.classList.remove('hidden');
                // stop sequential uploads on first error to prevent cascading issues
                break;
            }
        }

        uploadProgress.classList.add('hidden');
    }

    // Chat function
    async function handleChatSubmit() {
        const question = chatInput.value.trim();
        if (!question) return;

        // Clear input and disable button
        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.disabled = true;

        // Append user message
        appendMessage('user', question);
        scrollToBottom();

        // Append AI typing indicator placeholder
        const typingId = appendTypingIndicator();
        scrollToBottom();

        try {
            const response = await fetch('/subject-qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let sources = [];

            // Remove typing indicator before streaming
            removeTypingIndicator(typingId);

            // Create empty AI message container for streaming
            const msgContainer = document.createElement('div');
            msgContainer.className = 'ai-message message-container';
            msgContainer.innerHTML = `
                <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="bot" style="width: 20px; height: 20px;"></i></div>
                <div class="message-bubble-wrapper">
                    <div class="message-bubble"></div>
                </div>
            `;
            chatHistory.appendChild(msgContainer);
            if (typeof lucide !== 'undefined') lucide.createIcons();
            const bubble = msgContainer.querySelector('.message-bubble');

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;

                const sourceMatch = fullText.split('\n[SOURCES]:');
                let displayText = fullText;
                if (sourceMatch.length > 1) {
                    displayText = sourceMatch[0];
                    try { sources = JSON.parse(sourceMatch[1]); } catch(e) {}
                }

                bubble.innerHTML = formatMarkdown(displayText);
                scrollToBottom();
            }

            // Append sources pills if any
            if (sources && sources.length > 0) {
                const wrapper = msgContainer.querySelector('.message-bubble-wrapper');
                const sourcesDiv = document.createElement('div');
                sourcesDiv.className = 'message-sources';
                sources.forEach(src => {
                    const pill = document.createElement('span');
                    pill.className = 'source-pill';
                    pill.innerHTML = \`<i data-lucide="file-text" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> \${src}\`;
                    const match = src.match(/(.+?),\s*p\.(\d+)/i);
                    if (match) {
                        pill.style.cursor = 'pointer';
                        pill.addEventListener('click', () => { window.open(\`/pdf/\${encodeURIComponent(match[1].trim())}#page=\${match[2]}\`, '_blank'); });
                    }
                    sourcesDiv.appendChild(pill);
                });
                wrapper.appendChild(sourcesDiv);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            
            // Save state to local storage
            saveChatHistory();

        } catch (error) {
            console.error('Chat Error:', error);
            appendMessage('ai', `Sorry, I encountered an error: ${error.message}. Please verify your API keys and try again.`);
        } finally {
            sendBtn.disabled = false;
            scrollToBottom();
        }
    }

    // Robust markdown-to-HTML renderer
    function formatMarkdown(text) {
        if (!text) return "";
        const lines = text.split('\n');
        let html = '';
        let inUl = false, inOl = false, inCode = false;
        let codeContent = '';

        function closeList() {
            if (inUl) { html += '</ul>'; inUl = false; }
            if (inOl) { html += '</ol>'; inOl = false; }
        }
        function inlineFormat(line) {
            return line
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        }
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i], trimmed = raw.trim();
            if (trimmed.startsWith('```')) {
                if (!inCode) { closeList(); inCode = true; codeContent = ''; }
                else { html += `<pre class="code-block"><code>${codeContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`; inCode = false; }
                continue;
            }
            if (inCode) { codeContent += (codeContent ? '\n' : '') + raw; continue; }
            if (trimmed === '') { closeList(); continue; }
            const hm = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (hm) { closeList(); const t = `h${Math.min(hm[1].length+1,6)}`; html += `<${t} class="md-heading md-h${hm[1].length}">${inlineFormat(hm[2])}</${t}>`; continue; }
            const um = trimmed.match(/^[-*•]\s+(.*)$/);
            if (um) { if (inOl) { html += '</ol>'; inOl = false; } if (!inUl) { html += '<ul class="md-list">'; inUl = true; } html += `<li>${inlineFormat(um[1])}</li>`; continue; }
            const om = trimmed.match(/^\d+\.\s+(.*)$/);
            if (om) { if (inUl) { html += '</ul>'; inUl = false; } if (!inOl) { html += '<ol class="md-list">'; inOl = true; } html += `<li>${inlineFormat(om[1])}</li>`; continue; }
            closeList();
            html += `<p class="md-para">${inlineFormat(trimmed)}</p>`;
        }
        closeList();
        if (inCode && codeContent) html += `<pre class="code-block"><code>${codeContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`;
        return html;
    }

    // Append standard message bubble to chat container
    function appendMessage(sender, text, sources = []) {
        const msgContainer = document.createElement('div');
        msgContainer.className = `${sender}-message message-container`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.style.display = 'inline-flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.innerHTML = sender === 'user' ? '<i data-lucide="user" style="width: 20px; height: 20px;"></i>' : '<i data-lucide="bot" style="width: 20px; height: 20px;"></i>';

        const wrapper = document.createElement('div');
        wrapper.className = 'message-bubble-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = sender === 'ai' ? formatMarkdown(text) : text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        wrapper.appendChild(bubble);

        // Sources pills
        if (sources && sources.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'message-sources';
            sources.forEach(src => {
                const pill = document.createElement('span');
                pill.className = 'source-pill';
                pill.innerHTML = `<i data-lucide="file-text" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> ${src}`;
                
                const match = src.match(/(.+?),\s*p\.(\d+)/i);
                if (match) {
                    const filename = match[1].trim();
                    const page = match[2];
                    pill.style.cursor = 'pointer';
                    pill.addEventListener('click', () => {
                        window.open(`/pdf/${encodeURIComponent(filename)}#page=${page}`, '_blank');
                    });
                }
                
                sourcesDiv.appendChild(pill);
            });
            wrapper.appendChild(sourcesDiv);
        }

        // Actions (Copy)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'bubble-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i data-lucide="copy" style="width: 13px; height: 13px; vertical-align: text-bottom; margin-right: 4px;"></i> Copy';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '<i data-lucide="check" style="width: 13px; height: 13px; vertical-align: text-bottom; margin-right: 4px;"></i> Copied!';
                setTimeout(() => copyBtn.innerHTML = '<i data-lucide="copy" style="width: 13px; height: 13px; vertical-align: text-bottom; margin-right: 4px;"></i> Copy', 2000);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        });
        actionsDiv.appendChild(copyBtn);
        wrapper.appendChild(actionsDiv);

        msgContainer.appendChild(avatar);
        msgContainer.appendChild(wrapper);
        chatHistory.appendChild(msgContainer);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Append Typing Indicator
    function appendTypingIndicator() {
        const id = 'typing-' + Date.now();
        const msgContainer = document.createElement('div');
        msgContainer.className = 'ai-message message-container';
        msgContainer.id = id;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.style.display = 'inline-flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.innerHTML = '<i data-lucide="bot" style="width: 20px; height: 20px;"></i>';

        const wrapper = document.createElement('div');
        wrapper.className = 'message-bubble-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.className = 'typing-dot';
            indicator.appendChild(dot);
        }
        
        bubble.appendChild(indicator);
        wrapper.appendChild(bubble);
        msgContainer.appendChild(avatar);
        msgContainer.appendChild(wrapper);
        chatHistory.appendChild(msgContainer);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }

    // Save and Load Local Storage History for view consistency
    function saveChatHistory() {
        const messages = [];
        chatHistory.querySelectorAll('.message-container').forEach(msg => {
            // Skip indicator
            if (msg.id && msg.id.startsWith('typing-')) return;

            const isUser = msg.classList.contains('user-message');
            const bubble = msg.querySelector('.message-bubble');
            const sourcePills = msg.querySelectorAll('.source-pill');
            
            const sources = [];
            sourcePills.forEach(pill => {
                sources.push(pill.textContent.trim());
            });

            messages.push({
                sender: isUser ? 'user' : 'ai',
                text: bubble.textContent,
                sources: sources
            });
        });
        localStorage.setItem('notes_chat_history', JSON.stringify(messages));
    }

    function loadChatHistory() {
        const data = localStorage.getItem('notes_chat_history');
        if (!data) return;
        
        try {
            const messages = JSON.parse(data);
            if (messages.length > 0) {
                chatHistory.innerHTML = '';
                messages.forEach(msg => {
                    appendMessage(msg.sender, msg.text, msg.sources);
                });
                scrollToBottom();
            }
        } catch (e) {
            console.error('Error loading local chat history:', e);
        }
    }

    // Initialize all listeners
    function init() {
        dropzone = document.getElementById('notes-dropzone');
        fileInput = document.getElementById('notes-file-input');
        uploadProgress = document.getElementById('notes-upload-progress');
        progressBar = document.getElementById('notes-progress-bar');
        progressText = document.getElementById('notes-progress-text');
        uploadMessage = document.getElementById('notes-upload-message');

        chatHistory = document.getElementById('notes-chat-history');
        chatInput = document.getElementById('notes-chat-input');
        sendBtn = document.getElementById('notes-send-btn');
        clearChatBtn = document.getElementById('notes-clear-chat');
        indexedFilesList = document.getElementById('notes-indexed-files');
        filesLoader = document.getElementById('notes-files-loader');

        // Drag and Drop triggers
        if (dropzone && fileInput) {
            dropzone.addEventListener('click', (e) => {
                if (e.target === fileInput) return;
                fileInput.click();
            });

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragover');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    uploadFiles(e.dataTransfer.files);
                }
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) {
                    uploadFiles(fileInput.files);
                }
            });
        }

        // Chat text input events
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                sendBtn.disabled = !chatInput.value.trim();
                // Auto height adjustment
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

        if (sendBtn) {
            sendBtn.addEventListener('click', handleChatSubmit);
        }

        // Suggestion chips event listener
        const suggestionChips = document.querySelectorAll('#notes-suggestions .suggested-q-chip');
        suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                if (sendBtn && sendBtn.disabled) return;
                const question = chip.getAttribute('data-q') || chip.textContent;
                if (chatInput) {
                    chatInput.value = question.trim();
                    // Auto-resize the textarea
                    chatInput.style.height = 'auto';
                    chatInput.style.height = chatInput.scrollHeight + 'px';
                    // Enable send button
                    if (sendBtn) sendBtn.disabled = false;
                    // Focus input
                    chatInput.focus();
                    // Submit query
                    handleChatSubmit();
                }
            });
        });

        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                chatHistory.innerHTML = `
                    <div class="ai-message message-container">
                        <div class="message-avatar" style="display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="bot" style="width: 20px; height: 20px;"></i></div>
                        <div class="message-bubble-wrapper">
                            <div class="message-bubble">
                                Chat history cleared. Ask me a question about your uploaded notes!
                            </div>
                        </div>
                    </div>
                `;
                localStorage.removeItem('notes_chat_history');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        }

        // Load initially
        loadIndexedFiles();
        loadChatHistory();
    }

    return { init };
})();
