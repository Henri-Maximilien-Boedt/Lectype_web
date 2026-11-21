const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

let transport = null;

function useTransport(custom) {
  transport = custom;
}

async function sendWithBrevo(message) {
  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Lectype' },
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
    }),
  });
  if (!response.ok) throw new Error(`Brevo a répondu ${response.status}`);
}

function writeToConsole(message) {
  console.log(`\n--- E-mail (développement) ---\nÀ : ${message.to}\nObjet : ${message.subject}\n\n${message.text}\n------------------------------\n`);
}

async function deliver(message) {
  if (transport) return transport(message);
  if (process.env.BREVO_API_KEY) return sendWithBrevo(message);
  if (process.env.NODE_ENV === 'production') throw new Error('BREVO_API_KEY manque : e-mail non envoyé.');
  return writeToConsole(message);
}

function send(message) {
  deliver(message).catch((error) => console.error('Envoi d’e-mail impossible :', error.message));
}

module.exports = { send, useTransport };
