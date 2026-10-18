# 工程與工具鏈

Node >=24 ESM/built-ins；原生 HTML/CSS/JS，零 runtime、dev 外部依賴，無 npm install。正式安裝例 C:/Program Files/nodejs/node.exe 與 npm.cmd；不可修改 persistent PATH。產品核心是可測純函式，依 TECHNICAL.md 的固定 schema、錯誤順序與 output。UI 使用獨立 snapshot，任意改值立即 revision++/result=null；clipboard resolve/reject/finally 皆檢查 revision、request ID、page generation。

工具鏈提供 dev/test/check/build；preview dist/ 必須 noindex/nofollow。M2 增加 build:production/check:production/preview:production 與獨立 dist-production/，不覆寫 preview。check/build 完全離線；固定 allowlist、拒絕 symlink/junction/hardlink、未知檔案、path traversal、stale build 和非預期 public code；不掃描帳戶或兄弟資料夾。伺服器只 loopback、GET/HEAD、有正確 HTML/CSS/ESM/TXT/XML MIME、405/404、不 SPA fallback；port 衝突不停止別人服務，可印出 OS 配發實際 loopback port。

核心測試使用手寫預期值與獨立不變式；不可從被測函式產生 expected。每個錯誤不得留下 partial/stale output。schema 測試需包含 getter 未執行、extra/symbol/non-enumerable/sparse/noncanonical、最大邊界、非突變。瀏覽器各語言實際主流程、即時失效、清除取消/確認、鍵盤與320px；真機/原生限制分開標記。

工作前後用既有 $env:USERPROFILE/.codex/check-persistent-environment.ps1 記錄 HKCU/HKLM PATH hash/type/length/ephemeral count 與 full Environment fingerprint。只讀檢查；不可改 Windows persistent state。PowerShell 7 不把不相容 PSModulePath 傳入 Windows PowerShell 5.1。若不使用 dotnet 不安裝或呼叫；如獲獨立授權且使用暫時 DOTNET_CLI_HOME，首次前 process-local DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=0。

最後候選穩定後跑必要 npm test/check/build 各一次，修正後只重跑受影響 gate。固定 manifest 記每檔 bytes/SHA-256，排除自身避免循環。保留 task-owned 證據與不相關修改。
