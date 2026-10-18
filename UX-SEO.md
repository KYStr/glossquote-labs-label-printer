# 使用者介面與 SEO 規格：物品標籤列印

狀態：**規格，尚未實作。** Surface mode：Product App。頁面讓使用者貼上名稱、選擇份數和普通紙版型，再核對可列印結果；不做通用 SaaS hero。

## 使用者流程

1. 初始為空白表單；使用者逐行貼上名稱，設定每個名稱相同的份數，選一種 A4 或 Letter 版型。
2. 看見清楚的 10 KiB、每行 80 字、份數 1–20、總標籤不超過 300 限制。
3. 按「建立預覽 / Build preview」。格式或數量錯誤時只顯示可修復錯誤，不產生部分頁面。
4. 核對標籤順序、副本分組、紙張、欄列、頁數和最後一頁空格。
5. 按「列印標籤 / Print labels」才呼叫原生列印；列印視窗選同一紙張、100% 縮放並關閉頁首頁尾。先用普通紙核對後裁切。
6. 初始預設為空名稱清單、每項份數 1、A4 2×7；任何輸入或版型改動都淘汰預覽，需重新建立。清除或切換語言按確認後回初始狀態。

頁面明說「一般紙張裁切用版型，並非特定預裁貼紙套版；瀏覽器或印表機可能改變實際尺寸」。原生列印和紙張尺寸若未實測，文件和 UI 不得稱已驗證。

## 桌面工作區草圖

    ┌────────────────────────────────────────────────────────────────────┐
    │ Gloss Tools / 物品標籤列印              English　返回繁中首頁       │
    ├────────────────────────────────────────────────────────────────────┤
    │ 物品標籤列印                                                       │
    │ 逐行貼上名稱，設定每項份數，排成普通紙標籤頁後列印裁切。           │
    │ 一般 A4 / Letter 紙；非預裁貼紙套版；輸入不保存。                  │
    │                                                                    │
    │ 物品名稱（每行一項）                                               │
    │ ┌──────────────────────────┐  每項份數 [ 1 ]                       │
    │ │                          │  1–20；同一份數套用到所有名稱。       │
    │ │ 貼上清單                 │                                      │
    │ └──────────────────────────┘                                      │
    │ 版型  (●) A4 2×7  ( ) A4 3×8  ( ) Letter 2×7  ( ) Letter 3×8      │
    │ [載入範例] [清除]                         [建立預覽]                │
    │                                                                    │
    │ 預覽：A4 2×7　3 個標籤　1 頁　（目前沒有預覽時顯示空狀態）          │
    │ ┌────────────────────────標籤頁─────────────────────────────────┐ │
    │ │ 物品 A       物品 A                                             │ │
    │ │ 物品 B       物品 B                                             │ │
    │ │ …            …                                                  │ │
    │ └────────────────────────────────────────────────────────────────┘ │
    │ 一般紙張、縮放 100%、關閉頁首頁尾；先試印並核對實際尺寸。           │
    │ [列印標籤]                                                         │
    └────────────────────────────────────────────────────────────────────┘

## 手機草圖（320 CSS px 起）

    ┌───────────────────────────┐
    │ 物品標籤列印       English│
    │ 返回繁中首頁              │
    │ 逐行貼名稱，設定每項份數。│
    │ 一般紙裁切；不是預裁套版。│
    │ 物品名稱（每行一項）      │
    │ ┌───────────────────────┐ │
    │ │                       │ │
    │ │ 貼上清單              │ │
    │ └───────────────────────┘ │
    │ 每項份數 [ 1 ]             │
    │ 版型 [A4 2×7          ▾]   │
    │ [載入範例] [清除]          │
    │ [建立預覽]                 │
    │ 頁面預覽（縮小）           │
    │ [列印標籤]                 │
    └───────────────────────────┘

手機預覽在自己的標示區域縮小顯示或捲動，不能迫使整頁水平捲動。表單、錯誤和操作仍在單欄可用；虛擬鍵盤或安全區不能遮住目前欄位和主要操作。手機系統列印能力取決於裝置，不做保證。

## 控制與狀態

- Header 只放工具名稱、語言切換和目前語言首頁連結。工作區使用 family tokens、平面表面和清楚分隔；紙張標籤頁是主要視覺對象。
- 名稱欄為多行 textarea；份數使用文字欄和 numeric input mode，讓核心驗證接受原始字串，不依瀏覽器 number 解析或自動修正。版型用有標籤的單選群組。
- 表單和工作按鈕初始 disabled 且輸入沒有 name；完成初始化並掛妥事件後才啟用。初始化失敗不允許提交或列印。名稱清單初始空白、份數為 1、版型為 A4 2×7。
- 預覽初始空白。範例是假資料，只能由明確按鈕載入，並且還要再按建立預覽。
- 錯誤文字就近顯示並關聯欄位；名稱行錯誤列出一基底可見行號，技術 field 保持零基底。IME 組字中不逐字顯示錯誤；按建立預覽時一次驗證。
- 建立預覽成功後才顯示列印按鈕。修改任何輸入立即隱藏預覽、清除錯誤狀態、停用列印。
- 「清除 / Clear」只在 itemsRaw 非空、已有預覽，或份數／版型不等於預設 1／A4 2×7 時先確認；預設份數 1 不會單獨觸發確認。取消保持表單和預覽；確認清單、預覽、錯誤清空，份數回 1、版型回 A4 2×7。
- 語言切換先提示會清除清單、設定和預覽；取消保留本頁，確認導到另一個固定同源語言網址並顯示初始預設表單。
- 每個名稱以純文字呈現；格子內換行、不得溢位。空格仍保留裁切邊界但沒有文字。最後一頁不複製任何項目填空。
- 列印樣式只顯示標籤頁及固定紙張內容；隱藏表單、按鈕和說明。列印呼叫只來自使用者明確點擊。

## 雙語 SEO 與固定可見文案

### 繁體中文頁

- Title：**物品標籤列印｜Gloss Tools by GlossQuote**
- Description：**逐行輸入物品名稱，設定每項份數，排成 A4 或 Letter 普通紙標籤頁，列印後手動裁切。**
- H1：**物品標籤列印**
- Intro：**把物品名稱逐行貼上，設定每個名稱要印幾份，選擇 A4 或 Letter 普通紙版型，建立預覽後列印裁切。**
- Notice：**這是普通紙裁切用版型，不是特定品牌預裁貼紙套版。瀏覽器、列印縮放和印表機可能影響實際尺寸。**
- 輸入提示：**每行一個名稱；空白行會略過。每個名稱使用相同份數，請輸入 1–20。每行最多 80 個 Unicode code points，全部展開最多 300 張標籤。**
- 主要操作：**建立預覽**
- 其他操作：**載入範例**、**清除**、**列印標籤**
- 預覽提示：**先核對名稱順序、每項份數、版型和頁數。最後一頁未用格會保持空白。**
- 列印提示：**請選擇相同紙張、縮放 100%，並關閉頁首頁尾。先用普通紙試印，量測後再裁切。**
- 資料提示：**輸入只在目前頁面處理，不會保存。第一次載入仍需下載網站檔案。**
- 清除確認：**清除會移除目前清單、設定和預覽。要清除嗎？** 按鈕：**清除**、**取消**
- 語言確認：**切換語言會清除目前清單、設定和預覽。要繼續嗎？** 按鈕：**清除並切換**、**留在此頁**

### English page

- Title: **Item Label Printer | Gloss Tools by GlossQuote**
- Description: **Enter one item name per line, choose copies per item, then arrange labels on A4 or Letter paper to print and cut by hand.**
- H1: **Item Label Printer**
- Intro: **Paste one item name per line, choose how many copies to print for each name, then build an A4 or Letter paper preview. Print it and cut the labels by hand.**
- Notice: **This layout is for labels printed on plain paper and cut by hand. It is not a template for a specific brand of pre-cut labels. Browser and printer settings can change the physical size.**
- Input help: **Enter one name per line; blank lines are skipped. The same copy count applies to every name. Enter 1–20 copies. Each name may use up to 80 Unicode code points; the expanded job is limited to 300 labels.**
- Primary action: **Build preview**
- Other actions: **Load example**, **Clear**, **Print labels**
- Preview help: **Check the name order, copies, preset and page count. Unused cells on the last page stay blank.**
- Print help: **Choose the matching paper, set scale to 100%, and turn off headers and footers. Test on plain paper and measure before cutting.**
- Data note: **Your input stays in this page and is not saved. The first load still downloads the website files.**
- Clear confirmation: **Clearing removes the current list, settings, and preview. Clear them now?** Buttons: **Clear**, **Cancel**
- Language confirmation: **Changing language clears the current list, settings, and preview. Continue?** Buttons: **Clear and switch**, **Stay here**

固定錯誤文案依 TECHNICAL.md code/field 對照實作，至少包含輸入超過 10 KiB、行名超過 80 字、無名稱、份數格式/範圍錯誤、未知版型、超過 300 張及無效 Unicode。錯誤不得顯示使用者原文或原始例外。

### 固定狀態與錯誤字串

只有 item_control_character 和 item_too_long 使用技術層零基底行索引，顯示時換算成一基底行號；其餘錯誤不插入行號或原始名稱。invalid_unicode 對應整份 itemsRaw 欄位，因此訊息不含行號。

| 狀態或 code | 繁體中文 | English |
|---|---|---|
| 初始空白 | 尚未建立預覽。貼上名稱並建立預覽後，標籤頁會顯示在這裡。 | No preview yet. Paste item names and build a preview to see the label pages here. |
| 預覽成功 | 預覽已建立：{totalLabels} 張標籤，共 {pageCount} 頁。 | Preview ready: {totalLabels} labels across {pageCount} pages. |
| invalid_schema | 無法讀取這份清單。請重新載入頁面後再試。 | The list could not be read. Reload the page and try again. |
| invalid_items_type | 清單格式無效。請重新貼上物品名稱。 | The list format is invalid. Paste the item names again. |
| invalid_unicode | 名稱清單含無法處理的 Unicode 字元。請修正後再試。 | The item list contains invalid Unicode. Correct the text and try again. |
| items_too_large | 清單超過 10 KiB。請縮短後再試。 | The list is larger than 10 KiB. Shorten it and try again. |
| invalid_copies_format | 請輸入 1–20 的整數，不含空白、小數或前導零。 | Enter a whole number from 1–20, without spaces, decimals, or leading zeros. |
| copies_out_of_range | 每項份數必須介於 1 到 20。 | Copies per item must be from 1 to 20. |
| invalid_preset | 請選擇四種支援版型之一。 | Choose one of the four supported presets. |
| item_control_character | 第 {line} 行含不支援的控制或行分隔字元。 | Line {line} contains an unsupported control character or line separator. |
| item_too_long | 第 {line} 行超過 80 個 Unicode code points。 | Line {line} is longer than 80 Unicode code points. |
| no_items | 請至少輸入一個物品名稱。 | Enter at least one item name. |
| too_many_labels | 展開後超過 300 張標籤。請減少名稱數或每項份數。 | The expanded job exceeds 300 labels. Reduce the number of names or copies per item. |

欄位錯誤與摘要使用 role=status/alert 等合適語意，不只靠顏色；焦點只在按預覽後有助修正時移動，不逐字打斷 IME 組字。

## FAQ（頁面與 JSON-LD 一致）

### 繁體中文

1. **每個名稱會印幾份？** 所有非空白行共用同一個份數；每個名稱的副本會連在一起，再排下一個名稱。
2. **這可以套用到預裁貼紙嗎？** 這是 A4 或 Letter 普通紙裁切用版型，不保證符合任何品牌或型號的預裁貼紙。
3. **怎麼讓實際尺寸更接近版面？** 列印時選擇相同紙張、縮放 100%、關閉頁首頁尾；印表機不可列印邊界仍可能影響結果，請先用普通紙量測。
4. **輸入清單會保存或上傳嗎？** 本版只在目前頁面記憶體處理，不保存或上傳；第一次開頁仍需下載網站靜態檔案。

### English

1. **How many copies are printed for each name?** One copy count applies to every nonblank line. Copies of one name are grouped together before the next name.
2. **Can I use this with pre-cut label sheets?** The presets are for labels printed on plain A4 or Letter paper and cut by hand. They are not calibrated for a specific pre-cut label brand or model.
3. **How can I keep the printed size close to the layout?** Select the matching paper, use 100% scale, and turn off headers and footers. Printer margins can still affect the result, so measure a plain-paper test first.
4. **Is my list saved or uploaded?** This version processes the list in the current page and does not save or upload it. The first page load still downloads static website files.

## SEO 與正式網址

- 正式候選 origin 為 https://labels.glossquote.com；只有 M2/M3 確認實際內容與發布後才可稱為正式網址。
- 繁中固定頁 /index.html，英文固定頁 /en/index.html。M1 preview 127.0.0.1:4210 和 build 必須 noindex,nofollow，不輸出正式 canonical 或 sitemap。
- M2 才加入兩頁 self-canonical、zh-Hant/en reciprocal hreflang、x-default 指向繁中頁和只列兩頁的 sitemap；404 不呈現工具成功內容。
- 首頁連結須分別使用 https://glossquote.com/index.html 和 https://glossquote.com/en/index.html。頁面語言和首頁語言須對應。
- M2 的 FAQPage/WebApplication JSON-LD 只能反映頁面可見問答和功能；不得加入評分、評論、紙張相容性保證、索引或流量承諾。
- robots.txt 不得封鎖必要資產；檢查實際 canonical response headers、meta 和繼承的 X-Robots-Tag。排名、流量和使用者數不是驗收指標。

## 品牌、無障礙與使用限制

依 docs/DESIGN-SYSTEM.md 的 Product App 模式與共用 tokens。預覽是工作的核心畫布；避免巢狀卡片、假圖表、遠端字體或宣傳 hero。320 CSS px 下不出現整頁水平捲動，200% 縮放保留功能。欄位有可見標籤，鍵盤可完成全流程，焦點可見，狀態不只靠顏色，觸控目標約 44×44 px，一般文字對比至少 4.5:1；尊重 prefers-reduced-motion。

不得宣稱適用所有印表機、預裁貼紙精準、尺寸保證、永久免費、永遠離線、資料已被從瀏覽器或列印佇列刪除、搜尋排名或使用量。
