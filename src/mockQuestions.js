export const THEMES = [
  "日常问候",
  "自我介绍",
  "家庭与人物",
  "饮食与点餐",
  "时间与日期",
  "数字与价格",
  "地点与方向",
  "日常活动"
];

export const MOCK_QUESTIONS = {
  日常问候: [
    {
      promptZh: "你好。",
      acceptedAnswers: ["Bonjour.", "Salut."],
      autocomplete: ["bonjour", "salut"]
    },
    {
      promptZh: "谢谢你。",
      acceptedAnswers: ["Merci.", "Merci à toi."],
      autocomplete: ["merci", "à", "toi"]
    },
    {
      promptZh: "你好吗？",
      acceptedAnswers: ["Comment ça va ?", "Ça va ?"],
      autocomplete: ["comment", "ça", "va"]
    }
  ],
  自我介绍: [
    {
      promptZh: "我叫李明。",
      acceptedAnswers: ["Je m'appelle Li Ming.", "Moi, c'est Li Ming."],
      autocomplete: ["je", "m'appelle", "li", "ming", "moi", "c'est"]
    },
    {
      promptZh: "我是学生。",
      acceptedAnswers: ["Je suis étudiant.", "Je suis étudiante."],
      autocomplete: ["je", "suis", "étudiant", "étudiante"]
    },
    {
      promptZh: "我住在巴黎。",
      acceptedAnswers: ["J'habite à Paris.", "Je vis à Paris."],
      autocomplete: ["j'habite", "à", "paris", "je", "vis"]
    }
  ],
  家庭与人物: [
    {
      promptZh: "这是我的妈妈。",
      acceptedAnswers: ["C'est ma mère.", "Voici ma mère."],
      autocomplete: ["c'est", "ma", "mère", "voici"]
    },
    {
      promptZh: "他是我的朋友。",
      acceptedAnswers: ["C'est mon ami.", "Il est mon ami."],
      autocomplete: ["c'est", "mon", "ami", "il", "est"]
    },
    {
      promptZh: "她很友好。",
      acceptedAnswers: ["Elle est gentille.", "Elle est sympa."],
      autocomplete: ["elle", "est", "gentille", "sympa"]
    }
  ],
  饮食与点餐: [
    {
      promptZh: "我喜欢苹果。",
      acceptedAnswers: ["J'aime les pommes.", "J'aime manger des pommes."],
      autocomplete: ["j'aime", "les", "pommes", "manger", "des"]
    },
    {
      promptZh: "我想喝咖啡。",
      acceptedAnswers: ["Je veux un café.", "Je voudrais un café."],
      autocomplete: ["je", "veux", "voudrais", "un", "café"]
    },
    {
      promptZh: "我要一个面包。",
      acceptedAnswers: ["Je prends un pain.", "Je voudrais un pain."],
      autocomplete: ["je", "prends", "voudrais", "un", "pain"]
    }
  ],
  时间与日期: [
    {
      promptZh: "今天是星期一。",
      acceptedAnswers: ["Aujourd'hui, c'est lundi.", "Nous sommes lundi."],
      autocomplete: ["aujourd'hui", "c'est", "lundi", "nous", "sommes"]
    },
    {
      promptZh: "现在是三点。",
      acceptedAnswers: ["Il est trois heures.", "Il est 3 heures."],
      autocomplete: ["il", "est", "trois", "3", "heures"]
    },
    {
      promptZh: "明天是我的生日。",
      acceptedAnswers: ["Demain, c'est mon anniversaire.", "Demain est mon anniversaire."],
      autocomplete: ["demain", "c'est", "mon", "anniversaire", "est"]
    }
  ],
  数字与价格: [
    {
      promptZh: "这多少钱？",
      acceptedAnswers: ["Ça coûte combien ?", "C'est combien ?"],
      autocomplete: ["ça", "coûte", "combien", "c'est"]
    },
    {
      promptZh: "我有二十欧元。",
      acceptedAnswers: ["J'ai vingt euros.", "J'ai 20 euros."],
      autocomplete: ["j'ai", "vingt", "20", "euros"]
    },
    {
      promptZh: "我十八岁。",
      acceptedAnswers: ["J'ai dix-huit ans.", "J'ai 18 ans."],
      autocomplete: ["j'ai", "dix-huit", "18", "ans"]
    }
  ],
  地点与方向: [
    {
      promptZh: "学校在哪里？",
      acceptedAnswers: ["Où est l'école ?", "L'école est où ?"],
      autocomplete: ["où", "est", "l'école"]
    },
    {
      promptZh: "我去商店。",
      acceptedAnswers: ["Je vais au magasin.", "Je vais à la boutique."],
      autocomplete: ["je", "vais", "au", "magasin", "à", "la", "boutique"]
    },
    {
      promptZh: "我在家。",
      acceptedAnswers: ["Je suis à la maison.", "Je suis chez moi."],
      autocomplete: ["je", "suis", "à", "la", "maison", "chez", "moi"]
    }
  ],
  日常活动: [
    {
      promptZh: "我学习法语。",
      acceptedAnswers: ["J'étudie le français.", "J'apprends le français."],
      autocomplete: ["j'étudie", "le", "français", "j'apprends"]
    },
    {
      promptZh: "我看书。",
      acceptedAnswers: ["Je lis un livre.", "Je lis."],
      autocomplete: ["je", "lis", "un", "livre"]
    },
    {
      promptZh: "我早上工作。",
      acceptedAnswers: ["Je travaille le matin.", "Je travaille ce matin."],
      autocomplete: ["je", "travaille", "le", "matin", "ce"]
    }
  ]
};

export function getMockQuestions(theme, count = 5) {
  const source = MOCK_QUESTIONS[theme] || MOCK_QUESTIONS[THEMES[0]];
  return Array.from({ length: count }, (_, index) => ({
    ...source[index % source.length],
    id: `mock-${theme}-${Date.now()}-${index}`
  }));
}
