const sensitiveWords = [
  "色情",
  "暴力",
  "毒品",
  "赌博",
  "诈骗",
  "恐怖",
  "反动",
  "邪教",
  "迷信",
  "淫秽",
  "嫖娼",
  "卖淫",
  "强奸",
  "迷奸",
  "乱伦",
  "代孕",
  "捐精",
  "捐卵",
  "裸贷",
  "高利贷",
  "办证",
  "刻章",
  "发票",
  "假币",
  "洗钱",
  "走私",
  "贩毒",
  "吸毒",
  "制毒",
  "运毒",
  "枪支",
  "弹药",
  "爆炸",
  "管制刀具",
  "杀人",
  "抢劫",
  "绑架",
  "勒索",
  "敲诈",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "damn",
  "cock",
  "pussy",
  "dick",
  "cunt",
  "whore",
  "slut",
  "bastard",
  "motherfucker",
  "bullshit",
];

const containsSensitiveWords = (text) => {
  if (!text || typeof text !== "string") {
    return false;
  }

  const lowerText = text.toLowerCase();

  for (const word of sensitiveWords) {
    if (lowerText.includes(word.toLowerCase())) {
      return true;
    }
  }

  return false;
};

const filterSensitiveWords = (text) => {
  if (!text || typeof text !== "string") {
    return text;
  }

  let filteredText = text;

  for (const word of sensitiveWords) {
    const regex = new RegExp(word, "gi");
    filteredText = filteredText.replace(regex, "*".repeat(word.length));
  }

  return filteredText;
};

module.exports = {
  containsSensitiveWords,
  filterSensitiveWords,
};
