// script.js

// === DOM要素の取得 ===
const currentTimeElement = document.getElementById('currentTime');
const nextBusTimeElement = document.getElementById('nextBusTime');
const countdownElement = document.getElementById('countdown');
const messageElement = document.getElementById('message');
// const busStopNameElement = document.getElementById('bus-stop-name'); // 必要に応じて

// === CSV時刻表ベースの機能のための定数・変数 ===
// ここにGoogleスプレッドシートから発行したCSVのURLを貼り付けてください
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQF1H6eCIEv3AJ23kdwKsYiO6X8V2XgTpHxLYNJE9CkympIW3ZTJm9q4qzQrWKAzOUwFR1fwrwX-lGv/pub?gid=0&single=true&output=csv'; // ← GoogleスプレッドシートのCSV公開URL
// 時刻が記載されている列のインデックス (0から始まる。例: 最初の列なら0)
const TIME_COLUMN_INDEX = 0; // IMPORTHTMLで取得したデータに合わせて調整してください
let timetable = []; // CSV時刻表データを格納する配列

// === GTFS-RT (リアルタイムバス位置情報) のための定数・変数 ===
let GtfsRealtimeFeedMessage = null; // プロトコルバッファのメッセージ型を格納

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★ ここに、あなたが確認した `iga_vpos_update_v2.bin` への正しいURLを貼り付けてください ★
// ★ (例: 'https://bus-vision.jp/sanco/realtime/iga_vpos_update_v2.bin')         ★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
const GTFS_RT_VEHICLE_POSITIONS_URL = 'http://133.242.167.84:3000/busdata'; // ← 必ず正しいURLに置き換えてください！


// === 共通機能 ===

/**
 * 現在時刻を更新・表示する関数
 */
function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    if (currentTimeElement) { // 要素が存在するか確認
        currentTimeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

// === CSV時刻表ベースの次のバス表示機能 ===

/**
 * CSVデータを取得・解析する関数 (Googleスプレッドシート用)
 */
async function fetchTimetable() {
    if (!SPREADSHEET_URL || SPREADSHEET_URL === 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQF1H6eCIEv3AJ23kdwKsYiO6X8V2XgTpHxLYNJE9CkympIW3ZTJm9q4qzQrWKAzOUwFR1fwrwX-lGv/pub?output=csv') {
        console.warn("スプレッドシートURLが設定されていません。静的時刻表機能は動作しません。");
        if (messageElement) messageElement.textContent = '静的時刻表のURL未設定';
        return;
    }
    try {
        if (messageElement) messageElement.textContent = '時刻表データを読み込み中...';
        const response = await fetch(SPREADSHEET_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        parseCSV(csvText);
        updateBusInfo(); // 初回更新
    } catch (error) {
        console.error('静的時刻表データの取得に失敗しました:', error);
        if (messageElement) messageElement.textContent = '静的時刻表データの読み込みに失敗しました。';
    }
}

/**
 * CSVテキストを解析して時刻表配列を更新する関数
 */
function parseCSV(csvText) {
    timetable = [];
    const rows = csvText.trim().split('\n');
    for (let i = 0; i < rows.length; i++) {
        const rowString = rows[i].trim();
        if (rowString === "") continue;

        const columns = rowString.split(',');
        if (columns.length > TIME_COLUMN_INDEX) {
            const timeString = columns[TIME_COLUMN_INDEX].trim().replace(/"/g, '');
            if (/^\d{1,2}:\d{2}$/.test(timeString)) {
                timetable.push(timeString);
            } else {
                // console.warn(`Skipping invalid time format in CSV: '${timeString}' from row: '${rowString}'`);
            }
        }
    }
    timetable.sort((a, b) => {
        const [aHour, aMinute] = a.split(':').map(Number);
        const [bHour, bMinute] = b.split(':').map(Number);
        if (aHour !== bHour) return aHour - bHour;
        return aMinute - bMinute;
    });
    // console.log('読み込んだ静的時刻表:', timetable);
}

/**
 * 次のバスの情報を更新・表示する関数 (CSV時刻表ベース)
 */
function updateBusInfo() {
    if (!timetable || timetable.length === 0) {
        // fetchTimetable内でメッセージ表示されるので、ここでは不要な場合も
        // if (messageElement && messageElement.textContent.includes('読み込み中')) {
        //     messageElement.textContent = '静的時刻表データがありません。';
        // }
        if (nextBusTimeElement) nextBusTimeElement.textContent = '--:--';
        if (countdownElement) countdownElement.textContent = '--分--秒';
        return;
    }

    const now = new Date();
    let nextBus = null;
    let foundNextBus = false;

    for (const timeStr of timetable) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;
        const busDepartureTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

        if (busDepartureTime > now) {
            nextBus = busDepartureTime;
            foundNextBus = true;
            break;
        }
    }

    if (foundNextBus && nextBus) {
        const nextBusHours = String(nextBus.getHours()).padStart(2, '0');
        const nextBusMinutes = String(nextBus.getMinutes()).padStart(2, '0');
        if (nextBusTimeElement) nextBusTimeElement.textContent = `${nextBusHours}:${nextBusMinutes}`;
        if (messageElement && messageElement.textContent.includes('時刻表') || messageElement.textContent.includes('取得中')) {
             messageElement.textContent = ''; // 以前のメッセージをクリア
        }


        const diffMillis = nextBus.getTime() - now.getTime();
        const diffSecondsTotal = Math.max(0, Math.floor(diffMillis / 1000));
        const diffMinutes = Math.floor(diffSecondsTotal / 60);
        const diffSeconds = diffSecondsTotal % 60;

        if (countdownElement) countdownElement.textContent = `${diffMinutes}分${diffSeconds}秒`;

    } else {
        if (nextBusTimeElement) nextBusTimeElement.textContent = '--:--';
        if (countdownElement) countdownElement.textContent = '--分--秒';
        if (messageElement && timetable.length > 0) { // 時刻表はあるがバスがない場合
            // GTFS-RTのメッセージで上書きされる可能性があるので、ここではメッセージを更新しないか、条件を絞る
            // messageElement.textContent = '本日のバスは終了しました。（静的時刻表）';
        }
    }
}


// === GTFS-RT リアルタイムバス位置情報機能 ===

/**
 * .proto定義ファイルを読み込み、GTFS-RTのメッセージ型を初期化する関数
 */
async function initializeGtfsRealtime() {
    try {
        const root = await protobuf.load("gtfs-realtime.proto"); // index.htmlと同じ階層にgtfs-realtime.protoを置く
        GtfsRealtimeFeedMessage = root.lookupType("transit_realtime.FeedMessage");
        console.log("GTFS-RT .proto定義の読み込み成功！");
        if (messageElement) messageElement.textContent = "リアルタイム定義読み込み完了。";

        // 定義ファイルが読み込めたら、最初のリアルタイムデータ取得を試みる
        fetchAndProcessRealtimeBusData();

    } catch (error) {
        console.error("GTFS-RT .proto定義の読み込みに失敗しました:", error);
        if (messageElement) messageElement.textContent = "リアルタイムデータの定義読み込みに失敗しました。";
    }
}

/**
 * GTFS-RTのVehiclePositionデータ(.binファイル)を取得し、解析してコンソールに出力する関数
 */
async function fetchAndProcessRealtimeBusData() {
    if (!GtfsRealtimeFeedMessage) {
        console.error("GTFS-RTのFeedMessage型が初期化されていません。");
        if (messageElement) messageElement.textContent = "リアルタイムデータ形式の準備ができていません。";
        return;
    }
    if (!GTFS_RT_VEHICLE_POSITIONS_URL || GTFS_RT_VEHICLE_POSITIONS_URL === 'https://bus-vision.jp/realtime/iga_vpos_update_v2.bin') {
        console.warn("GTFS-RTのURLが設定されていません。リアルタイムバス機能は動作しません。");
        if (messageElement) messageElement.textContent = 'リアルタイムデータのURL未設定';
        return;
    }

    console.log(`リアルタイムバス位置情報を取得中: ${GTFS_RT_VEHICLE_POSITIONS_URL}`);
    if (messageElement) messageElement.textContent = "バス位置情報を取得中...";

    try {
        const response = await fetch(GTFS_RT_VEHICLE_POSITIONS_URL, { cache: 'no-cache', mode: 'cors' }); // cache: 'no-cache' を追加
        if (!response.ok) {
            throw new Error(`リアルタイム情報の取得に失敗しました: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        const feedMessage = GtfsRealtimeFeedMessage.decode(uint8Array);

        console.log("GTFS-RTデータのデコード成功！");
        console.log("生データ:", feedMessage); // ★★★ デコードされたデータ全体です ★★★

        if (messageElement) messageElement.textContent = "バス位置情報を取得・解析しました。";

        if (feedMessage.entity && feedMessage.entity.length > 0) {
            console.log(`含まれるエンティティ数: ${feedMessage.entity.length}`);
            let vehicleFound = false;
            feedMessage.entity.forEach((entity, index) => {
                if (entity.vehicle) { // VehiclePositionデータのみを対象とする
                    vehicleFound = true;
                    console.log(`エンティティ ${index} (車両ID ${entity.id}):`, entity.vehicle);
                    // 例: entity.vehicle.trip.routeId, entity.vehicle.position.latitude などが出力されます
                }
            });
            if (!vehicleFound && messageElement) {
                 messageElement.textContent = "現在、追跡可能なバス情報はありません。(エンティティ内に車両情報なし)";
            }
        } else {
            console.log("GTFS-RTフィードにエンティティが含まれていません。");
            if (messageElement) messageElement.textContent = "現在、運行中のバス情報はありません。(エンティティなし)";
        }

        // ここで feedMessage を使って路線図上のバスアイコンを更新する処理を将来追加します (ステップ3以降)

    } catch (error) {
        console.error("リアルタイムバス位置情報の取得または解析中にエラー:", error);
        if (messageElement) messageElement.textContent = `バス位置情報エラー: ${error.message}現在解決にむけて絶賛奮闘中`;
    }
}

// === 初期化処理 ===

// ページ読み込み時の処理をまとめる
function initializeApp() {
    // バス停名・行き先名を設定 (必要であれば)
    // const busStopNameSpan = document.getElementById('bus-stop-name');
    // if (busStopNameSpan) busStopNameSpan.textContent = "近大高専前"; // 例

    updateCurrentTime(); // まず現在時刻を表示
    fetchTimetable();    // CSVベースの時刻表を取得・表示開始
    
    initializeGtfsRealtime(); // GTFS-RTの初期化と最初のデータ取得開始

    // 定期的な更新処理
    setInterval(updateCurrentTime, 1000); // 現在時刻は毎秒更新
    setInterval(updateBusInfo, 1000);     // CSVベースの次のバス情報も毎秒更新 (必要に応じて間隔調整)

    // GTFS-RTデータを定期的に取得する場合 (例: 30秒ごと)
    // 注意：initializeGtfsRealtime() の中で初回の fetchAndProcessRealtimeBusData() が呼ばれます。
    // 定期実行は、最初のデータ取得と表示がうまくいくことを確認してから有効にしましょう。
    // setInterval(fetchAndProcessRealtimeBusData, 30000); // 30秒
}

// DOMが完全に読み込まれたらアプリケーションを初期化
document.addEventListener('DOMContentLoaded', initializeApp);
