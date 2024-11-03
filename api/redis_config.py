import json
import redis

# Assign default Redis credentials directly in the code
REDIS_HOST = 'redis-13548.c253.us-central1-1.gce.redns.redis-cloud.com'
REDIS_PORT = 13548
REDIS_PASSWORD = '63o9B87wMX5p3WQElweHWHD4o3iOvx4y'

# Initialize Redis client
redis_client = redis.StrictRedis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    decode_responses=True
)

# Vercel Serverless Function
def handler(request):
    if request.method == 'GET':
        return get_config(request)
    elif request.method == 'POST':
        return save_config(request)
    else:
        return {
            'statusCode': 405,
            'body': 'Method Not Allowed'
        }

def get_config(request):
    try:
        config_data = redis_client.get('chat_flow_config')
        if config_data is None:
            config = {"flow": []}
        else:
            config = json.loads(config_data)
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(config, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': 'Error loading config: ' + str(e)
        }

def save_config(request):
    try:
        content_length = int(request.headers['content-length'])
        body = request.body.read(content_length)
        config = json.loads(body.decode('utf-8'))
        config_data = json.dumps(config, ensure_ascii=False, indent=2)
        redis_client.set('chat_flow_config', config_data)
        return {
            'statusCode': 200,
            'body': 'Config saved successfully'
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': 'Error saving config: ' + str(e)
        }