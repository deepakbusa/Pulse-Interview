const {
    connectToMongoDB,
    closeMongoDB,
    createUser,
    createSession,
    logAPIRequest,
    saveChatMessage,
    updateUsageStats,
    logAuditEvent,
} = require('../src/utils/mongodb');

/**
 * Comprehensive MongoDB Population Script
 * Creates realistic sample data for complete dashboard platform
 */

// Sample user data with diverse profiles
const sampleUsers = [
    {
        userId: 'user1',
        password: 'pass123',
        email: 'john.doe@example.com',
        fullName: 'John Doe',
        role: 'user',
        plan: 'premium',
        isActive: true,
        preferences: {
            profile: 'interview',
            language: 'en-US',
            theme: 'dark',
            notifications: true,
        },
        metadata: {
            signupSource: 'direct',
            country: 'United States',
            timezone: 'America/New_York',
        },
    },
    {
        userId: 'user2',
        password: 'pass123',
        email: 'jane.smith@example.com',
        fullName: 'Jane Smith',
        role: 'user',
        plan: 'free',
        isActive: true,
        preferences: {
            profile: 'sales',
            language: 'en-US',
            theme: 'dark',
            notifications: true,
        },
        metadata: {
            signupSource: 'referral',
            country: 'Canada',
            timezone: 'America/Toronto',
        },
    },
    {
        userId: 'user3',
        password: 'pass123',
        email: 'alex.johnson@example.com',
        fullName: 'Alex Johnson',
        role: 'user',
        plan: 'premium',
        isActive: true,
        preferences: {
            profile: 'meeting',
            language: 'en-GB',
            theme: 'dark',
            notifications: false,
        },
        metadata: {
            signupSource: 'direct',
            country: 'United Kingdom',
            timezone: 'Europe/London',
        },
    },
    {
        userId: 'user4',
        password: 'pass123',
        email: 'maria.garcia@example.com',
        fullName: 'Maria Garcia',
        role: 'user',
        plan: 'free',
        isActive: true,
        preferences: {
            profile: 'presentation',
            language: 'es-ES',
            theme: 'dark',
            notifications: true,
        },
        metadata: {
            signupSource: 'social',
            country: 'Spain',
            timezone: 'Europe/Madrid',
        },
    },
    {
        userId: 'user5',
        password: 'pass123',
        email: 'chen.wei@example.com',
        fullName: 'Chen Wei',
        role: 'user',
        plan: 'premium',
        isActive: true,
        preferences: {
            profile: 'exam',
            language: 'cmn-CN',
            theme: 'dark',
            notifications: true,
        },
        metadata: {
            signupSource: 'direct',
            country: 'China',
            timezone: 'Asia/Shanghai',
        },
    },
    {
        userId: 'admin',
        password: 'admin789',
        email: 'admin@pulse.com',
        fullName: 'Admin User',
        role: 'admin',
        plan: 'enterprise',
        isActive: true,
        preferences: {
            profile: 'interview',
            language: 'en-US',
            theme: 'dark',
            notifications: true,
        },
        metadata: {
            signupSource: 'internal',
            country: 'United States',
            timezone: 'America/Los_Angeles',
        },
    },
    {
        userId: 'demo',
        password: 'demo123',
        email: 'demo@pulse.com',
        fullName: 'Demo User',
        role: 'demo',
        plan: 'trial',
        isActive: true,
        preferences: {
            profile: 'interview',
            language: 'en-US',
            theme: 'dark',
            notifications: false,
        },
        metadata: {
            signupSource: 'demo',
            country: 'United States',
            timezone: 'America/New_York',
        },
    },
    {
        userId: 'test',
        password: 'test123',
        email: 'test@pulse.com',
        fullName: 'Test User',
        role: 'tester',
        plan: 'free',
        isActive: true,
        preferences: {
            profile: 'sales',
            language: 'en-US',
            theme: 'dark',
            notifications: true,
        },
        metadata: {
            signupSource: 'internal',
            country: 'United States',
            timezone: 'America/Chicago',
        },
    },
    {
        userId: 'premium1',
        password: 'prem123',
        email: 'premium.user@example.com',
        fullName: 'Premium User',
        role: 'user',
        plan: 'premium',
        isActive: true,
        preferences: {
            profile: 'negotiation',
            language: 'en-US',
            theme: 'dark',
            notifications: true,
        },
        metadata: {
            signupSource: 'direct',
            country: 'United States',
            timezone: 'America/Denver',
        },
    },
    {
        userId: 'deactivated',
        password: 'deact123',
        email: 'deactivated@example.com',
        fullName: 'Deactivated User',
        role: 'user',
        plan: 'free',
        isActive: false,
        preferences: {
            profile: 'interview',
            language: 'en-US',
            theme: 'dark',
            notifications: false,
        },
        metadata: {
            signupSource: 'direct',
            country: 'United States',
            timezone: 'America/New_York',
            deactivatedAt: new Date('2025-12-15'),
            deactivationReason: 'User requested account closure',
        },
    },
];

// Helper function to generate random timestamp within last N days
function randomDate(daysAgo) {
    const now = Date.now();
    const randomTime = Math.random() * daysAgo * 24 * 60 * 60 * 1000;
    return new Date(now - randomTime);
}

// Helper function to generate random duration in seconds
function randomDuration(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sample chat messages and responses
const sampleChatExchanges = [
    {
        userMessage: 'How should I introduce myself in the interview?',
        aiResponse: 'Start with a brief professional introduction: your name, current role or recent graduation, and 1-2 key achievements relevant to the position. Keep it under 90 seconds and end with enthusiasm about the opportunity.',
        profile: 'interview',
    },
    {
        userMessage: 'What are the key features of this product?',
        aiResponse: 'The main features include: 1) AI-powered real-time assistance, 2) Screen analysis with Azure Vision, 3) Speech-to-text transcription, 4) Multi-language support, and 5) Customizable profiles for different scenarios.',
        profile: 'sales',
    },
    {
        userMessage: 'How do I handle difficult questions?',
        aiResponse: 'Use the STAR method: Situation, Task, Action, Result. Take a moment to think, be honest if you need clarification, and focus on what you learned from challenging experiences.',
        profile: 'interview',
    },
    {
        userMessage: 'What metrics should I highlight in my presentation?',
        aiResponse: 'Focus on: 1) User growth rate, 2) Customer satisfaction scores, 3) Revenue impact, 4) Cost savings achieved, and 5) Time-to-market improvements. Use visual charts for impact.',
        profile: 'presentation',
    },
    {
        userMessage: 'How can I negotiate better terms?',
        aiResponse: 'Research market rates, understand your value proposition, start with your ideal terms, be ready to walk away if needed, and always look for win-win solutions. Listen more than you talk.',
        profile: 'negotiation',
    },
    {
        userMessage: 'Explain the difference between REST and GraphQL',
        aiResponse: 'REST uses multiple endpoints with fixed data structures, while GraphQL uses a single endpoint where clients specify exactly what data they need. GraphQL reduces over-fetching but has a steeper learning curve.',
        profile: 'exam',
    },
    {
        userMessage: 'What are my strengths for this role?',
        aiResponse: 'Based on common interview scenarios: emphasize your technical skills, problem-solving ability, teamwork experience, and passion for continuous learning. Back each strength with a specific example.',
        profile: 'interview',
    },
    {
        userMessage: 'How do I handle objections about price?',
        aiResponse: 'Acknowledge the concern, reframe around value not cost, share success stories from similar clients, offer flexible payment options, and emphasize ROI and long-term benefits.',
        profile: 'sales',
    },
];

// Sample API services and their typical operations
const apiServices = [
    { service: 'azure-openai', operation: 'chat-completion', avgDuration: 2500 },
    { service: 'azure-speech', operation: 'speech-to-text', avgDuration: 1200 },
    { service: 'azure-vision', operation: 'image-analysis', avgDuration: 1800 },
    { service: 'azure-openai', operation: 'vision-analysis', avgDuration: 3000 },
];

/**
 * Populate MongoDB with comprehensive sample data
 */
async function populateDatabase() {
    try {
        console.log('🚀 Starting MongoDB population...\n');

        await connectToMongoDB();

        // Step 1: Create users
        console.log('👥 Creating users...');
        for (const user of sampleUsers) {
            try {
                await createUser(user);
                console.log(`   ✓ Created user: ${user.userId} (${user.fullName})`);
            } catch (error) {
                if (error.code === 11000) {
                    console.log(`   ⚠ User ${user.userId} already exists, skipping...`);
                } else {
                    throw error;
                }
            }
        }

        // Step 2: Create active sessions (for active users)
        console.log('\n🔐 Creating login sessions...');
        const activeUsers = sampleUsers.filter(u => u.isActive);
        const sessions = [];
        
        for (const user of activeUsers) {
            // Create 1-3 sessions per active user (simulating multiple devices/logins)
            const sessionCount = Math.floor(Math.random() * 3) + 1;
            
            for (let i = 0; i < sessionCount; i++) {
                const sessionId = await createSession(user.userId, {
                    platform: ['win32', 'darwin', 'linux'][Math.floor(Math.random() * 3)],
                    electronVersion: '30.0.5',
                    appVersion: '0.7.0',
                });
                
                sessions.push({ sessionId, userId: user.userId });
                console.log(`   ✓ Created session for ${user.userId}: ${sessionId}`);
            }
        }

        // Step 3: Generate API requests (simulate past activity)
        console.log('\n📊 Generating API request logs...');
        let totalAPIRequests = 0;
        
        for (const user of activeUsers) {
            // Generate 50-200 API requests per active user over the last 30 days
            const requestCount = Math.floor(Math.random() * 151) + 50;
            
            for (let i = 0; i < requestCount; i++) {
                const service = apiServices[Math.floor(Math.random() * apiServices.length)];
                const userSession = sessions.find(s => s.userId === user.userId);
                
                await logAPIRequest({
                    userId: user.userId,
                    sessionId: userSession?.sessionId || 'unknown',
                    service: service.service,
                    operation: service.operation,
                    status: Math.random() > 0.05 ? 'success' : 'error', // 95% success rate
                    duration: service.avgDuration + Math.floor((Math.random() - 0.5) * 500),
                    timestamp: randomDate(30),
                    metadata: {
                        model: service.service === 'azure-openai' ? 'gpt-4o' : undefined,
                        tokensUsed: service.service === 'azure-openai' ? Math.floor(Math.random() * 2000) + 500 : undefined,
                    },
                });
            }
            
            totalAPIRequests += requestCount;
            console.log(`   ✓ Generated ${requestCount} API requests for ${user.userId}`);
        }

        console.log(`   📈 Total API requests: ${totalAPIRequests}`);

        // Step 4: Generate chat history
        console.log('\n💬 Generating chat history...');
        let totalChatMessages = 0;
        
        for (const user of activeUsers) {
            // Generate 20-80 chat exchanges per active user
            const exchangeCount = Math.floor(Math.random() * 61) + 20;
            const userSession = sessions.find(s => s.userId === user.userId);
            
            for (let i = 0; i < exchangeCount; i++) {
                const exchange = sampleChatExchanges[Math.floor(Math.random() * sampleChatExchanges.length)];
                const baseTimestamp = randomDate(30);
                
                // User message
                await saveChatMessage({
                    userId: user.userId,
                    sessionId: userSession?.sessionId || 'unknown',
                    role: 'user',
                    message: exchange.userMessage,
                    profile: user.preferences.profile,
                    timestamp: baseTimestamp,
                });
                
                // AI response (1-3 seconds after user message)
                await saveChatMessage({
                    userId: user.userId,
                    sessionId: userSession?.sessionId || 'unknown',
                    role: 'assistant',
                    message: exchange.aiResponse,
                    profile: user.preferences.profile,
                    timestamp: new Date(baseTimestamp.getTime() + randomDuration(1000, 3000)),
                    metadata: {
                        model: 'gpt-4o',
                        tokensUsed: Math.floor(Math.random() * 1000) + 200,
                        processingTime: randomDuration(800, 2500),
                    },
                });
                
                totalChatMessages += 2;
            }
            
            console.log(`   ✓ Generated ${exchangeCount * 2} messages for ${user.userId}`);
        }

        console.log(`   💬 Total chat messages: ${totalChatMessages}`);

        // Step 5: Generate usage statistics
        console.log('\n📈 Generating usage statistics...');
        
        for (const user of activeUsers) {
            // Generate stats for last 30 days
            for (let day = 0; day < 30; day++) {
                await updateUsageStats(user.userId, {
                    totalRequests: Math.floor(Math.random() * 50) + 10,
                    apiCalls: Math.floor(Math.random() * 30) + 5,
                    chatMessages: Math.floor(Math.random() * 40) + 10,
                    screenshotsAnalyzed: Math.floor(Math.random() * 15) + 2,
                    transcriptionMinutes: Math.floor(Math.random() * 60) + 10,
                });
            }
            
            console.log(`   ✓ Generated 30 days of usage stats for ${user.userId}`);
        }

        // Step 6: Generate audit logs
        console.log('\n📝 Generating audit logs...');
        const auditActions = [
            'user.login',
            'user.logout',
            'session.start',
            'session.end',
            'profile.change',
            'settings.update',
            'api.request',
            'screenshot.capture',
            'transcription.start',
            'transcription.stop',
        ];
        
        let totalAuditLogs = 0;
        
        for (const user of activeUsers) {
            const auditCount = Math.floor(Math.random() * 101) + 50;
            
            for (let i = 0; i < auditCount; i++) {
                const action = auditActions[Math.floor(Math.random() * auditActions.length)];
                
                await logAuditEvent({
                    userId: user.userId,
                    action,
                    status: Math.random() > 0.02 ? 'success' : 'failure', // 98% success rate
                    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                    userAgent: 'Electron/30.0.5 Pulse/0.7.0',
                    timestamp: randomDate(30),
                    metadata: {
                        source: 'desktop-app',
                        details: `Action ${action} performed`,
                    },
                });
            }
            
            totalAuditLogs += auditCount;
            console.log(`   ✓ Generated ${auditCount} audit logs for ${user.userId}`);
        }

        console.log(`   📝 Total audit logs: ${totalAuditLogs}`);

        // Summary
        console.log('\n✅ Database population completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   • Users: ${sampleUsers.length}`);
        console.log(`   • Active Sessions: ${sessions.length}`);
        console.log(`   • API Requests: ${totalAPIRequests}`);
        console.log(`   • Chat Messages: ${totalChatMessages}`);
        console.log(`   • Audit Logs: ${totalAuditLogs}`);
        console.log(`   • Usage Statistics: ${activeUsers.length * 30} days\n`);

        console.log('🔐 Sample Credentials:');
        console.log('   • admin / admin789 (Admin user)');
        console.log('   • demo / demo123 (Demo user)');
        console.log('   • user1 / pass123 (Premium user)');
        console.log('   • user2 / pass123 (Free user)');
        console.log('   • test / test123 (Test user)\n');

        await closeMongoDB();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error populating database:', error);
        process.exit(1);
    }
}

// Run the population script
populateDatabase();
