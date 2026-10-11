/**
 * Demo catalogue used by `yarn seed`. Replace with the brand's real products.
 *
 * Pictures come from Unsplash (free licence) and are listed in demo-photos.json
 * under "<handle>/<colour>", with photographer credits. They are stand-ins only:
 * before launch every product must show the brand's own photos.
 *
 * Base text (stored on the product) is English (en-IN). Hindi (hi-IN) and
 * Marathi (mr-IN) go into Medusa's translation module.
 * The Hindi/Marathi wording must be reviewed by a native speaker.
 *
 * Prices are in rupees. `mrp` is the base price; `price` is the selling
 * price, applied through a "sale" price list so the shop can show MRP and % off.
 *
 * Colour and size values stay in English: they are keys. The storefront shows
 * them in the visitor's language (storefront/src/lib/i18n/colours.ts).
 */

export type Locale = "hi-IN" | "mr-IN"

export type Text = { en: string; hi: string; mr: string }

export type CategoryDef = {
  handle: string
  parent?: string
  name: Text
  rank: number
}

export type ProductDef = {
  handle: string
  categories: string[]
  collections?: string[]
  /** Small tag on product cards */
  badge?: "bestseller"
  colours: string[]
  sizes: string[]
  mrp: number
  price: number
  weight: number
  title: Text
  description: Text
  material: Text
  metadata: {
    fabric: "cotton" | "linen" | "silk" | "denim" | "rayon" | "fleece"
    fit: "regular" | "slim" | "relaxed"
    size_chart: "men-top" | "men-bottom" | "women-top" | "women-bottom" | "kids"
    care: "machine-cold" | "dry-clean" | "hand-wash"
    country_of_origin: "IN"
    /** HSN code for the GST invoice (4 digits; confirm with the accountant) */
    hsn: string
  }
  /** Stock per variant; `${size}/${colour}` overrides the default of 40. */
  stock?: Record<string, number>
}

export const LOCALES = [
  { code: "en-IN", name: "English (India)" },
  { code: "hi-IN", name: "Hindi (India)" },
  { code: "mr-IN", name: "Marathi (India)" },
]

const ADULT = ["S", "M", "L", "XL", "XXL"]
const WOMEN = ["XS", "S", "M", "L", "XL"]

export const CATEGORIES: CategoryDef[] = [
  { handle: "men", name: { en: "Men", hi: "पुरुष", mr: "पुरुष" }, rank: 0 },
  { handle: "women", name: { en: "Women", hi: "महिला", mr: "महिला" }, rank: 1 },
  { handle: "kids", name: { en: "Kids", hi: "बच्चे", mr: "मुले" }, rank: 2 },
  { handle: "winterwear", name: { en: "Winterwear", hi: "सर्दियों के कपड़े", mr: "हिवाळी कपडे" }, rank: 3 },

  { handle: "men-t-shirts", parent: "men", name: { en: "T-Shirts", hi: "टी-शर्ट", mr: "टी-शर्ट" }, rank: 0 },
  { handle: "men-shirts", parent: "men", name: { en: "Shirts", hi: "शर्ट", mr: "शर्ट" }, rank: 1 },
  { handle: "men-kurtas", parent: "men", name: { en: "Kurtas", hi: "कुर्ते", mr: "कुर्ते" }, rank: 2 },
  { handle: "men-jeans", parent: "men", name: { en: "Jeans", hi: "जींस", mr: "जीन्स" }, rank: 3 },

  { handle: "women-kurtas", parent: "women", name: { en: "Kurtas & Kurtis", hi: "कुर्ते और कुर्तियाँ", mr: "कुर्ते आणि कुर्ती" }, rank: 0 },
  { handle: "women-dresses", parent: "women", name: { en: "Dresses", hi: "ड्रेस", mr: "ड्रेस" }, rank: 1 },
  { handle: "women-t-shirts", parent: "women", name: { en: "T-Shirts", hi: "टी-शर्ट", mr: "टी-शर्ट" }, rank: 2 },
  { handle: "women-joggers", parent: "women", name: { en: "Joggers", hi: "जॉगर्स", mr: "जॉगर्स" }, rank: 3 },

  { handle: "kids-t-shirts", parent: "kids", name: { en: "T-Shirts", hi: "टी-शर्ट", mr: "टी-शर्ट" }, rank: 0 },
]

export const COLLECTIONS: { handle: string; title: Text }[] = [
  { handle: "new-arrivals", title: { en: "New Arrivals", hi: "नए आगमन", mr: "नवीन आगमन" } },
  { handle: "festive", title: { en: "Festive Edit", hi: "त्योहारों का संग्रह", mr: "सणासुदीचा संग्रह" } },
]

export const PRODUCTS: ProductDef[] = [
  {
    handle: "classic-crew-t-shirt",
    categories: ["men-t-shirts"],
    collections: ["new-arrivals"],
    colours: ["black", "white"],
    sizes: ADULT,
    mrp: 799,
    price: 499,
    weight: 220,
    title: {
      en: "Classic Cotton Crew Neck T-Shirt",
      hi: "क्लासिक कॉटन क्रू नेक टी-शर्ट",
      mr: "क्लासिक कॉटन क्रू नेक टी-शर्ट",
    },
    description: {
      en: "Soft, breathable 100% cotton T-shirt with a classic crew neck. Easy to wear all day, every day.",
      hi: "मुलायम और हवादार 100% कॉटन टी-शर्ट, क्लासिक क्रू नेक के साथ। पूरे दिन पहनने में आरामदायक।",
      mr: "मऊ आणि हवेशीर 100% कॉटन टी-शर्ट, क्लासिक क्रू नेकसह. दिवसभर घालायला आरामदायी.",
    },
    material: { en: "100% Cotton", hi: "100% कॉटन", mr: "100% कॉटन" },
    metadata: { fabric: "cotton", fit: "regular", size_chart: "men-top", care: "machine-cold", country_of_origin: "IN", hsn: "6109" },
    stock: { "XXL/black": 0, "S/white": 3 },
    badge: "bestseller",
  },
  {
    handle: "slim-fit-oxford-shirt",
    categories: ["men-shirts"],
    collections: ["new-arrivals"],
    colours: ["white", "sky-blue"],
    sizes: ADULT,
    mrp: 1599,
    price: 999,
    weight: 300,
    title: {
      en: "Slim Fit Oxford Shirt",
      hi: "स्लिम फिट ऑक्सफ़र्ड शर्ट",
      mr: "स्लिम फिट ऑक्सफर्ड शर्ट",
    },
    description: {
      en: "A crisp cotton Oxford shirt with a button-down collar. Smart enough for the office, relaxed enough for weekends.",
      hi: "बटन-डाउन कॉलर वाली कड़क कॉटन ऑक्सफ़र्ड शर्ट। ऑफ़िस के लिए स्मार्ट, वीकेंड के लिए आरामदायक।",
      mr: "बटन-डाउन कॉलर असलेला कडक कॉटन ऑक्सफर्ड शर्ट. ऑफिससाठी स्मार्ट, सुट्टीच्या दिवशी आरामदायी.",
    },
    material: { en: "100% Cotton", hi: "100% कॉटन", mr: "100% कॉटन" },
    metadata: { fabric: "cotton", fit: "slim", size_chart: "men-top", care: "machine-cold", country_of_origin: "IN", hsn: "6205" },
    stock: { "S/sky-blue": 0 },
  },
  {
    handle: "linen-blend-casual-shirt",
    categories: ["men-shirts"],
    colours: ["beige", "navy", "grey"],
    sizes: ADULT,
    mrp: 1999,
    price: 1299,
    weight: 280,
    title: {
      en: "Linen Blend Casual Shirt",
      hi: "लिनन ब्लेंड कैज़ुअल शर्ट",
      mr: "लिनन ब्लेंड कॅज्युअल शर्ट",
    },
    description: {
      en: "Lightweight linen-blend shirt that keeps you cool in Indian summers.",
      hi: "हल्की लिनन-ब्लेंड शर्ट, जो भारतीय गर्मियों में आपको ठंडा रखती है।",
      mr: "हलका लिनन-ब्लेंड शर्ट, जो भारतीय उन्हाळ्यात तुम्हाला थंड ठेवतो.",
    },
    material: {
      en: "Linen Blend (60% linen, 40% cotton)",
      hi: "लिनन ब्लेंड (60% लिनन, 40% कॉटन)",
      mr: "लिनन ब्लेंड (60% लिनन, 40% कॉटन)",
    },
    metadata: { fabric: "linen", fit: "relaxed", size_chart: "men-top", care: "hand-wash", country_of_origin: "IN", hsn: "6205" },
  },
  {
    handle: "cotton-straight-kurta",
    categories: ["men-kurtas"],
    collections: ["festive"],
    colours: ["white", "maroon", "mustard"],
    sizes: ADULT,
    mrp: 1499,
    price: 899,
    weight: 320,
    title: {
      en: "Cotton Straight Kurta",
      hi: "कॉटन स्ट्रेट कुर्ता",
      mr: "कॉटन स्ट्रेट कुर्ता",
    },
    description: {
      en: "A classic straight-cut cotton kurta with a mandarin collar. Perfect for pujas, family functions and daily wear.",
      hi: "मैंडरिन कॉलर वाला क्लासिक स्ट्रेट-कट कॉटन कुर्ता। पूजा, पारिवारिक समारोह और रोज़ाना पहनने के लिए बढ़िया।",
      mr: "मँडरिन कॉलर असलेला क्लासिक स्ट्रेट-कट कॉटन कुर्ता. पूजा, कौटुंबिक कार्यक्रम आणि रोजच्या वापरासाठी उत्तम.",
    },
    material: { en: "100% Cotton", hi: "100% कॉटन", mr: "100% कॉटन" },
    metadata: { fabric: "cotton", fit: "regular", size_chart: "men-top", care: "machine-cold", country_of_origin: "IN", hsn: "6211" },
  },
  {
    handle: "festive-silk-blend-kurta",
    categories: ["men-kurtas"],
    collections: ["festive", "new-arrivals"],
    colours: ["royal-blue", "pink"],
    sizes: ADULT,
    mrp: 2999,
    price: 1799,
    weight: 350,
    title: {
      en: "Festive Silk Blend Kurta",
      hi: "फ़ेस्टिव सिल्क ब्लेंड कुर्ता",
      mr: "फेस्टिव्ह सिल्क ब्लेंड कुर्ता",
    },
    description: {
      en: "Rich silk-blend kurta with a soft sheen, made for weddings and festivals.",
      hi: "हल्की चमक वाला सिल्क-ब्लेंड कुर्ता, शादियों और त्योहारों के लिए।",
      mr: "हलकी चमक असलेला सिल्क-ब्लेंड कुर्ता, लग्नसमारंभ आणि सणांसाठी.",
    },
    material: { en: "Silk Blend", hi: "सिल्क ब्लेंड", mr: "सिल्क ब्लेंड" },
    metadata: { fabric: "silk", fit: "regular", size_chart: "men-top", care: "dry-clean", country_of_origin: "IN", hsn: "6211" },
    stock: { "M/royal-blue": 2 },
  },
  {
    handle: "slim-fit-stretch-jeans",
    categories: ["men-jeans"],
    colours: ["indigo"],
    sizes: ["28", "30", "32", "34", "36"],
    mrp: 1999,
    price: 1199,
    weight: 600,
    title: {
      en: "Slim Fit Stretch Jeans",
      hi: "स्लिम फिट स्ट्रेच जींस",
      mr: "स्लिम फिट स्ट्रेच जीन्स",
    },
    description: {
      en: "Comfort-stretch denim with a modern slim fit that moves with you.",
      hi: "आरामदायक स्ट्रेच डेनिम, मॉडर्न स्लिम फिट के साथ, जो हर हरकत में साथ दे।",
      mr: "आरामदायी स्ट्रेच डेनिम, आधुनिक स्लिम फिटसह, जी प्रत्येक हालचालीत साथ देते.",
    },
    material: {
      en: "Denim (98% cotton, 2% elastane)",
      hi: "डेनिम (98% कॉटन, 2% इलास्टेन)",
      mr: "डेनिम (98% कॉटन, 2% इलास्टेन)",
    },
    metadata: { fabric: "denim", fit: "slim", size_chart: "men-bottom", care: "machine-cold", country_of_origin: "IN", hsn: "6203" },
    stock: { "36/indigo": 0 },
    badge: "bestseller",
  },
  {
    handle: "womens-a-line-rayon-kurta",
    categories: ["women-kurtas"],
    collections: ["festive", "new-arrivals"],
    colours: ["pink", "white"],
    sizes: [...WOMEN, "XXL"],
    mrp: 1299,
    price: 799,
    weight: 250,
    title: {
      en: "Women's A-Line Rayon Kurta",
      hi: "महिलाओं का ए-लाइन रेयॉन कुर्ता",
      mr: "महिलांसाठी ए-लाइन रेयॉन कुर्ता",
    },
    description: {
      en: "Flowy A-line kurta in soft rayon. Pair it with leggings or palazzos.",
      hi: "मुलायम रेयॉन में लहराता ए-लाइन कुर्ता। लेगिंग्स या पलाज़ो के साथ पहनें।",
      mr: "मऊ रेयॉनमधील सैलसर ए-लाइन कुर्ता. लेगिंग्ज किंवा पलाझोसोबत घाला.",
    },
    material: { en: "100% Rayon", hi: "100% रेयॉन", mr: "100% रेयॉन" },
    metadata: { fabric: "rayon", fit: "regular", size_chart: "women-top", care: "hand-wash", country_of_origin: "IN", hsn: "6211" },
  },
  {
    handle: "flowy-maxi-dress",
    categories: ["women-dresses"],
    collections: ["new-arrivals", "festive"],
    colours: ["red"],
    sizes: WOMEN,
    mrp: 1799,
    price: 1099,
    weight: 300,
    title: {
      en: "Flowy Maxi Dress",
      hi: "लहराती मैक्सी ड्रेस",
      mr: "घेरदार मॅक्सी ड्रेस",
    },
    description: {
      en: "A floor-length dress that flows with every step. Made for weddings, parties and evenings out.",
      hi: "हर कदम के साथ लहराती, पूरी लंबाई की ड्रेस। शादियों, पार्टियों और शाम की सैर के लिए।",
      mr: "प्रत्येक पावलासोबत लहरणारा, पूर्ण लांबीचा ड्रेस. लग्नसमारंभ, पार्ट्या आणि संध्याकाळच्या बाहेर फिरण्यासाठी.",
    },
    material: { en: "100% Rayon", hi: "100% रेयॉन", mr: "100% रेयॉन" },
    metadata: { fabric: "rayon", fit: "regular", size_chart: "women-top", care: "hand-wash", country_of_origin: "IN", hsn: "6204" },
  },
  {
    handle: "womens-everyday-cotton-t-shirt",
    categories: ["women-t-shirts"],
    colours: ["white"],
    sizes: WOMEN,
    mrp: 699,
    price: 399,
    weight: 180,
    title: {
      en: "Women's Everyday Cotton T-Shirt",
      hi: "महिलाओं की रोज़ाना कॉटन टी-शर्ट",
      mr: "महिलांसाठी रोजचा कॉटन टी-शर्ट",
    },
    description: {
      en: "A soft, regular-fit cotton tee for everyday comfort.",
      hi: "रोज़ के आराम के लिए मुलायम, रेगुलर-फिट कॉटन टी-शर्ट।",
      mr: "रोजच्या आरामासाठी मऊ, रेग्युलर-फिट कॉटन टी-शर्ट.",
    },
    material: { en: "100% Cotton", hi: "100% कॉटन", mr: "100% कॉटन" },
    metadata: { fabric: "cotton", fit: "regular", size_chart: "women-top", care: "machine-cold", country_of_origin: "IN", hsn: "6109" },
  },
  {
    handle: "unisex-fleece-hoodie",
    categories: ["winterwear"],
    collections: ["new-arrivals"],
    colours: ["grey"],
    sizes: ADULT,
    mrp: 2499,
    price: 1499,
    weight: 550,
    title: {
      en: "Unisex Fleece Hoodie",
      hi: "यूनिसेक्स फ़्लीस हुडी",
      mr: "युनिसेक्स फ्लीस हुडी",
    },
    description: {
      en: "Warm brushed-fleece hoodie with a kangaroo pocket and adjustable hood.",
      hi: "कंगारू पॉकेट और एडजस्टेबल हुड वाली गर्म, मुलायम फ़्लीस हुडी।",
      mr: "कांगारू पॉकेट आणि ॲडजस्टेबल हुड असलेली उबदार, मऊ फ्लीस हुडी.",
    },
    material: {
      en: "Fleece (60% cotton, 40% polyester)",
      hi: "फ़्लीस (60% कॉटन, 40% पॉलिएस्टर)",
      mr: "फ्लीस (60% कॉटन, 40% पॉलिएस्टर)",
    },
    metadata: { fabric: "fleece", fit: "relaxed", size_chart: "men-top", care: "machine-cold", country_of_origin: "IN", hsn: "6110" },
  },
  {
    handle: "womens-cotton-joggers",
    categories: ["women-joggers"],
    colours: ["grey", "red", "teal"],
    sizes: WOMEN,
    mrp: 1199,
    price: 699,
    weight: 280,
    title: {
      en: "Women's Cotton Joggers",
      hi: "महिलाओं के कॉटन जॉगर्स",
      mr: "महिलांसाठी कॉटन जॉगर्स",
    },
    description: {
      en: "Comfy cotton joggers with an elastic waist and drawstring. Great for yoga, travel and lounging.",
      hi: "इलास्टिक कमर और डोरी वाले आरामदायक कॉटन जॉगर्स। योग, यात्रा और घर पर आराम के लिए बढ़िया।",
      mr: "इलॅस्टिक कमर आणि नाडी असलेले आरामदायी कॉटन जॉगर्स. योग, प्रवास आणि घरी आरामासाठी उत्तम.",
    },
    material: {
      en: "Cotton Lycra (95% cotton, 5% spandex)",
      hi: "कॉटन लाइक्रा (95% कॉटन, 5% स्पैन्डेक्स)",
      mr: "कॉटन लायक्रा (95% कॉटन, 5% स्पॅन्डेक्स)",
    },
    metadata: { fabric: "cotton", fit: "relaxed", size_chart: "women-bottom", care: "machine-cold", country_of_origin: "IN", hsn: "6104" },
  },
  {
    handle: "kids-cotton-t-shirt",
    categories: ["kids-t-shirts"],
    colours: ["royal-blue", "lavender"],
    sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
    mrp: 499,
    price: 299,
    weight: 120,
    title: {
      en: "Kids' Cotton T-Shirt",
      hi: "बच्चों की कॉटन टी-शर्ट",
      mr: "मुलांसाठी कॉटन टी-शर्ट",
    },
    description: {
      en: "Soft, skin-friendly cotton tee for little ones who never sit still.",
      hi: "कभी न थकने वाले बच्चों के लिए मुलायम, त्वचा के अनुकूल कॉटन टी-शर्ट।",
      mr: "कधीही शांत न बसणाऱ्या चिमुकल्यांसाठी मऊ, त्वचेला सौम्य कॉटन टी-शर्ट.",
    },
    material: { en: "100% Cotton", hi: "100% कॉटन", mr: "100% कॉटन" },
    metadata: { fabric: "cotton", fit: "regular", size_chart: "kids", care: "machine-cold", country_of_origin: "IN", hsn: "6109" },
  },
]
