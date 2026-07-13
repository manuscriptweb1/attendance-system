// Motivation Messages Utility

const CATEGORIES = {
  CHECK_IN_NORMAL: 'CHECK_IN_NORMAL',
  CHECK_IN_LATE: 'CHECK_IN_LATE',
  PRESENT: 'PRESENT',
  HALF_DAY: 'HALF_DAY',
  CHECK_OUT_NORMAL: 'CHECK_OUT_NORMAL',
  CHECK_OUT_EARLY: 'CHECK_OUT_EARLY',
  AUTO_CHECKOUT: 'AUTO_CHECKOUT',
  SUNDAY: 'SUNDAY',
  GOVT_HOLIDAY: 'GOVT_HOLIDAY',
  OFFICE_HOLIDAY: 'OFFICE_HOLIDAY',
  BIRTHDAY: 'BIRTHDAY',
  DAILY_LOGIN: 'DAILY_LOGIN'
};

const MESSAGES = {
  [CATEGORIES.DAILY_LOGIN]: [
    { text: "Every day is a fresh start. Make today count!", icon: "🌅" },
    { text: "Your potential is limitless today.", icon: "✨" },
    { text: "Embrace the challenges and conquer the day.", icon: "💪" },
    { text: "A positive mindset brings positive results.", icon: "🧠" },
    { text: "You have what it takes to succeed today.", icon: "🌟" },
    { text: "Focus on your goals and take small steps.", icon: "🎯" },
    { text: "Your hard work is noticed and appreciated.", icon: "👏" },
    { text: "Stay focused, stay positive, stay strong.", icon: "⚡" },
    { text: "Let your dedication shine through your work.", icon: "💎" },
    { text: "Create the kind of day you want to have.", icon: "🎨" },
    { text: "Productivity is a choice. Choose wisely.", icon: "⚙️" },
    { text: "Believe in yourself and your abilities.", icon: "🚀" },
    { text: "You are an essential part of this team.", icon: "🤝" },
    { text: "Bring your best energy to work today.", icon: "🔋" },
    { text: "Success is the sum of small efforts.", icon: "📈" },
    { text: "Keep moving forward, one task at a time.", icon: "🚶" },
    { text: "Your enthusiasm is contagious. Spread it!", icon: "😊" },
    { text: "Be the reason someone smiles today.", icon: "☀️" },
    { text: "You are capable of amazing things.", icon: "🏆" },
    { text: "Let's make today productive and meaningful.", icon: "💼" }
  ],
  [CATEGORIES.CHECK_IN_NORMAL]: [
    { text: "Great start! Today is another opportunity to achieve something amazing.", icon: "🚀" },
    { text: "You're on time. Keep up the excellent work!", icon: "⏰" },
    { text: "Success begins with showing up. Have a productive day!", icon: "🌟" },
    { text: "Right on schedule! Let's conquer today's goals.", icon: "🎯" },
    { text: "Perfect timing. Let's make today count.", icon: "⏱️" },
    { text: "Glad to see you! Ready to tackle the day?", icon: "👋" },
    { text: "Punctuality is the soul of business. Great job!", icon: "👔" },
    { text: "You're here and ready. That's half the battle won.", icon: "⚔️" },
    { text: "Starting on time means finishing strong.", icon: "🏁" },
    { text: "Welcome! Your dedication is inspiring.", icon: "🙌" },
    { text: "Excellent start to the day. Let's keep this momentum.", icon: "💨" },
    { text: "You are clocked in and ready to shine.", icon: "✨" },
    { text: "A punctual start sets the tone for a great day.", icon: "🎵" },
    { text: "Ready, set, go! Let's have a fantastic day.", icon: "🚦" },
    { text: "Your commitment to being on time is appreciated.", icon: "🙏" },
    { text: "Early bird catches the worm. Let's get started!", icon: "🐦" },
    { text: "You made it! Let's focus and achieve greatness today.", icon: "🔭" },
    { text: "Another day, another chance to excel.", icon: "🏅" },
    { text: "On time and on point. Let's do this!", icon: "🎯" },
    { text: "Welcome aboard for another productive day.", icon: "🚢" }
  ],
  [CATEGORIES.CHECK_IN_LATE]: [
    { text: "You made it! Let's make the rest of the day count.", icon: "🏃" },
    { text: "Every new moment is another chance to improve.", icon: "⏳" },
    { text: "Don't worry about the delay. Finish the day strong.", icon: "💪" },
    { text: "Glad you're here. Let's focus on the tasks ahead.", icon: "🎯" },
    { text: "It's not about how you start, it's how you finish.", icon: "🏁" },
    { text: "You're here now. Let's turn things around.", icon: "🔄" },
    { text: "Better late than never. Let's get to work!", icon: "💼" },
    { text: "Take a deep breath and dive into your work.", icon: "🧘" },
    { text: "The day is still young. You can achieve a lot.", icon: "🌅" },
    { text: "Focus on productivity, not the clock.", icon: "⚙️" },
    { text: "Shake it off and let's have a great day.", icon: "👋" },
    { text: "You have arrived. Now let's make it happen.", icon: "🚀" },
    { text: "Don't let a late start define your whole day.", icon: "🎨" },
    { text: "We're glad you made it. Let's catch up!", icon: "📈" },
    { text: "Time to shift into high gear.", icon: "🏎️" },
    { text: "Put the morning behind you and focus forward.", icon: "➡️" },
    { text: "Your contribution is still needed today.", icon: "🤝" },
    { text: "Let's work smart and make up for lost time.", icon: "🧠" },
    { text: "You're here, and that's what matters. Let's go!", icon: "🌟" },
    { text: "Turn this late start into a highly productive finish.", icon: "🔥" }
  ],
  [CATEGORIES.PRESENT]: [
    { text: "Your presence makes our team stronger.", icon: "💪" },
    { text: "Keep up the consistent work!", icon: "🔄" },
    { text: "We appreciate your dedication every single day.", icon: "🙏" },
    { text: "Another day marked present, another day of progress.", icon: "📈" },
    { text: "Consistency is key to success. Great job!", icon: "🔑" },
    { text: "Your reliability is one of your best qualities.", icon: "🌟" },
    { text: "Thank you for showing up and giving your best.", icon: "🙌" },
    { text: "Being present is the first step to achieving goals.", icon: "🚶" },
    { text: "We value your commitment to the team.", icon: "🤝" },
    { text: "Your consistent attendance sets a great example.", icon: "🏆" },
    { text: "Keep bringing your unique skills to the table.", icon: "🎨" },
    { text: "Your hard work today builds your success tomorrow.", icon: "🏗️" },
    { text: "Thanks for being a dependable part of our workforce.", icon: "⚙️" },
    { text: "Every day you're here is a day we move forward.", icon: "➡️" },
    { text: "Your daily efforts do not go unnoticed.", icon: "👀" },
    { text: "Keep up the excellent attendance record!", icon: "📋" },
    { text: "We're glad to have you on the team today.", icon: "😊" },
    { text: "Your presence is felt and appreciated.", icon: "❤️" },
    { text: "Thank you for being reliable and ready to work.", icon: "💼" },
    { text: "Let's make today another successful day.", icon: "✨" }
  ],
  [CATEGORIES.HALF_DAY]: [
    { text: "Every contribution matters. Make the most of your remaining time.", icon: "⏳" },
    { text: "Small progress is still progress.", icon: "📈" },
    { text: "Focus on high-priority tasks for your half day.", icon: "🎯" },
    { text: "Make these hours count!", icon: "⏱️" },
    { text: "A half day is still an opportunity to shine.", icon: "🌟" },
    { text: "Work smart, not long today.", icon: "🧠" },
    { text: "Maximize your impact in the time you have.", icon: "💥" },
    { text: "Quality over quantity. Have a productive half day.", icon: "💎" },
    { text: "Let's achieve a lot in a little time.", icon: "🚀" },
    { text: "Prioritize and conquer your half day.", icon: "📋" },
    { text: "Even a half day can lead to full results.", icon: "📊" },
    { text: "Stay focused and efficient today.", icon: "⚙️" },
    { text: "Make every minute of your half day valuable.", icon: "💎" },
    { text: "You can do a lot in half the time if you focus.", icon: "🔍" },
    { text: "A brief but impactful day ahead.", icon: "⚡" },
    { text: "Let's make these hours highly productive.", icon: "💼" },
    { text: "Concentrate on what truly matters today.", icon: "🎯" },
    { text: "Short day, big impact. Let's go!", icon: "💥" },
    { text: "Efficiency is your best friend today.", icon: "🤝" },
    { text: "Enjoy your half day and work efficiently.", icon: "😊" }
  ],
  [CATEGORIES.CHECK_OUT_NORMAL]: [
    { text: "Excellent work today! Enjoy your evening.", icon: "🌆" },
    { text: "You completed another productive day.", icon: "✅" },
    { text: "Thank you for your dedication today.", icon: "🙏" },
    { text: "Time to rest and recharge for tomorrow.", icon: "🔋" },
    { text: "Great job completing your hours. Have a good night!", icon: "🌙" },
    { text: "Leave work at work and enjoy your personal time.", icon: "🏡" },
    { text: "Another successful day in the books.", icon: "📚" },
    { text: "You earned your rest today. Great work!", icon: "🏆" },
    { text: "Disconnect and relax. See you tomorrow!", icon: "👋" },
    { text: "Be proud of what you accomplished today.", icon: "🌟" },
    { text: "Your hard work today is appreciated. Good evening!", icon: "🌆" },
    { text: "Time to shift focus to yourself and your family.", icon: "❤️" },
    { text: "Rest well, you've done a great job today.", icon: "😴" },
    { text: "Mission accomplished for today.", icon: "🎯" },
    { text: "Have a peaceful and relaxing evening.", icon: "🕊️" },
    { text: "Thank you for giving your best today.", icon: "💯" },
    { text: "Unwind and enjoy your free time.", icon: "🧘" },
    { text: "You've worked hard, now it's time to play.", icon: "🎮" },
    { text: "Ending the day on a high note. Good job!", icon: "🎵" },
    { text: "See you tomorrow! Have a wonderful evening.", icon: "✨" }
  ],
  [CATEGORIES.CHECK_OUT_EARLY]: [
    { text: "You finished early today. Wishing you a good rest.", icon: "🛋️" },
    { text: "Take care and come back stronger tomorrow.", icon: "💪" },
    { text: "Enjoy the extra time off today.", icon: "⏱️" },
    { text: "Rest up and take care of yourself.", icon: "❤️" },
    { text: "Sometimes an early day is exactly what you need.", icon: "🧘" },
    { text: "Use this extra time to relax and recharge.", icon: "🔋" },
    { text: "Leaving early today? Have a safe trip home.", icon: "🚗" },
    { text: "Enjoy your evening, you've earned the rest.", icon: "🌆" },
    { text: "Take this time for yourself. See you soon.", icon: "👋" },
    { text: "Rest, recover, and return refreshed.", icon: "🌊" },
    { text: "It's okay to finish early sometimes. Take care.", icon: "👍" },
    { text: "Have a peaceful rest of your day.", icon: "🕊️" },
    { text: "We hope everything is okay. Take care of yourself.", icon: "🙏" },
    { text: "Enjoy the early departure. See you next time.", icon: "😊" },
    { text: "Use this time to decompress.", icon: "🌬️" },
    { text: "Wishing you a relaxing afternoon/evening.", icon: "🌇" },
    { text: "Take it easy and have a good rest of the day.", icon: "☕" },
    { text: "Your health and well-being come first.", icon: "⚕️" },
    { text: "Enjoy the unexpected free time.", icon: "🎁" },
    { text: "Have a safe journey home.", icon: "🏠" }
  ],
  [CATEGORIES.AUTO_CHECKOUT]: [
    { text: "You were automatically checked out yesterday. Don't forget to check out manually today if possible.", icon: "🤖" },
    { text: "System checked you out yesterday. Remember to log your departure today.", icon: "📝" },
    { text: "Did you forget to check out? The system handled it, but try to remember next time.", icon: "🔔" },
    { text: "Auto-checkout engaged yesterday. Let's aim for a manual checkout today.", icon: "🎯" },
    { text: "We missed your checkout yesterday! The system stepped in.", icon: "⚙️" },
    { text: "Remember to manually check out to accurately record your hours.", icon: "⏱️" },
    { text: "Auto-checkout caught you yesterday. Please remember to clock out.", icon: "⏰" },
    { text: "Your session auto-closed yesterday. Keep an eye on the clock today.", icon: "👀" },
    { text: "System reminder: Manual checkouts help maintain accurate records.", icon: "📊" },
    { text: "You were logged out automatically. Have a great day today!", icon: "🌅" },
    { text: "Don't let the system check you out! Remember to do it yourself.", icon: "✋" },
    { text: "Auto-checkout activated yesterday. Let's manually checkout today.", icon: "✅" },
    { text: "Just a friendly reminder to check out before you leave.", icon: "👋" },
    { text: "The system checked you out last time. Please remember today.", icon: "🧠" },
    { text: "Accurate working hours depend on manual checkouts.", icon: "📈" },
    { text: "We noticed an auto-checkout. Please try to check out manually.", icon: "🔍" },
    { text: "Keep your records accurate by checking out manually.", icon: "📋" },
    { text: "Auto-checkout is a backup, not the primary method. Remember to check out!", icon: "🛡️" },
    { text: "Let's make sure to hit that checkout button today.", icon: "🔘" },
    { text: "System auto-checkout performed yesterday. Have a productive day today!", icon: "🚀" }
  ],
  [CATEGORIES.SUNDAY]: [
    { text: "Enjoy your weekend and recharge for the week ahead.", icon: "☕" },
    { text: "Have a relaxing Sunday.", icon: "🛋️" },
    { text: "Sundays are for rest and reflection.", icon: "🧘" },
    { text: "Take it easy today. It's Sunday!", icon: "☀️" },
    { text: "Wishing you a peaceful and restful Sunday.", icon: "🕊️" },
    { text: "Recharge your batteries today.", icon: "🔋" },
    { text: "Enjoy a slow, easy Sunday.", icon: "🐢" },
    { text: "Make time for yourself this Sunday.", icon: "❤️" },
    { text: "Sunday vibes: Relax, Refresh, Reconnect.", icon: "🌊" },
    { text: "A Sunday well spent brings a week of content.", icon: "😊" },
    { text: "Take a deep breath and enjoy your Sunday.", icon: "🌬️" },
    { text: "Do something that makes your soul happy today.", icon: "🎵" },
    { text: "Sundays are perfect for doing absolutely nothing.", icon: "🛌" },
    { text: "Have a beautiful, lazy Sunday.", icon: "🌸" },
    { text: "Disconnect and enjoy your weekend.", icon: "🔌" },
    { text: "May your Sunday be full of sunshine and laughter.", icon: "🌞" },
    { text: "Rest up today so you can crush it tomorrow.", icon: "💪" },
    { text: "Enjoy the simple pleasures this Sunday.", icon: "🍰" },
    { text: "Wishing you a serene and joyful Sunday.", icon: "✨" },
    { text: "Take time to relax and enjoy the day.", icon: "🪴" }
  ],
  [CATEGORIES.GOVT_HOLIDAY]: [
    { text: "Happy Holiday! Wishing you a wonderful day.", icon: "🎉" },
    { text: "Enjoy the government holiday today!", icon: "🏛️" },
    { text: "Take time to celebrate and relax on this holiday.", icon: "🎊" },
    { text: "Wishing you a joyous and restful public holiday.", icon: "🌟" },
    { text: "Happy festivities! Enjoy your day off.", icon: "🎈" },
    { text: "A well-deserved holiday. Enjoy your time!", icon: "🍹" },
    { text: "Celebrate the spirit of the holiday today.", icon: "✨" },
    { text: "Wishing you a meaningful government holiday.", icon: "🙏" },
    { text: "Enjoy the celebrations and take it easy.", icon: "🥳" },
    { text: "Happy Public Holiday! Have a great day.", icon: "🎆" },
    { text: "Take a break and enjoy this special day.", icon: "🏖️" },
    { text: "May this holiday bring you joy and relaxation.", icon: "🌺" },
    { text: "Enjoy the festivities with your loved ones.", icon: "👨‍👩‍👧‍👦" },
    { text: "Wishing you a peaceful and happy holiday.", icon: "🕊️" },
    { text: "Celebrate safely and have a wonderful time.", icon: "🛡️" },
    { text: "Take advantage of this day off to unwind.", icon: "🧘" },
    { text: "Happy holidays! Enjoy the break from routine.", icon: "🔄" },
    { text: "Wishing you a fantastic government holiday.", icon: "🏆" },
    { text: "Have a memorable and joyous holiday today.", icon: "📸" },
    { text: "Enjoy the celebrations! Have a great day off.", icon: "🎈" }
  ],
  [CATEGORIES.OFFICE_HOLIDAY]: [
    { text: "Today is an office holiday. Enjoy your day!", icon: "🏢" },
    { text: "The office is closed, but our appreciation for you is always open.", icon: "❤️" },
    { text: "Enjoy this company holiday. You've earned it!", icon: "🎁" },
    { text: "Take a well-deserved break on this office holiday.", icon: "☕" },
    { text: "Company holiday today! Relax and recharge.", icon: "🔋" },
    { text: "Wishing you a fantastic day off from the team.", icon: "🤝" },
    { text: "Enjoy the downtime on this office holiday.", icon: "🛋️" },
    { text: "We hope you have a relaxing company holiday.", icon: "🌊" },
    { text: "Take this day to focus on yourself. Happy office holiday!", icon: "🧘" },
    { text: "Enjoy the break! See you back fresh and energized.", icon: "⚡" },
    { text: "Company holiday vibes. Have a great day!", icon: "🎵" },
    { text: "A day off just for our amazing team. Enjoy!", icon: "🌟" },
    { text: "Rest up! Happy office holiday to you.", icon: "😴" },
    { text: "Enjoy this special day off provided by the company.", icon: "🎉" },
    { text: "Take it easy and enjoy the office holiday.", icon: "😎" },
    { text: "Wishing you a wonderful day away from work.", icon: "🏖️" },
    { text: "Recharge your mind and body on this office holiday.", icon: "🧠" },
    { text: "Enjoy the break from the daily grind.", icon: "☕" },
    { text: "Happy company holiday! Have a wonderful time.", icon: "🎈" },
    { text: "Take a breather. Enjoy your office holiday!", icon: "🌬️" }
  ],
  [CATEGORIES.BIRTHDAY]: [
    { text: "Happy Birthday! Wishing you a fantastic year ahead.", icon: "🎂" },
    { text: "Enjoy your special day! Happy Birthday from the team.", icon: "🥳" },
    { text: "May all your wishes come true today. Happy Birthday!", icon: "✨" },
    { text: "Wishing you a day filled with joy and laughter.", icon: "🎈" },
    { text: "Happy Birthday! Here's to another year of success.", icon: "🥂" },
    { text: "Have a wonderful birthday celebration!", icon: "🎉" },
    { text: "Wishing you health, wealth, and happiness on your birthday.", icon: "🎁" },
    { text: "Happy Birthday! Hope your day is as amazing as you are.", icon: "🌟" },
    { text: "Celebrate yourself today. Happy Birthday!", icon: "🙌" },
    { text: "Wishing you a very Happy Birthday and a great year.", icon: "📅" },
    { text: "Happy Birthday! May your day be full of pleasant surprises.", icon: "🎊" },
    { text: "Enjoy every moment of your special day.", icon: "⏱️" },
    { text: "Happy Birthday! Thank you for all your hard work.", icon: "🙏" },
    { text: "Wishing you the happiest of birthdays today.", icon: "😊" },
    { text: "Happy Birthday! Hope you get spoiled today.", icon: "👑" },
    { text: "Have a brilliant birthday filled with fun.", icon: "🎠" },
    { text: "Wishing you a birthday that's just the beginning of a happy year.", icon: "🌅" },
    { text: "Happy Birthday! Enjoy your special day to the fullest.", icon: "💯" },
    { text: "Sending you warmest wishes on your birthday.", icon: "💌" },
    { text: "Happy Birthday! Let's celebrate your special day.", icon: "🍰" }
  ]
};

// Utility to get a random message from a category, preventing consecutive repeats in the session
export const getEventMotivation = (category) => {
  const messages = MESSAGES[category];
  if (!messages) return { text: "Have a great day!", icon: "🌟" };

  const sessionKey = `last_motivation_idx_${category}`;
  const lastIdx = parseInt(sessionStorage.getItem(sessionKey), 10);
  
  let newIdx = Math.floor(Math.random() * messages.length);
  
  // Prevent same message twice in a row if possible
  if (messages.length > 1 && newIdx === lastIdx) {
    newIdx = (newIdx + 1) % messages.length;
  }
  
  sessionStorage.setItem(sessionKey, newIdx);
  return messages[newIdx];
};

// Get the daily motivation, keeping it stable for the session
export const getDailyMotivation = (dayOfWeek, isGovtHoliday, isOfficeHoliday, isBirthday, hasAutoCheckout) => {
  const sessionKey = 'daily_motivation_cache';
  
  // Return cached message if it exists in this session
  const cached = sessionStorage.getItem(sessionKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // Ignored
    }
  }

  let category = CATEGORIES.DAILY_LOGIN;
  
  // Context aware prioritization
  if (isBirthday) {
    category = CATEGORIES.BIRTHDAY;
  } else if (hasAutoCheckout) {
    category = CATEGORIES.AUTO_CHECKOUT;
  } else if (isGovtHoliday) {
    category = CATEGORIES.GOVT_HOLIDAY;
  } else if (isOfficeHoliday) {
    category = CATEGORIES.OFFICE_HOLIDAY;
  } else if (dayOfWeek === 0) { // Sunday
    category = CATEGORIES.SUNDAY;
  }

  const message = getEventMotivation(category);
  
  // Cache for the session
  sessionStorage.setItem(sessionKey, JSON.stringify(message));
  
  return message;
};

export { CATEGORIES };
