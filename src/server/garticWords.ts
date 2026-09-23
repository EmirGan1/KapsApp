export interface GarticWord {
  word: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export const GARTIC_WORDS_POOL: GarticWord[] = [
  // --- HAYVANLAR (KOLAY) ---
  { word: "Kedi", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Köpek", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Balık", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Kuş", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Tavşan", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Ördek", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Kelebek", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Arı", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Fil", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "At", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Tavuk", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "İnek", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Koyun", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Maymun", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Yılan", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Kaplumbağa", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Kurbağa", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Fare", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Ayı", category: "Hayvanlar", difficulty: "easy", points: 100 },
  { word: "Tilki", category: "Hayvanlar", difficulty: "easy", points: 100 },

  // --- HAYVANLAR (ORTA) ---
  { word: "Zürafa", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Panda", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Kanguru", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Penguen", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Ahtapot", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Bukalemun", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Kirpi", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Sincap", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Papağan", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Flamingo", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Zebra", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Köpekbalığı", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Yunus", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Timsah", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Deve", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Kartal", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Baykuş", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Denizanası", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Denizatı", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Yengeç", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Kunduz", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Su Samuru", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Goril", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Çita", category: "Hayvanlar", difficulty: "medium", points: 200 },
  { word: "Yarasa", category: "Hayvanlar", difficulty: "medium", points: 200 },

  // --- HAYVANLAR (ZOR) ---
  { word: "Ornitorenk", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Karıncayiyen", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Engerek Yılanı", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Kutup Ayısı", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Müren Balığı", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Geyik Böceği", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Yalıçapkını", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Tukan Kuşu", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Komodo Ejderi", category: "Hayvanlar", difficulty: "hard", points: 350 },
  { word: "Deniz Hıyarı", category: "Hayvanlar", difficulty: "hard", points: 350 },

  // --- NESNELER & EŞYALAR (KOLAY) ---
  { word: "Kap", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Masa", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Sandalye", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Kitap", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Bardak", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Kalem", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Şapka", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Ayakkabı", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Gözlük", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Saat", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Telefon", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Kapı", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Pencere", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Mum", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Çanta", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Ayna", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Kutu", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Kaşık", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Çatal", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Bıçak", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Tarak", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Tava", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Tencere", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Yastık", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Battaniye", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Çekiç", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Makas", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Anahtar", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Şemsiye", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Süpürge", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Diş Fırçası", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Sabun", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Lamba", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Televizyon", category: "Nesneler", difficulty: "easy", points: 100 },
  { word: "Buzdolabı", category: "Nesneler", difficulty: "easy", points: 100 },

  // --- NESNELER & EŞYALAR (ORTA) ---
  { word: "Mikroskop", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Teleskop", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Dürbün", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Gitar", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Piyano", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Keman", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Bateri", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Trompet", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Fotoğraf Makinesi", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Kulaklık", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Hoparlör", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Dizüstü Bilgisayar", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Hesap Makinesi", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Pusula", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "El Feneri", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Termos", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Matara", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Çadır", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Uyku Tulumu", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Mangal", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Bumerang", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Kum Saati", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Dikiş Makinesi", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Ütü", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Tost Makinesi", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Mikser", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Kahve Makinesi", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Su Tabancası", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Kaykay", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Paten", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Drone", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Güvenlik Kamerası", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Oyun Kolu", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "Yangın Tüpü", category: "Nesneler", difficulty: "medium", points: 200 },
  { word: "İlk Yardım Çantası", category: "Nesneler", difficulty: "medium", points: 200 },

  // --- NESNELER & EŞYALAR (ZOR) ---
  { word: "Matruşka", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Gramofon", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Periskop", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Sismograf", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Barometre", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Daktilo", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Stetoskop", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Guguklu Saat", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Su Terazisi", category: "Nesneler", difficulty: "hard", points: 350 },
  { word: "Lehim Havzası", category: "Nesneler", difficulty: "hard", points: 350 },

  // --- MESLEKLER & KARAKTERLER (KOLAY) ---
  { word: "Doktor", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Polis", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Öğretmen", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Aşçı", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "İtfaiyeci", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Pilot", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Hemşire", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Kral", category: "Karakterler", difficulty: "easy", points: 100 },
  { word: "Kraliçe", category: "Karakterler", difficulty: "easy", points: 100 },
  { word: "Bebek", category: "Karakterler", difficulty: "easy", points: 100 },
  { word: "Palyaço", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Ressam", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Futbolcu", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Berber", category: "Meslekler", difficulty: "easy", points: 100 },
  { word: "Korsan", category: "Karakterler", difficulty: "easy", points: 100 },

  // --- MESLEKLER & KARAKTERLER (ORTA) ---
  { word: "Samuray", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Astronot", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Dedektif", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Dalgıç", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Büyücü", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Süper Kahraman", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Denizkızı", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Vampir", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Mumya", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Hayalet", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Ninja", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Şövalye", category: "Karakterler", difficulty: "medium", points: 200 },
  { word: "Arkeolog", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Mimar", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Veteriner", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Hakem", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Sihirbaz", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Kaptan", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Casus", category: "Meslekler", difficulty: "medium", points: 200 },
  { word: "Çiftçi", category: "Meslekler", difficulty: "medium", points: 200 },

  // --- MESLEKLER & KARAKTERLER (ZOR) ---
  { word: "Kuklacı", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Akrobat", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Simyacı", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Gökbilimci", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Saat Ustası", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Heykeltıraş", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Jeolog", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Maden Arayıcısı", category: "Meslekler", difficulty: "hard", points: 350 },
  { word: "Kaligraf", category: "Meslekler", difficulty: "hard", points: 350 },

  // --- YİYECEKLER & İÇECEKLER (KOLAY) ---
  { word: "Elma", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Muz", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Çilek", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Karpuz", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Limon", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Portakal", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Üzüm", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Havuç", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Domates", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Patates", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Ekmek", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Yumurta", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Peynir", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Süt", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Çay", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Kahve", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Su", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Pasta", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Çikolata", category: "Yiyecekler", difficulty: "easy", points: 100 },
  { word: "Dondurma", category: "Yiyecekler", difficulty: "easy", points: 100 },

  // --- YİYECEKLER & İÇECEKLER (ORTA) ---
  { word: "Hamburger", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Pizza", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Lahmacun", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Baklava", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Döner", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Köfte", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Makarna", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Kruvasan", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Patlamış Mısır", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Lolipop", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Donut", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Pankek", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Waffle", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Sushi", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Tako", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Avokado", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Hindistan Cevizi", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Ananas", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Kestane", category: "Yiyecekler", difficulty: "medium", points: 200 },
  { word: "Enginar", category: "Yiyecekler", difficulty: "medium", points: 200 },

  // --- TAŞITLAR & ULAŞIM (KOLAY / ORTA / ZOR) ---
  { word: "Araba", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Uçak", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Gemi", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Tren", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Bisiklet", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Otobüs", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Kamyon", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Taksi", category: "Taşıtlar", difficulty: "easy", points: 100 },
  { word: "Helikopter", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Motosiklet", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Roket", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Denizaltı", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Sıcak Hava Balonu", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Traktör", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Ambulans", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "İtfaiye Aracı", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Teleferik", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "UFO", category: "Taşıtlar", difficulty: "medium", points: 200 },
  { word: "Zepelin", category: "Taşıtlar", difficulty: "hard", points: 350 },
  { word: "Buharlı Lokomotif", category: "Taşıtlar", difficulty: "hard", points: 350 },
  { word: "Hoverkraft", category: "Taşıtlar", difficulty: "hard", points: 350 },

  // --- DOĞA & MEKANLAR (KOLAY / ORTA / ZOR) ---
  { word: "Güneş", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Ay", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Yıldız", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Ağaç", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Çiçek", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Bulut", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Yağmur", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Kar", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Dağ", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Deniz", category: "Doğa", difficulty: "easy", points: 100 },
  { word: "Ev", category: "Mekanlar", difficulty: "easy", points: 100 },
  { word: "Köprü", category: "Mekanlar", difficulty: "easy", points: 100 },
  { word: "Gökkuşağı", category: "Doğa", difficulty: "medium", points: 200 },
  { word: "Yanardağ", category: "Doğa", difficulty: "medium", points: 200 },
  { word: "Şelale", category: "Doğa", difficulty: "medium", points: 200 },
  { word: "Mağara", category: "Doğa", difficulty: "medium", points: 200 },
  { word: "Ada", category: "Doğa", difficulty: "medium", points: 200 },
  { word: "Çöl", category: "Doğa", difficulty: "medium", points: 200 },
  { word: "Piramit", category: "Mekanlar", difficulty: "medium", points: 200 },
  { word: "Kale", category: "Mekanlar", difficulty: "medium", points: 200 },
  { word: "Deniz Feneri", category: "Mekanlar", difficulty: "medium", points: 200 },
  { word: "Yel Değirmeni", category: "Mekanlar", difficulty: "medium", points: 200 },
  { word: "Stadyum", category: "Mekanlar", difficulty: "medium", points: 200 },
  { word: "Havalimanı", category: "Mekanlar", difficulty: "medium", points: 200 },
  { word: "Lunapark", category: "Mekanlar", difficulty: "medium", points: 200 },
  { word: "Kutup Işıkları", category: "Doğa", difficulty: "hard", points: 350 },
  { word: "Karadelik", category: "Doğa", difficulty: "hard", points: 350 },
  { word: "Meteor Yağmuru", category: "Doğa", difficulty: "hard", points: 350 },
  { word: "Gayzer", category: "Doğa", difficulty: "hard", points: 350 },
  { word: "Labirent", category: "Mekanlar", difficulty: "hard", points: 350 },
  { word: "Buzdağı", category: "Doğa", difficulty: "hard", points: 350 },
  { word: "Vaha", category: "Doğa", difficulty: "hard", points: 350 },

  // --- KAVRAMLAR, SPOR & FİİLLER (ORTA / ZOR) ---
  { word: "Satranç", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Okçuluk", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Boks", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Basketbol", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Voleybol", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Yüzme", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Paraşüt", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Dalış", category: "Spor", difficulty: "medium", points: 200 },
  { word: "Kardan Adam", category: "Kavramlar", difficulty: "medium", points: 200 },
  { word: "Doğum Günü", category: "Kavramlar", difficulty: "medium", points: 200 },
  { word: "Uykusuzluk", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Yerçekimi", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Zaman Yolculuğu", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Yapay Zeka", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "DNA Sarmalı", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Hipnoz", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Gölge Oyunu", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Hologram", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Fotosentez", category: "Kavramlar", difficulty: "hard", points: 350 },
  { word: "Akupunktur", category: "Kavramlar", difficulty: "hard", points: 350 }
];

/**
 * Normalizes Turkish text for comparison:
 * lowercases with tr-TR, strips punctuation, excess spaces.
 */
export const normalizeTr = (text: string): string => {
  return (text || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[\s\-_.,!?'"()]+/g, '');
};

/**
 * Strips Turkish diacritics for phonetic / typo closeness comparison
 */
export const stripDiacritics = (text: string): string => {
  return (text || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[\s\-_.,!?'"()]+/g, '');
};

/**
 * Standard Levenshtein Distance implementation
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[bn][an];
};

/**
 * Checks if a guess is very close to target word (e.g. 1 letter typo or missing accent)
 */
export const isCloseGuess = (guess: string, target: string): boolean => {
  const normGuess = normalizeTr(guess);
  const normTarget = normalizeTr(target);

  // Exact match is not "close", it is exact!
  if (normGuess === normTarget) return false;
  if (!normGuess || !normTarget) return false;

  // Compare without accents (e.g. "zurafa" vs "zürafa", "kopek" vs "köpek")
  const strippedGuess = stripDiacritics(guess);
  const strippedTarget = stripDiacritics(target);
  if (strippedGuess === strippedTarget) {
    return true;
  }

  // Levenshtein distance check based on length
  const dist = levenshteinDistance(normGuess, normTarget);
  if (normTarget.length <= 4 && dist === 1) return true;
  if (normTarget.length > 4 && normTarget.length <= 8 && dist <= 1) return true;
  if (normTarget.length > 8 && dist <= 2) return true;

  // Also check stripped distance
  const strippedDist = levenshteinDistance(strippedGuess, strippedTarget);
  if (strippedDist === 1) return true;

  return false;
};

/**
 * Checks if a message contains the secret word (to prevent spoiler by drawer / already guessed players)
 */
export const containsSecretWord = (message: string, target: string): boolean => {
  const normMsg = normalizeTr(message);
  const normTarget = normalizeTr(target);
  const strippedMsg = stripDiacritics(message);
  const strippedTarget = stripDiacritics(target);

  if (!normTarget || normTarget.length < 2) return false;

  return (
    normMsg.includes(normTarget) ||
    strippedMsg.includes(strippedTarget) ||
    normMsg === normTarget ||
    strippedMsg === strippedTarget
  );
};

/**
 * Selects count unique words from pool that are NOT in excludedList (Anti-repeat mechanism).
 * If pool runs out of unused words, resets excludedList automatically.
 */
export const getRandomWords = (
  count: number = 3,
  excludedList: Set<string> | string[] = new Set(),
  preferredDifficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard']
): { words: GarticWord[]; poolWasReset: boolean } => {
  const excludedSet = excludedList instanceof Set
    ? excludedList
    : new Set((excludedList || []).map(w => normalizeTr(w)));

  // Helper to filter available
  const getAvailableByDifficulty = (diff: 'easy' | 'medium' | 'hard') => {
    return GARTIC_WORDS_POOL.filter(
      item => item.difficulty === diff && !excludedSet.has(normalizeTr(item.word))
    );
  };

  let poolWasReset = false;

  // Check if we have enough words across requested difficulties
  let easyList = getAvailableByDifficulty('easy');
  let medList = getAvailableByDifficulty('medium');
  let hardList = getAvailableByDifficulty('hard');

  // If any pool is empty or total available is less than count, reset the anti-repeat set
  if (easyList.length === 0 || medList.length === 0 || hardList.length === 0) {
    excludedSet.clear();
    easyList = GARTIC_WORDS_POOL.filter(item => item.difficulty === 'easy');
    medList = GARTIC_WORDS_POOL.filter(item => item.difficulty === 'medium');
    hardList = GARTIC_WORDS_POOL.filter(item => item.difficulty === 'hard');
    poolWasReset = true;
  }

  const selectedWords: GarticWord[] = [];

  const pickRandom = (list: GarticWord[]): GarticWord => {
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  };

  // 1. Pick 1 Easy
  if (easyList.length > 0) {
    const chosen = pickRandom(easyList);
    selectedWords.push(chosen);
  }

  // 2. Pick 1 Medium
  if (medList.length > 0) {
    const chosen = pickRandom(medList);
    selectedWords.push(chosen);
  }

  // 3. Pick 1 Hard
  if (hardList.length > 0) {
    const chosen = pickRandom(hardList);
    selectedWords.push(chosen);
  }

  // If still less than count, fill with random unique from remaining
  while (selectedWords.length < count) {
    const remaining = GARTIC_WORDS_POOL.filter(
      item => !selectedWords.some(s => s.word === item.word)
    );
    if (remaining.length === 0) break;
    selectedWords.push(pickRandom(remaining));
  }

  return { words: selectedWords, poolWasReset };
};
