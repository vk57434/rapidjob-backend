const axios = require('axios');

class AIService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        this.modelName = process.env.MODEL_NAME || 'openai/gpt-4o';
    }

    async generateContent(prompt, systemPrompt = "You are a professional resume writer and career coach.") {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key is not configured');
        }

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.modelName,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://rapidjob.ai', // Required by OpenRouter
                        'X-Title': 'RapidJob' // Optional but recommended by OpenRouter
                    }
                }
            );

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content.trim();
            } else {
                console.error('Unexpected OpenRouter Response:', response.data);
                throw new Error('Invalid response from AI service');
            }
        } catch (error) {
            console.error('AI Generation Error (OpenRouter):', error.response?.data || error.message);
            throw new Error('Failed to generate content from AI via OpenRouter');
        }
    }

    buildPrompt(type, data) {
        switch (type) {
            case 'summary':
                return `Generate a professional resume summary for a ${data.jobRole || 'Professional'}.
                Experience: ${JSON.stringify(data.experience)}.
                Skills: ${data.skills.join(', ')}.
                Make it ATS-friendly and concise (3-4 lines).`;

            case 'experience':
                return `Rewrite the following work experience description to be more professional and impact-oriented using action verbs.
                Role: ${data.designation} at ${data.company}.
                Description: ${data.description}.
                Focus on achievements and quantifiable results.`;

            case 'project':
                return `Generate a professional description for a technical project named "${data.name}" built using ${data.technology}.
                Base it on: ${data.description}.
                Highlight the problem solved and the technologies used.`;

            case 'objective':
                return `Write a compelling career objective for a ${data.jobRole} with the following skills: ${data.skills.join(', ')}.`;

            case 'cover_letter':
                return `Write a professional cover letter for the role of ${data.jobRole}.
                Candidate Name: ${data.name}.
                Experience: ${JSON.stringify(data.experience)}.
                Skills: ${data.skills.join(', ')}.
                The letter should be persuasive and tailored to the job.`;

            default:
                return data.context || "Help me with my resume.";
        }
    }
}

module.exports = new AIService();
