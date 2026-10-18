# 里程碑任務：物品標籤列印

狀態：M0 六份產品規格已寫，待主代理審查；沒有產品實作、測試、公開來源或部署。每個 gate 要記實際命令、exit code、測試與 NOT_RUN 證據；本表不是通過紀錄。全域規則見 [AGENTS.md](AGENTS.md)、[TASK-ENTRY.md](TASK-ENTRY.md)、[docs/ENGINEERING.md](docs/ENGINEERING.md)、[docs/PRIVACY-SECURITY.md](docs/PRIVACY-SECURITY.md)、[docs/RELEASE.md](docs/RELEASE.md)、[docs/GIT-PUBLICATION-SAFETY.md](docs/GIT-PUBLICATION-SAFETY.md)。

## M0 — 自包含規格

- [x] 說清楚普通紙逐行標籤、每項共同份數、四個固定版型和非目標。
- [x] 寫明輸入上限、文字處理、展開、分頁、精確純函式 API、錯誤契約。
- [x] 記錄中英介面、桌機/手機草圖、SEO、離線與實際列印界線。
- [x] 定義至少 12 個可手算核心 oracle 和瀏覽器 gate。
- [ ] 主代理審查六份規格並放行原功能對話。
- [ ] 原功能對話按已審規格實作；requested model 為 gpt-6.1-sol/max，不能用自述代替 backend identity 證據。

M0 僅允許更新 README.md、PRODUCT.md、TECHNICAL.md、UX-SEO.md、ACCEPTANCE.md、TASKS.md 六檔。本階段不建產品程式、不跑產品測試、不開對話、不發布、不部署、不改共用文件。完成主審前各項保持未放行。

## M1 — 完整本機產品

本機預覽 127.0.0.1:4210，Node 24+ ESM/built-ins，無套件，noindex/nofollow；核心只作本機同步運算。

### T00 — 規格與安全起點

- 確認主代理 M1 放行，重讀本工具六份規格及適用 docs；查明允許路徑和無同路徑衝突。
- 在本工具允許 evidence 子目錄記錄唯一 task id、Node/npm 版本及 process-environment guard 前後指紋。此產品不呼叫 dotnet；不得為方便更動 persistent Windows/Git 設定。
- 沒有開始前證據前不得安裝套件、跑長時間測試或啟動 server。

### T01 — 純核心與輸入驗證

- 實作 TECHNICAL.md 的 calculateLabels(request)，含 exact schema、驗證順序、固定錯誤、頁數、slot 展開和輸入不突變。
- 將 C01–C24 轉成離線 node:test；所有成功 slots 和錯誤都是獨立手寫 expected，不可由被測函式生成。
- 特別驗 10240/10241 UTF-8 bytes、80/81 code points、20/21 copies、300/301 labels、CRLF/CR/LF、空行、重複名稱、surrogate 和控制字元。
- Gate：成功輸出 JSON 可序列化、錯誤無 partial result/raw echo、每頁容量正確、300 張上限不截斷。

### T02 — 繁中/英文本機工作流程

- 建立兩語空白 UI、textarea、份數、四個選項、欄位錯誤、範例和清除確認；遵守 UX-SEO 固定文案。
- 先註冊同步 submit capture preventDefault，再接妥其餘 listener；所有 fieldset 和工作按鈕初始 disabled、input 無 name；初始化全成功後才 enable。
- 實際走完兩語空白初始態、貼上、錯誤修復、範例、重複項目與每項副本、取消/確認清除、語言切換取消/確認、修改失效和新預覽。
- Gate：B01–B05、B08–B10、B12–B13、B16 中可在現有瀏覽器觀察的內容；缺一語主要流程即停止 M1。

### T03 — 固定網格、分頁和列印 CSS

- 用四個固定 preset class 與預先宣告 CSS 設定表現 A4/Letter 紙張，頁邊 10mm、格距 2mm，不產生 inline style。
- 驗證標籤依名稱順序各自連續 copies 份、固定容量 paginate、末頁空格不填入重複名稱；80 code point 名稱在格內換行。
- 建立預覽後才允許明確 click 呼叫原生 window.print；列印畫面只顯示標籤頁。
- Gate：C01–C09、C23–C24 和 B02–B07。原生 print preview 或實體紙張無可用設備時保留 NOT_RUN，不用測試 stub 冒充。

### T04 — 工具鏈、隱私與無障礙

- 依 docs/ENGINEERING.md 建立離線 test/check/build、固定 source allowlist、MIME/HTTP/404、loopback 預覽 4210 和 noindex/no-follow build。
- 依 docs/PRIVACY-SECURITY.md 和 PRODUCT.md 驗 CSP、安全標頭、純文字呈現、無 storage/網路資料提交/URL/console 使用者內容、pagehide 清除。
- 實測 320 CSS px、200% zoom、keyboard/focus、兩語長字串、錯誤關聯、手機單欄與減少動態效果；無真機能力則只把真機項目標 NOT_RUN。
- Gate：B08–B13、B16 以及全 offline checks；完整 Network/Storage 無觀測能力時明列限制。

### T05 — M1 整合候選

- 最後候選固定後跑 node --version、npm test、npm run check、npm run build 各一次；preview 只能 bind 127.0.0.1:4210。
- 執行 C01–C24、所有可用的 B01–B16，記下自動、實際 browser 和 NOT_RUN 狀態，不能把文件 oracle 當通過證據。
- 依工程契約產生 allowlist/manifest；保存有界 evidence，不收集完整 trace、使用者資料或憑證。
- 更新允許的本工具 HANDOFF.md、START-HERE.md、project.json、TASK-ENTRY.md、docs/RELEASE-CANDIDATE.md 狀態紀錄；可由 build 產生 dist。不得改共用或其他工具。
- M1 放行條件：核心和兩語主要流程通過，所有必要輸入/版型邊界正確，安全/隱私無未解問題；原生紙張/真機/完整網路儲存觀察依能力標 NOT_RUN；主代理明確書面放行才可開始 M2。

## M2 — 主代理 GO 後 production 工具鏈與來源發布

- 啟動條件：主代理明確放行固定 M1 候選；仍使用原功能對話。沒有放行不得推進或發布。
- 加入 production canonical、雙語 hreflang/x-default、正式 robots/sitemap、headers/404 和 127.0.0.1:5210 本機 production-like HTTP model。
- 新增 npm run release:check；release/check/build 離線。production build 只輸出 dist-production/，不得改寫 preview public/ 或 dist/。
- 僅在 reviewed publishing copy 發布 KYStr/glossquote-labs-label-printer；先後使用 docs/GIT-PUBLICATION-SAFETY.md 要求的 Git settings guard，逐項驗 remote visibility、commit、ZIP 根目錄及檔案 hash、乾淨副本 gates。
- 不讀憑證、不改 global/system Git 或 persistent environment、不呼叫 Cloudflare、不讀 token。缺認證或守衛失敗就停並留下實際錯誤。
- Gate：release:check、test/check/build、production HTTP/SEO/404、安全 headers、乾淨副本、public repo/commit/ZIP 全部有實際證據；等主代理驗收。來源公開不等於網站已部署。

## M3 — 主代理部署和首頁整合

- 只由主代理在 M2 獨立放行後處理。以已授權免費 Cloudflare 流程部署至 labels.glossquote.com，驗證兩語真實 HTTP body、headers、SEO、404 和核心操作。
- live release 驗證後，主代理將雙語首頁 catalog draft 改為 published、重建和發布共用首頁並驗兩語入口及 matching-language 回鏈。
- 記錄 source commit、實際 hosting、首頁狀態和 NOT_RUN；不可把本機模型、source push 或文件規格當 live 驗證。
- 交付為 awaiting external review；外部意見回原功能對話修正。外部未確認前不能標版本 complete。

## 每個 gate 的紀錄欄位

記錄候選識別、實際允許路徑、命令與 exit code、手寫 oracle 結果、雙語 browser 證據、print preview/實體列印是否 NOT_RUN 及原因、Network/Storage 能力、主代理放行、來源與 hosting 狀態。mock、靜態掃描、聊天摘要和本規格的預期值都不能代替實際測試。
