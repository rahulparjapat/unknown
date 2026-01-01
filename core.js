// Core System Logic - All business rules and calculations

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Timer limits
    MAX_SESSION_MINUTES: 120,
    
    // Minimum time requirements
    MIN_STUDY_MINUTES: 20,
    MIN_SECTIONAL_MOCK_MINUTES: 18,
    MIN_FULL_MOCK_MINUTES: 60,
    
    // Base XP rates (per hour)
    XP_RATES: {
        learning: 20,
        revision: 15,
        'mock-analysis': 25
    },
    
    // Level multipliers by level range
    LEVEL_MULTIPLIERS: [
        { min: 1, max: 3, multiplier: 1.0 },
        { min: 4, max: 5, multiplier: 1.1 },
        { min: 6, max: 7, multiplier: 1.25 },
        { min: 8, max: 9, multiplier: 1.4 },
        { min: 10, max: 11, multiplier: 1.6 },
        { min: 12, max: 999, multiplier: 1.8 }
    ],
    
    // Mock test XP
    MOCK_XP: {
        sectional: 30,
        full: 75
    },
    
    // Weekly caps by level
    WEEKLY_CAPS: [
        { min: 1, max: 3, cap: 800, rollover: 50 },
        { min: 4, max: 5, cap: 1200, rollover: 75 },
        { min: 6, max: 7, cap: 1500, rollover: 100 },
        { min: 8, max: 9, cap: 1800, rollover: 120 },
        { min: 10, max: 11, cap: 2100, rollover: 150 },
        { min: 12, max: 999, cap: 2500, rollover: 200 }
    ],
    
    // Daily decay by level
    DAILY_DECAY: [
        { min: 1, max: 3, decay: 0 },
        { min: 4, max: 5, decay: 15 },
        { min: 6, max: 7, decay: 30 },
        { min: 8, max: 9, decay: 50 },
        { min: 10, max: 11, decay: 80 },
        { min: 12, max: 999, decay: 120 }
    ],
    
    // Failure penalties
    FAILURE_PENALTIES: [
        { streak: 1, xpLoss: 40, levelLoss: 0, removeProtection: false },
        { streak: 2, xpLoss: 90, levelLoss: 0, removeProtection: true },
        { streak: 3, xpLoss: 180, levelLoss: 1, removeProtection: true },
        { streak: 4, xpLoss: 250, levelLoss: 0.5, removeProtection: true } // 0.5 = every 2 days
    ],
    
    // Quest XP by level
    QUEST_XP: [
        { min: 1, max: 3, xp: 30 },
        { min: 4, max: 5, xp: 50 },
        { min: 6, max: 7, xp: 80 },
        { min: 8, max: 9, xp: 120 },
        { min: 10, max: 11, xp: 180 },
        { min: 12, max: 999, xp: 250 }
    ],
    
    // Ranks
    RANKS: [
        { level: 1, rank: 'E' },
        { level: 4, rank: 'D' },
        { level: 6, rank: 'C' },
        { level: 8, rank: 'B' },
        { level: 10, rank: 'A' },
        { level: 12, rank: 'S' }
    ],
    
    // Evidence
    RANDOM_EVIDENCE_CHANCE: 0.125, // 12.5% (10-15% range)
    MAX_AFFIRMATIONS_PER_WEEK: 3,
    AFFIRMATION_GOLD_PENALTY: 0.5, // 50% reduction
    
    // Readiness base percentages
    READINESS_BASE: {
        E: 5,
        D: 15,
        C: 30,
        B: 55,
        A: 75,
        S: 90
    },
    
    // Notes minimum characters
    MIN_NOTES_CHARS: 30,
    MIN_AFFIRMATION_CHARS: 50
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let state = {
    // Profile
    startDate: null,
    awakening: {
        completed: false,
        vision: '',
        antiVision: ''
    },
    
    // Progress
    level: 1,
    xp: 0,
    gold: 0,
    
    // Weekly tracking
    weeklyXP: 0,
    weeklyRollover: 0,
    weekStart: null,
    
    // Streaks
    studyStreak: 0,
    failureStreak: 0,
    lastStudyDate: null,
    consecutiveFailureDays: 0,
    
    // Protection
    protection: {
        active: false,
        type: null, // 'partial' or 'full'
        expiresAt: null
    },
    
    // Grace days
    graceDaysUsed: 0,
    graceResetMonth: null,
    
    // Skills
    skills: {
        quant: 0,
        reasoning: 0,
        english: 0,
        gk: 0
    },
    
    // Habits
    habits: {
        dailyStudy: 0,
        dailyRevision: 0,
        weeklyMock: 0,
        formulaReview: 0
    },
    
    // Session tracking
    activeSession: null,
    sessionHistory: [],
    
    // Mock tracking
    lastMockDate: null,
    totalMocks: 0,
    
    // Daily quest
    dailyQuest: null,
    
    // Affirmation tracking
    weeklyAffirmations: 0,
    affirmationWeekStart: null,
    
    // Rewards
    claimedRewards: [],
    
    // Stats
    totalStudyMinutes: 0,
    totalSessions: 0
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeState() {
    const saved = Storage.get('appState');
    
    if (saved) {
        state = { ...state, ...saved };
        // Process any pending decay/resets
        processDailyMaintenance();
    } else {
        // New user
        state.startDate = Date.now();
        state.weekStart = getWeekStart();
        state.affirmationWeekStart = getWeekStart();
        state.graceResetMonth = new Date().getMonth();
        saveState();
    }
}

function saveState() {
    Storage.set('appState', state);
}

// ============================================================================
// LEVEL & RANK SYSTEM
// ============================================================================

function getXPForLevel(level) {
    return Math.floor(100 * Math.pow(2, level - 2));
}

function getCurrentRank() {
    for (let i = CONFIG.RANKS.length - 1; i >= 0; i--) {
        if (state.level >= CONFIG.RANKS[i].level) {
            return CONFIG.RANKS[i].rank;
        }
    }
    return 'E';
}

function getLevelMultiplier(level) {
    const config = CONFIG.LEVEL_MULTIPLIERS.find(m => level >= m.min && level <= m.max);
    return config ? config.multiplier : 1.0;
}

function getWeeklyCap(level) {
    const config = CONFIG.WEEKLY_CAPS.find(c => level >= c.min && level <= c.max);
    return config || CONFIG.WEEKLY_CAPS[0];
}

function getDailyDecay(level) {
    const config = CONFIG.DAILY_DECAY.find(d => level >= d.min && level <= d.max);
    return config ? config.decay : 0;
}

function addXP(amount, source = 'study') {
    const capConfig = getWeeklyCap(state.level);
    
    // Check weekly cap
    if (state.weeklyXP >= capConfig.cap) {
        // Add to rollover
        const rolloverSpace = capConfig.rollover - state.weeklyRollover;
        const toRollover = Math.min(amount, rolloverSpace);
        state.weeklyRollover += toRollover;
        return 0; // No XP added to current total
    }
    
    // Add XP within cap
    const remaining = capConfig.cap - state.weeklyXP;
    const toAdd = Math.min(amount, remaining);
    const overflow = amount - toAdd;
    
    state.xp += toAdd;
    state.weeklyXP += toAdd;
    
    // Add overflow to rollover
    if (overflow > 0) {
        const rolloverSpace = capConfig.rollover - state.weeklyRollover;
        const toRollover = Math.min(overflow, rolloverSpace);
        state.weeklyRollover += toRollover;
    }
    
    // Check for level up
    checkLevelUp();
    
    return toAdd;
}

function checkLevelUp() {
    const requiredXP = getXPForLevel(state.level);
    
    while (state.xp >= requiredXP) {
        state.xp -= requiredXP;
        state.level++;
    }
}

function removeXP(amount) {
    state.xp = Math.max(0, state.xp - amount);
}

function levelDown(levels = 1) {
    state.level = Math.max(1, state.level - levels);
    // Reset XP to 0 when leveling down
    state.xp = 0;
}

// ============================================================================
// TIMER & SESSION MANAGEMENT
// ============================================================================

function startStudySession(subject, topic, phase) {
    state.activeSession = {
        id: Date.now(),
        type: 'study',
        subject: subject,
        topic: topic,
        phase: phase,
        startTime: Date.now(),
        endTime: null,
        duration: 0
    };
    
    saveState();
    return state.activeSession;
}

function getSessionDuration(session) {
    const now = Date.now();
    const elapsed = now - session.startTime;
    return Math.floor(elapsed / 1000); // Return seconds
}

function completeStudySession() {
    if (!state.activeSession) return null;
    
    const endTime = Date.now();
    const durationMs = endTime - state.activeSession.startTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    // Cap at max session time
    const effectiveMinutes = Math.min(durationMinutes, CONFIG.MAX_SESSION_MINUTES);
    
    state.activeSession.endTime = endTime;
    state.activeSession.duration = effectiveMinutes;
    
    return state.activeSession;
}

function startMockSession(type, subject, source) {
    state.activeSession = {
        id: Date.now(),
        type: 'mock',
        mockType: type,
        subject: subject,
        source: source,
        startTime: Date.now(),
        endTime: null,
        duration: 0
    };
    
    saveState();
    return state.activeSession;
}

// ============================================================================
// XP CALCULATION
// ============================================================================

function calculateStudyXP(session, evidenceType) {
    const minutes = session.duration;
    const phase = session.phase;
    
    // Get base rate
    const baseRate = CONFIG.XP_RATES[phase] || 15;
    
    // Get level multiplier
    const levelMultiplier = getLevelMultiplier(state.level);
    
    // Calculate XP
    const hours = minutes / 60;
    let xp = hours * baseRate * levelMultiplier;
    
    // Round to whole number
    xp = Math.floor(xp);
    
    return xp;
}

function calculateGold(xp, evidenceType) {
    let gold = Math.floor(xp / 10);
    
    // Apply affirmation penalty
    if (evidenceType === 'affirmation') {
        gold = Math.floor(gold * CONFIG.AFFIRMATION_GOLD_PENALTY);
    }
    
    return gold;
}

function calculateMockXP(mockType) {
    const baseXP = CONFIG.MOCK_XP[mockType] || 30;
    const levelMultiplier = getLevelMultiplier(state.level);
    
    return Math.floor(baseXP * levelMultiplier);
}

// ============================================================================
// EVIDENCE & VALIDATION
// ============================================================================

function requiresRandomEvidence() {
    return Math.random() < CONFIG.RANDOM_EVIDENCE_CHANCE;
}

function canUseAffirmation() {
    // Check weekly limit
    checkAffirmationWeekReset();
    return state.weeklyAffirmations < CONFIG.MAX_AFFIRMATIONS_PER_WEEK;
}

function checkAffirmationWeekReset() {
    const currentWeekStart = getWeekStart();
    
    if (!state.affirmationWeekStart || state.affirmationWeekStart !== currentWeekStart) {
        state.weeklyAffirmations = 0;
        state.affirmationWeekStart = currentWeekStart;
    }
}

function validateMinimumTime(type, minutes) {
    if (type === 'study') {
        return minutes >= CONFIG.MIN_STUDY_MINUTES;
    } else if (type === 'sectional') {
        return minutes >= CONFIG.MIN_SECTIONAL_MOCK_MINUTES;
    } else if (type === 'full') {
        return minutes >= CONFIG.MIN_FULL_MOCK_MINUTES;
    }
    return false;
}

// ============================================================================
// SESSION COMPLETION
// ============================================================================

function finalizeStudySession(evidenceType, evidenceData, notes, difficulty, mistakes, revisionNeeded, confidence) {
    const session = state.activeSession;
    
    if (!session || session.type !== 'study') {
        return { success: false, error: 'No active study session' };
    }
    
    // Validate minimum time
    if (!validateMinimumTime('study', session.duration)) {
        // FAILURE
        registerFailure('minimum-time');
        state.activeSession = null;
        saveState();
        return { success: false, error: 'Session failed: Minimum time not met', failure: true };
    }
    
    // Track affirmation usage
    if (evidenceType === 'affirmation') {
        state.weeklyAffirmations++;
    }
    
    // Calculate rewards
    const xp = calculateStudyXP(session, evidenceType);
    const gold = calculateGold(xp, evidenceType);
    
    // Add rewards
    const actualXP = addXP(xp);
    state.gold += gold;
    
    // Update stats
    state.totalStudyMinutes += session.duration;
    state.totalSessions++;
    
    // Update skill
    if (state.skills[session.subject] !== undefined) {
        state.skills[session.subject] += actualXP;
    }
    
    // Update streaks
    updateStudyStreak();
    
    // Reset failure streak on successful study
    state.failureStreak = 0;
    state.consecutiveFailureDays = 0;
    
    // Save to history
    const historyEntry = {
        ...session,
        evidenceType: evidenceType,
        evidenceData: evidenceData,
        notes: notes,
        difficulty: difficulty,
        mistakes: mistakes,
        revisionNeeded: revisionNeeded,
        confidence: confidence,
        xpEarned: actualXP,
        goldEarned: gold,
        completedAt: Date.now()
    };
    
    state.sessionHistory.unshift(historyEntry);
    
    // Keep only last 100 sessions in memory
    if (state.sessionHistory.length > 100) {
        state.sessionHistory = state.sessionHistory.slice(0, 100);
    }
    
    state.activeSession = null;
    saveState();
    
    return {
        success: true,
        xp: actualXP,
        gold: gold,
        duration: session.duration
    };
}

function finalizeMockSession(evidenceData, score, totalQuestions, correct, analysis) {
    const session = state.activeSession;
    
    if (!session || session.type !== 'mock') {
        return { success: false, error: 'No active mock session' };
    }
    
    // Validate minimum time
    const minTime = session.mockType === 'full' ? 'full' : 'sectional';
    if (!validateMinimumTime(minTime, session.duration)) {
        registerFailure('minimum-time');
        state.activeSession = null;
        saveState();
        return { success: false, error: 'Mock failed: Minimum time not met', failure: true };
    }
    
    // Calculate rewards
    const xp = calculateMockXP(session.mockType);
    const gold = calculateGold(xp, 'screenshot');
    
    // Add rewards
    const actualXP = addXP(xp);
    state.gold += gold;
    
    // Update protection
    if (session.mockType === 'full') {
        state.protection = {
            active: true,
            type: 'full',
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 1 day
        };
    } else {
        state.protection = {
            active: true,
            type: 'partial',
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        };
    }
    
    // Update mock stats
    state.lastMockDate = Date.now();
    state.totalMocks++;
    
    // Reset failure streak
    state.failureStreak = 0;
    state.consecutiveFailureDays = 0;
    
    // Save to history
    const historyEntry = {
        ...session,
        evidenceData: evidenceData,
        score: score,
        totalQuestions: totalQuestions,
        correct: correct,
        analysis: analysis,
        xpEarned: actualXP,
        goldEarned: gold,
        completedAt: Date.now()
    };
    
    state.sessionHistory.unshift(historyEntry);
    
    if (state.sessionHistory.length > 100) {
        state.sessionHistory = state.sessionHistory.slice(0, 100);
    }
    
    state.activeSession = null;
    saveState();
    
    return {
        success: true,
        xp: actualXP,
        gold: gold,
        protection: state.protection.type
    };
}

// ============================================================================
// STREAKS & FAILURES
// ============================================================================

function updateStudyStreak() {
    const today = getDateKey();
    const lastDate = state.lastStudyDate;
    
    if (lastDate === today) {
        // Already studied today
        return;
    }
    
    const yesterday = getDateKey(Date.now() - 24 * 60 * 60 * 1000);
    
    if (lastDate === yesterday) {
        // Consecutive day
        state.studyStreak++;
    } else if (!lastDate || lastDate < yesterday) {
        // Streak broken or first study
        state.studyStreak = 1;
    }
    
    state.lastStudyDate = today;
}

function registerFailure(reason) {
    state.failureStreak++;
    state.consecutiveFailureDays++;
    
    const penalty = getFailurePenalty(state.failureStreak);
    
    // Apply XP loss
    removeXP(penalty.xpLoss);
    
    // Remove protection
    if (penalty.removeProtection) {
        state.protection = { active: false, type: null, expiresAt: null };
    }
    
    // Apply level loss
    if (penalty.levelLoss >= 1) {
        levelDown(Math.floor(penalty.levelLoss));
    } else if (penalty.levelLoss > 0) {
        // Fractional level loss (every 2 days for streak 4+)
        if (state.consecutiveFailureDays % 2 === 0) {
            levelDown(1);
        }
    }
    
    saveState();
}

function getFailurePenalty(streak) {
    const index = Math.min(streak, CONFIG.FAILURE_PENALTIES.length) - 1;
    if (index >= 0 && index < CONFIG.FAILURE_PENALTIES.length) {
        return CONFIG.FAILURE_PENALTIES[index];
    }
    // For streak 4+, use last penalty config
    return CONFIG.FAILURE_PENALTIES[CONFIG.FAILURE_PENALTIES.length - 1];
}

// ============================================================================
// DAILY MAINTENANCE (Decay, Resets, Grace)
// ============================================================================

function processDailyMaintenance() {
    const today = getDateKey();
    const lastProcessed = Storage.get('lastMaintenanceDate');
    
    if (lastProcessed === today) {
        return; // Already processed today
    }
    
    // Check if user studied today
    const studiedToday = state.lastStudyDate === today;
    
    if (!studiedToday) {
        // Check grace day eligibility
        const rank = getCurrentRank();
        const canUseGrace = (rank === 'B' || rank === 'A' || rank === 'S') && checkGraceDay();
        
        if (canUseGrace) {
            // Use grace day - no decay, no penalty
            state.graceDaysUsed++;
            saveState();
        } else {
            // Apply decay
            const decay = getDailyDecay(state.level);
            if (decay > 0) {
                // Check protection
                if (state.protection.active && state.protection.expiresAt > Date.now()) {
                    // Protected - no decay
                } else {
                    removeXP(decay);
                }
            }
        }
    }
    
    // Check mock protection expiry (7 days without mock)
    if (state.lastMockDate) {
        const daysSinceMock = (Date.now() - state.lastMockDate) / (1000 * 60 * 60 * 24);
        if (daysSinceMock >= 7) {
            state.protection = { active: false, type: null, expiresAt: null };
        }
    }
    
    // Weekly reset check
    checkWeeklyReset();
    
    // Generate new daily quest
    generateDailyQuest();
    
    Storage.set('lastMaintenanceDate', today);
    saveState();
}

function checkGraceDay() {
    const currentMonth = new Date().getMonth();
    
    // Reset grace days each month
    if (state.graceResetMonth !== currentMonth) {
        state.graceDaysUsed = 0;
        state.graceResetMonth = currentMonth;
    }
    
    return state.graceDaysUsed < 1;
}

function checkWeeklyReset() {
    const currentWeekStart = getWeekStart();
    
    if (state.weekStart !== currentWeekStart) {
        // New week - apply rollover
        const rollover = state.weeklyRollover;
        state.weeklyXP = rollover;
        state.weeklyRollover = 0;
        state.weekStart = currentWeekStart;
    }
}

// ============================================================================
// DAILY QUEST
// ============================================================================

function generateDailyQuest() {
    const today = getDateKey();
    
    // Check if quest already exists for today
    if (state.dailyQuest && state.dailyQuest.date === today) {
        return;
    }
    
    const subjects = ['quant', 'reasoning', 'english', 'gk'];
    const phases = ['learning', 'revision', 'mock-analysis'];
    
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const phase = phases[Math.floor(Math.random() * phases.length)];
    
    const questConfig = CONFIG.QUEST_XP.find(q => state.level >= q.min && state.level <= q.max);
    const questXP = questConfig ? questConfig.xp : 30;
    
    state.dailyQuest = {
        date: today,
        subject: subject,
        phase: phase,
        xp: questXP,
        completed: false
    };
    
    saveState();
}

function checkQuestCompletion(session) {
    if (!state.dailyQuest || state.dailyQuest.completed) {
        return false;
    }
    
    const today = getDateKey();
    if (state.dailyQuest.date !== today) {
        return false; // Quest expired
    }
    
    // Check if session matches quest
    if (session.subject === state.dailyQuest.subject && session.phase === state.dailyQuest.phase) {
        state.dailyQuest.completed = true;
        const xp = state.dailyQuest.xp;
        const actualXP = addXP(xp);
        saveState();
        return { completed: true, xp: actualXP };
    }
    
    return false;
}

// ============================================================================
// READINESS INDEX
// ============================================================================

function calculateReadiness() {
    const rank = getCurrentRank();
    
    // Hide for E/D ranks
    if (rank === 'E' || rank === 'D') {
        return { show: false, reason: 'too-early' };
    }
    
    // Hide during failure streaks
    if (state.failureStreak > 0) {
        return { show: false, reason: 'failure-streak' };
    }
    
    // Base percentage
    let base = CONFIG.READINESS_BASE[rank] || 5;
    
    // Modifiers
    let modifiers = 0;
    
    // Positive modifiers
    if (state.studyStreak >= 7) modifiers += 5;
    if (state.studyStreak >= 14) modifiers += 5;
    if (state.studyStreak >= 30) modifiers += 5;
    
    if (state.totalMocks >= 10) modifiers += 3;
    if (state.totalMocks >= 25) modifiers += 5;
    if (state.totalMocks >= 50) modifiers += 7;
    
    // Check weekly consistency (last 4 weeks)
    const weeklyConsistency = calculateWeeklyConsistency();
    if (weeklyConsistency >= 0.8) modifiers += 5;
    if (weeklyConsistency >= 0.9) modifiers += 5;
    
    // Negative modifiers
    const recentAffirmations = countRecentAffirmations();
    if (recentAffirmations >= 3) modifiers -= 5;
    if (recentAffirmations >= 6) modifiers -= 10;
    
    const weakConfidenceSessions = countWeakConfidenceSessions();
    if (weakConfidenceSessions >= 5) modifiers -= 5;
    if (weakConfidenceSessions >= 10) modifiers -= 10;
    
    // Calculate final percentage
    let percentage = base + modifiers;
    percentage = Math.max(0, Math.min(95, percentage));
    
    // Calculate range (±5%)
    const rangeLow = Math.max(0, percentage - 5);
    const rangeHigh = Math.min(95, percentage + 5);
    
    return {
        show: true,
        percentage: percentage,
        range: `${rangeLow}-${rangeHigh}%`,
        base: base,
        modifiers: modifiers
    };
}

function calculateWeeklyConsistency() {
    // Check if user studied at least 4 days per week for last 4 weeks
    const fourWeeksAgo = Date.now() - (28 * 24 * 60 * 60 * 1000);
    const recentSessions = state.sessionHistory.filter(s => s.completedAt >= fourWeeksAgo && s.type === 'study');
    
    if (recentSessions.length < 16) return 0; // Not enough data
    
    // Count unique study days
    const studyDays = new Set(recentSessions.map(s => getDateKey(s.completedAt)));
    
    return studyDays.size / 28; // Consistency ratio
}

function countRecentAffirmations() {
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    return state.sessionHistory.filter(s => 
        s.completedAt >= twoWeeksAgo && s.evidenceType === 'affirmation'
    ).length;
}

function countWeakConfidenceSessions() {
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    return state.sessionHistory.filter(s => 
        s.completedAt >= twoWeeksAgo && 
        (s.confidence === 'very-weak' || s.confidence === 'weak')
    ).length;
}

// ============================================================================
// REWARDS
// ============================================================================

function claimReward(rewardName, cost) {
    if (state.gold < cost) {
        return { success: false, error: 'Insufficient gold' };
    }
    
    state.gold -= cost;
    
    state.claimedRewards.unshift({
        name: rewardName,
        cost: cost,
        claimedAt: Date.now()
    });
    
    saveState();
    
    return { success: true };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getDateKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekStart(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday as week start
    const monday = new Date(date.setDate(diff));
    return getDateKey(monday.getTime());
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================================================
// EXPORT / REPORT GENERATION
// ============================================================================

function generateReport() {
    const rank = getCurrentRank();
    const readiness = calculateReadiness();
    const capConfig = getWeeklyCap(state.level);
    
    const report = {
        generatedAt: Date.now(),
        
        // Profile
        startDate: state.startDate,
        daysSinceStart: Math.floor((Date.now() - state.startDate) / (1000 * 60 * 60 * 24)),
        
        // Current status
        level: state.level,
        rank: rank,
        xp: state.xp,
        xpRequired: getXPForLevel(state.level),
        gold: state.gold,
        
        // Weekly
        weeklyXP: state.weeklyXP,
        weeklyCap: capConfig.cap,
        weeklyRollover: state.weeklyRollover,
        
        // Streaks
        studyStreak: state.studyStreak,
        failureStreak: state.failureStreak,
        
        // Protection & Grace
        protection: state.protection,
        graceDaysRemaining: 1 - state.graceDaysUsed,
        
        // Stats
        totalStudyMinutes: state.totalStudyMinutes,
        totalStudyHours: (state.totalStudyMinutes / 60).toFixed(1),
        totalSessions: state.totalSessions,
        totalMocks: state.totalMocks,
        
        // Skills
        skills: state.skills,
        
        // Readiness
        readiness: readiness,
        
        // History (last 50 sessions)
        history: state.sessionHistory.slice(0, 50)
    };
    
    return report;
}

// Initialize state on load
initializeState();