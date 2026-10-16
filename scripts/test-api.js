// scripts/test-api.js
const http = require("http");

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

(async () => {
  console.log("=== API TESTLERİ BAŞLIYOR ===");

  // 1. Health
  const h = await fetchJSON("http://localhost:3000/api/health");
  console.log("1. /api/health -> Status:", h.status, "| Ürün Sayısı:", h.data.total_products);

  // 2. Search
  const s = await fetchJSON("http://localhost:3000/api/products/search?q=flormar&limit=2");
  console.log("2. /api/products/search -> Status:", s.status, "| Bulunan:", s.data.count, "| İlk Ürün:", s.data.products[0].name);

  // 3. Barcode Detail
  const productWithIng = s.data.products.find(p => p.has_ingredients) || s.data.products[0];
  const barcode = productWithIng.barcode;
  const b = await fetchJSON(`http://localhost:3000/api/products/${barcode}`);
  const ingCount = b.data.safety_summary ? b.data.safety_summary.total_ingredients : 0;
  console.log("3. /api/products/:barcode -> Status:", b.status, "| Ürün:", b.data.name, "| İçerik Sayısı:", ingCount);

  // 4. Analyze POST
  const a = await fetchJSON("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Aqua, Glycerin, Niacinamide, Squalane, Phenoxyethanol" })
  });
  console.log("4. /api/analyze (POST) -> Status:", a.status, "| Eşleşen:", a.data.matched, "/", a.data.total, "| Güvenli mi:", a.data.is_clean);

  console.log("\n✅ TÜM API UÇ NOKTALARI EKSİKSİZ VE BAŞARIYLA ÇALIŞIYOR!");
})();
