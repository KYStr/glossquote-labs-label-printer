# 驗收案例：物品標籤列印

狀態：**規格案例，尚未執行。** 下列預期是固定手算 oracle，不由被測函式推導。M0 寫下預期值不代表實作已通過。規則見 [PRODUCT.md](PRODUCT.md) 與 [TECHNICAL.md](TECHNICAL.md)，操作和文案見 [UX-SEO.md](UX-SEO.md)，工程證據依本工具 docs/ENGINEERING.md。

## 固定核心案例

成功結果比較完整 presetId、paperSize、columns、rows、capacity、計數、頁數及每頁 slots；null 表示空格。每頁 slots 必須剛好等於容量。錯誤比較完整 ok/code/field，確認無 result、message 或 raw echo。

| ID | 精確輸入 | 預期 |
|---|---|---|
| C01 | itemsRaw 為「箱子」，copiesRaw=1，presetId=a4-2x7 | 成功；itemCount=1、copiesPerItem=1、totalLabels=1、pageCount=1、capacity=14；page 0 slots 前一格為「箱子」，其後 13 格 null。 |
| C02 | itemsRaw 為「 A \r\nA\r B \n \t \n」，copiesRaw=2，presetId=letter-3x8 | 換行正規化、trim、空白行忽略；保留名稱依序 A、A、B；slots 前六格是 A,A,A,A,B,B，接著 18 格 null；itemCount=3、totalLabels=6、pageCount=1。 |
| C03 | itemsRaw 為「X\nY」，copiesRaw=3，presetId=a4-3x8 | 每名稱副本相鄰；slots 前六格為 X,X,X,Y,Y,Y，其後 18 格 null；itemCount=2、totalLabels=6、capacity=24。 |
| C04 | itemsRaw 為 N01 至 N14 共 14 行，copiesRaw=1，presetId=a4-2x7 | totalLabels=14、pageCount=1；slots 依序 N01…N14，無 null。 |
| C05 | itemsRaw 為 N01 至 N15 共 15 行，copiesRaw=1，presetId=a4-2x7 | totalLabels=15、pageCount=2；第一頁 14 項，第二頁第一格 N15、其後 13 格 null；不得在第一頁重複名稱。 |
| C06 | itemsRaw 為 N01 至 N25 共 25 行，copiesRaw=1，presetId=letter-3x8 | capacity=24、pageCount=2；第二頁第一格 N25，其後 23 格 null；paperSize=Letter、columns=3、rows=8。 |
| C07 | itemsRaw 有 15 個單字母名稱，copiesRaw=20，presetId=a4-2x7 | totalLabels=300、pageCount=22；每個字母連續 20 格。第 22 頁有 6 個標籤，後 8 格 null。 |
| C08 | itemsRaw 為 N001 至 N301 共 301 行，copiesRaw=1，presetId=letter-2x7 | 錯誤 too_many_labels、field=totalLabels；無 pages，不回傳前 300 項。 |
| C09 | itemsRaw=Z，copiesRaw=20 與 copiesRaw=1 分別呼叫，presetId=a4-2x7 | 兩次皆成功；copies=20 時 totalLabels=20、pageCount=2，第一頁 14 個 Z、第二頁 6 個 Z 加 8 個 null；copies=1 時 totalLabels=1。 |
| C10 | copiesRaw 依序為 0、21、空字串、01、1.0、+1、前後空白的 1、1e0、全形 １；其他欄合法 | 0、21 回 copies_out_of_range/copiesRaw；其餘回 invalid_copies_format/copiesRaw。 |
| C11 | 126 行，每行恰 80 個 ASCII x，行間各一個 LF，末尾再加 35 個 LF；copiesRaw=1、presetId=a4-2x7 | 原始 UTF-8 大小恰 10240 bytes；成功、itemCount=126、totalLabels=126、pageCount=9；尾端空行忽略。 |
| C12 | 與 C11 相同，但末尾改加 36 個 LF | 原始大小 10241 bytes；items_too_large/itemsRaw，沒有結果。 |
| C13 | itemsRaw 為 80 個 😀 code point，copies=1、a4-2x7 | 成功；名稱長度按 code point 算 80（雖然 UTF-16 code unit 數為 160），輸出文字逐字保留。 |
| C14 | itemsRaw 為 81 個 ASCII x，其餘合法 | item_too_long/itemsRaw.lines[0]；沒有部分結果。 |
| C15 | itemsRaw 依序測「貨」+ U+0009 TAB +「物」、含 U+0085 NEXT LINE、含 U+2028 LINE SEPARATOR；其餘合法 | 各自回 item_control_character/itemsRaw.lines[0]；不把控制或行分隔字元當成名稱排版。 |
| C16 | itemsRaw 為單一 U+D800 高 surrogate，其餘合法 | invalid_unicode/itemsRaw；不先用 UTF-8 替代字元編碼，不 echo 原始值。 |
| C17 | itemsRaw 只有空格、tab、CRLF，copiesRaw=1、presetId=a4-2x7 | no_items/itemsRaw；不能產生空白列印頁。 |
| C18 | itemsRaw=「箱」，copiesRaw=1，presetId=legal-4x4 | invalid_preset/presetId。 |
| C19 | 根物件加 enumerable own 欄位 debug，值為含敏感文字的假字串 | invalid_schema/request；沒有 result，也不回顯 debug。 |
| C20 | 根 itemsRaw 為 enumerable getter；getter 內將計數加一 | invalid_schema/request；getter 呼叫次數為 0。相同 schema gate 另測 symbol own key、non-enumerable extra、accessor 和缺欄位。 |
| C21 | 成功呼叫後 JSON.stringify/parse result，並深比對呼叫前後 request | 成功序列化，JSON 結構相同，request 未改變；沒有 BigInt、undefined 或不在固定 schema 內欄位。 |
| C22 | itemsRaw 為「`<img src=x onerror=alert(1)>`」，copies=1，preset=a4-2x7 | 成功；slot 文字與輸入相同。瀏覽器以純文字顯示，不建立 img 元素、不執行事件。 |
| C23 | 輸入分別使用 a4-2x7、a4-3x8、letter-2x7、letter-3x8，各一標籤 | preset 映射依序為 (A4,2,7,14)、(A4,3,8,24)、(Letter,2,7,14)、(Letter,3,8,24)；全部頁邊 10mm、間隙 2mm。 |
| C24 | 四版型按 TECHNICAL.md 尺寸公式計格 | A4 2×7 格 94×265/7 mm；A4 3×8 格 62×32.875 mm；Letter 2×7 格 96.95×247.4/7 mm；Letter 3×8 格 191.9/3×30.675 mm。 |

## 瀏覽器和使用環境案例

M1 使用 127.0.0.1:4210，只用假物品名稱。兩種語言各自實際走過主要流程；原生列印、完整 Network/Storage 和真機能力如未取得需逐項記 NOT_RUN。mock 對話框不能冒充原生列印或已列印紙張。

| ID | 可重現操作 | 預期 |
|---|---|---|
| B01 | 初次載入繁中，再載入 /en/index.html | 兩頁各自清單空白、份數為 1、預設版型 A4 2×7，不預填或自動列印；輸入和工作按鈕初始 disabled、input 沒有 name；初始化與事件註冊完成才啟用。 |
| B02 | 在兩語各輸入兩個名稱、copies=2、選 A4 2×7，按建立預覽 | 兩語結果同為四格名稱按 X,X,Y,Y 排列；正確顯示一頁和 A4 2×7；只有明確點擊列印按鈕才呼叫原生 print。 |
| B03 | 建立成功預覽後改名稱、份數或 preset 任一項 | 同一事件循環清除預覽並停用列印；不能列印舊版型或舊名稱。重新建立成功後才啟用列印。 |
| B04 | 初始預設清單空白、份數 1、A4 2×7 時按清除；再分別只改份數為 2、只改版型為 Letter 2×7，測清除確認的取消與確認；最後建立有資料的預覽再測一次取消/確認 | 初始預設不出現確認；份數或版型單獨非預設時會確認，取消保留設定、確認重設份數 1 和 A4 2×7；有清單/預覽時取消保留完整工作，確認後清單清空、預覽移除並回預設。 |
| B05 | 有清單時切換語言，先取消再確認 | 取消保留原頁資料；確認後導至固定同源另一語言頁，清單和預覽清空、份數為 1、版型回 A4 2×7。URL 不含使用者名稱。 |
| B06 | 15 個名稱選 A4 2×7，建立預覽 | 可見 2 頁；第 2 頁只一個名稱和 13 個空白格。空格只有裁切邊界，沒有重複文字。 |
| B07 | 輸入 80 個中英文混合字元或一段不含空格的長名稱 | 名稱在格內換行，不覆蓋相鄰格、不改變頁數或網格；若實際列印截斷，記阻止驗收並修正。 |
| B08 | 320 CSS px、200% 縮放、只用鍵盤操作完整輸入、選版型、預覽及列印 | 表單在單欄可完成；頁面操作不被遮住，紙張預覽在自己的區域縮放/捲動；沒有整頁水平捲動；focus 可見。 |
| B09 | 輸入與 C22 相同的惡意標記字串、建立預覽後查看頁面 | 僅顯示原始純文字，不建立 img node 或執行程式；不進 URL、console 或網路 payload。 |
| B10 | 先讓頁面完整載入，再在離線模式輸入並建立預覽；另測冷啟動離線 | 已載入分頁能本機運算；冷啟動離線能力不承諾。不得用 service worker 或隱藏快取改變規格。 |
| B11 | DevTools 觀察載入、輸入、預覽和清除的 Network/Storage | 只允許靜態同源初次載入；不傳物品名稱、不寫 storage/cookie/cache/service worker/URL。完整觀測能力不足時記 NOT_RUN。 |
| B12 | 關閉 JavaScript 後載入頁面，嘗試 submit | 只能閱讀用途說明；工作控制 disabled，沒有 GET、query string 或假的成功預覽。 |
| B13 | 按清除和語言切換各自取消/確認，檢查 pagehide/BFCache 返回 | 取消保持內容；確認清除後為空白。pagehide 清除目前記憶體工作，BFCache 返回空白；無 object URL、下載或剪貼簿狀態。 |
| B14 | 逐一查看四版型的實際瀏覽器 print preview，後用 A4/Letter 普通紙各試印 | 瀏覽器預覽需顯示正確頁數和所選紙張；量測 10mm 邊界、2mm 格距和列印縮放。若沒有可用印表機或瀏覽器列印環境，這一項及原生紙張精度標 NOT_RUN，不得用 mock 代替。 |
| B15 | 低階或慢速裝置以 300 個標籤建立預覽 | 上限內完成且互動可恢復；若無真機量測記 NOT_RUN，不能聲稱所有裝置效能。 |
| B16 | 本機 HTTP 檢查兩語 SEO 和 assets | M1 兩頁 noindex,nofollow；沒有 production canonical、sitemap 或遠端字型；頁面語言和 matching-language 首頁連結正確。 |

## M1 必要 gate 與未驗項目

- C01–C24 核心案例都轉成離線 Node 測試，預期值獨立手寫；產品改動後只重跑受影響 gate。
- B01–B10、B12–B13、B16 中可由現有瀏覽器環境完成的部分必須實測，且繁中和英文主要流程都要通過。
- 原生瀏覽器 print preview、實體紙張、真機/慢機、完整 Network/Storage 未實際觀察時逐項 NOT_RUN；mock 不可冒充原生結果。CSP、headers、HTTP 模型按 docs/ENGINEERING.md 和 docs/PRIVACY-SECURITY.md 驗收。
- M0 文件和 oracle 沒有執行實作、測試、真機列印、正式 SEO、公開來源或部署。
