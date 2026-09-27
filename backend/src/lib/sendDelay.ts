import redis from "./redis";

const RESERVE_SEND_SLOT_SCRIPT = `
local lastSend = redis.call("GET", KEYS[1])
local now = tonumber(ARGV[1])
local minimumDelay = tonumber(ARGV[2])

if not lastSend then
  redis.call("SET", KEYS[1], tostring(now))
  return 0
end

lastSend = tonumber(lastSend)

local nextAllowed = lastSend + minimumDelay

if now >= nextAllowed then
  redis.call("SET", KEYS[1], tostring(now))
  return 0
end

local waitTime = nextAllowed - now

redis.call("SET", KEYS[1], tostring(nextAllowed))

return waitTime
`;

export async function reserveSendSlot(
  senderId: string,
  minimumDelayMs: number
): Promise<number> {
  if (minimumDelayMs <= 0) {
    return 0;
  }

  const key = `email-send-slot:${senderId}`;

  const result = await redis.eval(
    RESERVE_SEND_SLOT_SCRIPT,
    1,
    key,
    Date.now().toString(),
    minimumDelayMs.toString()
  );

  return Number(result);
}