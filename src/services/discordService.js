const WEBHOOK_URL = 'https://discord.com/api/webhooks/1470028326914621636/TwsKOqyFG01TfE2siqNdRe740xhmjkgZl65wmyfn3DI07toQqiWgv_N-zpACP3-Htw9W';

export async function envoyerAnnonceDiscord({ titre, message, mentionEveryone = false, imageBlob = null }) {
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

  // Si une image est jointe, l'afficher dans l'embed
  if (imageBlob) {
    embed.image = { url: 'attachment://image.png' };
  }

  const payload = {
    content: contenu,
    embeds: [embed]
  };

  let response;

  if (imageBlob) {
    // Envoi multipart avec fichier
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(payload));
    formData.append('files[0]', imageBlob, 'image.png');

    response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      body: formData
    });
  } else {
    // Envoi JSON classique
    response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur Discord (${response.status}): ${text}`);
  }

  return true;
}
