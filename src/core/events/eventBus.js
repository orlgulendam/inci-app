// src/core/events/eventBus.js - Modüller Arası Olay Veriyolu (Observer Pattern)
// Gerekçe: Modüllerin birbirini doğrudan sıkı bağlamadan (tight coupling) asenkron haberleşmesi için Observer deseni.
const EventEmitter = require("events");
const logger = require("../logging/logger");

class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(25);
  }

  publish(eventName, payload) {
    logger.debug(`[EventBus] Publishing event: ${eventName}`, { eventName });
    // Hataların ana akışı kesmemesi için asenkron yürüt
    setImmediate(() => {
      try {
        this.emit(eventName, payload);
      } catch (err) {
        logger.error(`[EventBus] Error dispatching event: ${eventName}`, { error: err.message });
      }
    });
  }

  subscribe(eventName, handler) {
    this.on(eventName, async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error(`[EventBus] Handler failed for event: ${eventName}`, { error: err.message });
      }
    });
  }
}

const eventBus = new AppEventBus();

module.exports = eventBus;
