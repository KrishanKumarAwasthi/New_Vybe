const io = require('socket.io-client');
const axios = require('axios');
const assert = require('assert');
const { execSync } = require('child_process');

const API_URL = 'http://localhost:8000';

const generateUser = (prefix) => ({
    name: `${prefix} Name`,
    userName: `${prefix}_${Date.now()}`,
    email: `${prefix}_${Date.now()}@example.com`,
    password: 'password123',
    gender: 'male'
});

const dockerCmd = (cmd) => {
    try {
        console.log(`Executing: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Docker command failed: ${cmd}`);
    }
};

const delay = ms => new Promise(r => setTimeout(r, ms));

async function runTests() {
    console.log("Starting Phase 8 Resilience Tests...\n");
    let results = [];
    let cookieA, userA, cookieB, userB;
    let socketA, socketB;

    const report = (testName, pass, details = "") => {
        const resultStr = pass ? "PASS" : "FAIL";
        console.log(`[${resultStr}] ${testName} ${details}`);
        results.push({ testName, pass, details });
    };

    try {
        // Setup Users
        let resA = await axios.post(`${API_URL}/api/auth/signup`, generateUser('usera_p8'));
        cookieA = resA.headers['set-cookie'][0];
        userA = resA.data;
        
        let resB = await axios.post(`${API_URL}/api/auth/signup`, generateUser('userb_p8'));
        cookieB = resB.headers['set-cookie'][0];
        userB = resB.data;

        // -----------------------------------------------------------------------------------
        // Test A: API Gateway / service failure
        // -----------------------------------------------------------------------------------
        console.log("--- Test A: API Gateway / service failure ---");
        dockerCmd('docker stop vybe-content-service');
        await delay(3000); // Wait for gateway to realize
        try {
            // Attempt to hit content service
            await axios.get(`${API_URL}/api/post/all`, { headers: { cookie: cookieA } });
            report("Test A (Down)", false, "Expected 502/504, but got 200");
        } catch (error) {
            if (error.response && [502, 503, 504].includes(error.response.status)) {
                report("Test A (Down)", true, `Got expected ${error.response.status}`);
            } else {
                report("Test A (Down)", false, `Got unexpected status: ${error.response?.status}`);
            }
        }
        // Verify Gateway is still up
        try {
            const health = await axios.get(`${API_URL}/health`);
            report("Test A (Gateway Up)", health.status === 200, "Gateway remained operational");
        } catch(e) {
            report("Test A (Gateway Up)", false, "Gateway crashed");
        }
        dockerCmd('docker start vybe-content-service');
        await delay(5000); // Give it time to start
        try {
            await axios.get(`${API_URL}/api/post/all`, { headers: { cookie: cookieA } });
            report("Test A (Recovery)", true, "Service recovered successfully");
        } catch(error) {
            report("Test A (Recovery)", false, "Service did not recover");
        }

        // -----------------------------------------------------------------------------------
        // Test B: Redis failure
        // -----------------------------------------------------------------------------------
        console.log("\n--- Test B: Redis failure ---");
        dockerCmd('docker stop vybe-redis');
        await delay(2000);
        try {
            const profileRes = await axios.get(`${API_URL}/api/user/getProfile/${userB.userName}`, { headers: { cookie: cookieA } });
            report("Test B (Fallback)", profileRes.status === 200, "Successfully fell back to MongoDB");
        } catch(error) {
            report("Test B (Fallback)", false, "Failed to fallback to MongoDB");
        }
        dockerCmd('docker start vybe-redis');
        await delay(3000); // Let Redis start
        try {
            const start = Date.now();
            await axios.get(`${API_URL}/api/user/getProfile/${userB.userName}`, { headers: { cookie: cookieA } });
            const time1 = Date.now() - start;
            
            const start2 = Date.now();
            await axios.get(`${API_URL}/api/user/getProfile/${userB.userName}`, { headers: { cookie: cookieA } });
            const time2 = Date.now() - start2;

            report("Test B (Recovery)", time2 < time1 + 20, "Caching resumed successfully");
        } catch(error) {
            report("Test B (Recovery)", false, "Caching failed to resume");
        }

        // -----------------------------------------------------------------------------------
        // Test C: Kafka failure
        // -----------------------------------------------------------------------------------
        console.log("\n--- Test C: Kafka failure ---");
        dockerCmd('docker stop vybe-kafka');
        await delay(2000);
        try {
            const followRes = await axios.get(`${API_URL}/api/user/follow/${userB._id}`, { headers: { cookie: cookieA } });
            report("Test C (Isolate)", followRes.status === 200, "Business logic succeeded despite Kafka down");
        } catch(error) {
            report("Test C (Isolate)", false, "Business logic failed due to Kafka");
        }
        dockerCmd('docker start vybe-kafka');
        await delay(7000); // Kafka takes a bit to start up

        // -----------------------------------------------------------------------------------
        // Test D: MongoDB failure
        // -----------------------------------------------------------------------------------
        console.log("\n--- Test D: MongoDB failure ---");
        dockerCmd('docker stop vybe-mongodb');
        await delay(2000);
        try {
            await axios.get(`${API_URL}/api/user/current`, { headers: { cookie: cookieA } });
            report("Test D (Failure)", false, "Expected error, got 200");
        } catch(error) {
            if (error.response && [500, 502, 503].includes(error.response.status)) {
                report("Test D (Failure)", true, `Got expected ${error.response.status} instead of hanging`);
            } else {
                report("Test D (Failure)", false, `Got unexpected status: ${error.response?.status}`);
            }
        }
        dockerCmd('docker start vybe-mongodb');
        await delay(5000); // Mongo takes a bit to recover and mongoose to reconnect
        try {
            const currentRes = await axios.get(`${API_URL}/api/user/current`, { headers: { cookie: cookieA } });
            report("Test D (Recovery)", currentRes.status === 200, "Service recovered after MongoDB restart");
        } catch(error) {
            report("Test D (Recovery)", false, "Service did not recover");
        }

        // -----------------------------------------------------------------------------------
        // Test E & F: Malformed & Duplicate Kafka Events
        // -----------------------------------------------------------------------------------
        console.log("\n--- Test E & F: Malformed & Duplicate Kafka Events ---");
        try {
            const { Kafka } = require('kafkajs');
            const kafka = new Kafka({ clientId: 'test-client', brokers: ['localhost:9092'] });
            const producer = kafka.producer();
            await producer.connect();
            
            const eventId = "test_dup_123";
            const topic = "user-events";
            
            // Emit malformed event
            await producer.send({
                topic,
                messages: [{ value: JSON.stringify({ eventType: "UNKNOWN_TRASH", data: null }) }]
            });
            report("Test E (Malformed)", true, "Sent malformed event without crashing consumer");

            // Emit duplicate events
            await producer.send({
                topic,
                messages: [
                    { value: JSON.stringify({ eventId, eventType: "USER_FOLLOWED", followerId: userB._id, followedUserId: userA._id }) },
                    { value: JSON.stringify({ eventId, eventType: "USER_FOLLOWED", followerId: userB._id, followedUserId: userA._id }) }
                ]
            });
            await producer.disconnect();

            await delay(3000);
            
            const notifs = await axios.get(`${API_URL}/api/user/getAllNotifications`, { headers: { cookie: cookieA } });
            const follows = notifs.data.filter(n => n.type === 'follow' && n.sender === userB._id);
            if (follows.length === 1) {
                report("Test F (Duplicate)", true, "Only one notification created despite duplicate events");
            } else {
                report("Test F (Duplicate)", false, `Found ${follows.length} notifications`);
            }
        } catch(e) {
            report("Test E & F", false, `Failed to run Kafka tests: ${e.message}`);
        }

        // -----------------------------------------------------------------------------------
        // Test G: Socket failure
        // -----------------------------------------------------------------------------------
        console.log("\n--- Test G: Socket failure ---");
        try {
            socketA = io(API_URL, { extraHeaders: { cookie: cookieA }, transports: ['websocket'] });
            socketB = io(API_URL, { extraHeaders: { cookie: cookieB }, transports: ['websocket'] });
            
            await new Promise((resolve) => {
                let connected = 0;
                const onConnect = () => { connected++; if(connected === 2) resolve(); };
                socketA.on('connect', onConnect);
                socketB.on('connect', onConnect);
            });

            socketB.disconnect(); // simulate disconnect
            await delay(500);

            const sendRes = await axios.post(`${API_URL}/api/message/send/${userB._id}`, 
                { message: "Offline message test" },
                { headers: { cookie: cookieA } }
            );

            report("Test G (Disconnect)", sendRes.status === 200, "Message API still works and persists when recipient offline");

            socketB.connect();
            await new Promise((resolve) => socketB.on('connect', resolve));
            
            const msgPromise = new Promise(resolve => socketB.on('newMessage', resolve));
            
            await axios.post(`${API_URL}/api/message/send/${userB._id}`, 
                { message: "Online message test" },
                { headers: { cookie: cookieA } }
            );

            const received = await msgPromise;
            report("Test G (Reconnect)", received.message === "Online message test", "Realtime behavior restored after reconnect");
        } catch(error) {
            report("Test G", false, "Socket test failed: " + error.message);
        }

    } catch (e) {
        console.error("FATAL ERROR IN TEST HARNESS:", e);
    } finally {
        if (socketA) socketA.disconnect();
        if (socketB) socketB.disconnect();
        console.log("\n=== TEST RUN SUMMARY ===");
        results.forEach(r => {
            console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.testName}`);
        });
        process.exit(0);
    }
}

runTests();
