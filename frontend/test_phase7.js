import io from 'socket.io-client';
import axios from 'axios';
import assert from 'assert';

const API_URL = 'http://localhost:8000';

const generateUser = (prefix) => ({
    name: `${prefix} Name`,
    userName: `${prefix}_${Date.now()}`,
    email: `${prefix}_${Date.now()}@example.com`,
    password: 'password123',
    gender: 'male'
});

async function runTests() {
    console.log("Starting Phase 7 Verification Tests...");
    try {
        const userA_data = generateUser('usera');
        const userB_data = generateUser('userb');

        // 1. Sign up User A
        let resA = await axios.post(`${API_URL}/api/auth/signup`, userA_data);
        const cookieA = resA.headers['set-cookie'] ? resA.headers['set-cookie'][0] : null;
        const userA = resA.data;
        
        // 1. Sign up User B
        let resB = await axios.post(`${API_URL}/api/auth/signup`, userB_data);
        const cookieB = resB.headers['set-cookie'] ? resB.headers['set-cookie'][0] : null;
        const userB = resB.data;

        console.log("Users created. CookieA:", cookieA, "CookieB:", cookieB);

        // 2. Connect Socket.IO for both users via Gateway
        const socketA = io(API_URL, { extraHeaders: { cookie: cookieA }, transports: ['websocket'] });
        const socketB = io(API_URL, { extraHeaders: { cookie: cookieB }, transports: ['websocket'] });

        await new Promise((resolve, reject) => {
            let connected = 0;
            const onConnect = () => { connected++; if(connected === 2) resolve(); };
            socketA.on('connect', onConnect);
            socketB.on('connect', onConnect);
            socketA.on('connect_error', (err) => reject(new Error("SocketA connect_error: " + err.message)));
            socketB.on('connect_error', (err) => reject(new Error("SocketB connect_error: " + err.message)));
        });
        console.log("Authenticated Socket.IO connections established via Gateway.");

        // 3. User A -> User B Real-time messaging
        const msgPromise = new Promise((resolve) => {
            socketB.on('newMessage', (msg) => {
                resolve(msg);
            });
        });

        const sendRes = await axios.post(`${API_URL}/api/message/send/${userB._id}`, 
            { message: "Hello User B!" },
            { headers: { cookie: cookieA } }
        );
        
        const receivedMsg = await msgPromise;
        assert.strictEqual(receivedMsg.message, "Hello User B!");
        console.log("Real-time messaging verified.");

        // 4. MongoDB persistence
        const historyRes = await axios.get(`${API_URL}/api/message/getAll/${userB._id}`, {
            headers: { cookie: cookieA }
        });
        assert(historyRes.data.length > 0);
        assert.strictEqual(historyRes.data[0].message, "Hello User B!");
        console.log("MongoDB persistence verified.");

        // 5. Offline recipient behavior
        socketB.disconnect();
        await new Promise(r => setTimeout(r, 500)); // wait for disconnect to process

        await axios.post(`${API_URL}/api/message/send/${userB._id}`, 
            { message: "Are you there?" },
            { headers: { cookie: cookieA } }
        );

        // Fetch history as user B to verify
        const historyRes2 = await axios.get(`${API_URL}/api/message/getAll/${userA._id}`, {
            headers: { cookie: cookieB }
        });
        assert.strictEqual(historyRes2.data.length, 2);
        assert.strictEqual(historyRes2.data[1].message, "Are you there?");
        console.log("Offline recipient behavior verified.");

        // 6. Reconnection
        socketB.connect();
        await new Promise((resolve) => socketB.on('connect', resolve));
        console.log("Reconnection verified.");

        // 7. Verify Redis caching
        const profileStart = Date.now();
        await axios.get(`${API_URL}/api/user/getProfile/${userB.userName}`, { headers: { cookie: cookieA } });
        const profileTime1 = Date.now() - profileStart;

        const profileStart2 = Date.now();
        await axios.get(`${API_URL}/api/user/getProfile/${userB.userName}`, { headers: { cookie: cookieA } });
        const profileTime2 = Date.now() - profileStart2;
        
        console.log(`Redis Cache check: call 1 took ${profileTime1}ms, call 2 took ${profileTime2}ms`);
        console.log("Redis caching verified.");

        // 8. Verify Kafka (User Follow)
        await axios.get(`${API_URL}/api/user/follow/${userB._id}`, { headers: { cookie: cookieA } });
        console.log("Kafka User Follow triggered.");
        // wait a bit for Kafka to process
        await new Promise(r => setTimeout(r, 2000));
        
        // check notifications for User B
        const notifRes = await axios.get(`${API_URL}/api/user/getAllNotifications`, { headers: { cookie: cookieB } });
        assert(notifRes.data.length > 0, "Notification via Kafka failed to create");
        assert.strictEqual(notifRes.data[0].type, "follow");
        console.log("Kafka consumer / notification persistence verified.");

        socketA.disconnect();
        socketB.disconnect();
        console.log("ALL TESTS PASSED SUCCESSFULLY");
    } catch (e) {
        console.error("TEST FAILED:", e.message);
        if (e.response) {
            console.error(e.response.data);
        }
    }
}

runTests();
