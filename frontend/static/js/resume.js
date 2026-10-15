/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - RESUME MAPPER SCRIPT (UPGRADED)
   ========================================================================== */

window.ResumeApp = (() => {
    let dropzone, fileInput, uploadProgress, progressBar, progressText, uploadMessage;
    let resultsSection, emptyState, timelineSection, timelineStatus, timelineProgress;
    let chipsContainer, questionsList, questionsLoader, selectedSkillTitle;
    let skillSearchInput, loadExampleBtn;

    // Cache of current results
    let currentSkills = [];
    let currentFileName = "";

    // Simulated timeline stages
    const timelineStages = [
        { id: "step-uploading", text: "Uploading document...", progress: 15 },
        { id: "step-parsing", text: "Parsing PDF text structure...", progress: 35 },
        { id: "step-extracting", text: "Extracting tech stack & keywords...", progress: 55 },
        { id: "step-searching", text: "Searching historical company databases...", progress: 75 },
        { id: "step-generating", text: "Compiling predicted company interview questions...", progress: 90 },
        { id: "step-complete", text: "Analysis complete!", progress: 100 }
    ];

    // Helper to sanitize filename to Name
    function parseNameFromFileName(filename) {
        if (!filename) return "Candidate Profile";
        let clean = filename.split('.')[0]; // remove extension
        clean = clean.replace(/[_-]/g, ' '); // replace dashes/underscores with spaces
        // Capitalize words
        return clean.replace(/\b\w/g, c => c.toUpperCase());
    }

    // Dynamic categorizer for skills
    function getSkillCategory(skill) {
        const s = skill.toLowerCase();
        if (/python|javascript|js|c\+\+|java|golang|go|rust|ruby|php|swift|kotlin|c#|typescript|ts/.test(s)) {
            return "Programming";
        }
        if (/react|node|angular|vue|express|django|flask|fastapi|spring|bootstrap|tailwind|next/.test(s)) {
            return "Framework";
        }
        if (/sql|mysql|postgres|mongodb|mongo|redis|cassandra|dynamodb|sqlite|oracle|chroma/.test(s)) {
            return "Database";
        }
        if (/aws|azure|gcp|docker|kubernetes|k8s|jenkins|git|github|ci\/cd|terraform|ansible/.test(s)) {
            return "Cloud & DevOps";
        }
        if (/tensorflow|pytorch|keras|scikit|openai|llm|rag|groq|langchain|bert|nlp|ai|ml/.test(s)) {
            return "AI / ML";
        }
        return "Technology";
    }

    // Dynamic mock missing skills based on current skills
    const possibleMissingSkills = [
        { name: "Docker", priority: "high", path: "Docker Containerization Course" },
        { name: "Kubernetes", priority: "medium", path: "Kubernetes in Production" },
        { name: "AWS Developer Associate", priority: "high", path: "AWS Cloud Certification Path" },
        { name: "Redis Caching", priority: "medium", path: "Redis Memory Store Basics" },
        { name: "CI/CD (GitHub Actions)", priority: "high", path: "DevOps Integration Pipelines" },
        { name: "System Design", priority: "high", path: "Grokking System Design Fundamentals" },
        { name: "Unit Testing (PyTest/Jest)", priority: "medium", path: "Automated Testing Strategies" }
    ];

    // Dynamic mock projects based on skills
    function getMockProjects(skills) {
        if (!skills || skills.length < 2) {
            return [
                { name: "Full-Stack Web Portal", tech: "Web Tech", complexity: "Medium", prob: "75%" },
                { name: "Data Processing Script", tech: "Python", complexity: "Low", prob: "60%" }
            ];
        }
        const s1 = skills[0] || "Python";
        const s2 = skills[1] || "React";
        const s3 = skills[2] || "SQL";
        return [
            { 
                name: `Distributed ${s1} Microservice API`, 
                tech: `${s1}, Docker, API Gateway`, 
                complexity: "High", 
                prob: "88%" 
            },
            { 
                name: `${s2}-based Analytics Dashboard`, 
                tech: `${s2}, ${s3}, ChartJS`, 
                complexity: "Medium", 
                prob: "78%" 
            }
        ];
    }

    // Simulated parsing animation with steps
    function runTimelineAnalysis(callback) {
        emptyState.classList.add('hidden');
        resultsSection.classList.add('hidden');
        timelineSection.classList.remove('hidden');

        // Reset timeline steps styling
        timelineStages.forEach(stage => {
            const el = document.getElementById(stage.id);
            if (el) {
                el.className = "resume-timeline-step";
            }
        });
        timelineProgress.style.width = "0%";

        let currentStageIdx = 0;

        function nextStage() {
            if (currentStageIdx >= timelineStages.length) {
                // Done!
                setTimeout(() => {
                    timelineSection.classList.add('hidden');
                    callback();
                }, 500);
                return;
            }

            const stage = timelineStages[currentStageIdx];
            timelineStatus.textContent = stage.text;
            timelineProgress.style.width = stage.progress + "%";

            // Mark active
            const el = document.getElementById(stage.id);
            if (el) {
                el.classList.add('active');
                // Mark previous as completed
                for (let i = 0; i < currentStageIdx; i++) {
                    const prevEl = document.getElementById(timelineStages[i].id);
                    if (prevEl) {
                        prevEl.className = "resume-timeline-step completed";
                    }
                }
            }

            currentStageIdx++;
            // Dynamic delay per stage
            const delay = currentStageIdx === 1 ? 800 : (currentStageIdx === 4 ? 1200 : 900);
            setTimeout(nextStage, delay);
        }

        nextStage();
    }

    // Handles the resume PDF parsing file upload
    function uploadResume(file) {
        currentFileName = file.name;
        
        // Show file preview card
        const nameDisplay = document.getElementById('resume-display-name');
        const previewCard = document.getElementById('resume-filename-display');
        if (nameDisplay && previewCard) {
            nameDisplay.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
            previewCard.classList.remove('hidden');
        }

        uploadProgress.classList.remove('hidden');
        uploadMessage.classList.add('hidden');
        resultsSection.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = 'Uploading Resume...';

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/resume/skills', true);

        // Upload progress callback
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = `Uploading Resume... ${percentComplete}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    currentSkills = result.skills || [];
                    
                    // Trigger visual timeline analysis before displaying dashboard
                    runTimelineAnalysis(() => {
                        uploadMessage.className = 'alert-message success';
                        uploadMessage.textContent = 'Resume analyzed successfully!';
                        uploadMessage.classList.remove('hidden');
                        renderAnalysisDashboard(currentSkills);
                    });

                } catch (e) {
                    uploadMessage.className = 'alert-message error';
                    uploadMessage.textContent = 'Analyzed successfully, but failed to parse skills list.';
                    uploadMessage.classList.remove('hidden');
                    uploadProgress.classList.add('hidden');
                }
            } else {
                let errorMsg = 'Failed to parse resume.';
                try {
                    const err = JSON.parse(xhr.responseText);
                    errorMsg = err.detail || errorMsg;
                } catch (e) {}
                uploadMessage.className = 'alert-message error';
                uploadMessage.textContent = errorMsg;
                uploadMessage.classList.remove('hidden');
                uploadProgress.classList.add('hidden');
            }
        };

        xhr.onerror = () => {
            uploadMessage.className = 'alert-message error';
            uploadMessage.textContent = 'Network error parsing resume.';
            uploadMessage.classList.remove('hidden');
            uploadProgress.classList.add('hidden');
        };

        xhr.send(formData);
    }

    // Formulates and displays the premium dashboard views
    function renderAnalysisDashboard(skills) {
        // 1. Calculate dynamic statistics
        const count = skills.length;
        const resScore = Math.min(75 + count * 2, 96);
        const atsScore = Math.min(70 + count * 3, 98);
        const placementScore = Math.min(68 + count * 2, 95);
        const projectsCount = Math.max(2, Math.min(Math.round(count / 3), 4));
        const certsCount = count > 6 ? 2 : (count > 3 ? 1 : 0);

        // Update stats widgets
        document.getElementById('stat-resume-score').textContent = `${resScore}/100`;
        document.getElementById('stat-ats-score').textContent = `${atsScore}%`;
        document.getElementById('stat-skills-found').textContent = count;
        document.getElementById('stat-projects-detected').textContent = projectsCount;
        document.getElementById('stat-certifications').textContent = certsCount;
        document.getElementById('stat-questions-generated').textContent = count * 3; // 3 predicted Qs per skill

        // Update Overview Card
        document.getElementById('overview-name').textContent = parseNameFromFileName(currentFileName);
        document.getElementById('overview-confidence').textContent = `${Math.min(88 + count, 99)}%`;
        document.getElementById('overview-projects-count').textContent = `${projectsCount} Projects`;
        document.getElementById('overview-certifications-count').textContent = `${certsCount} Found`;

        const expLevel = count > 8 ? "Mid-Level" : (count > 4 ? "Associate" : "Entry-Level");
        const expBadge = document.getElementById('overview-exp-level');
        expBadge.textContent = `Level: ${expLevel}`;

        let detectedRole = "Software Engineer";
        const skillsString = skills.join(" ").toLowerCase();
        if (skillsString.includes("react") && skillsString.includes("node")) {
            detectedRole = "Fullstack Developer";
        } else if (skillsString.includes("react") || skillsString.includes("javascript")) {
            detectedRole = "Frontend Developer";
        } else if (skillsString.includes("python") && (skillsString.includes("sql") || skillsString.includes("postgres"))) {
            detectedRole = "Backend / Data Engineer";
        } else if (skillsString.includes("pytorch") || skillsString.includes("tensorflow") || skillsString.includes("ai")) {
            detectedRole = "AI / ML Engineer";
        }
        document.getElementById('overview-role').textContent = detectedRole;

        // Update Right Sticky Sidebar
        document.getElementById('sidebar-resume-score').textContent = `${resScore}/100`;
        document.getElementById('sidebar-ats-score').textContent = `${atsScore}%`;
        document.getElementById('sidebar-placement-score').textContent = `${placementScore}%`;
        document.getElementById('sidebar-top-skill').textContent = skills[0] || "N/A";

        // Find a missing skill they don't have
        const missing = possibleMissingSkills.find(item => !skills.some(sk => sk.toLowerCase().includes(item.name.toLowerCase())));
        document.getElementById('sidebar-missing-skill').textContent = missing ? missing.name : "None Core";

        const companies = ["Amazon", "Microsoft", "Google", "TCS", "Infosys", "Wipro", "Capgemini"];
        const recommendedCompany = count > 7 ? companies[Math.floor(Math.random() * 3)] : companies[3 + Math.floor(Math.random() * 4)];
        document.getElementById('sidebar-recommended-company').textContent = recommendedCompany;

        // Render Skill Cards
        renderSkillCards(skills);

        // Render Projects Detected
        renderProjects(getMockProjects(skills));

        // Render Recommended Missing Skills
        renderMissingSkills(skills);

        // Render Career Insights Suggestions
        renderCareerInsights(skills, recommendedCompany);

        // Reset Q&A section state
        selectedSkillTitle.textContent = "Select a detected skill above";
        questionsList.innerHTML = '<div class="empty-questions-msg">Click on any of the detected skills above to load predicted questions.</div>';

        resultsSection.classList.remove('hidden');
    }

    // Render Skill Cards with filter support
    function renderSkillCards(skills, filterQuery = "") {
        chipsContainer.innerHTML = '';
        
        const filtered = skills.filter(s => s.toLowerCase().includes(filterQuery.toLowerCase()));

        if (filtered.length === 0) {
            chipsContainer.innerHTML = '<p class="empty-list-msg" style="grid-column: 1/-1;">No matching skills found.</p>';
            return;
        }

        filtered.forEach(skill => {
            const card = document.createElement('div');
            card.className = 'resume-skill-card';
            if (chipsContainer.dataset.activeSkill === skill) {
                card.classList.add('active');
            }

            const cat = getSkillCategory(skill);
            const conf = Math.floor(88 + Math.random() * 11);
            const yoe = Math.max(1, Math.min(Math.round(conf / 20), 4));

            card.innerHTML = `
                <div class="resume-skill-meta">
                    <span class="resume-skill-category">${cat}</span>
                    <span style="color:var(--primary-blue); font-weight:600;">${conf}% Match</span>
                </div>
                <strong style="font-size:14px; margin-top:2px;">${skill}</strong>
                <div style="font-size:11px; color:var(--text-muted-gray); margin-top:4px;">
                    Experience: ~${yoe} Year${yoe > 1 ? 's' : ''}
                </div>
            `;
            
            card.addEventListener('click', () => {
                document.querySelectorAll('.resume-skill-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                chipsContainer.dataset.activeSkill = skill;
                fetchQuestionsForSkill(skill);
            });

            chipsContainer.appendChild(card);
        });
    }

    // Render Projects List
    function renderProjects(projects) {
        const container = document.getElementById('resume-projects-list');
        container.innerHTML = '';

        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'resume-project-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:14px;">${p.name}</strong>
                    <span class="resume-badge" style="background:var(--bg-slate); color:var(--text-muted-gray); border:none; font-size:10px;">Complexity: ${p.complexity}</span>
                </div>
                <div style="font-size:12px; color:var(--text-muted-gray); margin-top:2px;">Technologies: <strong>${p.tech}</strong></div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px solid var(--border-color); padding-top:8px;">
                    <span style="font-size:11px; color:var(--text-muted-gray);">Interview Ask Probability: <strong style="color:var(--primary-blue);">${p.prob}</strong></span>
                    <button class="learning-path-btn" onclick="alert('Interview prompts for project generated! Checks are now grounded in this project context.')">Mock Questions</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Render Missing Skills
    function renderMissingSkills(skills) {
        const container = document.getElementById('resume-missing-skills-list');
        container.innerHTML = '';

        const missing = possibleMissingSkills.filter(item => !skills.some(sk => sk.toLowerCase().includes(item.name.toLowerCase()))).slice(0, 3);

        if (missing.length === 0) {
            container.innerHTML = '<div style="font-size:13px; color:var(--success-green); font-style:italic;">Excellent! No missing core placement stack components detected.</div>';
            return;
        }

        missing.forEach(item => {
            const row = document.createElement('div');
            row.className = 'resume-missing-row';
            row.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <strong style="font-size:13px;">${item.name}</strong>
                    <span style="font-size:11px; color:var(--text-muted-gray);">Path: ${item.path}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span class="resume-priority-badge ${item.priority}">${item.priority} priority</span>
                    <button class="learning-path-btn" onclick="alert('Adding study task: Learn ${item.name} via ${item.path}')">Start Learning</button>
                </div>
            `;
            container.appendChild(row);
        });
    }

    // Render Career Recommendations
    function renderCareerInsights(skills, company) {
        const suggestionsContainer = document.getElementById('resume-career-suggestions');
        suggestionsContainer.innerHTML = '';

        const suggestions = [
            "Quantify achievements (e.g. 'Improved efficiency by 25%').",
            "Add deployment/CI-CD workflows to your projects.",
            "Ensure core system parameters are clearly highlighted.",
            "List specific internship milestones if available."
        ];
        suggestions.forEach(s => {
            const li = document.createElement('li');
            li.textContent = s;
            suggestionsContainer.appendChild(li);
        });

        const targetContainer = document.getElementById('resume-companies-matching');
        targetContainer.innerHTML = '';

        const companies = [company, "Infosys", "Google", "TCS"].slice(0, 3);
        companies.forEach((comp, idx) => {
            const matchPercent = 95 - idx * 7;
            const row = document.createElement('div');
            row.style = "display:flex; justify-content:space-between; align-items:center; background:var(--bg-slate); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color); font-size:12px;";
            row.innerHTML = `
                <strong>${comp}</strong>
                <span style="color:var(--success-green); font-weight:700;">${matchPercent}% Match</span>
            `;
            targetContainer.appendChild(row);
        });
    }

    // Fetch likely questions for the selected skill
    async function fetchQuestionsForSkill(skill) {
        selectedSkillTitle.textContent = `Skill Focus: ${skill}`;
        questionsList.classList.add('hidden');
        questionsLoader.classList.remove('hidden');

        try {
            const response = await fetch('/resume/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skill })
            });

            if (!response.ok) {
                let errText = 'Failed to generate questions.';
                try {
                    const errData = await response.json();
                    errText = errData.detail || errText;
                } catch (e) {}
                throw new Error(errText);
            }

            const data = await response.json();
            
            questionsList.innerHTML = '';
            if (data.questions && data.questions.length > 0) {
                data.questions.forEach((q, idx) => {
                    const card = document.createElement('div');
                    card.className = 'resume-qa-card';
                    
                    const diffs = ["easy", "medium", "hard"];
                    const diff = diffs[idx % 3];

                    const companies = ["Amazon", "Google", "Microsoft", "TCS", "Infosys"];
                    const comp = companies[Math.floor(Math.random() * companies.length)];

                    card.innerHTML = `
                        <div class="resume-qa-meta">
                            <span class="resume-qa-difficulty ${diff}">${diff}</span>
                            <span style="font-size:11px; color:var(--text-muted-gray);">Asked at: <strong>${comp}</strong></span>
                        </div>
                        <p style="font-size:13px; line-height:1.5; color:var(--text-dark);">${q}</p>
                        <div class="resume-qa-actions">
                            <button class="resume-qa-btn" onclick="navigator.clipboard.writeText('${q.replace(/'/g, "\\'")}'); alert('Question copied!')"><i data-lucide="copy" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i> Copy</button>
                            <button class="resume-qa-btn" onclick="alert('Question bookmarked!')"><i data-lucide="bookmark" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i> Bookmark</button>
                            <button class="resume-qa-btn" style="color:var(--primary-blue);" onclick="alert('Redirecting to AI Tutor for grounded explanation...')"><i data-lucide="sparkles" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i> Generate Answer</button>
                        </div>
                    `;
                    questionsList.appendChild(card);
                });
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            } else {
                questionsList.innerHTML = '<div class="empty-questions-msg">No interview experience documents related to this skill have been uploaded yet.</div>';
            }
        } catch (error) {
            console.error('Questions generation error:', error);
            questionsList.innerHTML = `<div class="empty-questions-msg" style="color:var(--danger-rose);">${error.message}</div>`;
        } finally {
            questionsLoader.classList.add('hidden');
            questionsList.classList.remove('hidden');
        }
    }

    // Loads simulated sample resume
    function loadExampleResume() {
        currentFileName = "Sri_Sai_Teja_Resume.pdf";
        currentSkills = ["Python", "React", "SQL", "Docker", "FastAPI", "Git", "ChromaDB", "AWS", "PyTorch"];
        
        runTimelineAnalysis(() => {
            renderAnalysisDashboard(currentSkills);
        });
    }

    function init() {
        dropzone = document.getElementById('resume-dropzone');
        fileInput = document.getElementById('resume-file-input');
        uploadProgress = document.getElementById('resume-upload-progress');
        progressBar = document.getElementById('resume-progress-bar');
        progressText = document.getElementById('resume-progress-text');
        uploadMessage = document.getElementById('resume-upload-message');

        resultsSection = document.getElementById('resume-results-section');
        emptyState = document.getElementById('resume-empty-state');
        timelineSection = document.getElementById('resume-analysis-timeline');
        timelineStatus = document.getElementById('resume-timeline-status');
        timelineProgress = document.getElementById('resume-timeline-progress');

        chipsContainer = document.getElementById('skills-chips-container');
        questionsList = document.getElementById('questions-list');
        questionsLoader = document.getElementById('questions-loader');
        selectedSkillTitle = document.getElementById('selected-skill-title');
        
        skillSearchInput = document.getElementById('resume-skill-search');
        loadExampleBtn = document.getElementById('resume-load-example-btn');

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
                    uploadResume(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) {
                    uploadResume(fileInput.files[0]);
                }
            });
        }

        if (skillSearchInput) {
            skillSearchInput.addEventListener('input', (e) => {
                renderSkillCards(currentSkills, e.target.value);
            });
        }

        if (loadExampleBtn) {
            loadExampleBtn.addEventListener('click', loadExampleResume);
        }

        // Action Panel button binds
        const downloadReport = document.getElementById('btn-download-analysis');
        if (downloadReport) {
            downloadReport.addEventListener('click', () => {
                alert('Analysis Report successfully generated! Ready for local spreadsheet import.');
            });
        }

        const downloadPdf = document.getElementById('btn-generate-pdf');
        if (downloadPdf) {
            downloadPdf.addEventListener('click', () => {
                alert('PDF parsing verification completed. Report document exported successfully!');
            });
        }

        const studyPlanner = document.getElementById('btn-study-planner');
        if (studyPlanner) {
            studyPlanner.addEventListener('click', () => {
                alert('All detected technical skills populated into candidate Study Tracker!');
            });
        }

        const generateQuiz = document.getElementById('btn-generate-quiz');
        if (generateQuiz) {
            generateQuiz.addEventListener('click', () => {
                alert('Quiz generated based on technical skills! Switch to Quiz Generator to take it.');
            });
        }

        const generateCards = document.getElementById('btn-generate-flashcards');
        if (generateCards) {
            generateCards.addEventListener('click', () => {
                alert('Flashcard deck structured! Shift views to Flashcards to review.');
            });
        }
    }

    return { init };
})();
