const aiService = require('../services/ai.service');

exports.generateResumeContent = async (req, res) => {
    try {
        const { type, data } = req.body;

        if (!type || !data) {
            return res.status(400).json({ error: 'Type and data are required' });
        }

        const prompt = aiService.buildPrompt(type, data);
        const generatedText = await aiService.generateContent(prompt);

        res.json({
            status: 'success',
            data: generatedText
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
