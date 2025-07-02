import { openaiService } from '@/lib/openai-service'

interface ConversationTurn {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  intent?: string;
  confidence?: number;
}

interface CallAnalytics {
  conversationStage: 'opening' | 'discovery' | 'presentation' | 'objection' | 'closing';
  customerSentiment: 'positive' | 'negative' | 'neutral';
  agentPerformance: number; // 0-100 score
  talkRatio: { agent: number; customer: number }; // percentage
  keyMoments: string[];
  detectedIntents: string[];
  riskFactors: string[];
  opportunities: string[];
}

// Simplified coaching tip interface
interface SimpleCoachingTip {
  id: string;
  tip: string;
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  callSid: string;
  timestamp: string;
  conversationStage: string;
  suggestedScript: string;
}

class EnhancedConversationTracker {
  private conversations = new Map<string, {
    turns: ConversationTurn[];
    analytics: CallAnalytics;
    lastTipTime: number;
    tipHistory: SimpleCoachingTip[];
    callStartTime: number;
    customerProfile?: any;
    lastSpeaker?: 'agent' | 'customer';
    customerJustFinishedSpeaking: boolean;
  }>();

  initializeCall(callSid: string, customerData?: any) {
    this.conversations.set(callSid, {
      turns: [],
      analytics: {
        conversationStage: 'opening',
        customerSentiment: 'neutral',
        agentPerformance: 50,
        talkRatio: { agent: 0, customer: 0 },
        keyMoments: [],
        detectedIntents: [],
        riskFactors: [],
        opportunities: []
      },
      lastTipTime: 0,
      tipHistory: [],
      callStartTime: Date.now(),
      customerProfile: customerData,
      lastSpeaker: undefined,
      customerJustFinishedSpeaking: false
    });
  }

  addTranscript(callSid: string, speaker: 'agent' | 'customer', text: string, timestamp: string) {
    const conversation = this.conversations.get(callSid);
    if (!conversation) return;

    const wasCustomerSpeaking = conversation.lastSpeaker === 'customer';
    const isCustomerSpeaking = speaker === 'customer';
    console.log('lastSpeaker', conversation.lastSpeaker);
    console.log('speaker', speaker);
    conversation.customerJustFinishedSpeaking = (wasCustomerSpeaking && !isCustomerSpeaking) || 
                                                 (conversation.lastSpeaker === undefined && !isCustomerSpeaking && conversation.turns.some(t => t.speaker === 'customer'));
    conversation.lastSpeaker = speaker;

    const turn: ConversationTurn = {
      speaker,
      text,
      timestamp,
      sentiment: this.analyzeSentiment(text),
      intent: this.detectIntent(text, speaker),
      confidence: this.calculateConfidence(text)
    };

    conversation.turns.push(turn);
    this.updateAnalytics(callSid, turn);
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['great', 'excellent', 'perfect', 'love', 'amazing', 'fantastic', 'wonderful', 'interested', 'yes', 'absolutely',
                          'dream home', 'beautiful', 'spacious', 'move forward', 'ready to buy', 'ready to list', 'exactly what', 'impressed',
                          'good value', 'fair price', 'reasonable', 'motivated', 'excited', 'sounds good'];
    const negativeWords = ['terrible', 'awful', 'hate', 'no', 'never', 'problem', 'issue', 'concerned', 'worried', 'expensive',
                          'overpriced', 'too small', 'needs work', 'bad location', 'not interested', 'disappointing', 'commission too high',
                          'fees too much', 'cant afford', 'bad market', 'unrealistic', 'not worth it'];
    
    const words = text.toLowerCase().split(' ');
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positiveScore++;
      if (negativeWords.some(nw => word.includes(nw))) negativeScore++;
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  private detectIntent(text: string, speaker: 'agent' | 'customer'): string {
    const lowerText = text.toLowerCase();
    
    if (speaker === 'customer') {
      // Real estate specific customer intents (BUYER & SELLER)
      if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('expensive') || lowerText.includes('budget')) {
        return 'price_inquiry';
      }
      if (lowerText.includes('commission') || lowerText.includes('fees') || lowerText.includes('what do you charge')) {
        return 'commission_inquiry';
      }
      if (lowerText.includes('location') || lowerText.includes('neighborhood') || lowerText.includes('area') || lowerText.includes('schools')) {
        return 'location_inquiry';
      }
      if (lowerText.includes('bedrooms') || lowerText.includes('bathrooms') || lowerText.includes('square feet') || lowerText.includes('garage')) {
        return 'property_features';
      }
      if (lowerText.includes('market value') || lowerText.includes('what is it worth') || lowerText.includes('comps') || lowerText.includes('comparable')) {
        return 'property_valuation';
      }
      if (lowerText.includes('think about') || lowerText.includes('consider') || lowerText.includes('decide later') || lowerText.includes('sleep on it')) {
        return 'hesitation';
      }
      if (lowerText.includes('not interested') || lowerText.includes('not right now') || lowerText.includes('looking elsewhere')) {
        return 'rejection';
      }
      if (lowerText.includes('when can we see') || lowerText.includes('schedule a showing') || lowerText.includes('viewing')) {
        return 'showing_request';
      }
      if (lowerText.includes('list my house') || lowerText.includes('sell my home') || lowerText.includes('listing agreement')) {
        return 'listing_request';
      }
      if (lowerText.includes('mortgage') || lowerText.includes('financing') || lowerText.includes('pre-approved') || lowerText.includes('loan')) {
        return 'financing_inquiry';
      }
      if (lowerText.includes('staging') || lowerText.includes('prepare house') || lowerText.includes('improvements') || lowerText.includes('repairs')) {
        return 'property_preparation';
      }
      if (lowerText.includes('yes') || lowerText.includes('sounds good') || lowerText.includes('interested')) {
        return 'positive_engagement';
      }
    } else {
      // Real estate specific agent intents (BUYER & SELLER scenarios)
      if (lowerText.includes('tell me about') || lowerText.includes('what are you looking for') || lowerText.includes('budget') || lowerText.includes('why are you selling')) {
        return 'discovery_question';
      }
      if (lowerText.includes('i understand') || lowerText.includes('that makes sense') || lowerText.includes('i hear you')) {
        return 'empathy';
      }
      if (lowerText.includes('would you like to see') || lowerText.includes('shall we schedule') || lowerText.includes('viewing')) {
        return 'closing_attempt';
      }
      if (lowerText.includes('ready to list') || lowerText.includes('sign the listing') || lowerText.includes('move forward with listing')) {
        return 'listing_close';
      }
      if (lowerText.includes('this property has') || lowerText.includes('features include') || lowerText.includes('neighborhood offers')) {
        return 'property_presentation';
      }
      if (lowerText.includes('market analysis') || lowerText.includes('comparable sales') || lowerText.includes('pricing strategy') || lowerText.includes('market value')) {
        return 'market_analysis';
      }
      if (lowerText.includes('my marketing plan') || lowerText.includes('how i sell homes') || lowerText.includes('my strategy')) {
        return 'value_proposition';
      }
    }
    
    return 'general';
  }

  private calculateConfidence(text: string): number {
    // Simple confidence calculation based on text length and completeness
    const wordCount = text.split(' ').length;
    if (wordCount < 3) return 0.6;
    if (wordCount < 8) return 0.8;
    return 0.95;
  }

  private updateAnalytics(callSid: string, turn: ConversationTurn) {
    const conversation = this.conversations.get(callSid);
    if (!conversation) return;

    const { analytics, turns } = conversation;
    
    // Update talk ratio
    const agentTurns = turns.filter(t => t.speaker === 'agent').length;
    const customerTurns = turns.filter(t => t.speaker === 'customer').length;
    const total = agentTurns + customerTurns;
    
    analytics.talkRatio = {
      agent: total > 0 ? (agentTurns / total) * 100 : 0,
      customer: total > 0 ? (customerTurns / total) * 100 : 0
    };

    // Update conversation stage
    analytics.conversationStage = this.determineConversationStage(turns);
    
    // Update customer sentiment
    const recentCustomerTurns = turns.filter(t => t.speaker === 'customer').slice(-3);
    if (recentCustomerTurns.length > 0) {
      const sentiments = recentCustomerTurns.map(t => t.sentiment);
      analytics.customerSentiment = this.calculateOverallSentiment(sentiments);
    }

    // Detect risk factors
    this.detectRiskFactors(analytics, turn);
    
    // Detect opportunities
    this.detectOpportunities(analytics, turn);
  }

  private determineConversationStage(turns: ConversationTurn[]): 'opening' | 'discovery' | 'presentation' | 'objection' | 'closing' {
    const recentTurns = turns.slice(-5);
    const recentText = recentTurns.map(t => t.text.toLowerCase()).join(' ');
    
    // Real estate specific stage detection (BUYER & SELLER)
    if (recentText.includes('price') || recentText.includes('too expensive') || recentText.includes('budget') || recentText.includes('cant afford') || 
        recentText.includes('commission') || recentText.includes('fees') || recentText.includes('too high')) {
      return 'objection';
    }
    if (recentText.includes('schedule') || recentText.includes('showing') || recentText.includes('when can we see') || recentText.includes('viewing') || recentText.includes('offer') ||
        recentText.includes('list my house') || recentText.includes('listing agreement') || recentText.includes('ready to list') || recentText.includes('sign')) {
      return 'closing';
    }
    if (recentText.includes('property has') || recentText.includes('neighborhood') || recentText.includes('features') || recentText.includes('bedrooms') || recentText.includes('square feet') ||
        recentText.includes('market analysis') || recentText.includes('comparable') || recentText.includes('marketing plan') || recentText.includes('strategy')) {
      return 'presentation';
    }
    if (recentText.includes('looking for') || recentText.includes('budget') || recentText.includes('what are you') || recentText.includes('tell me about') ||
        recentText.includes('why selling') || recentText.includes('motivation') || recentText.includes('timeline')) {
      return 'discovery';
    }
    
    return turns.length < 6 ? 'opening' : 'discovery';
  }

  private calculateOverallSentiment(sentiments: (string | undefined)[]): 'positive' | 'negative' | 'neutral' {
    const validSentiments = sentiments.filter(s => s) as string[];
    const positiveCount = validSentiments.filter(s => s === 'positive').length;
    const negativeCount = validSentiments.filter(s => s === 'negative').length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private detectRiskFactors(analytics: CallAnalytics, turn: ConversationTurn) {
    const text = turn.text.toLowerCase();
    
    // Customer disengagement
    if (turn.speaker === 'customer' && text.length < 10 && analytics.customerSentiment === 'negative') {
      analytics.riskFactors.push('Customer seems disengaged');
    }
    
    // Real estate price objections (BUYER & SELLER)
    if (text.includes('expensive') || text.includes('too much') || text.includes('out of budget') || text.includes('cant afford')) {
      analytics.riskFactors.push('Price objection detected');
    }
    
    // Commission/fee objections (SELLER)
    if (text.includes('commission too high') || text.includes('fees too much') || text.includes('reduce commission') || text.includes('discount fees')) {
      analytics.riskFactors.push('Commission objection detected');
    }
    
    // Location concerns (BUYER)
    if (text.includes('location') && (text.includes('not') || text.includes('wrong') || text.includes('bad'))) {
      analytics.riskFactors.push('Location concerns expressed');
    }
    
    // Property condition concerns (BUYER & SELLER)
    if (text.includes('needs work') || text.includes('repairs') || text.includes('outdated') || text.includes('condition')) {
      analytics.riskFactors.push('Property condition concerns');
    }
    
    // Market timing concerns (SELLER)
    if (text.includes('bad time to sell') || text.includes('market is down') || text.includes('wait for better market')) {
      analytics.riskFactors.push('Market timing concerns');
    }
    
    // Pricing expectations too high (SELLER)
    if (text.includes('neighbor sold for more') || text.includes('zillow says') || text.includes('should be worth more')) {
      analytics.riskFactors.push('Unrealistic pricing expectations');
    }
    
    // Other agents/properties mentioned (BUYER & SELLER)
    if (text.includes('other agent') || text.includes('other property') || text.includes('looking at others') || text.includes('shopping around') ||
        text.includes('interviewing agents') || text.includes('other realtor')) {
      analytics.riskFactors.push('Considering other options');
    }
    
    // Timeline issues (BUYER & SELLER)
    if (text.includes('no rush') || text.includes('not urgent') || text.includes('take our time') || text.includes('no hurry to sell')) {
      analytics.riskFactors.push('No urgency expressed');
    }
    
    // Agent talking too much
    if (analytics.talkRatio.agent > 70) {
      analytics.riskFactors.push('Agent dominating conversation');
    }
  }

  private detectOpportunities(analytics: CallAnalytics, turn: ConversationTurn) {
    const text = turn.text.toLowerCase();
    
    // Positive engagement
    if (turn.speaker === 'customer' && turn.sentiment === 'positive') {
      analytics.opportunities.push('Customer showing positive interest');
    }
    
    // Real estate specific opportunities (BUYER & SELLER)
    if (text.includes('love') || text.includes('perfect') || text.includes('exactly what') || text.includes('dream home')) {
      analytics.opportunities.push('Strong emotional connection to property');
    }
    
    // Urgency indicators (BUYER & SELLER)
    if (text.includes('need to move') || text.includes('lease expires') || text.includes('closing soon') || text.includes('time sensitive') ||
        text.includes('need to sell quickly') || text.includes('already bought') || text.includes('job relocation')) {
      analytics.opportunities.push('Time urgency expressed');
    }
    
    // Financial readiness (BUYER)
    if (text.includes('pre-approved') || text.includes('cash buyer') || text.includes('financing ready') || text.includes('qualified')) {
      analytics.opportunities.push('Financial qualification confirmed');
    }
    
    // Motivated seller indicators (SELLER)
    if (text.includes('need to sell') || text.includes('must sell') || text.includes('divorce') || text.includes('estate sale') || 
        text.includes('financial hardship') || text.includes('foreclosure')) {
      analytics.opportunities.push('Highly motivated seller');
    }
    
    // Property preparation willingness (SELLER)
    if (text.includes('willing to stage') || text.includes('make repairs') || text.includes('fix things') || text.includes('prepare house')) {
      analytics.opportunities.push('Willing to prepare property');
    }
    
    // Viewing interest (BUYER)
    if (text.includes('want to see') || text.includes('schedule showing') || text.includes('when can we visit')) {
      analytics.opportunities.push('Ready to view property');
    }
    
    // Listing readiness (SELLER)
    if (text.includes('ready to list') || text.includes('want to sell') || text.includes('when can we start')) {
      analytics.opportunities.push('Ready to move forward with listing');
    }
    
    // Family/lifestyle fit (BUYER)
    if (text.includes('kids would love') || text.includes('family room') || text.includes('perfect for us')) {
      analytics.opportunities.push('Lifestyle fit identified');
    }
    
    // Decision maker indicators (BUYER & SELLER)
    if (text.includes('i decide') || text.includes('my decision') || text.includes('we can approve') || text.includes('final say') ||
        text.includes('my house') || text.includes('sole owner')) {
      analytics.opportunities.push('Decision maker identified');
    }
    
    // Market awareness (BUYER & SELLER)
    if (text.includes('before someone else') || text.includes('dont want to lose') || text.includes('market is hot') ||
        text.includes('prices going up') || text.includes('good time to sell')) {
      analytics.opportunities.push('Market urgency awareness');
    }
    
    // Trust building (SELLER)
    if (text.includes('you seem knowledgeable') || text.includes('like your approach') || text.includes('trust you')) {
      analytics.opportunities.push('Trust and rapport building');
    }
  }

  getConversation(callSid: string) {
    return this.conversations.get(callSid);
  }

  endCall(callSid: string) {
    const conversation = this.conversations.get(callSid);
    if (conversation) {
      // Store final analytics for reporting
      console.log(`Call ${callSid} ended. Final analytics:`, conversation.analytics);
    }
    this.conversations.delete(callSid);
  }
}

class EnhancedCoachingService {
  private tracker = new EnhancedConversationTracker();

  async processTranscript(
    callSid: string,
    track: string,
    transcriptionData: string,
    timestamp: string,
    speaker: 'agent' | 'customer'
  ): Promise<SimpleCoachingTip | null> {
    try {

      let actualTranscript = transcriptionData;
      try {
        const parsed = JSON.parse(transcriptionData);
        actualTranscript = parsed.transcript || transcriptionData;
      } catch (e) {
        actualTranscript = transcriptionData;
      }

      this.tracker.addTranscript(callSid, speaker, actualTranscript, timestamp);
      
      const conversation = this.tracker.getConversation(callSid);
      if (!conversation) {
        this.tracker.initializeCall(callSid);
        return null;
      }

      if (speaker === 'agent') {
        return null;
      }

      const tip = await this.generateEnhancedTip(callSid, conversation);
      
      if (tip) {
        conversation.lastTipTime = Date.now();
        conversation.tipHistory.push(tip);
        return tip;
      }

      return null;
    } catch (error) {
      console.error('Error in enhanced coaching analysis:', error);
      return null;
    }
  }

  private async generateEnhancedTip(
    callSid: string,
    conversation: any
  ): Promise<SimpleCoachingTip | null> {
    const { turns, analytics } = conversation;
    const lastCustomerTurn = turns.filter((t: ConversationTurn) => t.speaker === 'customer').slice(-1)[0];
    if (!lastCustomerTurn) {
      console.log('No customer speech detected yet');
      return null;
    }

    const fullConversation = turns
      .map((turn: ConversationTurn, index: number) => {
        const turnNumber = index + 1;
        const sentiment = turn.sentiment ? ` [${turn.sentiment}]` : '';
        const intent = turn.intent ? ` [${turn.intent}]` : '';
        return `Turn ${turnNumber} - ${turn.speaker}${sentiment}${intent}: "${turn.text}"`;
      })
      .join('\n');

    const conversationSummary = {
      totalTurns: turns.length,
      agentTurns: turns.filter((t: ConversationTurn) => t.speaker === 'agent').length,
      customerTurns: turns.filter((t: ConversationTurn) => t.speaker === 'customer').length,
      duration: Date.now() - conversation.callStartTime,
      previousTipCount: conversation.tipHistory?.length || 0
    };

    try {
      const tipData = await openaiService.generateCoachingTip({
        conversationHistory: turns,
        fullConversation,
        recentCustomerText: lastCustomerTurn.text,
        previousTips: conversation.tipHistory || [],
        callSid,
        timestamp: new Date().toISOString(),
        analytics: {
          ...analytics,
          conversationSummary
        }
      });
      
      return {
        id: `tip_${callSid}_${Date.now()}`,
        tip: tipData.tip,
        urgency: tipData.urgency,
        suggestedScript: tipData.suggested_script,
        reasoning: `${tipData.reasoning} (Based on ${turns.length} conversation turns + ${conversation.tipHistory?.length || 0} previous tips)`,
        callSid,
        timestamp: new Date().toISOString(),
        conversationStage: analytics.conversationStage
      };
      
    } catch (error) {
      console.error('Error generating tip:', error);
      return null;
    }
  }

  getCallAnalytics(callSid: string) {
    const conversation = this.tracker.getConversation(callSid);
    return conversation?.analytics;
  }

  generateCallSummary(callSid: string) {
    const conversation = this.tracker.getConversation(callSid);
    if (!conversation) return null;

    return {
      duration: Date.now() - conversation.callStartTime,
      totalTurns: conversation.turns.length,
      analytics: conversation.analytics,
      tipCount: conversation.tipHistory.length,
      keyInsights: this.extractKeyInsights(conversation)
    };
  }

  private extractKeyInsights(conversation: any): string[] {
    const insights: string[] = [];
    const { analytics, turns } = conversation;

    if (analytics.talkRatio.agent > 70) {
      insights.push('Agent dominated the conversation - consider asking more questions');
    }

    if (analytics.customerSentiment === 'positive' && analytics.conversationStage !== 'closing') {
      insights.push('Customer is engaged - good time to move toward closing');
    }

    if (analytics.riskFactors.length > 2) {
      insights.push('Multiple risk factors detected - focus on addressing concerns');
    }

    return insights;
  }

  endCall(callSid: string) {
    return this.tracker.endCall(callSid);
  }
}

export const coachingService = new EnhancedCoachingService();