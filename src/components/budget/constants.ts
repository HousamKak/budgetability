// Custom date picker styles
export const datePickerStyles = `
  /* Custom styling for all date pickers */
  input[type="date"] {
    color-scheme: light;
    accent-color: #f59e0b;
    position: relative;
    transform: none !important;
  }

  /* Only hide calendar indicator for our custom calendar icon */
  .custom-calendar-hidden input[type="date"]::-webkit-calendar-picker-indicator {
    opacity: 0;
    cursor: pointer;
  }

  /* Stable date inputs - ensure they behave normally */
  .date-input-stable {
    position: static !important;
    transform: none !important;
  }

  .date-input-stable::-webkit-calendar-picker-indicator {
    opacity: 1;
    cursor: pointer;
  }

  /* Subtle focus states for date inputs */
  input[type="date"]:focus {
    outline: 1px solid #d97706;
    outline-offset: 1px;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
  }

  /* Even more subtle for stable date inputs */
  .date-input-stable:focus {
    outline: 1px solid #d97706;
    outline-offset: 0px;
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.15);
  }

  /* Prevent date picker from interfering with other elements */
  input[type="date"]::-webkit-calendar-picker-indicator {
    z-index: 1;
  }

  /* Ensure date picker popup behaves correctly */
  input[type="date"]::-webkit-datetime-edit {
    padding: 0;
  }
`;

// Daily motivational quotes
export const DAILY_QUOTES = [
  "Every penny saved is a step towards your dreams! 💫",
  "Small changes today = big savings tomorrow! 🌱",
  "You're doing great! Budget warriors unite! 🛡️",
  "Money saved is money earned. Keep going! 💪",
  "Your future self will thank you for today's choices! 🙏",
  "Budgeting is self-care in disguise! ✨",
  "Progress, not perfection. Every day counts! 📈",
  "You're building wealth one day at a time! 🏗️",
  "Smart spending = smart living! 🧠",
  "Your financial goals are within reach! 🎯",
  "Discipline today = freedom tomorrow! 🕊️",
  "You're rewriting your money story! 📖",
  "Every budget entry is a victory! 🏆",
  "Mindful money = mindful life! 🧘",
  "You're investing in your peace of mind! 🕊️",
  "A budget is telling your money where to go! 🗺️",
  "Wealth is built one dollar at a time! 🧱",
  "Your wallet reflects your priorities! 💼",
  "Saving is the first step to financial freedom! 🔓",
  "Every expense tracked is a lesson learned! 📚",
  "You're the CEO of your own finances! 👑",
  "Financial literacy is financial power! ⚡",
  "Budgeting: Because math is your friend! 🤓",
  "Your money goals are calling - answer them! 📞",
  "Compound interest is the 8th wonder of the world! 🌍",
  "A penny saved is still a penny earned! 🪙",
  "Budget like your dreams depend on it! 🎭",
  "Every no to spending is a yes to saving! ❌✅",
  "You're not cheap, you're financially smart! 🎓",
  "Emergency funds = peace of mind funds! 😌",
  "Track it, tackle it, triumph over it! 🏃‍♀️",
  "Your bank account is your report card! 📊",
  "Frugal is the new fabulous! ✨",
  "Delayed gratification = accelerated success! 🚀",
  "You control your money, not the other way! 🎮",
  "Every budget is a step towards independence! 🗽",
  "Financial goals: Set them, get them! 🎯",
  "Your money mindset shapes your reality! 🧠",
  "Budgeting is adulting at its finest! 👨‍💼",
  "Save first, spend what's left! ↩️",
  "You're writing your financial success story! ✍️",
  "Money talks, but your budget listens! 👂",
  "Being broke is temporary, being poor is mindset! 💭",
  "Your spending choices create your future! 🔮",
  "A good budget is a roadmap to riches! 🗺️",
  "Financial discipline = financial freedom! 🆓",
  "You're not poor, you're pre-rich! 🌟",
  "Every dollar has a job in your budget! 👷",
  "Budgeting: The art of living below your means! 🎨",
  "Your money is a tool, use it wisely! 🔧",
  "Invest in yourself, it pays the best interest! 📈",
  "A budget without goals is just math! 🧮",
  "You're building your empire one expense at a time! 🏰",
  "Financial peace is worth more than riches! ☮️",
  "Budget boldly, live brilliantly! 💎",
  "Your net worth reflects your self-worth! 💝",
  "Money is energy - direct it purposefully! ⚡",
  "You're the architect of your financial future! 🏗️",
  "Budgets turn dreams into plans! 📋",
  "Financial wisdom is the ultimate superpower! 🦸‍♀️",
  "Every tracked expense is a step forward! 👣",
  "You're not spending, you're investing in experiences! 🎪",
  "A dollar saved today is dollars earned tomorrow! 📅",
  "Your budget is your financial GPS! 🧭",
  "Money management is life management! 🌱",
  "You're cultivating wealth, not just counting coins! 🌾",
  "Financial freedom starts with the first saved dollar! 🥇",
  "Your budget reflects your values! 💖",
  "Every 'no' to impulse is a 'yes' to your goals! 🎯",
  "You're not restricting, you're redirecting! ↗️",
  "Budgeting is self-love in action! 💕",
  "Your money story is still being written! 📝",
  "Financial discipline today = choices tomorrow! 🔮",
  "You're the hero of your financial journey! 🦸",
  "Every budget revision is growth in action! 🌱",
  "Money is a terrible master but an excellent servant! 👤",
  "Your spending plan is your freedom plan! 🕊️",
  "Budget with purpose, spend with intention! 🎯",
  "You're not cheap, you're investment-minded! 📈",
  "Financial goals achieved one day at a time! 📆",
  "Your future wealth starts with today's discipline! ⏰",
  "Budgeting: Because your dreams have a price tag! 🏷️",
  "You're trading temporary comfort for permanent security! 🏠",
  "Every tracked dollar is a step towards independence! 🗽",
  "Your money mindset determines your money reality! 🎭",
  "Budget like a boss, live like royalty! 👑",
  "Financial planning is self-care planning! 🛁",
  "You're not penny-pinching, you're profit-maximizing! 📊",
  "Every expense decision shapes your destiny! 🔮",
  "Your budget is your permission slip to dream big! 🎫",
  "Money confidence comes from money competence! 💪",
  "You're building wealth habits one day at a time! 🧱",
  "Financial freedom is a mindset and a math set! 🧮",
  "Your spending choices vote for your values! 🗳️",
  "Budget wisely today, live freely tomorrow! 🆓",
  "You're the CFO of your own life! 💼",
  "Every dollar saved is a dollar of freedom earned! 🕊️",
  "Your financial journey is uniquely yours! 🛤️",
  "Budgeting transforms hopes into plans! 🗓️",
  "You're not sacrificing, you're strategizing! 🎯",
  "Money is a tool for building the life you want! 🔨",
  "Your budget is your blueprint for success! 📐",
  "Financial wisdom: Buy assets, not liabilities! ⚖️",
  "You're creating your financial masterpiece! 🎨",
  "Every tracked expense is data for better decisions! 📊",
  "Your money works hardest when you work smartest! 🧠",
  "Budget with love, spend with logic! ❤️🧮",
  "You're not restricting your life, you're designing it! 🎨",
];

export const getRandomQuote = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-11
  const dayOfMonth = today.getDate(); // 1-31

  // Create a unique index that ensures no repeats within the same month
  // Use month as offset and day of month to cycle through quotes
  const monthOffset = month * 31; // Offset by month to avoid repeats across months
  const quoteIndex = (monthOffset + dayOfMonth - 1) % DAILY_QUOTES.length;

  return DAILY_QUOTES[quoteIndex];
};
