const fs = require('fs');
const path = require('path');

const userLastAction = new Map();
const RATE_LIMIT_MS = 2000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS ? 
  process.env.ALLOWED_USER_IDS.split(',').map(id => parseInt(id.trim())) : 
  [];

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не установлен');
}

if (ALLOWED_USER_IDS.length === 0) {
  console.error('ALLOWED_USER_IDS не установлен или пуст');
}

async function sendMessage(chatId, text, parseMode = 'HTML') {
  try {
    if (!text || text.length > 4096) {
      text = text ? text.substring(0, 4090) + '...' : 'Пустое сообщение';
    }
    
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
      }),
    });
    
    if (!response.ok) {
      console.error('Ошибка отправки сообщения:', response.status, response.statusText);
    }
    
    return response.json();
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    return { ok: false, error: error.message };
  }
}

function checkRateLimit(userId) {
  const now = Date.now();
  const lastAction = userLastAction.get(userId);
  
  if (lastAction && (now - lastAction) < RATE_LIMIT_MS) {
    return false;
  }
  
  userLastAction.set(userId, now);
  return true;
}

function loadInfobase() {
  try {
    const infobasePath = path.join(process.cwd(), 'infobase.json');
    if (fs.existsSync(infobasePath)) {
      const data = fs.readFileSync(infobasePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Ошибка загрузки базы данных:', error);
    return [];
  }
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 1000);
}

function validateEntry(entry) {
  const errors = [];
  
  if (!entry.title || entry.title.length < 1) {
    errors.push('Название не может быть пустым');
  }
  
  if (entry.title && entry.title.length > 100) {
    errors.push('Название слишком длинное (максимум 100 символов)');
  }
  
  if (entry.info && entry.info.length > 2000) {
    errors.push('Информация слишком длинная (максимум 2000 символов)');
  }
  
  if (entry.img && entry.img.length > 500) {
    errors.push('Поле изображений слишком длинное (максимум 500 символов)');
  }
  
  return errors;
}

function saveInfobase(data) {
  try {
    if (!Array.isArray(data)) {
      throw new Error('Данные должны быть массивом');
    }
    
    if (data.length > 1000) {
      throw new Error('Слишком много записей (максимум 1000)');
    }
    
    const sanitizedData = data.map(entry => ({
      title: sanitizeInput(entry.title || ''),
      date: sanitizeInput(entry.date || ''),
      pin: entry.pin === 'y' ? 'y' : 'n',
      info: sanitizeInput(entry.info || ''),
      img: sanitizeInput(entry.img || '')
    }));
    
    const infobaseJsonPath = path.join(process.cwd(), 'infobase.json');
    const infobaseJsPath = path.join(process.cwd(), 'infobase.js');
    
    fs.writeFileSync(infobaseJsonPath, JSON.stringify(sanitizedData, null, 2), 'utf8');
    
    const jsContent = `const infobase = ${JSON.stringify(sanitizedData, null, 2)};`;
    fs.writeFileSync(infobaseJsPath, jsContent, 'utf8');
    
    return true;
  } catch (error) {
    console.error('Ошибка сохранения базы данных:', error);
    return false;
  }
}

function formatEntryInfo(entry) {
  return `
<b>${entry.title || 'Без названия'}</b>
Дата: ${entry.date || 'Не указана'}
Закреплено: ${entry.pin === 'y' ? 'Да' : 'Нет'}

<b>Информация:</b>
${entry.info || 'Нет информации'}

<b>Изображения:</b> ${entry.img || 'Нет изображений'}
`;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!TELEGRAM_BOT_TOKEN || ALLOWED_USER_IDS.length === 0) {
    console.error('Переменные окружения не настроены');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  try {
    if (!event.body || event.body.length > 10000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request body' }),
      };
    }

    const update = JSON.parse(event.body);
    
    if (!update.message) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok' }),
      };
    }

    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';

    if (!ALLOWED_USER_IDS.includes(userId)) {
      console.log(`Неавторизованная попытка доступа от пользователя: ${userId}`);
      await sendMessage(chatId, "❌ У вас нет доступа к этому боту");
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'unauthorized' }),
      };
    }

    if (!checkRateLimit(userId)) {
      await sendMessage(chatId, "⏱️ Слишком частые запросы. Подождите немного.");
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'rate_limited' }),
      };
    }

    if (text.startsWith('/start')) {
      const helpText = `
🤖 <b>Бот для управления базой данных</b>

<b>Команды:</b>
/list - показать все записи
/add - добавить новую запись
/delete [номер] - удалить запись
/help - показать эту справку

<b>Формат добавления записи:</b>
/add
Название: Имя человека
Дата: 26.11.2024
Закреплено: y
Номер: +7 999 123 45 67
ФИО: Иванов Иван Иванович
Почта: example@mail.ru
Изображения: ссылка1,ссылка2
`;
      await sendMessage(chatId, helpText);
    }
    
    else if (text.startsWith('/list')) {
      const infobase = loadInfobase();
      if (infobase.length === 0) {
        await sendMessage(chatId, "📝 База данных пуста");
      } else {
        for (let i = 0; i < infobase.length; i++) {
          const entryText = `<b>#${i + 1}</b>\n` + formatEntryInfo(infobase[i]);
          await sendMessage(chatId, entryText);
        }
      }
    }
    
    else if (text.startsWith('/add')) {
      const addInstructions = `
📝 <b>Добавление новой записи</b>

Отправьте следующим сообщением данные в формате:

Название: Имя человека
Дата: 26.11.2024
Закреплено: y
Номер: +7 999 123 45 67
ФИО: Иванов Иван Иванович
Почта: example@mail.ru
Изображения: ссылка1,ссылка2

<i>Каждый параметр с новой строки!</i>
`;
      await sendMessage(chatId, addInstructions);
    }
    
    else if (text.startsWith('/delete')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        await sendMessage(chatId, "❌ Укажите номер записи: /delete 1");
      } else {
        try {
          const index = parseInt(parts[1]) - 1;
          const infobase = loadInfobase();
          
          if (index >= 0 && index < infobase.length) {
            const deletedEntry = infobase.splice(index, 1)[0];
            if (saveInfobase(infobase)) {
              await sendMessage(chatId, `✅ Запись '${deletedEntry.title || 'Без названия'}' удалена`);
            } else {
              await sendMessage(chatId, "❌ Ошибка при сохранении");
            }
          } else {
            await sendMessage(chatId, "❌ Запись с таким номером не найдена");
          }
        } catch (error) {
          await sendMessage(chatId, "❌ Неверный номер записи");
        }
      }
    }
    
    else if (text.startsWith('/help')) {
      const helpText = `
🤖 <b>Справка по командам</b>

/list - показать все записи
/add - добавить новую запись  
/delete [номер] - удалить запись
/help - показать справку
`;
      await sendMessage(chatId, helpText);
    }
    
    else if (!text.startsWith('/')) {
      if (text.includes('Название:') || text.includes('ФИО:') || text.includes('Номер:')) {
        try {
          const lines = text.trim().split('\n');
          const newEntry = {
            title: '',
            date: '',
            pin: 'n',
            info: '',
            img: ''
          };
          
          const infoParts = [];
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('Название:')) {
              newEntry.title = trimmedLine.replace('Название:', '').trim();
            } else if (trimmedLine.startsWith('Дата:')) {
              newEntry.date = trimmedLine.replace('Дата:', '').trim();
            } else if (trimmedLine.startsWith('Закреплено:')) {
              const pinValue = trimmedLine.replace('Закреплено:', '').trim().toLowerCase();
              newEntry.pin = ['y', 'да', 'yes'].includes(pinValue) ? 'y' : 'n';
            } else if (trimmedLine.startsWith('Изображения:')) {
              newEntry.img = trimmedLine.replace('Изображения:', '').trim();
            } else if (trimmedLine.startsWith('Номер:') || 
                      trimmedLine.startsWith('ФИО:') || 
                      trimmedLine.startsWith('Почта:') || 
                      trimmedLine.startsWith('Адрес:') || 
                      trimmedLine.startsWith('Соцсети:')) {
              infoParts.push(trimmedLine);
            } else if (trimmedLine && !trimmedLine.startsWith('Название:') && 
                      !trimmedLine.startsWith('Дата:') && 
                      !trimmedLine.startsWith('Закреплено:') && 
                      !trimmedLine.startsWith('Изображения:')) {
              infoParts.push(trimmedLine);
            }
          }
          
          newEntry.info = infoParts.join('\n');
          
          const validationErrors = validateEntry(newEntry);
          if (validationErrors.length > 0) {
            await sendMessage(chatId, `❌ Ошибки валидации:\n${validationErrors.join('\n')}`);
            return {
              statusCode: 200,
              body: JSON.stringify({ status: 'validation_error' }),
            };
          }
          
          const infobase = loadInfobase();
          
          if (infobase.length >= 1000) {
            await sendMessage(chatId, "❌ Достигнут лимит записей (1000). Удалите старые записи.");
            return {
              statusCode: 200,
              body: JSON.stringify({ status: 'limit_reached' }),
            };
          }
          
          infobase.push(newEntry);
          
          if (saveInfobase(infobase)) {
            await sendMessage(chatId, `✅ Запись '${sanitizeInput(newEntry.title)}' добавлена в базу данных!`);
          } else {
            await sendMessage(chatId, "❌ Ошибка при сохранении записи");
          }
          
        } catch (error) {
          console.error('Ошибка при добавлении записи:', error);
          await sendMessage(chatId, `❌ Ошибка при добавлении записи: ${error.message}`);
        }
      } else {
        await sendMessage(chatId, "❌ Неизвестная команда. Используйте /help для справки");
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' }),
    };

  } catch (error) {
    console.error('Ошибка обработки webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
