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
      firstName: doc.first_name || null,
      lastName: doc.last_name || null,
      role: doc.role || "user",
      isEmailVerified: !!doc.is_email_verified,
      emailVerificationToken: doc.email_verification_token || null,
      passwordResetToken: doc.password_reset_token || null,
      passwordResetExpires: doc.password_reset_expires || null,
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

  async findByVerificationToken(token) {
    try {
      const doc = await this.collection.findOne({ email_verification_token: token });
      return MongoUserRepository.toDomain(doc);
    } catch (err) {
      logger.error(`Error finding user by verification token`, { error: err.message });
      return null;
    }
  }

  async findByResetToken(token) {
    try {
      const doc = await this.collection.findOne({
        password_reset_token: token,
        password_reset_expires: { $gt: new Date() }
      });
      return MongoUserRepository.toDomain(doc);
    } catch (err) {
      logger.error(`Error finding user by reset token`, { error: err.message });
      return null;
    }
  }

  async findAllUsers({ page = 1, limit = 20, search = null } = {}) {
    try {
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip = (Math.max(1, page) - 1) * safeLimit;

      const filter = {};
      if (search && search.trim().length > 0) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [
          { email: regex },
          { first_name: regex },
          { last_name: regex }
        ];
      }

      const total = await this.collection.countDocuments(filter);
      const docs = await this.collection
        .find(filter, {
          projection: {
            password_hash: 0,
            password_reset_token: 0
          }
        })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(safeLimit)
        .toArray();

      return {
        items: docs.map(MongoUserRepository.toDomain),
        meta: {
          total,
          page,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit)
        }
      };
    } catch (err) {
      logger.error("Error listing users for admin", { error: err.message });
      return { items: [], meta: { total: 0, page: 1, limit, totalPages: 0 } };
    }
  }

  async save(user) {
    try {
      const doc = {
        email: user.email,
        password_hash: user.passwordHash,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        is_email_verified: user.isEmailVerified,
        email_verification_token: user.emailVerificationToken,
        password_reset_token: user.passwordResetToken,
        password_reset_expires: user.passwordResetExpires,
        points: user.points,
        skin_profile: {
          skinType: user.skinProfile.skinType,
          conditions: user.skinProfile.conditions,
          allergicIngredients: user.skinProfile.allergicIngredients,
          frequentlyUsedProducts: user.skinProfile.frequentlyUsedProducts,
          routineMedications: user.skinProfile.routineMedications,
          dermatologistNotes: user.skinProfile.dermatologistNotes,
          targetedBenefits: user.skinProfile.targetedBenefits,
          completionPercentage: user.skinProfile.completionPercentage
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
