const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

async function authenticate() {
  const credentials = await readFile('./gCredentials.json');
  const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  let token;
  try {
    token = await readFile('./gToken.json');
    oAuth2Client.setCredentials(JSON.parse(token));
  } catch (err) {
    token = await getAccessToken(oAuth2Client);
  }
  return oAuth2Client;
}

async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
  });

  console.log('Authorize this app by visiting this url:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      resolve(code);
    });
  });

  const token = await new Promise((resolve, reject) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        return reject(err);
      }
      oAuth2Client.setCredentials(token);
      writeFile('./gToken.json', JSON.stringify(token))
        .then(() => {
          console.log('Token stored to', './gToken.json');
          resolve(token);
        })
        .catch((err) => reject(err));
    });
  });

  return token;
}

async function getPlaylistVideos(auth, playlistId) {
  const youtube = google.youtube({
    version: 'v3',
    auth,
  });

  let nextPageToken = null;
  let allVideos = [];

  do {
    const response = await youtube.playlistItems.list({
      part: 'snippet',
      playlistId: playlistId,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    const videos = response.data.items;

    if (videos) {
      allVideos = allVideos.concat(videos);
    }

    nextPageToken = response.data.nextPageToken;
  } while (nextPageToken);

  return allVideos;
}

async function replacePlaylistTitles(auth, playlistId, newTitles) {
  const youtube = google.youtube({
    version: 'v3',
    auth,
  });

  for (let i = 0; i < playlistId.length; i++) {
    const videoId = playlistId[i];
    const newTitle = newTitles[i];

    await youtube.videos.update({
      part: 'snippet',
      resource: {
        id: videoId,
        snippet: {          
          title: newTitle,
          categoryId: 20,
        },
      },
    });

    console.log(`Title updated for video ID ${videoId}`);
  }
}

(async () => {
  const auth = await authenticate();

  // ID da playlist
  const playlistId = ''; // Substitua pelo ID da sua playlist

  // Obter vídeos da playlist
  const playlistVideos = await getPlaylistVideos(auth, playlistId);

  // Extrair IDs dos vídeos e títulos atuais
  const videoIds = playlistVideos.map((video) => video.snippet.resourceId.videoId);
  const currentTitles = playlistVideos.map((video) => video.snippet.title);

  // Novos títulos
  const newTitles = currentTitles.map((title) => ``); // Coloque os novos titulos dos videos aqui
  
  // Substituir títulos
  await replacePlaylistTitles(auth, videoIds, newTitles);
})();
