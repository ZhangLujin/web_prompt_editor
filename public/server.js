// public/server.js

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { Redis } from "https://deno.land/x/redis@v0.25.4/mod.ts";

// Redis连接信息
const redisHost = 'redis-13548.c253.us-central1-1.gce.redns.redis-cloud.com';
const redisPort = 13548; // 替换为您的Redis端口
const redisPassword = '63o9B87wMX5p3WQElweHWHD4o3iOvx4y';

// 创建Redis客户端
const redis = await Redis.connect({
    hostname: redisHost,
    port: redisPort,
    password: redisPassword,
});

console.log("Connected to Redis");

serve(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === '/api/config') {
        if (req.method === 'GET') {
            try {
                const configData = await redis.get('chat_flow_config');
                const responseData = configData ? JSON.parse(configData) : { flow: [] };
                return new Response(JSON.stringify(responseData), {
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                console.error('Error fetching config:', error);
                return new Response(JSON.stringify({ error: 'Error fetching config' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        } else if (req.method === 'POST') {
            try {
                const body = await req.json();
                await redis.set('chat_flow_config', JSON.stringify(body));
                return new Response(JSON.stringify({ message: 'Configuration updated successfully' }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                console.error('Error updating config:', error);
                return new Response(JSON.stringify({ error: 'Error updating config' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }
    }

    // 如果请求不匹配任何路由，返回404
    return new Response('Not Found', { status: 404 });
});