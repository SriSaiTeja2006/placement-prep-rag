/* ==========================================================================
   PLACEMENT PREP RAG ASSISTANT - MAIN APPLICATION SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const viewContainer = document.getElementById('view-container');
    const navItems = document.querySelectorAll('.nav-item');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const appSidebar = document.getElementById('app-sidebar');
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const clearSessionBtn = document.getElementById('clear-session-btn');

    let currentView = null;

    // View initialization registry
    const initializers = {
        notes: () => window.NotesApp && window.NotesApp.init(),
        interview: () => window.InterviewApp && window.InterviewApp.init(),
        resume: () => window.ResumeApp && window.ResumeApp.init(),
        assignment: () => window.AssignmentApp && window.AssignmentApp.init(),
        ai_tutor: () => window.TutorApp && window.TutorApp.init(),
        quiz_generator: () => window.QuizApp && window.QuizApp.init(),
        flashcards: () => window.FlashcardsApp && window.FlashcardsApp.init(),
        study_planner: () => window.PlannerApp && window.PlannerApp.init(),
        dashboard: () => window.DashboardApp && window.DashboardApp.init(),
        analytics: () => window.AnalyticsApp && window.AnalyticsApp.init()
    };

    // Helper to dynamically load sub-module scripts
    function loadModuleScript(viewName, callback) {
        const scriptPath = `/static/js/${viewName}.js`;
        if (document.querySelector(`script[src="${scriptPath}"]`)) {
            if (callback) callback();
            return;
        }
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = () => {
            console.log(`Loaded module: ${viewName}.js`);
            if (callback) callback();
        };
        script.onerror = () => {
            console.error(`Failed to load module script: ${scriptPath}`);
        };
        document.body.appendChild(script);
    }

    const viewCache = {}; // Cache for view HTML templates to enable instant tab switching

    // Main Routing Function
    async function navigateTo(viewName) {
        if (currentView === viewName) return;
        
        console.log(`Navigating to view: ${viewName}`);
        
        // Helper to update active navigation links styling
        function updateActiveLink() {
            navItems.forEach(item => {
                if (item.getAttribute('data-view') === viewName) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
            currentView = viewName;
            appSidebar.classList.remove('open');
        }

        // Helper to load and initialize client module script
        function initializeModule() {
            loadModuleScript(viewName, () => {
                const initializer = initializers[viewName];
                if (initializer) {
                    initializer();
                } else {
                    console.warn(`No initializer found for view: ${viewName}`);
                }
                // Initialize Lucide icons on newly loaded view elements
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        }

        // If view is already cached, load it instantly with zero network delay
        if (viewCache[viewName]) {
            viewContainer.innerHTML = viewCache[viewName];
            updateActiveLink();
            initializeModule();
            return;
        }

        // Show loader on the first network fetch load
        viewContainer.innerHTML = `
            <div class="loading-view">
                <div class="spinner"></div>
                <p>Loading ${viewName.toUpperCase()} Module...</p>
            </div>
        `;

        try {
            const response = await fetch(`/views/${viewName}`);
            if (!response.ok) throw new Error(`Failed to fetch view ${viewName}`);
            
            const html = await response.text();
            viewCache[viewName] = html; // Save view template to cache
            
            viewContainer.innerHTML = html;
            updateActiveLink();
            initializeModule();

        } catch (error) {
            console.error('Routing Error:', error);
            viewContainer.innerHTML = `
                <div class="loading-view">
                    <span style="font-size: 40px; display: inline-flex; align-items: center; justify-content: center;"><i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: var(--danger-rose);"></i></span>
                    <p style="color: #f87171;">Error loading view: ${error.message}</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    // Bind Navigation Click Events
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewName = item.getAttribute('data-view');
            navigateTo(viewName);
        });
    });

    // Mobile Sidebar Toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            appSidebar.classList.toggle('open');
        });
    }

    // Close mobile sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (appSidebar.classList.contains('open') && !appSidebar.contains(e.target) && e.target !== sidebarToggle) {
            appSidebar.classList.remove('open');
        }
    });

    // Settings Modal Handlers
    if (openSettingsBtn && settingsModal) {
        openSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });
    }

    if (closeSettingsBtn && settingsModal) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
    }

    // Clear Session Handler
    if (clearSessionBtn) {
        clearSessionBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your current session, chat histories, and uploaded files?')) {
                // Clear localStorage
                localStorage.clear();
                
                // Clear cookies/session state variables if any
                console.log('Session cleared.');
                
                // Reload current view
                const viewToReload = currentView || 'notes';
                currentView = null;
                navigateTo(viewToReload);
            }
        });
    }

    // Initialize Application with Default View (Dashboard)
    navigateTo('dashboard');
});
