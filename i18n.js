const TRANSLATIONS = {
  en: {
    dir: 'ltr',
    pageTitle: 'Many Paths — one destination',
    tagline: 'one destination.',
    topicLabel: 'Choose a topic',
    topicPlaceholder: 'e.g. forgiveness, prayer, afterlife...',
    religionLabel: 'Select religions to compare (pick 2–4)',
    compareBtn: 'Compare →',
    loadingText: 'Researching across traditions...',
    footer: 'Many Paths presents scholarship for educational purposes only. Part of the {getmAIde} family.',
    alertNoTopic: 'Please enter a topic.',
    alertMinReligions: 'Please select at least 2 religions.',
    alertError: 'Something went wrong: ',
    commonGround: '🌍 Common Ground',
    religions: {
      Christianity: 'Christianity', Judaism: 'Judaism', Islam: 'Islam',
      Buddhism: 'Buddhism', Hinduism: 'Hinduism', Taoism: 'Taoism', Sikhism: 'Sikhism',
    },
  },
  es: {
    dir: 'ltr',
    pageTitle: 'Many Paths — un destino',
    tagline: 'un destino.',
    topicLabel: 'Elige un tema',
    topicPlaceholder: 'ej. perdón, oración, vida después de la muerte...',
    religionLabel: 'Selecciona religiones para comparar (elige 2–4)',
    compareBtn: 'Comparar →',
    loadingText: 'Investigando entre tradiciones...',
    footer: 'Many Paths presenta estudios solo con fines educativos. Parte de la familia {getmAIde}.',
    alertNoTopic: 'Por favor, ingresa un tema.',
    alertMinReligions: 'Por favor, selecciona al menos 2 religiones.',
    alertError: 'Algo salió mal: ',
    commonGround: '🌍 Terreno Común',
    religions: {
      Christianity: 'Cristianismo', Judaism: 'Judaísmo', Islam: 'Islam',
      Buddhism: 'Budismo', Hinduism: 'Hinduismo', Taoism: 'Taoísmo', Sikhism: 'Sijismo',
    },
  },
  ar: {
    dir: 'rtl',
    pageTitle: 'Many Paths — وجهة واحدة',
    tagline: 'وجهة واحدة.',
    topicLabel: 'اختر موضوعاً',
    topicPlaceholder: 'مثل: المغفرة، الصلاة، الآخرة...',
    religionLabel: 'اختر الأديان للمقارنة (اختر 2–4)',
    compareBtn: '← قارن',
    loadingText: 'بحث عبر التقاليد الدينية...',
    footer: 'تقدم Many Paths محتوى أكاديمياً لأغراض تعليمية فقط. جزء من عائلة {getmAIde}.',
    alertNoTopic: 'الرجاء إدخال موضوع.',
    alertMinReligions: 'الرجاء اختيار دينين على الأقل.',
    alertError: 'حدث خطأ ما: ',
    commonGround: '🌍 أرضية مشتركة',
    religions: {
      Christianity: 'المسيحية', Judaism: 'اليهودية', Islam: 'الإسلام',
      Buddhism: 'البوذية', Hinduism: 'الهندوسية', Taoism: 'التاوية', Sikhism: 'السيخية',
    },
  },
  he: {
    dir: 'rtl',
    pageTitle: 'Many Paths — יעד אחד',
    tagline: 'יעד אחד.',
    topicLabel: 'בחר נושא',
    topicPlaceholder: 'למשל: סליחה, תפילה, חיים לאחר המוות...',
    religionLabel: 'בחר דתות להשוואה (בחר 2–4)',
    compareBtn: '← השווה',
    loadingText: 'חוקר בין מסורות שונות...',
    footer: 'Many Paths מציגה מחקר למטרות חינוכיות בלבד. חלק ממשפחת {getmAIde}.',
    alertNoTopic: 'אנא הכנס נושא.',
    alertMinReligions: 'אנא בחר לפחות 2 דתות.',
    alertError: 'משהו השתבש: ',
    commonGround: '🌍 בסיס משותף',
    religions: {
      Christianity: 'נצרות', Judaism: 'יהדות', Islam: 'אסלאם',
      Buddhism: 'בודהיזם', Hinduism: 'הינדואיזם', Taoism: 'טאואיזם', Sikhism: 'סיקיזם',
    },
  },
  hi: {
    dir: 'ltr',
    pageTitle: 'Many Paths — एक मंज़िल',
    tagline: 'एक मंज़िल।',
    topicLabel: 'विषय चुनें',
    topicPlaceholder: 'जैसे: क्षमा, प्रार्थना, मृत्यु के बाद...',
    religionLabel: 'तुलना के लिए धर्म चुनें (2–4 चुनें)',
    compareBtn: 'तुलना करें →',
    loadingText: 'परंपराओं में शोध हो रहा है...',
    footer: 'Many Paths केवल शैक्षणिक उद्देश्यों के लिए शोध प्रस्तुत करती है। {getmAIde} परिवार का हिस्सा।',
    alertNoTopic: 'कृपया एक विषय दर्ज करें।',
    alertMinReligions: 'कृपया कम से कम 2 धर्म चुनें।',
    alertError: 'कुछ गलत हो गया: ',
    commonGround: '🌍 साझा आधार',
    religions: {
      Christianity: 'ईसाई धर्म', Judaism: 'यहूदी धर्म', Islam: 'इस्लाम',
      Buddhism: 'बौद्ध धर्म', Hinduism: 'हिन्दू धर्म', Taoism: 'ताओ धर्म', Sikhism: 'सिख धर्म',
    },
  },
  fr: {
    dir: 'ltr',
    pageTitle: 'Many Paths — une destination',
    tagline: 'une destination.',
    topicLabel: 'Choisissez un sujet',
    topicPlaceholder: 'ex. pardon, prière, vie après la mort...',
    religionLabel: 'Sélectionnez des religions à comparer (choisir 2–4)',
    compareBtn: 'Comparer →',
    loadingText: 'Recherche à travers les traditions...',
    footer: 'Many Paths présente des études à des fins éducatives uniquement. Fait partie de la famille {getmAIde}.',
    alertNoTopic: 'Veuillez entrer un sujet.',
    alertMinReligions: 'Veuillez sélectionner au moins 2 religions.',
    alertError: 'Une erreur est survenue : ',
    commonGround: '🌍 Terrain Commun',
    religions: {
      Christianity: 'Christianisme', Judaism: 'Judaïsme', Islam: 'Islam',
      Buddhism: 'Bouddhisme', Hinduism: 'Hindouisme', Taoism: 'Taoïsme', Sikhism: 'Sikhisme',
    },
  },
  zh: {
    dir: 'ltr',
    pageTitle: 'Many Paths — 一个目的地',
    tagline: '一个目的地。',
    topicLabel: '选择话题',
    topicPlaceholder: '例如：宽恕、祈祷、来世...',
    religionLabel: '选择要比较的宗教（选 2–4 个）',
    compareBtn: '比较 →',
    loadingText: '正在研究各宗教传统...',
    footer: 'Many Paths 仅出于教育目的提供学术内容。{getmAIde} 家族的一部分。',
    alertNoTopic: '请输入一个话题。',
    alertMinReligions: '请至少选择 2 种宗教。',
    alertError: '出错了：',
    commonGround: '🌍 共同点',
    religions: {
      Christianity: '基督教', Judaism: '犹太教', Islam: '伊斯兰教',
      Buddhism: '佛教', Hinduism: '印度教', Taoism: '道教', Sikhism: '锡克教',
    },
  },
  ja: {
    dir: 'ltr',
    pageTitle: 'Many Paths — ひとつの目的地',
    tagline: 'ひとつの目的地。',
    topicLabel: 'トピックを選ぶ',
    topicPlaceholder: '例：許し、祈り、来世...',
    religionLabel: '比較する宗教を選ぶ（2〜4 つ）',
    compareBtn: '比較する →',
    loadingText: '各宗教の伝統を研究中...',
    footer: 'Many Paths は教育目的のみで学術情報を提供します。{getmAIde} ファミリーの一員。',
    alertNoTopic: 'トピックを入力してください。',
    alertMinReligions: '少なくとも 2 つの宗教を選んでください。',
    alertError: 'エラーが発生しました：',
    commonGround: '🌍 共通点',
    religions: {
      Christianity: 'キリスト教', Judaism: 'ユダヤ教', Islam: 'イスラム教',
      Buddhism: '仏教', Hinduism: 'ヒンドゥー教', Taoism: '道教', Sikhism: 'シク教',
    },
  },
};

let currentLang = localStorage.getItem('bridgemaide_lang') || 'en';

// Translate a top-level UI string
function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

// Translate a religion name
function tr(religion) {
  return TRANSLATIONS[currentLang]?.religions?.[religion] ?? religion;
}

function applyTranslations() {
  const lang = TRANSLATIONS[currentLang];
  if (!lang) return;

  document.documentElement.lang = currentLang;
  document.documentElement.dir = lang.dir;
  document.title = lang.pageTitle;

  document.querySelector('.tagline').textContent = lang.tagline;
  document.querySelector('label[for="topic"]').textContent = lang.topicLabel;
  document.getElementById('topic').placeholder = lang.topicPlaceholder;
  document.querySelector('.religion-select > label').textContent = lang.religionLabel;
  document.getElementById('compareBtn').textContent = lang.compareBtn;
  document.querySelector('.faith-label').textContent = lang.loadingText;

  // Religion checkbox labels — replace text node, keep input + sym
  document.querySelectorAll('.checkboxes label').forEach(label => {
    const cb  = label.querySelector('input');
    const sym = label.querySelector('.cb-sym');
    if (!cb || !sym) return;
    [...label.childNodes]
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .forEach(n => n.remove());
    label.appendChild(document.createTextNode('\u00A0' + (lang.religions[cb.value] || cb.value)));
  });

  // Footer (safe: template string is from our own controlled object)
  const footerP = document.querySelector('footer p');
  if (footerP) {
    footerP.innerHTML = lang.footer.replace(
      '{getmAIde}',
      '<a href="https://getmaide.com">getmAIde</a>'
    );
  }

  // Sync picker
  const picker = document.getElementById('langPicker');
  if (picker) picker.value = currentLang;
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('bridgemaide_lang', lang);
  applyTranslations();
}

document.addEventListener('DOMContentLoaded', applyTranslations);
