# 技術規格：物品標籤列印

狀態：**規格，尚未實作。** Node.js 24+ ESM、原生瀏覽器 API 和 Node built-ins；不引入任何 runtime/dev/test package。共同工具鏈及安全約束見 docs/ENGINEERING.md、docs/PRIVACY-SECURITY.md。

## 模組責任

核心提供純函式 calculateLabels(request)。它只驗證輸入並回傳固定 JSON 資料；不讀 DOM、環境、檔案、網路、時鐘或儲存。瀏覽器層負責表單狀態、固定版型 class、預覽和使用者明確觸發的原生列印。

建議分層：

- public/js/core/label-printer.mjs：命名匯出 calculateLabels；可由 Node 測試和瀏覽器 ESM 同路徑載入。
- public/js/app.mjs：事件、revision、雙語固定錯誤文案、DOM 建立。
- public/js/render.mjs：以 element.textContent/value 建構預覽，不把名稱解讀成標記。
- public/index.html 與 public/en/index.html：繁中和英文入口。
- public/assets/app.css：所有四種版型 class 和列印樣式；不使用 inline style。
- test/label-printer.test.mjs：獨立手寫預期值與錯誤測試。

檔名是後續實作預期的工具專屬範圍；若主代理在 M1 指示調整，只能在同一 milestone 記錄，不得擴大到共用檔案。

## 純函式輸入

calculateLabels 接收一個精確根結構，僅含三個 own 欄位：

| 欄位 | 型別 | 規則 |
|---|---|---|
| itemsRaw | string | UTF-8 原始位元組最多 10240；可有 CRLF、CR、LF |
| copiesRaw | string | 最多 2 字元；標準 ASCII 整數 1–20，不接受前導零 |
| presetId | string | a4-2x7、a4-3x8、letter-2x7、letter-3x8 之一 |

拒絕 null、陣列、非普通物件、未知 own 欄位、symbol own key、non-enumerable own key、accessor 欄位及缺欄位。欄位必須是 own enumerable data property；檢查 descriptors 時不得呼叫 getter。反射檢查若拋例外，回固定 schema error。輸入物件不修改。不得遍歷或回傳非預期欄位。

### 字串處理順序

1. 確認 itemsRaw 是字串，並先拒絕孤立高／低 surrogate；避免 UTF-8 encoder 以替代字元掩蓋錯誤。
2. 以 UTF-8 原始位元組計算長度，超過 10240 回錯。此長度包含 CR、LF 和尾端空白，且在任何換行正規化前計算。
3. copiesRaw 和 presetId 按固定格式及 enum 驗證。
4. 把 CRLF、單獨 CR 轉成 LF；依 LF split。對每行套用 ECMAScript String.prototype.trim。用正規化後的原始行索引報告錯誤，索引從 0 開始；trim 後空行丟棄。
5. 對保留行按順序檢查 Unicode Cc 控制範圍 U+0000–001F、U+007F–009F；另拒絕 U+2028/U+2029 以確保一個清單行只成為一個標籤。名稱按 Unicode code points 計數，範圍 1–80。不得做 Unicode 正規化。
6. 若無保留名稱，回 no_items。
7. 計算 totalLabels = itemCount × copiesPerItem。大於 300 回 too_many_labels；不截斷、不產生部分頁面。
8. 根據固定版型展開和分頁，回傳成功結果。

copiesRaw 只接受正規式語義 ^(?:[1-9]|1[0-9]|20)$。因此 1 和 20 合法；0、21 是範圍錯誤；01、空字串、前後空白、+1、1.0、1e0、全形數字是格式錯誤。

## 固定版型幾何

方向皆為直向。紙張尺寸、頁邊和間隙皆以 mm 表示；columns × rows 的乘積是每頁容量。

| presetId | 紙張寬 × 高 | 欄 × 列 | 容量 | 格寬 × 高（內容區平均分格） |
|---|---:|---:|---:|---:|
| a4-2x7 | 210 × 297 | 2 × 7 | 14 | 94 × 265/7（約 37.857142857） |
| a4-3x8 | 210 × 297 | 3 × 8 | 24 | 62 × 32.875 |
| letter-2x7 | 215.9 × 279.4 | 2 × 7 | 14 | 96.95 × 247.4/7（約 35.342857143） |
| letter-3x8 | 215.9 × 279.4 | 3 × 8 | 24 | 191.9/3（約 63.966666667） × 30.675 |

計算式：內容寬 = 紙張寬 − 2×10 − (columns−1)×2；內容高 = 紙張高 − 2×10 − (rows−1)×2；格寬／高分別是內容寬／高除以欄／列。CSS grid 按固定 class 和這個可重現公式均分，不把浮點結果注入 style 屬性。每個版型使用預先宣告的命名 @page 規則、紙張 size 和 10mm margin；標籤間隔 2mm。列印引擎支援和實際縮放需真實瀏覽器／印表機確認，未測項標 NOT_RUN。

UI 只允許四個靜態 class 對應 preset：preset--a4-2x7、preset--a4-3x8、preset--letter-2x7、preset--letter-3x8。class selector 固定選取既有 @page 名稱與 grid 欄列；不得由輸入、DOM style 屬性或任意 CSS 值形成版型。

## 輸出與錯誤契約

成功物件頂層只有 ok、result，ok 為 true。result 僅有以下欄位，均可 JSON.stringify：

- presetId：輸入的四種固定 ID 之一。
- paperSize：A4 或 Letter。
- columns、rows、capacity：固定整數版型資料。
- itemCount、copiesPerItem、totalLabels、pageCount：已驗證的整數。
- pages：長度恰為 pageCount 的陣列。
- 每頁恰含 pageIndex 和 slots；pageIndex 從 0 開始，slots 長度恰等於 capacity。
- slots 由已 trim 的標籤文字或 null 組成；資料依名稱順序展開，每項副本相鄰。末頁未使用格為 null。

pageCount = ceil(totalLabels / capacity)。因空清單拒絕，成功頁數最少為 1。沒有 BigInt、undefined、Date、DOM 值、原始整份 itemsRaw 或額外欄位。標籤名稱本身會出現在成功預覽資料中，僅留在目前頁面 memory。

錯誤物件固定為 {ok:false,error:{code,field}}；不回 result、message、原始文字或例外。固定 code/field 如下：

| code | field | 條件 |
|---|---|---|
| invalid_schema | request | 根物件或 own 欄位結構不符 |
| invalid_items_type | itemsRaw | itemsRaw 不是字串 |
| invalid_unicode | itemsRaw | itemsRaw 含孤立 surrogate |
| items_too_large | itemsRaw | 原始 UTF-8 位元組 > 10240 |
| invalid_copies_format | copiesRaw | 非 canonical ASCII 整數字串或長度 > 2 |
| copies_out_of_range | copiesRaw | 合法整數語法但值不是 1–20 |
| invalid_preset | presetId | 非四種固定版型之一 |
| item_control_character | itemsRaw.lines[n] | 原始正規化行索引 n 有禁止字元 |
| item_too_long | itemsRaw.lines[n] | trim 後超過 80 code points |
| no_items | itemsRaw | 所有行 trim 後皆空 |
| too_many_labels | totalLabels | 展開總數大於 300 |

若同一輸入有多個錯誤，依以下順序只回第一個：root schema、itemsRaw 型別/Unicode/bytes、copiesRaw 格式/範圍、presetId、逐行內容、no_items、totalLabels。UI 對 totalLabels 錯誤顯示於表單摘要並關聯名稱和份數控制。固定本地化訊息不得拼入原始輸入。

## 展開演算法

依保留的名稱陣列逐項處理；每個名稱連續追加 copiesPerItem 次。再按 capacity 分組為 pages。每頁固定長度 capacity；最後一頁尾端補 null。相同名稱仍依原行數分別展開，不 deduplicate。整個計算同步、純函式且最多輸出 300 個文字格，不需 worker 或外部函式庫。

## 頁面生命週期

初始 UI 固定為 itemsRaw 空字串、copiesRaw 字串 1、presetId a4-2x7、result null。表單和所有工作按鈕初始 disabled，input 不設定 name。初始化先同步註冊 submit capture listener，listener 第一個動作是 preventDefault，再註冊其他事件。所有 listener 和初始狀態成功後才啟用控制；初始化失敗時維持 disabled。無 JavaScript 時沒有 GET 提交。

每次輸入或 preset 變更，同步增加 revision 並將 result 設為 null、隱藏預覽、停用列印。建立預覽只能在當下完整驗證成功後替換整體結果；失敗清空舊結果。列印按鈕讀取當前 revision 的成功結果，只能從明確 click handler 呼叫 window.print()。

有工作定義為 itemsRaw 非空、result 存在、copiesRaw 不等於字串「1」，或 presetId 不等於 a4-2x7；預設份數 1 本身不構成有工作。清除確認取消時保留原工作；確認時清空 textarea、預覽、錯誤和 revision 狀態，將 copiesRaw 重設為字串「1」、presetId 重設為 a4-2x7，回目前語言初始表單。若清單空、沒有結果且兩個設定都仍為預設值，不要求確認。語言切換依 UX-SEO.md 先確認清除，再導覽固定同源 URL。pagehide 清空原始欄位、結果與暫存引用；BFCache persisted pageshow 初始化為空白新 generation，不復原資料。頁面沒有 object URL、非同步 clipboard、下載連結或保存資料。

## 安全和離線界線

使用者文字一律透過 textContent/value 建立，不使用 innerHTML、eval、Function 或動態 style。沒有 fetch/XHR/beacon、storage、cookie、URL 資料、外部字型、service worker 或 telemetry。CSP、安全標頭、static server 和完整 Network/Storage gate 見 docs/PRIVACY-SECURITY.md、docs/ENGINEERING.md。

首次開頁仍要載入靜態資源。資源已載入的目前分頁可在記憶體運算；不承諾離線冷啟動或永久離線。HTTP preview 和正式 Hosting 的驗收依 docs/RELEASE.md；M0 不表示任何一項已執行。
