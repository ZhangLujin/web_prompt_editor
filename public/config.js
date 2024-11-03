// api/config.js
const redis = require('redis');

const REDIS_HOST = 'redis-13548.c253.us-central1-1.gce.redns.redis-cloud.com';
const REDIS_PORT = 13548;
const REDIS_PASSWORD = '63o9B87wMX5p3WQElweHWHD4o3iOvx4y';

let redisClient;

function initRedisClient() {
    if (!redisClient) {
        redisClient = redis.createClient({
            host: REDIS_HOST,
            port: REDIS_PORT,
            password: REDIS_PASSWORD,
            tls: true
        });

        redisClient.on('error', (err) => {
            console.error('Redis error', err);
        });
    }
}

module.exports = (req, res) => {
    initRedisClient();

    if (req.method === 'GET') {
        redisClient.get('chat_flow_config', (err, data) => {
            if (err) {
                console.error('Error fetching config from Redis:', err);
                res.status(500).json({ error: 'Error fetching config from Redis' });
            } else {
                if (data) {
                    res.status(200).json(JSON.parse(data));
                } else {
                    // 返回默认配置
                    res.status(200).json({ flow: [] });
                }
            }
        });
    } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const config = JSON.parse(body);
                redisClient.set('chat_flow_config', JSON.stringify(config), (err) => {
                    if (err) {
                        console.error('Error saving config to Redis:', err);
                        res.status(500).json({ error: 'Error saving config to Redis' });
                    } else {
                        res.status(200).json({ message: 'Config saved successfully' });
                    }
                });
            } catch (err) {
                console.error('Invalid JSON:', err);
                res.status(400).json({ error: 'Invalid JSON' });
            }
        });
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
};