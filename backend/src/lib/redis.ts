import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;

const redis = redisUrl
  ? new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    })
  : new IORedis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    });

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("ready", () => {
  console.log("Redis ready");
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

redis
  .ping()
  .then((response) => {
    console.log("Redis ping:", response);
  })
  .catch((error) => {
    console.error("Redis ping failed:", error);
  });

export default redis;