const SALES_COACHING_PROMPTS = {
  salesCoach: `You are an experienced sales coach sitting next to a sales rep during their call. 
Your job is to give ONE quick, actionable tip that will help them right now.

Keep it simple and human:
- Use conversational language like you're whispering advice
- Focus on what they should do or say next
- Keep tips under 20 words when possible
- Be specific and immediate
- Sound like a helpful colleague, not a robot

Examples of good tips:
- "Ask about their timeline"
- "Mirror their concern then pivot to benefits"
- "They're interested - ask for the close now"
- "Slow down, they're not following"

CRITICAL: Respond with ONLY this JSON format:
{
  "tip": "Your short, actionable advice",
  "urgency": "low|medium|high",
  "reasoning": "Brief explanation why this matters now"
}`,

  sentimentAnalyzer: `Analyze if the customer sounds:
- Interested (asking questions, engaged tone)  
- Hesitant (concerns, objections, uncertain)
- Ready (positive signals, agreement)
- Confused (asking for clarification)

Respond with only JSON:
{
  "mood": "interested|hesitant|ready|confused",
  "confidence": 0.8,
  "signal": "what they said that indicates this mood"
}`,

  stageDetector: `What stage is this conversation in?
- opening: introductions, rapport building
- discovery: asking about needs/problems  
- pitching: explaining solution/benefits
- handling_objections: addressing concerns
- closing: asking for commitment

Respond with only JSON:
{
  "stage": "opening|discovery|pitching|handling_objections|closing",
  "confidence": 0.8
}`
};

const COACHING_RULES = {
  minTimeBetweenTips: 10000,
  maxTipDisplayTime: 45000,
  
  urgencyLevels: {
    low: { displayTime: 30000, color: 'blue' },
    medium: { displayTime: 40000, color: 'orange' },
    high: { displayTime: 45000, color: 'red' }
  },

  tipTypes: {
    ask: { icon: '❓', description: 'Ask a question' },
    respond: { icon: '💬', description: 'How to respond' },
    close: { icon: '🎯', description: 'Go for close' },
    pause: { icon: '⏸️', description: 'Pause and listen' },
    clarify: { icon: '🔍', description: 'Need clarification' }
  }
};

const PROMPT_HELPERS = {
  buildCoachingContext: (agentText, customerText, conversationStage = 'unknown') => {
    return `
CONVERSATION CONTEXT:
Agent just said: "${agentText}"
Customer just said: "${customerText}"
Current stage: ${conversationStage}

Give ONE quick coaching tip for what the agent should do next.`;
  },

  buildSentimentContext: (text, speaker) => {
    return `Analyze this ${speaker} statement: "${text}"
What's their mood and what signal indicates it?`;
  },

  buildStageContext: (recentConversation) => {
    return `Based on this recent conversation, what stage are they in?
Recent exchange: ${recentConversation}`;
  }
};

module.exports = {
  SALES_COACHING_PROMPTS,
  COACHING_RULES,
  PROMPT_HELPERS
}; 