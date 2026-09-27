import redis from "./redis";

export async function checkHourlyRateLimit(
  senderId: string,
  limit: number
): Promise<{
  allowed: boolean;
  retryAfterMs: number;
}> {
  const now = Date.now();

  const hourStart =
    Math.floor(now / 3600000) * 3600000;

  const key = `email-rate:${senderId}:${hourStart}`;

  const currentCount = await redis.incr(key);

  // Keep the Redis key for slightly more than one hour
  if (currentCount === 1) {
    await redis.expire(key, 3700);
  }

  if (currentCount <= limit) {
    return {
      allowed: true,
      retryAfterMs: 0,
    };
  }

  const nextHour =
    hourStart + 3600000;

  const retryAfterMs =
    nextHour - now;

  return {
    allowed: false,
    retryAfterMs,
  };
}