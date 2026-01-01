// UI Logic, Routing, and Event Handling

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Process daily maintenance
    processDailyMaintenance();
    
    // Check awakening
    if (!state.awakening.completed) {
        showAwakeningModal();
    }
    
    // Setup navigation
    setupNavigation();
    
    // Setup study page
    setupStudyPage();
    
    // Setup mock page
    setupMockPage();
    
    // Setup quests page
    setupQuestsPage();
    
    // Setup report page
    setupReportPage();
    
    // Render dashboard
    renderDashboard();
    
    // Check export reminder
    if (checkExportReminder()) {
        showToast('Reminder: Export your progress report regularly', 'warning');
    }
    
    // Start timer update loop
    startTimerLoop();
});

// ============================================================================
// NAVIGATION
// ============================================================================

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const page = link.dataset.page;
            navigateToPage(page);
        });
    });
}

function navigateToPage(pageName) {
    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageName);
    });
    
    // Show page
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });
    
    // Render page content
    if (pageName === 'dashboard') renderDashboard();
    if (pageName === 'quests') renderQuests();
    if (pageName === 'report') renderReport();
}

// ============================================================================
// AWAKENING MODAL
// ============================================================================

function showAwakeningModal() {
    const modal = document.getElementById('awakening-modal');
    modal.style.display = 'flex';
    
    document.getElementById('vision-next-btn').addEventListener('click', () => {
        const vision = document.getElementById('vision-input').value.trim();
        
        if (vision.length < 100) {
            showToast('Please write at least 100 characters describing your vision', 'error');
            return;
        }
        
        state.awakening.vision = vision;
        
        document.getElementById('awakening-step-1').style.display = 'none';
        document.getElementById('awakening-step-2').style.display = 'block';
    });
    
    document.getElementById('awakening-complete-btn').addEventListener('click', () => {
        const antiVision = document.getElementById('anti-vision-input').value.trim();
        
        if (antiVision.length < 100) {
            showToast('Please write at least 100 characters describing your fears', 'error');
            return;
        }
        
        state.awakening.antiVision = antiVision;
        state.awakening.completed = true;
        
        saveState();
        modal.style.display = 'none';
        
        showToast('Awakening complete. Your journey begins now.', 'success');
        renderDashboard();
    });
}

// ============================================================================
// DASHBOARD
// ============================================================================

function renderDashboard() {
    const rank = getCurrentRank();
    const capConfig = getWeeklyCap(state.level);
    const requiredXP = getXPForLevel(state.level);
    const xpProgress = (state.xp / requiredXP) * 100;
    const weeklyProgress = (state.weeklyXP / capConfig.cap) * 100;
    
    // Status
    document.getElementById('status-rank').textContent = rank;
    document.getElementById('status-level').textContent = state.level;
    document.getElementById('status-xp').textContent = `${state.xp} / ${requiredXP}`;
    document.getElementById('xp-progress').style.width = `${xpProgress}%`;
    document.getElementById('status-gold').textContent = state.gold;
    
    // Weekly
    document.getElementById('weekly-xp').textContent = state.weeklyXP;
    document.getElementById('weekly-cap').textContent = capConfig.cap;
    document.getElementById('weekly-progress').style.width = `${weeklyProgress}%`;
    document.getElementById('weekly-rollover').textContent = `${state.weeklyRollover} / ${capConfig.rollover}`;
    
    // Streaks
    document.getElementById('study-streak').textContent = `${state.studyStreak} days`;
    document.getElementById('failure-streak').textContent = state.failureStreak;
    
    const protectionText = state.protection.active ? 
        `${state.protection.type} (${Math.ceil((state.protection.expiresAt - Date.now()) / (1000 * 60 * 60))}h)` : 
        'None';
    document.getElementById('protection-status').textContent = protectionText;
    
    const graceRemaining = 1 - state.graceDaysUsed;
    document.getElementById('grace-days').textContent = graceRemaining > 0 ? '1 available' : 'Used this month';
    
    // Skills
    renderSkills();
    
    // Habits
    renderHabits();
    
    // Readiness
    renderReadiness();
    
    // Recent activity
    renderRecentActivity();
}

function renderSkills() {
    const skills = ['quant', 'reasoning', 'english', 'gk'];
    
    skills.forEach(skill => {
        const xp = state.skills[skill] || 0;
        const nextLevel = Math.floor(xp / 100) + 1;
        const progress = (xp % 100);
        
        document.getElementById(`skill-${skill}`).textContent = `${xp} XP`;
        document.getElementById(`skill-${skill}-progress`).style.width = `${progress}%`;
    });
}

function renderHabits() {
    document.getElementById('habit-daily-study').textContent = `${state.habits.dailyStudy} days`;
    document.getElementById('habit-daily-revision').textContent = `${state.habits.dailyRevision} days`;
    document.getElementById('habit-weekly-mock').textContent = `${state.habits.weeklyMock} weeks`;
    document.getElementById('habit-formula-review').textContent = `${state.habits.formulaReview} days`;
}

function renderReadiness() {
    const readiness = calculateReadiness();
    const content = document.getElementById('readiness-content');
    
    if (!readiness.show) {
        if (readiness.reason === 'too-early') {
            content.innerHTML = '<p class="readiness-hidden">Readiness calculation available from Rank C onwards. Focus on building consistency.</p>';
        } else if (readiness.reason === 'failure-streak') {
            content.innerHTML = '<p class="readiness-hidden">Readiness hidden during failure streak. Complete a successful session to restore.</p>';
        }
        return;
    }
    
    content.innerHTML = `
        <div class="readiness-display">
            <div class="readiness-percentage">${readiness.percentage}%</div>
            <div class="readiness-range">Range: ${readiness.range}</div>
            <div class="readiness-disclaimer">
                <strong>Disclaimer:</strong> This index reflects your preparation consistency and effort, not guaranteed selection. 
                Actual exam performance depends on multiple factors including current affairs, exam pattern changes, and competition level.
                Use this as a guide, not a prediction.
            </div>
        </div>
    `;
}

function renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    const recent = state.sessionHistory.slice(0, 10);
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-state">No activity yet. Start your first study session!</p>';
        return;
    }
    
    container.innerHTML = recent.map(session => {
        const title = session.type === 'study' ? 
            `${session.topic} (${session.phase})` : 
            `${session.mockType} Mock Test`;
        
        const details = session.type === 'study' ?
            `${session.duration} min • +${session.xpEarned} XP • ${session.evidenceType}` :
            `${session.score}% • +${session.xpEarned} XP`;
        
        return `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title">${title}</div>
                    <div class="activity-details">${details}</div>
                </div>
                <div class="activity-time">${formatTimeAgo(session.completedAt)}</div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// STUDY PAGE
// ============================================================================

let studyTimer = null;

function setupStudyPage() {
    // Start button
    document.getElementById('start-study-btn').addEventListener('click', startStudy);
    
    // Complete button
    document.getElementById('complete-study-btn').addEventListener('click', completeStudy);
    
    // Evidence submission
    document.getElementById('submit-evidence-btn').addEventListener('click', submitEvidence);
    
    // Reflection submission
    document.getElementById('submit-reflection-btn').addEventListener('click', submitReflection);
    
    // Cancel buttons
    document.getElementById('cancel-study-btn').addEventListener('click', cancelStudy);
    
    // New session
    document.getElementById('new-study-btn').addEventListener('click', resetStudyForm);
    
    // Photo preview
    document.getElementById('evidence-photo').addEventListener('change', previewPhoto);
}

function startStudy() {
    const subject = document.getElementById('study-subject').value;
    const topic = document.getElementById('study-topic').value.trim();
    const phase = document.getElementById('study-phase').value;
    
    if (!subject || !topic || !phase) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    const session = startStudySession(subject, topic, phase);
    
    // Update UI
    document.getElementById('study-intent-form').style.display = 'none';
    document.getElementById('study-active-session').style.display = 'block';
    
    document.getElementById('session-subject').textContent = getSubjectName(subject);
    document.getElementById('session-topic').textContent = topic;
    document.getElementById('session-phase').textContent = getPhaseName(phase);
    
    showToast('Study session started. Timer is running.', 'success');
}

function completeStudy() {
    const session = completeStudySession();
    
    if (!session) {
        showToast('No active session', 'error');
        return;
    }
    
    // Check minimum time
    if (session.duration < CONFIG.MIN_STUDY_MINUTES) {
        showToast(`Session failed: Minimum ${CONFIG.MIN_STUDY_MINUTES} minutes required`, 'error');
        registerFailure('minimum-time');
        resetStudyForm();
        renderDashboard();
        return;
    }
    
    // Show evidence form
    document.getElementById('study-active-session').style.display = 'none';
    document.getElementById('study-evidence-form').style.display = 'block';
    
    // Check if random evidence required
    const requiresEvidence = requiresRandomEvidence();
    const evidenceReq = document.getElementById('evidence-requirement');
    
    if (requiresEvidence) {
        evidenceReq.textContent = 'Random verification: Photo evidence required for this session';
        evidenceReq.className = 'form-hint danger';
    } else {
        evidenceReq.textContent = 'Submit photo evidence or use affirmation (with reduced rewards)';
        evidenceReq.className = 'form-hint';
    }
    
    // Check affirmation usage
    checkAffirmationWeekReset();
    const affirmationsLeft = CONFIG.MAX_AFFIRMATIONS_PER_WEEK - state.weeklyAffirmations;
    const warning = document.getElementById('affirmation-count-warning');
    
    if (affirmationsLeft === 0) {
        warning.textContent = 'Weekly affirmation limit reached. Photo required.';
        warning.style.display = 'block';
        document.getElementById('evidence-affirmation').disabled = true;
    } else if (affirmationsLeft <= 1) {
        warning.textContent = `Only ${affirmationsLeft} affirmation(s) remaining this week`;
        warning.style.display = 'block';
    }
}

function submitEvidence() {
    const photoInput = document.getElementById('evidence-photo');
    const affirmationInput = document.getElementById('evidence-affirmation');
    
    const hasPhoto = photoInput.files.length > 0;
    const affirmation = affirmationInput.value.trim();
    
    if (!hasPhoto && !affirmation) {
        showToast('Please provide either photo or affirmation', 'error');
        return;
    }
    
    if (!hasPhoto && affirmation.length < CONFIG.MIN_AFFIRMATION_CHARS) {
        showToast(`Affirmation must be at least ${CONFIG.MIN_AFFIRMATION_CHARS} characters`, 'error');
        return;
    }
    
    if (!canUseAffirmation() && !hasPhoto) {
        showToast('Weekly affirmation limit reached. Photo required.', 'error');
        return;
    }
    
    // Store evidence type and data
    if (hasPhoto) {
        const file = photoInput.files[0];
        saveImage(file, state.activeSession.id, 'photo').then(imageId => {
            state.activeSession.evidenceId = imageId;
            state.activeSession.evidenceType = 'photo';
            proceedToReflection();
        }).catch(err => {
            showToast('Error saving photo. Please try again.', 'error');
            console.error(err);
        });
    } else {
        state.activeSession.evidenceData = affirmation;
        state.activeSession.evidenceType = 'affirmation';
        proceedToReflection();
    }
}

function proceedToReflection() {
    document.getElementById('study-evidence-form').style.display = 'none';
    document.getElementById('study-reflection-form').style.display = 'block';
}

function submitReflection() {
    const notes = document.getElementById('study-notes').value.trim();
    const difficulty = document.getElementById('study-difficulty').value;
    const mistakes = document.getElementById('study-mistakes').value.trim();
    const revisionNeeded = document.getElementById('study-revision-needed').value;
    const confidence = document.getElementById('study-confidence').value;
    
    if (notes.length < CONFIG.MIN_NOTES_CHARS) {
        showToast(`Notes must be at least ${CONFIG.MIN_NOTES_CHARS} characters`, 'error');
        return;
    }
    
    const result = finalizeStudySession(
        state.activeSession.evidenceType,
        state.activeSession.evidenceData || state.activeSession.evidenceId,
        notes,
        difficulty,
        mistakes,
        revisionNeeded,
        confidence
    );
    
    if (!result.success) {
        showToast(result.error, 'error');
        if (result.failure) {
            resetStudyForm();
            renderDashboard();
        }
        return;
    }
    
    // Check quest completion
    const questResult = checkQuestCompletion(state.sessionHistory[0]);
    if (questResult && questResult.completed) {
        showToast(`Daily quest completed! +${questResult.xp} bonus XP`, 'success');
    }
    
    // Show success
    document.getElementById('study-reflection-form').style.display = 'none';
    document.getElementById('study-success').style.display = 'block';
    
    document.getElementById('earned-xp').textContent = result.xp;
    document.getElementById('earned-gold').textContent = result.gold;
    document.getElementById('earned-time').textContent = `${result.duration} min`;
    
    renderDashboard();
}

function cancelStudy() {
    if (confirm('Cancel this session? This will count as a failure.')) {
        registerFailure('cancelled');
        resetStudyForm();
        renderDashboard();
        showToast('Session cancelled. Failure penalty applied.', 'error');
    }
}

function resetStudyForm() {
    document.getElementById('study-intent-form').style.display = 'block';
    document.getElementById('study-active-session').style.display = 'none';
    document.getElementById('study-evidence-form').style.display = 'none';
    document.getElementById('study-reflection-form').style.display = 'none';
    document.getElementById('study-success').style.display = 'none';
    
    document.getElementById('study-subject').value = '';
    document.getElementById('study-topic').value = '';
    document.getElementById('study-phase').value = '';
    document.getElementById('evidence-photo').value = '';
    document.getElementById('evidence-affirmation').value = '';
    document.getElementById('study-notes').value = '';
    document.getElementById('study-mistakes').value = '';
    document.getElementById('photo-preview').innerHTML = '';
    
    state.activeSession = null;
    saveState();
}

function previewPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('photo-preview').innerHTML = 
            `<img src="${event.target.result}" alt="Evidence photo">`;
    };
    reader.readAsDataURL(file);
}

// ============================================================================
// MOCK PAGE
// ============================================================================

let mockTimer = null;

function setupMockPage() {
    document.getElementById('start-mock-btn').addEventListener('click', startMock);
    document.getElementById('complete-mock-btn').addEventListener('click', completeMock);
    document.getElementById('submit-mock-btn').addEventListener('click', submitMock);
    document.getElementById('cancel-mock-btn').addEventListener('click', cancelMock);
    document.getElementById('new-mock-btn').addEventListener('click', resetMockForm);
    
    document.getElementById('mock-type').addEventListener('change', (e) => {
        const isSectional = e.target.value === 'sectional';
        document.getElementById('mock-subject').disabled = !isSectional;
    });
    
    document.getElementById('mock-screenshot').addEventListener('change', previewMockScreenshot);
}

function startMock() {
    const type = document.getElementById('mock-type').value;
    const subject = document.getElementById('mock-subject').value;
    const source = document.getElementById('mock-source').value.trim();
    
    if (!type || !source) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (type === 'sectional' && !subject) {
        showToast('Please select subject for sectional mock', 'error');
        return;
    }
    
    const session = startMockSession(type, subject, source);
    
    document.getElementById('mock-intent-form').style.display = 'none';
    document.getElementById('mock-active-session').style.display = 'block';
    
    document.getElementById('mock-session-type').textContent = type === 'full' ? 'Full Mock' : 'Sectional Mock';
    
    if (type === 'sectional') {
        document.getElementById('mock-session-subject-row').style.display = 'flex';
        document.getElementById('mock-session-subject').textContent = getSubjectName(subject);
    } else {
        document.getElementById('mock-session-subject-row').style.display = 'none';
    }
    
    document.getElementById('mock-session-source').textContent = source;
    
    showToast('Mock test started. Timer is running.', 'success');
}

function completeMock() {
    const session = completeStudySession(); // Uses same completion logic
    
    if (!session) {
        showToast('No active session', 'error');
        return;
    }
    
    const minTime = session.mockType === 'full' ? 
        CONFIG.MIN_FULL_MOCK_MINUTES : 
        CONFIG.MIN_SECTIONAL_MOCK_MINUTES;
    
    if (session.duration < minTime) {
        showToast(`Mock failed: Minimum ${minTime} minutes required`, 'error');
        registerFailure('minimum-time');
        resetMockForm();
        renderDashboard();
        return;
    }
    
    document.getElementById('mock-active-session').style.display = 'none';
    document.getElementById('mock-evidence-form').style.display = 'block';
}

function submitMock() {
    const screenshotInput = document.getElementById('mock-screenshot');
    const score = parseFloat(document.getElementById('mock-score').value);
    const totalQuestions = parseInt(document.getElementById('mock-total-questions').value);
    const correct = parseInt(document.getElementById('mock-correct').value);
    const analysis = document.getElementById('mock-analysis').value.trim();
    
    if (!screenshotInput.files.length) {
        showToast('Screenshot is mandatory for mock tests', 'error');
        return;
    }
    
    if (isNaN(score) || isNaN(totalQuestions) || isNaN(correct)) {
        showToast('Please fill all score fields', 'error');
        return;
    }
    
    const file = screenshotInput.files[0];
    saveImage(file, state.activeSession.id, 'screenshot').then(imageId => {
        const result = finalizeMockSession(imageId, score, totalQuestions, correct, analysis);
        
        if (!result.success) {
            showToast(result.error, 'error');
            if (result.failure) {
                resetMockForm();
                renderDashboard();
            }
            return;
        }
        
        document.getElementById('mock-evidence-form').style.display = 'none';
        document.getElementById('mock-success').style.display = 'block';
        
        document.getElementById('mock-earned-xp').textContent = result.xp;
        document.getElementById('mock-earned-gold').textContent = result.gold;
        document.getElementById('mock-protection').textContent = result.protection || 'None';
        
        renderDashboard();
        showToast('Mock test completed successfully!', 'success');
    }).catch(err => {
        showToast('Error saving screenshot. Please try again.', 'error');
        console.error(err);
    });
}

function cancelMock() {
    if (confirm('Cancel this mock test? This will count as a failure.')) {
        registerFailure('cancelled');
        resetMockForm();
        renderDashboard();
        showToast('Mock cancelled. Failure penalty applied.', 'error');
    }
}

function resetMockForm() {
    document.getElementById('mock-intent-form').style.display = 'block';
    document.getElementById('mock-active-session').style.display = 'none';
    document.getElementById('mock-evidence-form').style.display = 'none';
    document.getElementById('mock-success').style.display = 'none';
    
    document.getElementById('mock-type').value = '';
    document.getElementById('mock-subject').value = '';
    document.getElementById('mock-subject').disabled = true;
    document.getElementById('mock-source').value = '';
    document.getElementById('mock-screenshot').value = '';
    document.getElementById('mock-score').value = '';
    document.getElementById('mock-total-questions').value = '';
    document.getElementById('mock-correct').value = '';
    document.getElementById('mock-analysis').value = '';
    document.getElementById('mock-screenshot-preview').innerHTML = '';
    
    state.activeSession = null;
    saveState();
}

function previewMockScreenshot(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('mock-screenshot-preview').innerHTML = 
            `<img src="${event.target.result}" alt="Mock screenshot">`;
    };
    reader.readAsDataURL(file);
}

// ============================================================================
// QUESTS PAGE
// ============================================================================

function setupQuestsPage() {
    document.querySelectorAll('[data-reward]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rewardName = e.target.dataset.reward;
            const cost = parseInt(e.target.dataset.cost);
            claimRewardHandler(rewardName, cost);
        });
    });
}

function renderQuests() {
    // Update gold display
    document.getElementById('rewards-gold').textContent = state.gold;
    
    // Render daily quest
    const questContent = document.getElementById('daily-quest-content');
    
    if (!state.dailyQuest) {
        questContent.innerHTML = '<p class="empty-state">No quest available today</p>';
        return;
    }
    
    const today = getDateKey();
    const isToday = state.dailyQuest.date === today;
    const isCompleted = state.dailyQuest.completed;
    const isExpired = !isToday && !isCompleted;
    
    if (isExpired) {
        questContent.innerHTML = '<p class="empty-state">Quest expired. Come back tomorrow for a new quest.</p>';
        return;
    }
    
    const questClass = isCompleted ? 'quest-card quest-expired' : 'quest-card';
    
    questContent.innerHTML = `
        <div class="${questClass}">
            <h4>${isCompleted ? '✓ Quest Completed' : 'Daily Quest'}</h4>
            <div class="quest-info">
                <div class="quest-row">
                    <span>Subject:</span>
                    <span>${getSubjectName(state.dailyQuest.subject)}</span>
                </div>
                <div class="quest-row">
                    <span>Phase:</span>
                    <span>${getPhaseName(state.dailyQuest.phase)}</span>
                </div>
                <div class="quest-row">
                    <span>Reward:</span>
                    <span>+${state.dailyQuest.xp} XP</span>
                </div>
            </div>
            <p class="form-hint">${isCompleted ? 'Quest completed! Reward has been added to your XP.' : 'Complete a verified study session matching these requirements to earn the reward.'}</p>
        </div>
    `;
    
    // Render claimed rewards
    renderClaimedRewards();
}

function claimRewardHandler(rewardName, cost) {
    const result = claimReward(rewardName, cost);
    
    if (!result.success) {
        showToast(result.error, 'error');
        return;
    }
    
    showToast(`Reward claimed: ${getRewardDisplayName(rewardName)}`, 'success');
    document.getElementById('rewards-gold').textContent = state.gold;
    renderClaimedRewards();
    renderDashboard();
}

function renderClaimedRewards() {
    const container = document.getElementById('claimed-rewards-list');
    
    if (state.claimedRewards.length === 0) {
        container.innerHTML = '<p class="empty-state">No rewards claimed yet</p>';
        return;
    }
    
    container.innerHTML = state.claimedRewards.slice(0, 20).map(reward => `
        <div class="activity-item">
            <div class="activity-content">
                <div class="activity-title">${getRewardDisplayName(reward.name)}</div>
                <div class="activity-details">Cost: ${reward.cost} Gold</div>
            </div>
            <div class="activity-time">${formatTimeAgo(reward.claimedAt)}</div>
        </div>
    `).join('');
}

// ============================================================================
// REPORT PAGE
// ============================================================================

function setupReportPage() {
    document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);
    document.getElementById('cleanup-storage-btn').addEventListener('click', cleanupStorage);
    document.getElementById('edit-vision-btn').addEventListener('click', editVision);
}

function renderReport() {
    const report = generateReport();
    const content = document.getElementById('report-content');
    
    content.innerHTML = `
        <div class="report-section">
            <h4>Overview</h4>
            <div class="report-grid">
                <div class="report-stat">
                    <div class="report-stat-label">Days Active</div>
                    <div class="report-stat-value">${report.daysSinceStart}</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-label">Current Level</div>
                    <div class="report-stat-value">${report.level} (${report.rank})</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-label">Total XP</div>
                    <div class="report-stat-value">${report.xp + (report.level * 100)}</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-label">Gold</div>
                    <div class="report-stat-value">${report.gold}</div>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4>Study Statistics</h4>
            <div class="report-grid">
                <div class="report-stat">
                    <div class="report-stat-label">Total Sessions</div>
                    <div class="report-stat-value">${report.totalSessions}</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-label">Study Hours</div>
                    <div class="report-stat-value">${report.totalStudyHours}</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-label">Mock Tests</div>
                    <div class="report-stat-value">${report.totalMocks}</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-label">Study Streak</div>
                    <div class="report-stat-value">${report.studyStreak}</div>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4>Recent Sessions</h4>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Subject/Topic</th>
                        <th>Duration</th>
                        <th>XP</th>
                        <th>Evidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.history.map(s => `
                        <tr>
                            <td>${formatDate(s.completedAt)}</td>
                            <td>${s.type === 'study' ? 'Study' : 'Mock'}</td>
                            <td>${s.type === 'study' ? s.topic : s.mockType}</td>
                            <td>${s.duration} min</td>
                            <td>${s.xpEarned}</td>
                            <td><span class="evidence-badge ${s.evidenceType}">${s.evidenceType}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Storage info
    renderStorageInfo();
    
    // Vision review
    renderVisionReview();
}

async function renderStorageInfo() {
    const usage = await getStorageUsage();
    const container = document.getElementById('storage-info');
    
    container.innerHTML = `
        <div class="report-grid">
            <div class="report-stat">
                <div class="report-stat-label">Images Stored</div>
                <div class="report-stat-value">${usage.count}</div>
            </div>
            <div class="report-stat">
                <div class="report-stat-label">Storage Used</div>
                <div class="report-stat-value">${usage.sizeMB} MB</div>
            </div>
        </div>
    `;
}

function renderVisionReview() {
    const container = document.getElementById('vision-review');
    
    container.innerHTML = `
        <div class="report-section">
            <h4>Your Vision (After Selection)</h4>
            <p>${state.awakening.vision}</p>
        </div>
        <div class="report-section">
            <h4>Your Anti-Vision (If You Fail)</h4>
            <p>${state.awakening.antiVision}</p>
        </div>
    `;
}

function exportPDF() {
    window.print();
    setExportReminder();
    showToast('Print dialog opened. Save as PDF to export your report.', 'success');
}

async function cleanupStorage() {
    const count = await cleanupOldImages();
    showToast(`Cleaned ${count} old images (90+ days)`, 'success');
    renderStorageInfo();
}

function editVision() {
    const vision = prompt('Edit your vision (after selection):', state.awakening.vision);
    if (vision && vision.length >= 100) {
        state.awakening.vision = vision;
        saveState();
        renderVisionReview();
        showToast('Vision updated', 'success');
    }
}

// ============================================================================
// TIMER LOOP
// ============================================================================

function startTimerLoop() {
    setInterval(() => {
        if (state.activeSession) {
            const duration = getSessionDuration(state.activeSession);
            const display = state.activeSession.type === 'study' ? 
                document.getElementById('timer-display') : 
                document.getElementById('mock-timer-display');
            
            if (display) {
                display.textContent = formatDuration(duration);
            }
            
            // Auto-end at max time
            if (duration >= CONFIG.MAX_SESSION_MINUTES * 60) {
                const timerStatus = document.getElementById('timer-status');
                if (timerStatus) {
                    timerStatus.textContent = 'Max session time reached. Complete or chain sessions.';
                    timerStatus.style.color = 'var(--warning)';
                }
            }
        }
    }, 1000);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function getSubjectName(subject) {
    const names = {
        'quant': 'Quantitative Aptitude',
        'reasoning': 'Reasoning',
        'english': 'English',
        'gk': 'General Knowledge'
    };
    return names[subject] || subject;
}

function getPhaseName(phase) {
    const names = {
        'learning': 'Learning (New Concept)',
        'revision': 'Revision',
        'mock-analysis': 'Mock Analysis'
    };
    return names[phase] || phase;
}

function getRewardDisplayName(reward) {
    const names = {
        'break': 'Extra Study Break (15 min)',
        'movie': 'Movie Night',
        'meal': 'Cheat Meal',
        'dayoff': 'Full Day Off',
        'social': 'Social Outing',
        'gaming': 'Gaming Session (2h)'
    };
    return names[reward] || reward;
}