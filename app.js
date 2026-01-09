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
    themeBtns: document.querySelectorAll('.theme-btn')
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

    try {
        // Generate quiz using Bytez API
        const quiz = await api.generateQuiz(subject, numQuestions);
        
        // Save to state
        state.currentQuiz = quiz;
        state.currentLevel = 1;
        state.currentQuestionIndex = 0;
        state.score = 0;

        // Update UI
        updateQuizUI();
        generateLevelButtons();
        
        // Ask about saving
        const saveQuiz = confirm('Do you want to save this quiz to resume later?');
        if (saveQuiz) {
            saveQuizToStorage(quiz);
        }

    } catch (error) {
        console.error('Error generating quiz:', error);
        alert('Failed to generate quiz. Please try again.');
        
        // Create fallback quiz
        const fallbackQuiz = api.createFallbackQuiz(subject, numQuestions);
        state.currentQuiz = fallbackQuiz;
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
    }
}

function selectOption(optionIndex) {
    const questions = state.currentQuiz.questions[state.currentLevel];
    const currentQuestion = questions[state.currentQuestionIndex];
    
    // Remove selection from all options
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selection to clicked option
    document.querySelector(`.option[data-option="${optionIndex}"]`).classList.add('selected');
    
    // Update question state
    currentQuestion.userAnswer = optionIndex;
    currentQuestion.isCorrect = optionIndex === currentQuestion.correctAnswer;
    
    // Enable submit button
    elements.submitBtn.disabled = false;
}

function submitAnswer() {
    const questions = state.currentQuiz.questions[state.currentLevel];
    const currentQuestion = questions[state.currentQuestionIndex];
    
    if (currentQuestion.isCorrect) {
        state.score += 10;
        elements.score.textContent = state.score;
        alert('Correct! ' + currentQuestion.explanation);
    } else {
        const correctOption = String.fromCharCode(65 + currentQuestion.correctAnswer);
        alert(`Incorrect. The correct answer is ${correctOption}. ${currentQuestion.explanation}`);
    }
    
    // Move to next question if available
    if (state.currentQuestionIndex < questions.length - 1) {
        showNextQuestion();
    } else {
        alert('Level completed! Moving to next level...');
        if (state.currentLevel < state.currentQuiz.totalLevels) {
            changeLevel(state.currentLevel + 1);
        } else {
            alert('Congratulations! You completed the entire quiz!');
        }
    }
}

function showPreviousQuestion() {
    if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex--;
        updateQuizUI();
    }
}

function showNextQuestion() {
    const questions = state.currentQuiz.questions[state.currentLevel];
    if (state.currentQuestionIndex < questions.length - 1) {
        state.currentQuestionIndex++;
        updateQuizUI();
    }
}

function changeLevel(level) {
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
    badge.textContent = state.savedQuizzes.length;
}

function renderSavedQuizzesList() {
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
                <h3>${quiz.subject}</h3>
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
            const quizId = parseInt(e.target.dataset.id);
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
        if (confirm('Found a previous quiz. Do you want to resume?')) {
            loadQuizFromStorage(parseInt(lastQuizId));
        }
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
