const WEBHOOK_URL = 'https://discord.com/api/webhooks/1470028326914621636/TwsKOqyFG01TfE2siqNdRe740xhmjkgZl65wmyfn3DI07toQqiWgv_N-zpACP3-Htw9W';

export async function envoyerAnnonceDiscord({ titre, message, mentionEveryone = false }) {
  const contenu = mentionEveryone ? '@everyone' : '';

  const embed = {
    title: titre,
    description: message,
    color: 0xd97706, // amber-600
    footer: {
      text: 'Duels de Cave'
    },
    timestamp: new Date().toISOString()
  };

  const body = {
    content: contenu,
    embeds: [embed]
  };

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur Discord (${response.status}): ${text}`);
  }

  return true;
}
