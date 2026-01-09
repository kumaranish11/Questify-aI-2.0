// Serverless function for Vercel (using Bytez API)
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { subject, numQuestions } = req.body;

        if (!subject || !numQuestions) {
            return res.status(400).json({ error: 'Subject and number of questions are required' });
        }

        if (numQuestions < 150 || numQuestions > 250) {
            return res.status(400).json({ error: 'Number of questions must be between 150 and 250' });
        }

        // Bytez API Configuration
        const BYTEZ_API_KEY = process.env.BYTEZ_API_KEY || 'd45b101b7b72903a4f57d976a3ff608f';
        const BYTEZ_API_URL = 'https://api.bytez.com/chat/completions';
        const MODEL = 'openai/gpt-4o';

        // Create the prompt
        const prompt = `Generate a quiz with exactly ${numQuestions} multiple-choice questions about "${subject}".
        
        Format the response as a JSON array. Each question must have:
        - question: string
        - options: array of exactly 4 strings
        - correctAnswer: number (0-3)
        - explanation: string
        - level: number (1-25, assign sequentially)
        
        Organize questions into 25 levels with approximately ${Math.ceil(numQuestions / 25)} questions per level.
        Make the questions educational, diverse, and gradually increase in difficulty.`;

        // Call Bytez API
        const response = await fetch(BYTEZ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${BYTEZ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert quiz generator. Always respond with valid JSON only, no additional text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 8000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Bytez API Error:', response.status, errorText);
            throw new Error(`Bytez API error: ${response.status}`);
        }

        const data = await response.json();
        let questions;

        try {
            // Try to parse the response as JSON
            const content = data.choices[0].message.content;
            
            // Clean up the response (remove markdown code blocks if present)
            const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
            questions = JSON.parse(cleanedContent);
        } catch (parseError) {
            console.error('Failed to parse API response:', parseError);
            // Create fallback questions
            questions = createFallbackQuestions(subject, numQuestions);
        }

        // Organize by levels
        const organizedQuiz = organizeQuestionsByLevel(questions, numQuestions);

        return res.status(200).json(organizedQuiz);

    } catch (error) {
        console.error('Error in generate-quiz:', error);
        return res.status(500).json({ 
            error: 'Failed to generate quiz',
            details: error.message,
            fallback: createFallbackQuiz(req.body?.subject || 'General', req.body?.numQuestions || 200)
        });
    }
}

// Helper functions
function createFallbackQuestions(subject, numQuestions) {
    const questions = [];
    const levels = 25;
    const perLevel = Math.ceil(numQuestions / levels);

    for (let i = 1; i <= numQuestions; i++) {
        const level = Math.ceil(i / perLevel);
        questions.push({
            question: `What is an important concept about ${subject} (Question ${i})?`,
            options: [
                `Correct answer for question ${i}`,
                `Incorrect option A for question ${i}`,
                `Incorrect option B for question ${i}`,
                `Incorrect option C for question ${i}`
            ],
            correctAnswer: 0,
            explanation: `This is the explanation for question ${i} about ${subject}.`,
            level: Math.min(level, 25)
        });
    }
    return questions;
}

function organizeQuestionsByLevel(questions, totalQuestions) {
    const levels = 25;
    const perLevel = Math.ceil(totalQuestions / levels);
    const organized = {};

    // Initialize levels
    for (let level = 1; level <= levels; level++) {
        organized[level] = [];
    }

    // Distribute questions to levels
    questions.forEach((question, index) => {
        const level = question.level || Math.floor(index / perLevel) + 1;
        const actualLevel = Math.min(level, levels);
        
        organized[actualLevel].push({
            ...question,
            id: `q${index + 1}`,
            level: actualLevel,
            userAnswer: null,
            isCorrect: null
        });
    });

    // Fill any empty levels with sample questions
    for (let level = 1; level <= levels; level++) {
        if (organized[level].length === 0) {
            organized[level] = Array.from({ length: perLevel }, (_, i) => ({
                id: `q${(level - 1) * perLevel + i + 1}`,
                level: level,
                question: `Sample question about the subject (Level ${level}, Q${i + 1})?`,
                options: ["Option A", "Option B", "Option C", "Option D"],
                correctAnswer: 0,
                explanation: "This is a sample question explanation.",
                userAnswer: null,
                isCorrect: null
            }));
        }
    }

    return {
        id: Date.now(),
        subject: "Generated Quiz",
        totalQuestions: totalQuestions,
        totalLevels: levels,
        questionsPerLevel: perLevel,
        createdAt: new Date().toISOString(),
        questions: organized
    };
}

function createFallbackQuiz(subject, numQuestions) {
    const questions = createFallbackQuestions(subject, numQuestions);
    return organizeQuestionsByLevel(questions, numQuestions);
          }
