// api/config.js

const redis = require('redis');

const REDIS_HOST = 'redis-13548.c253.us-central1-1.gce.redns.redis-cloud.com';
const REDIS_PORT = 13548;
const REDIS_PASSWORD = '63o9B87wMX5p3WQElweHWHD4o3iOvx4y';

let redisClient;

async function initRedisClient() {
    if (!redisClient) {
        redisClient = redis.createClient({
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                tls: true
            },
            password: REDIS_PASSWORD,
        });

        redisClient.on('error', (err) => console.error('Redis Client Error', err));

        await redisClient.connect();
    }
}

module.exports = async (req, res) => {
    try {
        await initRedisClient();

        if (req.method === 'GET') {
            const data = await redisClient.get('chat_flow_config');

            if (data) {
                res.status(200).json(JSON.parse(data));
            } else {
                res.status(200).json({ flow: [] }); // Return default config if none exists
            }
        } else if (req.method === 'POST') {
            let body = '';

            req.on('data', chunk => {
                body += chunk;
            });

            req.on('end', async () => {
                try {
                    const config = JSON.parse(body);
                    await redisClient.set('chat_flow_config', JSON.stringify(config));
                    res.status(200).json({ message: 'Config saved successfully' });
                } catch (err) {
                    console.error('Error saving config:', err);
                    res.status(500).json({ error: 'Error saving config to Redis' });
                }
            });
        } else {
            res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};