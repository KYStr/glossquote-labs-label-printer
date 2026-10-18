# 物品標籤列印發布契約

M1 只本機，preview noindex,nofollow。主代理明確通過固定 M1 才放行 M2；一次 milestone，未通過不得越級。

M2 原功能對話建立 production 工具鏈：固定 origin https://labels.glossquote.com；兩語 canonical /index.html 和 /en/index.html；reciprocal hreflang zh-Hant/en/x-default（fallback中文）；title/description/OG/WebApplication JSON-LD 內容須與實際功能一致。robots允許正式索引，sitemap只列兩個canonical，preview仍封鎖。404無工具成功頁、無SPA fallback。所有 headers/allowlist/static MIME 明確可測。production local model 127.0.0.1:5210。

沿用家族已審核 static-assets-only Wrangler 配置：worker glossquote-label-printer，custom domain labels.glossquote.com，assets.directory=./dist-production，html_handling=none、not_found_handling=404-page，workers_dev=false、preview_urls=false、send_metrics=false、observability/logs/traces=false；沒有Worker script、binding、database、secret、遙測或runtime package。M2 只配置，不呼叫Cloudflare、不裝CLI、不讀token。正式標頭由 _headers 提供，JSON-LD用精確 CSP hash。

公開來源必須在 reviewed publishing copy（只本工具）進行。repo public KYStr/glossquote-labs-label-printer，branch前綴codex/。不得包含 .runs、node_modules、秘密、帳戶資料、其他工具、使用者輸入。先讀 GIT-PUBLICATION-SAFETY.md。用專案 tool-projects/scripts/git-settings-guard.mjs 在發布前 capture、之後 verify，證據在根 .runs 自己的唯一目錄；該 guard 只讀 known config fingerprints，不輸出值。若 standalone checkout 尚無 guard，由主代理提供已審核副本，不能省略或自行搜尋憑證。

禁止 gh auth setup-git/login/refresh、git config --global/--system 寫入、變更使用者gitconfig、讀token、authtrace。既有CLI身份可正常發布；必要 helper 只 per-command git -c 且不寫持久設定。缺認證停並回報。清除child-process GIT_TRACE*/GIT_CURL_VERBOSE/GH_DEBUG 等debug選項，不改persistent環境。

M2 驗證公開visibility、remote commit、來源ZIP由固定git commit archive產生、每檔與git blob一致、SHA256/bytes、在乾淨副本跑必要test/check/build/production gates，產物與候選相符。所有命令exit和未驗項目寫HANDOFF，原始完整trace不得打包。

M3 由主代理驗收 M2 後，使用已授權 reviewed loader 免費部署，驗兩語live body/headers/SEO/404與核心流程，再把 catalog draft 轉published，重建/驗證/公開首頁來源/部署首頁/驗兩語入口。僅source push或local catalog更新不算發布。這裡的權限不含付費、040141.xyz、GlossGate、擴token權限。

交付標 awaiting-external-review；保留真機/完整NetworkStorage/原生未驗，不以HTTP/模擬替代。外部回報回原對話修正，主代理重驗、重發後，需外部確認才完成版本。

## 已知發布錯誤的回歸要求

robots不得封鎖頁面需要的JS/CSS；測試需對所有資產實際套用allow/disallow的最長匹配，不僅找文字。Cloudflare _headers規則會合併：若全站設X-Robots-Tag:noindex，兩個正式canonical路徑必須先用 ! X-Robots-Tag 移除繼承值，再依政策設定；不得產生同時noindex和index。HTML meta正式index,follow，非canonical／404維持noindex，sitemap只兩頁。以上必須有實際header模型與SEO測試。

來源ZIP請優先直接git archive HEAD，根目錄就是package.json（沒有頂層包裝資料夾）；若必要有prefix必須完整回報，不能讓主驗猜測。正式工具鏈需提供本機HTTP模型，效仿Cloudflare但如實標示並非正式站驗收。發布後狀態註記不改已固定commit及ZIP，最新來源識別獨立記錄。
