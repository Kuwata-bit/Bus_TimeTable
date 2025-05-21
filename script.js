// ここにGoogleスプレッドシートから発行したCSVのURLを貼り付けてください
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQF1H6eCIEv3AJ23kdwKsYiO6X8V2XgTpHxLYNJE9CkympIW3ZTJm9q4qzQrWKAzOUwFR1fwrwX-lGv/pubhtml?gid=0&single=true';
// 時刻が記載されている列のインデックス (0から始まる。例: 最初の列なら0)
const TIME_COLUMN_INDEX = 0; // IMPORTHTMLで取得したデータに合わせて調整してください

// --- DOM要素の取得 ---
const currentTimeElement = document.getElementById('currentTime');
const nextBusTimeElement = document.getElementById('nextBusTime');
const countdownElement = document.getElementById('countdown');
const messageElement = document.getElementById('message');
const busStopNameElement = document.getElementById('bus-stop-name'); // 必要に応じて

// --- バス停名・行き先名を設定 ---
// 例: busStopNameElement.textContent = "近大高専前 発 → 名張駅東口 行き";
// IMPORTHTMLで取得した情報から動的に設定する場合は、CSVのパース部分で対応してください。


let timetable = []; // 時刻表データを格納する配列

// --- CSVデータを取得・解析する関数 ---
async function fetchTimetable() {
    try {
        const response = await fetch(SPREADSHEET_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        parseCSV(csvText);
        updateBusInfo(); // 初回更新
    } catch (error) {
        console.error('時刻表データの取得に失敗しました:', error);
        messageElement.textContent = '時刻表データの読み込みに失敗しました。';
    }
}

// --- CSVテキストを解析して時刻表配列を更新する関数 ---
function parseCSV(csvText) {
    timetable = []; // 初期化
    const rows = csvText.trim().split('\n');
    // ヘッダー行がある場合は i=1 から始めるなど調整してください
    for (let i = 0; i < rows.length; i++) {
        const columns = rows[i].split(',');
        if (columns.length > TIME_COLUMN_INDEX) {
            const timeString = columns[TIME_COLUMN_INDEX].trim().replace(/"/g, ''); // "08:30" のような形式
            // 正規表現で HH:MM 形式か確認
            if (/^\d{1,2}:\d{2}$/.test(timeString)) {
                timetable.push(timeString);
            }
        }
    }
    // 時刻を昇順にソート (念のため)
    timetable.sort((a, b) => {
        const [aHour, aMinute] = a.split(':').map(Number);
        const [bHour, bMinute] = b.split(':').map(Number);
        if (aHour !== bHour) {
            return aHour - bHour;
        }
        return aMinute - bMinute;
    });
    console.log('読み込んだ時刻表:', timetable);
}

// --- 現在時刻を更新・表示する関数 ---
function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    currentTimeElement.textContent = `${hours}:${minutes}:${seconds}`;
}

// --- 次のバスの情報を更新・表示する関数 ---
function updateBusInfo() {
    if (timetable.length === 0) {
        messageElement.textContent = '時刻表データがありません。';
        nextBusTimeElement.textContent = '--:--';
        countdownElement.textContent = '--分--秒';
        return;
    }

    const now = new Date();
    let nextBus = null;

    for (const timeStr of timetable) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const busDepartureTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

        if (busDepartureTime > now) {
            nextBus = busDepartureTime;
            break;
        }
    }

    if (nextBus) {
        const nextBusHours = String(nextBus.getHours()).padStart(2, '0');
        const nextBusMinutes = String(nextBus.getMinutes()).padStart(2, '0');
        nextBusTimeElement.textContent = `${nextBusHours}:${nextBusMinutes}`;
        messageElement.textContent = ''; // メッセージをクリア

        const diffMillis = nextBus.getTime() - now.getTime();
        const diffSecondsTotal = Math.floor(diffMillis / 1000);
        const diffMinutes = Math.floor(diffSecondsTotal / 60);
        const diffSeconds = diffSecondsTotal % 60;

        countdownElement.textContent = `${diffMinutes}分${diffSeconds}秒`;

    } else {
        nextBusTimeElement.textContent = '--:--';
        countdownElement.textContent = '--分--秒';
        messageElement.textContent = '本日のバスは終了しました。';
    }
}

// --- 初期化と定期更新 ---
// ページ読み込み時に時刻表を取得
fetchTimetable();

// 1秒ごとに現在時刻と次のバス情報を更新
setInterval(() => {
    updateCurrentTime();
    if (timetable.length > 0) { // 時刻表が読み込まれてから実行
        updateBusInfo();
    }
}, 1000);
