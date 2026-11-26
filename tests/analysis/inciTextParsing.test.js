// tests/analysis/inciTextParsing.test.js - INCI Etiket Metni Ayrıştırma (TokenizerService) Testleri
// Odak: Kozmetik etiket metninin atomik bileşenlere bölünmesi.
// Ayraçlar, parantezli ifadeler, CI renk kodları, OCR gürültüsü, Türkçe karakterler ve uç
// girdiler (boş metin, tek bileşen, çok uzun liste) bu dosyada toplanır.
//
// Dosyanın sonundaki "Düzeltilen Hatalar" bölümü, bu PR'da giderilen ayrıştırıcı
// hatalarının regresyon testlerini içerir.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const TokenizerService = require("../../src/modules/analysis/application/services/TokenizerService");

describe("INCI Metin Ayrıştırma: Ayraçlar", () => {
  test("Virgül ve noktalı virgül ayraçları aynı bileşen listesini vermeli", () => {
    const expected = ["Aqua", "Glycerin", "Niacinamide"];

    assert.deepEqual(TokenizerService.split("Aqua, Glycerin, Niacinamide"), expected);
    assert.deepEqual(TokenizerService.split("Aqua; Glycerin; Niacinamide"), expected);
  });

  test("Satır sonu, madde imi ve orta nokta ayraçları da bileşenleri bölmeli", () => {
    const tokens = TokenizerService.split("Aqua, Glycerin; Panthenol\nTocopherol • Squalane · Urea");

    assert.deepEqual(tokens, ["Aqua", "Glycerin", "Panthenol", "Tocopherol", "Squalane", "Urea"]);
  });

  test("Windows satır sonu (CRLF) ile yazılmış etiket doğru bölünmeli", () => {
    assert.deepEqual(
      TokenizerService.split("Aqua\r\nGlycerin\r\nPanthenol"),
      ["Aqua", "Glycerin", "Panthenol"]
    );
  });

  test("Tekrarlı ayraçlar ve baştaki/sondaki boşluklar boş bileşen üretmemeli", () => {
    const tokens = TokenizerService.split("   ,, Aqua ,  Glycerin ,,   ");

    assert.deepEqual(tokens, ["Aqua", "Glycerin"]);
    assert.ok(tokens.every((t) => t === t.trim()), "bileşen adlarında artık boşluk kalmamalı");
  });
});

describe("INCI Metin Ayrıştırma: Başlık ve Gürültü Temizliği", () => {
  test("'Ingredients:' başlığı bileşen listesinden ayıklanmalı", () => {
    assert.deepEqual(TokenizerService.split("Ingredients: Aqua, Glycerin"), ["Aqua", "Glycerin"]);
    assert.deepEqual(TokenizerService.split("INGREDIENT: Aqua, Glycerin"), ["Aqua", "Glycerin"]);
  });

  test("Almanca ve küçük harfli Türkçe başlıklar da temizlenmeli", () => {
    assert.deepEqual(TokenizerService.split("Inhaltsstoffe: Aqua, Glycerin"), ["Aqua", "Glycerin"]);
    assert.deepEqual(TokenizerService.split("Zutaten: Aqua, Glycerin"), ["Aqua", "Glycerin"]);
    assert.deepEqual(TokenizerService.split("içindekiler: Aqua, Glycerin"), ["Aqua", "Glycerin"]);
  });

  test("'May contain' ve '+/-' önekleri atılıp CI kodları korunmalı", () => {
    assert.deepEqual(TokenizerService.split("May Contain: CI 77491, CI 77492"), ["CI 77491", "CI 77492"]);
    assert.deepEqual(TokenizerService.split("+/- CI 77491, Mica"), ["CI 77491", "Mica"]);
  });

  test("Köşeli parantezler bileşen adından sıyrılmalı", () => {
    assert.deepEqual(TokenizerService.split("[Aqua], [Glycerin]"), ["Aqua", "Glycerin"]);
  });
});

describe("INCI Metin Ayrıştırma: Parantezli İfadeler", () => {
  test("Parantez içindeki virgül bileşeni ikiye bölmemeli", () => {
    assert.deepEqual(
      TokenizerService.split("Water (Aqua), Butylene Glycol (and) Glycerin"),
      ["Water (Aqua)", "Butylene Glycol (and) Glycerin"]
    );
  });

  test("İç içe parantezli bitki adları tek bileşen olarak kalmalı", () => {
    assert.deepEqual(
      TokenizerService.split("Extract (Camellia Sinensis (Green Tea) Leaf), Aqua"),
      ["Extract (Camellia Sinensis (Green Tea) Leaf)", "Aqua"]
    );
  });

  test("Parantez içindeki çoklu CI kodları ayrı bileşenlere açılmalı", () => {
    assert.deepEqual(
      TokenizerService.split("Iron Oxides (CI 77491, CI 77492, CI 77499)"),
      ["CI 77491", "CI 77492", "CI 77499"]
    );
  });

  test("Küçük harfli 'ci' kodları da normalize edilip büyük harfe çevrilmeli", () => {
    assert.deepEqual(
      TokenizerService.split("iron oxides (ci 77491, ci 77492)"),
      ["CI 77491", "CI 77492"]
    );
  });

  test("Tek CI kodu içeren parantez bileşenle birlikte kalmalı", () => {
    assert.deepEqual(
      TokenizerService.split("Mica (CI 77019), Aqua"),
      ["Mica (CI 77019)", "Aqua"]
    );
  });

  test("Tek ve çoklu CI kodları aynı etikette birlikte doğru ayrışmalı", () => {
    assert.deepEqual(
      TokenizerService.split("Mica, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492)"),
      ["Mica", "Titanium Dioxide (CI 77891)", "CI 77491", "CI 77492"]
    );
  });
});

describe("INCI Metin Ayrıştırma: Kimyasal Virgül", () => {
  test("'1,2-Hexanediol' gibi rakam-virgül-rakam yapısı bölünmemeli", () => {
    assert.deepEqual(
      TokenizerService.split("1,2-Hexanediol, 1,3-Propanediol, Aqua"),
      ["1,2-Hexanediol", "1,3-Propanediol", "Aqua"]
    );
  });
});

describe("INCI Metin Ayrıştırma: Uç Girdiler", () => {
  test("Boş metin boş dizi dönmeli ve hata fırlatmamalı", () => {
    assert.deepEqual(TokenizerService.split(""), []);
  });

  test("Yalnızca boşluk içeren metin boş dizi dönmeli", () => {
    assert.deepEqual(TokenizerService.split("    \n\t  "), []);
  });

  test("null, undefined ve metin olmayan girdilerde çökmeyip boş dizi dönmeli", () => {
    assert.deepEqual(TokenizerService.split(null), []);
    assert.deepEqual(TokenizerService.split(undefined), []);
    assert.deepEqual(TokenizerService.split(42), []);
    assert.deepEqual(TokenizerService.split({}), []);
  });

  test("Tek bileşenli liste tek elemanlı dizi vermeli", () => {
    assert.deepEqual(TokenizerService.split("Aqua"), ["Aqua"]);
  });

  test("Tek karakterlik girdi anlamlı bileşen sayılmamalı", () => {
    assert.deepEqual(TokenizerService.split("A"), []);
  });

  test("120 bileşenli çok uzun liste eksiksiz ve sırası bozulmadan ayrışmalı", () => {
    const names = Array.from({ length: 120 }, (_, i) => `Testium Compound ${i + 1}`);

    const tokens = TokenizerService.split(names.join(", "));

    assert.equal(tokens.length, 120);
    assert.deepEqual(tokens, names, "uzun listede sıra ve içerik korunmalı");
  });
});

describe("INCI Metin Ayrıştırma: OCR Gürültüsü", () => {
  test("OCR'dan gelen tek karakterlik gürültü bileşen sayılmamalı", () => {
    assert.deepEqual(
      TokenizerService.split("Aqua, *, Glycerin, -, Panthenol, 1"),
      ["Aqua", "Glycerin", "Panthenol"]
    );
  });

  test("OCR'ın bozduğu karakterler bileşeni düşürmemeli, ad olduğu gibi aktarılmalı", () => {
    const tokens = TokenizerService.split("Aqua,,, Glyc€rin, Nia¢inamide, Panthenol");

    assert.deepEqual(tokens, ["Aqua", "Glyc€rin", "Nia¢inamide", "Panthenol"]);
  });

  test("Sekme karakteriyle ayrılmış OCR çıktısı bileşen adını bozmamalı", () => {
    assert.deepEqual(TokenizerService.split("Aqua,\tGlycerin"), ["Aqua", "Glycerin"]);
  });
});

describe("INCI Metin Ayrıştırma: Türkçe Karakterler", () => {
  test("Türkçe karakterli bileşen adları ayrıştırmada korunmalı", () => {
    assert.deepEqual(
      TokenizerService.split("Su, Gliserin, Çay Ağacı Yağı, Şeker, Üzüm Çekirdeği Yağı"),
      ["Su", "Gliserin", "Çay Ağacı Yağı", "Şeker", "Üzüm Çekirdeği Yağı"]
    );
  });

  test("Türkçe karakterler ayraç olarak yorumlanmamalı", () => {
    const tokens = TokenizerService.split("Çörek Otu Yağı, İğde Çiçeği Özü");

    assert.equal(tokens.length, 2);
    assert.ok(tokens[0].includes("Ç"), "Türkçe büyük harf korunmalı");
    assert.ok(tokens[1].includes("İ"), "Türkçe noktalı İ korunmalı");
  });
});

describe("INCI Metin Ayrıştırma: Yüzde İfadelerinin Temizlenmesi (cleanToken)", () => {
  test("Parantezli ve parantezsiz yüzde ifadeleri bileşen adından silinmeli", () => {
    assert.equal(TokenizerService.cleanToken("Aqua (%7.50)"), "Aqua");
    assert.equal(TokenizerService.cleanToken("Aqua (7.50%)"), "Aqua");
    assert.equal(TokenizerService.cleanToken("Aqua 7.50%"), "Aqua");
    assert.equal(TokenizerService.cleanToken("Niacinamide 10 %"), "Niacinamide");
  });

  test("Yüzde ifadesi içindeki fazla boşluklar da toparlanmalı", () => {
    assert.equal(TokenizerService.cleanToken("Glycerin   (  %  12  )"), "Glycerin");
  });

  test("Yüzde içermeyen bileşende parantezli eş ad korunmalı", () => {
    assert.equal(TokenizerService.cleanToken("Parfum (Fragrance)"), "Parfum (Fragrance)");
  });

  test("Baştaki ve sondaki boşluklar kırpılmalı", () => {
    assert.equal(TokenizerService.cleanToken("   Aqua   "), "Aqua");
  });
});

describe("INCI Metin Ayrıştırma: Düzeltilen Hatalar (Regresyon)", () => {
  test("Büyük 'İ' ile başlayan Türkçe başlık da temizlenmeli", () => {
    // JavaScript'in /i/ bayrağı büyük "İ" (U+0130) ile küçük "i"yi eşleştirmez;
    // Türkçe ambalajlarda başlık neredeyse her zaman büyük harfle basılır.
    assert.deepEqual(TokenizerService.split("İçindekiler: Su, Gliserin, Şeker"), ["Su", "Gliserin", "Şeker"]);
    assert.deepEqual(TokenizerService.split("İÇİNDEKİLER: Aqua, Glycerin"), ["Aqua", "Glycerin"]);
    assert.deepEqual(TokenizerService.split("IÇINDEKILER: Aqua, Glycerin"), ["Aqua", "Glycerin"]);
  });

  test("Türkçe başlık temizlendikten sonra ilk bileşen kaybolmamalı", () => {
    const tokens = TokenizerService.split("İçindekiler: Aqua, Glycerin, Panthenol");

    assert.equal(tokens.length, 3);
    assert.equal(tokens[0], "Aqua", "ilk bileşen başlıkla birleşmemeli");
    assert.ok(!tokens[0].includes("İçindekiler"));
  });

  test("Kapanmamış parantez ardındaki bileşenleri yutmamalı", () => {
    // OCR kapanış parantezini sık kaçırır; eskiden listenin tamamı tek jetona dönüşüyordu.
    const tokens = TokenizerService.split("Aqua (Water, Glycerin, Niacinamide, Panthenol, Phenoxyethanol");

    assert.ok(tokens.length >= 5, `bileşenler ayrışmalı, gelen: ${JSON.stringify(tokens)}`);
    assert.ok(tokens.includes("Glycerin"));
    assert.ok(tokens.includes("Niacinamide"));
    assert.ok(tokens.includes("Panthenol"));
    assert.ok(tokens.includes("Phenoxyethanol"));
  });

  test("Fazla kapanış parantezi de listeyi bozmamalı", () => {
    const tokens = TokenizerService.split("Aqua), Glycerin, Panthenol");

    assert.ok(tokens.includes("Glycerin"));
    assert.ok(tokens.includes("Panthenol"));
  });

  test("Parantez dengesi bozukken bile dengeli listeler etkilenmemeli", () => {
    // Denge kontrolü yalnızca bozuk metni kurtarır; normal etiketler aynı kalmalı.
    assert.deepEqual(
      TokenizerService.split("Water (Aqua), Butylene Glycol (and) Glycerin"),
      ["Water (Aqua)", "Butylene Glycol (and) Glycerin"]
    );
    assert.deepEqual(
      TokenizerService.split("Extract (Camellia Sinensis (Green Tea) Leaf), Aqua"),
      ["Extract (Camellia Sinensis (Green Tea) Leaf)", "Aqua"]
    );
  });

  test("Virgülden sonra boşluk bırakılmış kimyasal konum listesi bölünmemeli", () => {
    assert.deepEqual(TokenizerService.split("1, 2-Hexanediol"), ["1, 2-Hexanediol"]);
    assert.deepEqual(TokenizerService.split("Ceramide NP, 1, 3-Butanediol"), ["Ceramide NP", "1, 3-Butanediol"]);
  });

  test("Boşluklu konum koruması gerçek ayraçları kimyasal virgül sanmamalı", () => {
    // "CI 77491, 77492" iki ayrı renklendiricidir; tek bileşene birleşmemeli.
    assert.deepEqual(TokenizerService.split("CI 77491, 77492"), ["CI 77491", "77492"]);
    assert.deepEqual(
      TokenizerService.split("Titanium Dioxide, 12345 Compound"),
      ["Titanium Dioxide", "12345 Compound"]
    );
  });

  test("Boşluksuz kimyasal virgül davranışı korunmalı", () => {
    assert.deepEqual(TokenizerService.split("1,2,3-Propanetriol, Aqua"), ["1,2,3-Propanetriol", "Aqua"]);
    assert.deepEqual(TokenizerService.split("1,2-Hexanediol, Aqua"), ["1,2-Hexanediol", "Aqua"]);
  });
});
