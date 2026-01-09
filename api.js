// Bytez API Configuration
const BYTEZ_API_KEY = 'd45b101b7b72903a4f57d976a3ff608f';
const BYTEZ_API_URL = 'https://api.bytez.com/chat/completions';
const MODEL = 'openai/gpt-4o';

class BytezAPI {
    constructor() {
        this.apiKey = BYTEZ_API_KEY;
        this.baseUrl = BYTEZ_API_URL;
        this.model = MODEL;
    }

    async generateQuiz(subject, numQuestions) {
        try {
            const prompt = this.createQuizPrompt(subject, numQuestions);
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert quiz generator. Generate multiple-choice questions with exactly 4 options each. Format response as JSON.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseQuizData(data.choices[0].message.content, subject, numQuestions);
            
        } catch (error) {
            console.error('Bytez API Error:', error);
            throw error;
        }
    }

    createQuizPrompt(subject, numQuestions) {
        return `Generate a quiz with ${numQuestions} multiple-choice questions about "${subject}".
        
        Requirements:
        1. Format as JSON array
        2. Each question must have:
           - question: string
           - options: array of exactly 4 strings
           - correctAnswer: number (0-3)
           - explanation: string explaining the answer
        3. Organize questions in 25 levels with 10 questions per level
        4. Difficulty should increase gradually
        5. Make questions diverse and educational
        
        Example format:
        [
          {
            "level": 1,
            "question": "What is...?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0,
            "explanation": "Because..."
          }
        ]
        
        Generate exactly ${numQuestions} questions.`;
    }

    parseQuizData(apiResponse, subject, numQuestions) {
        try {
            // Try to parse JSON directly
            let questions;
            try {
                questions = JSON.parse(apiResponse);
            } catch {
                // Extract JSON from markdown if needed
                const jsonMatch = apiResponse.match(/```json\n([\s\S]*?)\n```/) || 
                                 apiResponse.match(/```\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    questions = JSON.parse(jsonMatch[1]);
                } else {
                    questions = JSON.parse(apiResponse);
                }
            }

            // Validate and structure data
            const structuredQuiz = {
                id: Date.now(),
                subject: subject,
                totalQuestions: numQuestions,
                totalLevels: 25,
                questionsPerLevel: Math.ceil(numQuestions / 25),
                createdAt: new Date().toISOString(),
                questions: this.organizeQuestionsByLevel(questions, numQuestions)
            };

            return structuredQuiz;
            
        } catch (error) {
            console.error('Parsing Error:', error);
            // Fallback: Create sample questions if API fails
            return this.createFallbackQuiz(subject, numQuestions);
        }
    }

    organizeQuestionsByLevel(questions, totalQuestions) {
        const levels = 25;
        const perLevel = Math.ceil(totalQuestions / levels);
        const organized = {};

        for (let level = 1; level <= levels; level++) {
            const start = (level - 1) * perLevel;
            const end = Math.min(start + perLevel, totalQuestions);
            organized[level] = questions.slice(start, end).map((q, i) => ({
                ...q,
                id: `q${start + i + 1}`,
                level: level,
                userAnswer: null,
                isCorrect: null
            }));
        }

        return organized;
    }

    createFallbackQuiz(subject, numQuestions) {
        const questions = [];
        const levels = 25;
        const perLevel = Math.ceil(numQuestions / levels);

        for (let i = 1; i <= numQuestions; i++) {
            const level = Math.ceil(i / perLevel);
            questions.push({
                id: `q${i}`,
                level: level,
                question: `Sample question ${i} about ${subject}?`,
                options: [
                    `Option A for question ${i}`,
                    `Option B for question ${i}`,
                    `Option C for question ${i}`,
                    `Option D for question ${i}`
                ],
                correctAnswer: Math.floor(Math.random() * 4),
                explanation: `This is the explanation for question ${i}`,
                userAnswer: null,
                isCorrect: null
            });
        }

        return {
            id: Date.now(),
            subject: subject,
            totalQuestions: numQuestions,
            totalLevels: levels,
            questionsPerLevel: perLevel,
            createdAt: new Date().toISOString(),
            questions: this.organizeQuestionsByLevel(questions, numQuestions)
        };
    }
}

// Export for use in app.js
const api = new BytezAPI();
