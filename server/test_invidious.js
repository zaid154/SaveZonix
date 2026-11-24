async function testInvidious() {
  const vid = 'L8XYCkfamfE';
  const instances = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://invidious.protokolla.fi',
    'https://yt.artemislena.eu',
    'https://invidious.private.coffee',
    'https://invidious.perennialte.ch'
  ];
  for (const inst of instances) {
    try {
      console.log('Testing', inst);
      const res = await fetch(inst + '/api/v1/videos/' + vid + '?fields=title,adaptiveFormats,formatStreams', {
        headers: { 'User-Agent': 'SaveZonix/2.5' },
        signal: AbortSignal.timeout(5000)
      });
      console.log(inst, 'Status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('SUCCESS with', inst);
        console.log('Title:', data.title);
        console.log('adaptiveFormats count:', data.adaptiveFormats?.length);
        console.log('formatStreams count:', data.formatStreams?.length);
        const stream = data.formatStreams?.[0] || data.adaptiveFormats?.find(f => f.resolution?.includes('1080') || f.qualityLabel?.includes('1080'));
        console.log('Sample stream url:', stream?.url ? stream.url.slice(0, 80) + '...' : 'NONE');
        return data;
      }
    } catch (e) {
      console.log(inst, 'Failed:', e.message);
    }
  }
}
testInvidious();
