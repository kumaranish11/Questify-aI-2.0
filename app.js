// Global State
const state = {
    currentQuiz: null,
    currentLevel: 1,
    currentQuestionIndex: 0,
    score: 0,
    savedQuizzes: [],
    theme: 'light'
};

// DOM Elements
const elements = {
    welcomeDialog: document.getElementById('welcomeDialog'),
    mainContainer: document.querySelector('.container'),
    confirmBtn: document.getElementById('confirmBtn'),
    subjectInput: document.getElementById('subject'),
    questionCount: document.getElementById('questionCount'),
    countValue: document.getElementById('countValue'),
    totalQuestions: document.getElementById('totalQuestions'),
    generateBtn: document.getElementById('generateBtn'),
    quizTitle: document.getElementById('quizTitle'),
    currentLevel: document.getElementById('currentLevel'),
    score: document.getElementById('score'),
    questionText: document.getElementById('questionText'),
    optionsContainer: document.getElementById('optionsContainer'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    submitBtn: document.getElementById('submitBtn'),
    progressBar: document.getElementById('progressBar'),
    levelButtons: document.getElementById('levelButtons'),
    savedQuizzesBtn: document.getElementById('savedQuizzesBtn'),
    quizzesModal: document.getElementById('quizzesModal'),
    quizzesList: document.getElementById('quizzesList'),
    resumeQuiz: document.getElementById('resumeQuiz'),
    clearStorage: document.getElementById('clearStorage'),
    themeBtns: document.querySelectorAll('.theme-btn'),
    qNum: document.getElementById('qNum')
};

// Initialize Application
function init() {
    loadSavedQuizzes();
    updateBadgeCount();
    setupEventListeners();
    applyTheme();
    checkForResumeQuiz();
}

function setupEventListeners() {
    // Welcome Dialog
    elements.confirmBtn.addEventListener('click', () => {
        elements.welcomeDialog.classList.add('hidden');
        elements.mainContainer.classList.remove('hidden');
        localStorage.setItem('questify_welcome_shown', 'true');
    });

    // Question Count Slider
    elements.questionCount.addEventListener('input', (e) => {
        const value = e.target.value;
        elements.countValue.textContent = value;
        elements.totalQuestions.textContent = value;
    });

    // Generate Quiz
    elements.generateBtn.addEventListener('click', generateNewQuiz);

    // Quiz Navigation
    elements.prevBtn.addEventListener('click', showPreviousQuestion);
    elements.nextBtn.addEventListener('click', showNextQuestion);
    elements.submitBtn.addEventListener('click', submitAnswer);

    // Level Navigation
    elements.levelButtons.addEventListener('click', (e) => {
        if (e.target.classList.contains('level-btn')) {
            const level = parseInt(e.target.dataset.level);
            changeLevel(level);
        }
    });

    // Saved Quizzes
    elements.savedQuizzesBtn.addEventListener('click', showSavedQuizzes);
    document.querySelector('.close-modal').addEventListener('click', () => {
        elements.quizzesModal.classList.remove('active');
    });

    // Quick Actions
    elements.resumeQuiz.addEventListener('click', resumeLastQuiz);
    elements.clearStorage.addEventListener('click', clearAllStorage);

    // Theme Switcher
    elements.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            changeTheme(theme);
        });
    });

    // Close modal on outside click
    elements.quizzesModal.addEventListener('click', (e) => {
        if (e.target === elements.quizzesModal) {
            elements.quizzesModal.classList.remove('active');
        }
    });

    // Check if welcome dialog was already shown
    if (localStorage.getItem('questify_welcome_shown')) {
        elements.welcomeDialog.classList.add('hidden');
        elements.mainContainer.classList.remove('hidden');
    }
}

async function generateNewQuiz() {
    const subject = elements.subjectInput.value.trim();
    const numQuestions = parseInt(elements.questionCount.value);

    if (!subject) {
        alert('Please enter a subject!');
        return;
    }

    if (numQuestions < 150 || numQuestions > 250) {
        alert('Please select between 150-250 questions');
        return;
    }

    // Show loading state
    elements.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    elements.generateBtn.disabled = true;
    elements.quizTitle.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating ${subject} Quiz...`;

    try {
        // Call our serverless function
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subject: subject,
                numQuestions: numQuestions
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate quiz');
        }

        const quiz = await response.json();
        
        // Update subject from API response
        quiz.subject = subject;
        
        // Save to state
        state.currentQuiz = quiz;
        state.currentLevel = 1;
        state.currentQuestionIndex = 0;
        state.score = 0;

        // Update UI
        updateQuizUI();
        generateLevelButtons();
        
        // Ask about saving
        const saveQuiz = confirm(`Your ${subject} quiz with ${numQuestions} questions is ready!\n\nDo you want to save this quiz to resume later?`);
        if (saveQuiz) {
            saveQuizToStorage(quiz);
        }

    } catch (error) {
        console.error('Error generating quiz:', error);
        alert(`Failed to generate quiz: ${error.message}\n\nUsing sample questions instead.`);
        
        // Create sample quiz
        const sampleQuiz = createSampleQuiz(subject, numQuestions);
        state.currentQuiz = sampleQuiz;
        state.currentLevel = 1;
        state.currentQuestionIndex = 0;
        state.score = 0;
        
        updateQuizUI();
        generateLevelButtons();
    } finally {
        // Reset button state
        elements.generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Quiz';
        elements.generateBtn.disabled = false;
    }
}

function updateQuizUI() {
    if (!state.currentQuiz) return;

    const quiz = state.currentQuiz;
    const questions = quiz.questions[state.currentLevel] || [];
    const currentQuestion = questions[state.currentQuestionIndex];

    // Update quiz info
    elements.quizTitle.textContent = `${quiz.subject} Quiz`;
    elements.currentLevel.textContent = state.currentLevel;
    elements.score.textContent = state.score;

    // Update question
    if (currentQuestion) {
        elements.questionText.textContent = currentQuestion.question;
        elements.qNum.textContent = state.currentQuestionIndex + 1;

        // Update options
        elements.optionsContainer.innerHTML = '';
        currentQuestion.options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            if (currentQuestion.userAnswer === index) {
                optionDiv.classList.add('selected');
            }
            optionDiv.dataset.option = index;
            optionDiv.innerHTML = `
                <span class="option-label">${String.fromCharCode(65 + index)}</span>
                <span class="option-text">${option}</span>
            `;
            optionDiv.addEventListener('click', () => selectOption(index));
            elements.optionsContainer.appendChild(optionDiv);
        });

        // Update progress
        const totalQuestionsInLevel = questions.length;
        const progress = ((state.currentQuestionIndex + 1) / totalQuestionsInLevel) * 100;
        elements.progressBar.style.width = `${progress}%`;

        // Update button states
        elements.prevBtn.disabled = state.currentQuestionIndex === 0;
        elements.nextBtn.disabled = state.currentQuestionIndex === totalQuestionsInLevel - 1;
        elements.submitBtn.disabled = currentQuestion.userAnswer === null;
    } else {
        elements.questionText.textContent = 'No questions available for this level.';
    }
}

function selectOption(optionIndex) {
    if (!state.currentQuiz) return;
    
    const questions = state.currentQuiz.questions[state.currentLevel];
    const currentQuestion = questions[state.currentQuestionIndex];
    
    if (!currentQuestion) return;
    
    // Remove selection from all options
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selection to clicked option
    const selectedOption = document.querySelector(`.option[data-option="${optionIndex}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Update question state
    currentQuestion.userAnswer = optionIndex;
    currentQuestion.isCorrect = optionIndex === currentQuestion.correctAnswer;
    
    // Enable submit button
    elements.submitBtn.disabled = false;
}

function submitAnswer() {
    if (!state.currentQuiz) return;
    
    const questions = state.currentQuiz.questions[state.currentLevel];
    const currentQuestion = questions[state.currentQuestionIndex];
    
    if (!currentQuestion) return;
    
    if (currentQuestion.isCorrect) {
        state.score += 10;
        elements.score.textContent = state.score;
        alert('✅ Correct! ' + currentQuestion.explanation);
    } else {
        const correctOption = String.fromCharCode(65 + currentQuestion.correctAnswer);
        alert(`❌ Incorrect. The correct answer is ${correctOption}. ${currentQuestion.explanation}`);
    }
    
    // Move to next question if available
    if (state.currentQuestionIndex < questions.length - 1) {
        showNextQuestion();
    } else {
        alert('🎉 Level completed! Moving to next level...');
        if (state.currentLevel < state.currentQuiz.totalLevels) {
            changeLevel(state.currentLevel + 1);
        } else {
            alert('🏆 Congratulations! You completed the entire quiz!');
        }
    }
}

function showPreviousQuestion() {
    if (!state.currentQuiz) return;
    
    if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex--;
        updateQuizUI();
    }
}

function showNextQuestion() {
    if (!state.currentQuiz) return;
    
    const questions = state.currentQuiz.questions[state.currentLevel];
    if (state.currentQuestionIndex < questions.length - 1) {
        state.currentQuestionIndex++;
        updateQuizUI();
    }
}

function changeLevel(level) {
    if (!state.currentQuiz) return;
    
    if (level >= 1 && level <= state.currentQuiz.totalLevels) {
        state.currentLevel = level;
        state.currentQuestionIndex = 0;
        updateQuizUI();
        
        // Update level buttons
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.level) === level) {
                btn.classList.add('active');
            }
        });
    }
}

function generateLevelButtons() {
    elements.levelButtons.innerHTML = '';
    for (let i = 1; i <= 25; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        if (i === 1) btn.classList.add('active');
        btn.dataset.level = i;
        btn.textContent = i;
        elements.levelButtons.appendChild(btn);
    }
}

function saveQuizToStorage(quiz) {
    const savedQuizzes = JSON.parse(localStorage.getItem('questify_quizzes') || '[]');
    
    // Remove if already exists with same ID
    const filteredQuizzes = savedQuizzes.filter(q => q.id !== quiz.id);
    filteredQuizzes.push(quiz);
    
    localStorage.setItem('questify_quizzes', JSON.stringify(filteredQuizzes));
    localStorage.setItem('questify_last_quiz', quiz.id);
    loadSavedQuizzes();
}

function loadSavedQuizzes() {
    const savedQuizzes = JSON.parse(localStorage.getItem('questify_quizzes') || '[]');
    state.savedQuizzes = savedQuizzes;
    updateBadgeCount();
    renderSavedQuizzesList();
}

function updateBadgeCount() {
    const badge = document.querySelector('.badge');
    if (badge) {
        badge.textContent = state.savedQuizzes.length;
    }
}

function renderSavedQuizzesList() {
    if (!elements.quizzesList) return;
    
    elements.quizzesList.innerHTML = '';
    
    if (state.savedQuizzes.length === 0) {
        elements.quizzesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No saved quizzes yet</p>
            </div>
        `;
        return;
    }
    
    state.savedQuizzes.forEach(quiz => {
        const quizCard = document.createElement('div');
        quizCard.className = 'quiz-card';
        quizCard.innerHTML = `
            <div class="quiz-card-header">
                <h3>${quiz.subject || 'Quiz'}</h3>
                <span class="quiz-date">${new Date(quiz.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="quiz-card-body">
                <p><i class="fas fa-question-circle"></i> ${quiz.totalQuestions} Questions</p>
                <p><i class="fas fa-layer-group"></i> ${quiz.totalLevels} Levels</p>
            </div>
            <div class="quiz-card-actions">
                <button class="action-btn load-quiz" data-id="${quiz.id}">
                    <i class="fas fa-play"></i> Load
                </button>
                <button class="action-btn delete-quiz" data-id="${quiz.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        elements.quizzesList.appendChild(quizCard);
    });
    
    // Add event listeners to action buttons
    document.querySelectorAll('.load-quiz').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const quizId = parseInt(e.target.closest('button').dataset.id);
            loadQuizFromStorage(quizId);
            elements.quizzesModal.classList.remove('active');
        });
    });
    
    document.querySelectorAll('.delete-quiz').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const quizId = parseInt(e.target.closest('button').dataset.id);
            deleteQuizFromStorage(quizId);
        });
    });
}

function loadQuizFromStorage(quizId) {
    const quiz = state.savedQuizzes.find(q => q.id === quizId);
    if (quiz) {
        state.currentQuiz = quiz;
        state.currentLevel = 1;
        state.currentQuestionIndex = 0;
        state.score = 0;
        
        updateQuizUI();
        generateLevelButtons();
        alert('Quiz loaded successfully!');
    }
}

function deleteQuizFromStorage(quizId) {
    if (confirm('Are you sure you want to delete this quiz?')) {
        const filteredQuizzes = state.savedQuizzes.filter(q => q.id !== quizId);
        localStorage.setItem('questify_quizzes', JSON.stringify(filteredQuizzes));
        loadSavedQuizzes();
    }
}

function showSavedQuizzes() {
    elements.quizzesModal.classList.add('active');
    renderSavedQuizzesList();
}

function resumeLastQuiz() {
    if (state.savedQuizzes.length > 0) {
        const lastQuiz = state.savedQuizzes[state.savedQuizzes.length - 1];
        loadQuizFromStorage(lastQuiz.id);
    } else {
        alert('No saved quizzes found!');
    }
}

function clearAllStorage() {
    if (confirm('Are you sure you want to clear all saved quizzes?')) {
        localStorage.removeItem('questify_quizzes');
        localStorage.removeItem('questify_last_quiz');
        loadSavedQuizzes();
        alert('All saved quizzes cleared!');
    }
}

function changeTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('questify_theme', theme);
    
    // Update active button
    elements.themeBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
}

function applyTheme() {
    const savedTheme = localStorage.getItem('questify_theme') || 'light';
    changeTheme(savedTheme);
}

function checkForResumeQuiz() {
    const lastQuizId = localStorage.getItem('questify_last_quiz');
    if (lastQuizId && state.savedQuizzes.find(q => q.id === parseInt(lastQuizId))) {
        setTimeout(() => {
            if (confirm('Found a previous quiz. Do you want to resume?')) {
                loadQuizFromStorage(parseInt(lastQuizId));
            }
        }, 1000);
    }
}

function createSampleQuiz(subject, numQuestions) {
    const levels = 25;
    const perLevel = Math.ceil(numQuestions / levels);
    const questions = {};
    
    for (let level = 1; level <= levels; level++) {
        questions[level] = [];
        for (let q = 0; q < perLevel; q++) {
            const questionNum = (level - 1) * perLevel + q + 1;
            if (questionNum > numQuestions) break;
            
            questions[level].push({
                id: `q${questionNum}`,
                level: level,
                question: `Sample question ${questionNum} about ${subject}: What is an important concept?`,
                options: [
                    `Correct concept for ${subject}`,
                    `Common misconception A`,
                    `Common misconception B`,
                    `Common misconception C`
                ],
                correctAnswer: 0,
                explanation: `This is a sample explanation for question ${questionNum} about ${subject}.`,
                userAnswer: null,
                isCorrect: null
            });
        }
    }
    
    return {
        id: Date.now(),
        subject: subject,
        totalQuestions: numQuestions,
        totalLevels: levels,
        questionsPerLevel: perLevel,
        createdAt: new Date().toISOString(),
        questions: questions
    };
}

// Add CSS for quiz cards in modal
const style = document.createElement('style');
style.textContent = `
    .quiz-card {
        background: var(--surface);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 1rem;
        transition: var(--transition);
    }
    
    .quiz-card:hover {
        box-shadow: var(--shadow);
        transform: translateY(-2px);
    }
    
    .quiz-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    
    .quiz-card-header h3 {
        margin: 0;
        color: var(--text-primary);
    }
    
    .quiz-date {
        font-size: 0.85rem;
        color: var(--text-secondary);
    }
    
    .quiz-card-body {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    
    .quiz-card-body p {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .quiz-card-actions {
        display: flex;
        gap: 0.5rem;
    }
    
    .action-btn {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-color);
        background: var(--background);
        color: var(--text-primary);
        border-radius: 6px;
        cursor: pointer;
        transition: var(--transition);
        font-size: 0.9rem;
    }
    
    .action-btn:hover {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }
`;
document.head.appendChild(style);

// Start the application
document.addEventListener('DOMContentLoaded', init);
