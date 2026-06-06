// server/redis.ts
import Redis from "ioredis";

let redisInstance: Redis | null = null;
let redisDisabled = false;
let hasLoggedConfigWarning = false;
let hasLoggedConnectionWarning = false;

function hasRedisConfig() {
	return Boolean(process.env.REDIS_HOST && process.env.REDIS_PORT);
}

export function getRedisOptional(): Redis | null {
	if (redisDisabled) {
		return null;
	}

	if (!hasRedisConfig()) {
		if (!hasLoggedConfigWarning) {
			hasLoggedConfigWarning = true;
			console.warn(
				"Redis cache disabled: REDIS_HOST/REDIS_PORT not configured.",
			);
		}
		redisDisabled = true;
		return null;
	}

	if (!redisInstance) {
		redisInstance = new Redis({
			host: process.env.REDIS_HOST,
			port: Number(process.env.REDIS_PORT),
			password: process.env.REDIS_PASSWORD || undefined,
			lazyConnect: true,
			enableOfflineQueue: false,
			maxRetriesPerRequest: 1,
			retryStrategy: () => null,
		});

		redisInstance.on("error", (error) => {
			if (!hasLoggedConnectionWarning) {
				hasLoggedConnectionWarning = true;
				console.warn(
					`Redis cache disabled due to connection error: ${error.message}`,
				);
			}
			redisDisabled = true;
			redisInstance?.disconnect();
			redisInstance = null;
		});
	}

	return redisInstance;
}

export function getRedis(): Redis {
	const redis = getRedisOptional();

	if (!redis) {
		throw new Error("Redis is unavailable.");
	}

	return redis;
}
