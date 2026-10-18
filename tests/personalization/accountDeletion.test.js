// tests/personalization/accountDeletion.test.js - Apple Guideline 5.1.1 Uyumlu Hesap Silme Testi
const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../../src/modules/personalization/domain/entities/User");
const ProfileService = require("../../src/modules/personalization/application/services/ProfileService");

class MockUserRepo {
  constructor() {
    this.users = new Map();
  }
  async findById(id) {
    return this.users.get(String(id)) || null;
  }
  async save(user) {
    this.users.set(String(user.id), user);
    return user.id;
  }
  async deleteById(id) {
    return this.users.delete(String(id));
  }
}

test("Apple App Store Uyumu: deleteAccount kullanıcının tüm verilerini kalıcı olarak silmeli", async () => {
  const repo = new MockUserRepo();
  const profileService = new ProfileService(repo);

  const user = new User({
    id: "user-apple-test-1",
    email: "apple_user@inci.app",
    firstName: "Gizem",
    skinProfile: { skinType: "hassas", allergicIngredients: ["Fragrance"] }
  });
  await repo.save(user);

  // Silmeden önce kullanıcı var olmalı
  const beforeDelete = await repo.findById("user-apple-test-1");
  assert.ok(beforeDelete);

  // Hesabı sil
  const result = await profileService.deleteAccount("user-apple-test-1");
  assert.ok(result.message.includes("başarıyla"));

  // Silindikten sonra kullanıcı bulunamamalı
  const afterDelete = await repo.findById("user-apple-test-1");
  assert.strictEqual(afterDelete, null);

  // Olmayan kullanıcı silinmek istendiğinde NotFoundError fırlatmalı
  await assert.rejects(
    async () => profileService.deleteAccount("user-apple-test-1"),
    /Kullanıcı bulunamadı/
  );
});
