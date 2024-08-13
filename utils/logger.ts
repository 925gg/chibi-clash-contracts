import winston from "winston";

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

if (process.env.LOGGER_LEVEL) {
  logger.level = process.env.LOGGER_LEVEL;
}

logger.info = ((message: string) => {
  if (process.env.LOGGER_LEVEL === "warn") {
    return;
  }
  console.log("[info]", message);
}) as any;

export { logger };
