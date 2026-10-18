// src/core/database/mongo.js - Veritabanı Bağlantı ve Transaction Yöneticisi
const { MongoClient } = require("mongodb");
const config = require("../config/env");
const logger = require("../logging/logger");

let client = null;
let db = null;

async function connectToMongo() {
  if (db) return db;

  try {
    logger.info("Connecting to MongoDB...", { uri: config.mongo.uri, dbName: config.mongo.dbName });
    client = new MongoClient(config.mongo.uri);
    await client.connect();
    db = client.db(config.mongo.dbName);
    logger.info("Successfully connected to MongoDB database.", { dbName: config.mongo.dbName });
    return db;
  } catch (error) {
    logger.error("Failed to connect to MongoDB", { error: error.message });
    throw error;
  }
}

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectToMongo first.");
  }
  return db;
}

function getClient() {
  if (!client) {
    throw new Error("MongoClient not initialized. Call connectToMongo first.");
  }
  return client;
}

async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info("MongoDB connection closed.");
  }
}

/**
 * Multi-Document ACID Transaction Yardımcısı
 * @param {Function} work - async (session) => Promise<any>
 */
async function withTransaction(work) {
  const c = getClient();
  const session = c.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  connectToMongo,
  getDb,
  getClient,
  closeMongo,
  withTransaction
};
