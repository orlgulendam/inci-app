// tests/architectural/boundaries.test.js - Modül Sınırları ve Mimari Bağımlılık Testi (ArchUnit / Dependency Linting)
// Gerekçe: Modüllerin birbirinin iç dosyalarına doğrudan erişmediğini (yalnızca public/ facade kullandığını) garanti eder.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (file.endsWith(".js") && !file.includes(".test.js")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

test("Architecture: Modüller birbirinin iç infrastructure/domain dosyalarına doğrudan erişmemeli", () => {
  const modulesDir = path.resolve(__dirname, "../../src/modules");
  const allFiles = scanDirectory(modulesDir);

  const violations = [];

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const currentModule = path.relative(modulesDir, filePath).split(path.sep)[0];

    // Regex ile import/require yollarını yakala
    const requireMatches = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];

    for (const req of requireMatches) {
      const match = req.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (!match) continue;
      const importPath = match[1];

      // Eğer başka bir modüle gidiyorsa
      if (importPath.includes("/modules/")) {
        const targetModuleMatch = importPath.match(/\/modules\/([^/]+)/);
        if (targetModuleMatch) {
          const targetModule = targetModuleMatch[1];
          if (targetModule !== currentModule) {
            // Başka modülün iç katmanına (infrastructure/domain/application) erişim yasak; sadece public izinli
            const isAccessingInternal =
              importPath.includes("/infrastructure/") ||
              importPath.includes("/domain/") ||
              importPath.includes("/application/") ||
              importPath.includes("/presentation/");

            if (isAccessingInternal) {
              violations.push({
                file: path.relative(process.cwd(), filePath),
                violatingImport: importPath,
                currentModule,
                targetModule
              });
            }
          }
        }
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Mimari sınır ihlali tespit edildi! Modüller arası sadece public Facade kullanılmalıdır: ${JSON.stringify(violations, null, 2)}`
  );
});

test("Architecture: Analysis modülü hiçbir dış iş modülüne bağımlı olmamalı", () => {
  const analysisDir = path.resolve(__dirname, "../../src/modules/analysis");
  const files = scanDirectory(analysisDir);

  const violations = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes("catalog") || content.includes("personalization") || content.includes("community")) {
      // Yorum satırlarını hariç tutmak için basit kontrol
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.trim().startsWith("//") && !line.trim().startsWith("/*")) {
          if (line.includes("require") && (line.includes("catalog") || line.includes("personalization") || line.includes("community"))) {
            violations.push({ file: filePath, line });
          }
        }
      }
    }
  }

  assert.equal(violations.length, 0, `Analysis modülü dış modüllere bağımlı olamaz: ${JSON.stringify(violations)}`);
});
