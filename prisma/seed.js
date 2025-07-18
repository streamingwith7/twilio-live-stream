const { PrismaClient } = require('@prisma/client');
const { SALES_COACHING_PROMPTS, COACHING_RULES, PROMPT_HELPERS } = require('../lib/prompts-store.js');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding prompts...');

  // Sales Coaching Prompts
  await prisma.prompt.upsert({
    where: { key: 'salesCoach' },
    update: {},
    create: {
      key: 'salesCoach',
      name: 'Sales Coach',
      description: 'Main sales coaching prompt for real-time AI home buying assistant',
      type: 'SALES_COACHING',
      content: SALES_COACHING_PROMPTS.salesCoach,
      variables: null,
      isActive: true,
      version: 1,
      createdBy: 'system'
    }
  });

  await prisma.prompt.upsert({
    where: { key: 'sentimentAnalyzer' },
    update: {},
    create: {
      key: 'sentimentAnalyzer',
      name: 'Sentiment Analyzer',
      description: 'Analyzes seller sentiment in home buyer-to-seller conversations',
      type: 'SENTIMENT_ANALYZER',
      content: SALES_COACHING_PROMPTS.sentimentAnalyzer,
      variables: null,
      isActive: true,
      version: 1,
      createdBy: 'system'
    }
  });

  await prisma.prompt.upsert({
    where: { key: 'stageDetector' },
    update: {},
    create: {
      key: 'stageDetector',
      name: 'Stage Detector',
      description: 'Detects the current stage of the home buyer call based on conversation flow',
      type: 'STAGE_DETECTOR',
      content: SALES_COACHING_PROMPTS.stageDetector,
      variables: null,
      isActive: true,
      version: 1,
      createdBy: 'system'
    }
  });

  await prisma.prompt.upsert({
    where: { key: 'callFeedback' },
    update: {},
    create: {
      key: 'callFeedback',
      name: 'Call Feedback',
      description: 'Provides structured call scoring and coaching feedback for home buying specialists',
      type: 'CALL_FEEDBACK',
      content: SALES_COACHING_PROMPTS.callFeedback,
      variables: null,
      isActive: true,
      version: 1,
      createdBy: 'system'
    }
  });

  await prisma.prompt.upsert({
    where: { key: 'coachingRules' },
    update: {},
    create: {
      key: 'coachingRules',
      name: 'Coaching Rules',
      description: 'Configuration rules for coaching timing and display',
      type: 'COACHING_RULES',
      content: 'Configuration rules for coaching system',
      variables: COACHING_RULES,
      isActive: true,
      version: 1,
      createdBy: 'system'
    }
  });

  await prisma.prompt.upsert({
    where: { key: 'promptHelpers' },
    update: {},
    create: {
      key: 'promptHelpers',
      name: 'Prompt Helpers',
      description: 'Helper functions for building coaching contexts',
      type: 'PROMPT_HELPERS',
      content: 'Helper functions for prompt context building',
      variables: {
        buildCoachingContext: PROMPT_HELPERS.buildCoachingContext.toString(),
        buildSentimentContext: PROMPT_HELPERS.buildSentimentContext.toString(),
        buildStageContext: PROMPT_HELPERS.buildStageContext.toString()
      },
      isActive: true,
      version: 1,
      createdBy: 'system'
    }
  });

  console.log('Prompts seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 