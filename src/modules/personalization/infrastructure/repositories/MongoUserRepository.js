// src/modules/personalization/infrastructure/repositories/MongoUserRepository.js - Somut Kullanıcı Deposu (DIP)
const { ObjectId } = require("mongodb");
const { getDb } = require("../../../../core/database/mongo");
const logger = require("../../../../core/logging/logger");
const User = require("../../domain/entities/User");
const SkinProfile = require("../../domain/value-objects/SkinProfile");
const IUserRepository = require("./IUserRepository");

class MongoUserRepository extends IUserRepository {
  get collection() {
    return getDb().collection("users");
  }

  static toDomain(doc) {
    if (!doc) return null;
    return new User({
      id: doc._id,
      email: doc.email,
      passwordHash: doc.password_hash,
      role: doc.role || "user",
      points: doc.points || 0,
      skinProfile: new SkinProfile(doc.skin_profile || {}),
      createdAt: doc.created_at || new Date()
    });
  }

  async findById(id) {
    try {
      const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
      const doc = await this.collection.findOne(query);
      return MongoUserRepository.toDomain(doc);
    } catch (err) {
      logger.error(`Error finding user by id: ${id}`, { error: err.message });
      return null;
    }
  }

  async findByEmail(email) {
    try {
      const clean = String(email).toLowerCase().trim();
      const doc = await this.collection.findOne({ email: clean });
      return MongoUserRepository.toDomain(doc);
    } catch (err) {
      logger.error(`Error finding user by email: ${email}`, { error: err.message });
      return null;
    }
  }

  async save(user) {
    try {
      const doc = {
        email: user.email,
        password_hash: user.passwordHash,
        role: user.role,
        points: user.points,
        skin_profile: {
          skinType: user.skinProfile.skinType,
          conditions: user.skinProfile.conditions,
          allergicIngredients: user.skinProfile.allergicIngredients
        },
        updated_at: new Date()
      };

      if (user.id) {
        const query = ObjectId.isValid(user.id) ? { _id: new ObjectId(user.id) } : { _id: user.id };
        await this.collection.updateOne(query, { $set: doc });
        return user.id;
      } else {
        doc.created_at = user.createdAt;
        const res = await this.collection.insertOne(doc);
        return res.insertedId;
      }
    } catch (err) {
      logger.error(`Error saving user: ${user.email}`, { error: err.message });
      throw err;
    }
  }

  async updatePoints(userId, delta, session = null) {
    try {
      const query = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId };
      const options = session ? { session } : {};
      await this.collection.updateOne(query, { $inc: { points: delta } }, options);
    } catch (err) {
      logger.error(`Error updating points for user: ${userId}`, { error: err.message });
      throw err;
    }
  }
}

module.exports = MongoUserRepository;
