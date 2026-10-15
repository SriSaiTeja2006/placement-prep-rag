/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - ASSIGNMENT HELPER SCRIPT (v2)
   ========================================================================== */

window.AssignmentApp = (() => {
    // --- DOM References ---
    let problemInput, submitBtn, loader, emptyState, resultsContainer;
    let approachText, pseudocodeText, conceptChips, sourcesContainer, exportBtn;
    let uploadDropzone, fileInput, unitInput;
    let uploadProgress, progressBar, progressText, alertMessage;
    let historyList;
    let statAssisted, statConcepts, statDifficulty, statUploaded;

    // --- State ---
    let hintLevel = 1; // 0 = Nudge, 1 = Concept, 2 = Pseudocode
    let assignmentsHistory = [];
    let currentPlan = null;

    // ===== Hint Level Slider =====
    function initSlider() {
        const steps = document.querySelectorAll('#ah-hint-steps .ah-hint-step');
        const fill = document.getElementById('ah-hint-fill');
        const desc = document.getElementById('ah-hint-desc');
        const descriptions = [
            'A gentle nudge toward the right way of thinking — no algorithm names given yet.',
            'Explains the core idea and relevant data structures/algorithms — no step-by-step logic yet.',
            'Full step-by-step pseudocode mapped to your notes — still no compilable code.'
        ];
        const widths = ['16%', '50%', '84%'];

        steps.forEach(s => s.addEventListener('click', () => {
            steps.forEach(x => x.classList.remove('active'));
            s.classList.add('active');
            hintLevel = parseInt(s.dataset.level);
            if (fill) fill.style.width = widths[hintLevel];
            if (desc) desc.textContent = descriptions[hintLevel];
        }));
    }

    // ===== Alert Helper =====
    function showAlert(msg, type = 'success') {
        if (!alertMessage) return;
        alertMessage.textContent = msg;
        alertMessage.className = 'ah-alert ' + type;
        alertMessage.classList.remove('ah-hidden');
        setTimeout(() => alertMessage.classList.add('ah-hidden'), 6000);
    }

    // ===== Course Notes Ingestion =====
    async function uploadCourseNotes(files) {
        if (files.length === 0) return;

        const unitName = unitInput.value.trim() || 'General';
        const courseId = 'CS-101'; // Default course ID

        uploadProgress.classList.remove('ah-hidden');
        alertMessage.classList.add('ah-hidden');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            progressBar.style.width = '0%';
            progressText.textContent = `Uploading [${i + 1}/${files.length}]: ${file.name} (0%)...`;

            try {
                await new Promise((resolve, reject) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('course_id', courseId);
                    formData.append('unit_name', unitName);

                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/assignment/upload', true);

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const pct = Math.round((e.loaded / e.total) * 100);
                            progressBar.style.width = pct + '%';
                            progressText.textContent = `Uploading [${i + 1}/${files.length}]: ${file.name} (${pct}%)...`;
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                showAlert(`Uploaded successfully! Indexed ${result.chunks_indexed} chunks for ${unitName}.`);
                                incrementStat('ah-stat-uploaded');
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

        uploadProgress.classList.add('ah-hidden');
    }

    // ===== Query Endpoint (RAG retrieval + LLM generation) =====
    async function getConceptualHelp() {
        const problem = problemInput.value.trim();
        if (!problem) return;

        const unitName = unitInput.value.trim();

        // Reset UI State
        submitBtn.disabled = true;
        loader.classList.remove('ah-hidden');
        emptyState.classList.add('ah-hidden');
        resultsContainer.classList.add('ah-hidden');

        try {
            const response = await fetch('/assignment/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_statement: problem,
                    unit_name: unitName || null,
                    hint_level: hintLevel
                })
            });

            if (!response.ok) {
                let errText = 'Failed to generate plan.';
                try { const e = await response.json(); errText = e.detail || errText; } catch (_) {}
                throw new Error(errText);
            }

            const data = await response.json();
            currentPlan = data;

            // Load solution results
            renderPlan(data);

            // Add to history
            const newRecord = {
                problem_statement: problem,
                hint_level: hintLevel,
                difficulty: data.difficulty || 'Medium',
                concept_tags: data.concept_tags || [],
                source_refs: data.source_refs || [],
                approach: data.approach,
                pseudocode: data.pseudocode,
                timestamp: new Date().toLocaleString()
            };
            assignmentsHistory.unshift(newRecord);
            localStorage.setItem('assignment_history_v2', JSON.stringify(assignmentsHistory));
            renderHistoryList();

            // Update stats
            incrementStat('ah-stat-assisted');
            updateConceptsStat();

        } catch (error) {
            console.error('Assignment Help Query Error:', error);
            showAlert(error.message, 'error');
            emptyState.classList.remove('ah-hidden');
        } finally {
            submitBtn.disabled = false;
            loader.classList.add('ah-hidden');
        }
    }

    function renderPlan(plan) {
        approachText.textContent = plan.approach;

        // Render pseudocode section
        const pseudoSec = document.getElementById('ah-pseudocode-section');
        if (plan.pseudocode) {
            pseudocodeText.textContent = plan.pseudocode;
            if (pseudoSec) pseudoSec.classList.remove('ah-hidden');
        } else {
            pseudocodeText.textContent = '';
            if (pseudoSec) pseudoSec.classList.add('ah-hidden');
        }

        // Concept tags
        conceptChips.innerHTML = '';
        if (plan.concept_tags && plan.concept_tags.length > 0) {
            plan.concept_tags.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'ah-cchip';
                chip.textContent = tag.startsWith('#') ? tag : '#' + tag;
                conceptChips.appendChild(chip);
            });
        }

        // Sources citations
        sourcesContainer.innerHTML = '';
        if (plan.source_refs && plan.source_refs.length > 0) {
            plan.source_refs.forEach(ref => {
                const pill = document.createElement('div');
                pill.style.display = 'inline-flex';
                pill.style.alignItems = 'center';
                pill.style.gap = '4px';
                pill.style.margin = '4px 6px 4px 0';
                pill.style.background = 'var(--ah-primary-tint)';
                pill.style.color = 'var(--ah-primary-dark)';
                pill.style.fontSize = '11px';
                pill.style.fontWeight = '600';
                pill.style.padding = '3px 8px';
                pill.style.borderRadius = '6px';
                pill.innerHTML = `<i data-lucide="file-text" style="width:12px;height:12px;"></i> ${ref}`;
                sourcesContainer.appendChild(pill);
            });
        } else {
            sourcesContainer.innerHTML = '<span style="font-style:italic;color:var(--ah-muted);">No reference course notes cited. Core knowledge base used.</span>';
        }

        resultsContainer.classList.remove('ah-hidden');
        exportBtn.removeAttribute('disabled');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ===== Recent History list =====
    function renderHistoryList() {
        if (!historyList) return;
        historyList.innerHTML = '';

        if (assignmentsHistory.length === 0) {
            historyList.innerHTML = '<div class="ah-empty">No recent assignments.</div>';
            return;
        }

        // Expose counts
        if (statAssisted) statAssisted.textContent = assignmentsHistory.length;

        // Classify average difficulty
        const diffMap = { 'Easy': 0, 'Medium': 0, 'Hard': 0 };
        assignmentsHistory.forEach(item => {
            const d = item.difficulty || 'Medium';
            diffMap[d] = (diffMap[d] || 0) + 1;
        });
        let maxDiff = 'Medium';
        if (diffMap['Hard'] >= diffMap['Medium'] && diffMap['Hard'] >= diffMap['Easy']) maxDiff = 'Hard';
        else if (diffMap['Easy'] > diffMap['Medium'] && diffMap['Easy'] > diffMap['Hard']) maxDiff = 'Easy';
        if (statDifficulty) statDifficulty.textContent = maxDiff;

        assignmentsHistory.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'ah-history-item';
            
            let icon = '📖';
            if (item.concept_tags.some(t => t.toLowerCase().includes('tree') || t.toLowerCase().includes('bst'))) icon = '🌳';
            else if (item.concept_tags.some(t => t.toLowerCase().includes('semaphore') || t.toLowerCase().includes('mutex') || t.toLowerCase().includes('queue'))) icon = '🧵';
            else if (item.concept_tags.some(t => t.toLowerCase().includes('recursion') || t.toLowerCase().includes('backtrack'))) icon = '🔁';

            const tagLine = item.concept_tags.slice(0, 2).map(t => t.startsWith('#') ? t.substring(1) : t).join(' · ') || 'General';
            const diffClass = item.difficulty.toLowerCase() === 'easy' ? 'ah-diff-easy' : (item.difficulty.toLowerCase() === 'hard' ? 'ah-diff-hard' : 'ah-diff-med');

            div.innerHTML = `
                <div class="icon">${icon}</div>
                <div class="meta">
                    <div class="t" style="text-overflow:ellipsis;overflow:hidden;white-space:nowrap;max-width:180px;">${item.problem_statement}</div>
                    <div class="s">${tagLine}</div>
                </div>
                <span class="ah-diff-badge ${diffClass}">${item.difficulty}</span>
            `;

            div.addEventListener('click', () => {
                currentPlan = item;
                problemInput.value = item.problem_statement;
                // Highlight corresponding step slider
                const sliderSteps = document.querySelectorAll('#ah-hint-steps .ah-hint-step');
                if (sliderSteps[item.hint_level]) {
                    sliderSteps[item.hint_level].click();
                }
                emptyState.classList.add('ah-hidden');
                renderPlan(item);
            });

            historyList.appendChild(div);
        });
    }

    function loadHistory() {
        const data = localStorage.getItem('assignment_history_v2');
        if (data) {
            try {
                assignmentsHistory = JSON.parse(data);
                renderHistoryList();
            } catch (e) {
                console.error('Error loading history:', e);
            }
        }
    }

    function incrementStat(id) {
        const el = document.getElementById(id);
        if (el) {
            const count = parseInt(el.textContent) || 0;
            el.textContent = count + 1;
        }
    }

    function updateConceptsStat() {
        const allTags = new Set();
        assignmentsHistory.forEach(item => {
            if (item.concept_tags) item.concept_tags.forEach(t => allTags.add(t));
        });
        if (statConcepts) statConcepts.textContent = allTags.size;
    }

    // ===== Export Notes =====
    function exportPlanToMarkdown() {
        if (!currentPlan) return;

        const cleanTags = currentPlan.concept_tags.map(t => t.startsWith('#') ? t : '#' + t).join(' ');
        const citedNotes = currentPlan.source_refs && currentPlan.source_refs.length > 0 
            ? currentPlan.source_refs.map(ref => `- ${ref}`).join('\n') 
            : 'No direct note sections cited.';

        const mdContent = `# Assignment Helper Study Sheet
Generated on: ${new Date().toLocaleString()}

## Problem Statement
${currentPlan.problem_statement}

## Tags
${cleanTags}

## Difficulty: ${currentPlan.difficulty} | Hint Level: ${currentPlan.hint_level === 0 ? 'Nudge' : (currentPlan.hint_level === 1 ? 'Concept' : 'Pseudocode')}

---

## Conceptual Solution Plan

### Approach & Logic
${currentPlan.approach}

${currentPlan.pseudocode ? `### Abstract Pseudocode
\`\`\`text
${currentPlan.pseudocode}
\`\`\`
` : ''}

---

## Referenced Notes Sections
${citedNotes}

---
*Generated by Placement Prep AI Assignment Assistant (Academic Integrity Guardrail Enforced)*
`;

        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conceptual_study_sheet_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== Initialize =====
    function init() {
        // Map elements
        problemInput = document.getElementById('ah-problem-input');
        submitBtn = document.getElementById('ah-submit-btn');
        loader = document.getElementById('ah-loader');
        emptyState = document.getElementById('ah-empty-state');
        resultsContainer = document.getElementById('ah-results');
        exportBtn = document.getElementById('ah-export-btn');

        approachText = document.getElementById('ah-approach-text');
        pseudocodeText = document.getElementById('ah-pseudocode-text');
        conceptChips = document.getElementById('ah-concept-chips');
        sourcesContainer = document.getElementById('ah-sources');

        uploadDropzone = document.getElementById('ah-upload-dropzone');
        fileInput = document.getElementById('ah-file-input');
        unitInput = document.getElementById('ah-unit-input');

        uploadProgress = document.getElementById('ah-upload-progress');
        progressBar = document.getElementById('ah-progress-bar');
        progressText = document.getElementById('ah-progress-text');
        alertMessage = document.getElementById('ah-alert-message');

        historyList = document.getElementById('ah-history-list');

        statAssisted = document.getElementById('ah-stat-assisted');
        statConcepts = document.getElementById('ah-stat-concepts');
        statDifficulty = document.getElementById('ah-stat-difficulty');
        statUploaded = document.getElementById('ah-stat-uploaded');

        // Slider init
        initSlider();

        // Dropzone & Ingest click triggers (with fixed bubbling)
        if (uploadDropzone && fileInput) {
            uploadDropzone.addEventListener('click', (e) => {
                if (e.target === fileInput) return;
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
                if (e.dataTransfer.files.length > 0) uploadCourseNotes(e.dataTransfer.files);
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) uploadCourseNotes(fileInput.files);
            });
        }

        // Query submit
        if (submitBtn) {
            submitBtn.addEventListener('click', getConceptualHelp);
            
            // Enable button based on input
            if (problemInput) {
                submitBtn.disabled = !problemInput.value.trim();
                problemInput.addEventListener('input', () => {
                    submitBtn.disabled = !problemInput.value.trim();
                });
            }
        }

        // Export button click
        if (exportBtn) {
            exportBtn.addEventListener('click', exportPlanToMarkdown);
        }

        // Load persisted elements
        loadHistory();
    }

    return { init };
})();
